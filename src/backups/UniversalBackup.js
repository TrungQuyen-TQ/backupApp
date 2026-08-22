import fs from "fs";
import path from "path";
import { Client as SshClient } from "ssh2";
import { Client as PgClient } from "pg";
import mysql from "mysql2/promise";
import { MongoClient } from "mongodb";
import mssql from "mssql";
import { getZipPassword } from "../utils/configHelper.js";

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

// --- CÁC HÀM LẤY THỐNG KÊ CHI TIẾT ---
async function getPgStats(client) {
  const res = await client.query("SELECT version();");
  const version = res.rows[0].version.split(" ")[1];
  
  // Lấy danh sách các bảng và số dòng ước tính (nhanh hơn COUNT(*) cho Postgres)
  const statsRes = await client.query(`
    SELECT relname AS table_name, n_live_tup AS row_count
    FROM pg_stat_user_tables
  `);
  
  let rowCounts = {};
  statsRes.rows.forEach(row => {
    rowCounts[row.table_name] = row.row_count;
  });

  return { shortVersion: version, rowCounts };
}

async function getMysqlStats(connection, dbName) {
  const [versionRows] = await connection.query("SELECT VERSION() as version");
  const shortVersion = versionRows[0].version;

  const [tables] = await connection.query(`
    SELECT TABLE_NAME, TABLE_ROWS 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
  `, [dbName]);

  let rowCounts = {};
  for (const row of tables) {
    rowCounts[row.TABLE_NAME] = row.TABLE_ROWS || 0;
  }
  return { shortVersion, rowCounts };
}

async function getMongoStats(client, dbName) {
  const db = client.db(dbName);
  const collections = await db.listCollections().toArray();
  const admin = db.admin();
  const info = await admin.serverStatus();
  
  let rowCounts = {};
  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    rowCounts[col.name] = count;
  }
  return { shortVersion: info.version, rowCounts };
}

async function getSqlServerStats(pool) {
  const versionRaw = await pool.request().query("SELECT @@VERSION as version");
  const shortVersion = versionRaw.recordset[0].version.split("-")[0].split("\n")[0].trim();

  const tablesQuery = await pool.request().query(`
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME NOT LIKE 'sys%'
  `);

  const allTables = tablesQuery.recordset.map((row) => row.TABLE_NAME);
  let rowCounts = {};
  for (const table of allTables) {
    try {
      const result = await pool.request().query(`SELECT COUNT(*) as count FROM [${table}]`);
      rowCounts[table] = result.recordset[0].count;
    } catch (err) {
      rowCounts[table] = "N/A";
    }
  }
  return { shortVersion, rowCounts };
}

// --- HÀM THỰC THI SSH ---
// --- HÀM THỰC THI SSH (BẢN FIX ĐỢI NÉN FILE LỚN) ---
export async function executeSshBackup(sshConfig, transferConfig, mainCommand, onProgress, onSshReady) {
  return new Promise((resolve) => {
    const ssh = new SshClient();
    let isClosed = false;

    // 1. Lấy thông tin kết nối
    const { host, port, username, password } = sshConfig;

    // 2. Thiết lập bộ điều khiển dừng (Stop Controller)
    if (onSshReady) {
      onSshReady({
        stop: async () => {
          isClosed = true;
          try {
            if (ssh._sock && ssh._sock.writable) {
              const cleanupCmd = `rm -f ${transferConfig.remoteZipFile} ${transferConfig.remoteZipFile.replace('.7z', '.*')}`;
              ssh.exec(cleanupCmd, () => { ssh.end(); });
            } else {
              ssh.end();
            }
          } catch (e) {
            ssh.end();
          }
        }
      });
    }

    ssh.on("ready", () => {
      onProgress("Đang thực thi lệnh Backup & Nén trên Server...", 40);
      console.log(">>> [SSH Ready] Executing Command Pipeline...");

      ssh.exec(mainCommand, (err, stream) => {
        if (err) {
          ssh.end();
          return resolve({ success: false, error: "Lỗi khởi tạo lệnh SSH: " + err.message });
        }

        let stderr = "";
        
        // Theo dõi luồng lỗi/cảnh báo
        stream.stderr.on("data", (data) => {
          const msg = data.toString();
          stderr += msg;
          // Lưu ý: MySQL Warning sẽ xuất hiện ở đây, ta chỉ log ra để theo dõi
          console.log(">>> [SERVER LOG]:", msg.trim());
        });

        // Theo dõi luồng phản hồi chuẩn
        stream.on("data", (data) => {
          console.log(">>> [SERVER STDOUT]:", data.toString().trim());
        });

        // QUAN TRỌNG NHẤT: Đợi sự kiện 'close' - nghĩa là Bash đã chạy xong script
        stream.on("close", (code) => {
          console.log(">>> [SERVER] Pipeline finished with code:", code);
          
          if (isClosed) return;

          // Nếu code khác 0 và không phải là warning vô hại
          if (code !== 0 && !stderr.includes("Using a password on the command line interface can be insecure")) {
            ssh.end();
            return resolve({
              success: false,
              error: `Lỗi thực thi trên Server (Code ${code}): ${stderr || "Thất bại không rõ nguyên nhân"}`
            });
          }

          // 3. Tiến hành SFTP sau khi chắc chắn nén xong
          onProgress("Nén thành công. Đang tải file về máy local...", 70);

          ssh.sftp((err, sftp) => {
            if (err || isClosed) {
              ssh.end();
              return resolve({ success: false, error: "Lỗi khởi tạo SFTP: " + (err ? err.message : "Bị hủy") });
            }

            console.log(">>> [SFTP] Downloading:", transferConfig.remoteZipFile);

            sftp.fastGet(transferConfig.remoteZipFile, transferConfig.localPath, {
              // Cấu hình tải file lớn ổn định
              chunkSize: 64 * 1024,
              concurrency: 4
            }, (dlErr) => {
              if (dlErr) {
                ssh.end();
                return resolve({ success: false, error: "Lỗi truyền tải SFTP: " + dlErr.message });
              }

              // 4. Kiểm tra dung lượng file đã tải về máy local
              try {
                if (!fs.existsSync(transferConfig.localPath) || fs.statSync(transferConfig.localPath).size === 0) {
                  ssh.end();
                  return resolve({
                    success: false,
                    error: "Lỗi truyền tải SFTP: File tải về máy local có dung lượng 0 bytes! Vui lòng kiểm tra quyền truy cập thư mục tạm trên Server."
                  });
                }
              } catch (statErr) {
                ssh.end();
                return resolve({ success: false, error: "Lỗi kiểm tra file sau khi tải: " + statErr.message });
              }

              // 5. Dọn dẹp server
              onProgress("Đang dọn dẹp file tạm trên Server...", 95);
              sftp.unlink(transferConfig.remoteZipFile, (unlinkErr) => {
                if (unlinkErr) console.warn(">>> [SFTP] Không thể xóa file tạm:", unlinkErr.message);
                ssh.end();
                resolve({ success: true, path: transferConfig.localPath });
              });
            });
          });
        });
      });
    })
    .on("error", (err) => {
      resolve({ success: false, error: "Không thể kết nối SSH: " + err.message });
    })
    .connect({
      host: host,
      port: Number(port) || 22,
      username: username,
      password: password,
      readyTimeout: 999999,      // Đợi nén file 2.1GB
      keepaliveInterval: 10000,  // Giữ kết nối SSH luôn sống
      keepaliveCountMax: 100
    });
  });
}

// --- HÀM CHÍNH ---
export async function universalBackupHandler(formData, event, onSshReady) {
  const sendProgress = (msg, percent) => event && event.sender.send("backup-progress", { message: msg, progress: percent });

  // 1. Khởi tạo và chuẩn bị biến
  sendProgress("Đang khởi tạo kết nối...", 5);
  const timestamp = Date.now();
  const dbName = formData.database;
  const dbType = formData.dbType.toLowerCase();
  const baseName = `backup_${dbType}_${dbName}_${timestamp}`;
  const localPath = path.join(formData.localPath, `${baseName}.7z`);

  // 2. Lấy mật khẩu Zip
  const zipPass = getZipPassword();

  const safeZipPass = shellQuote(zipPass);
  const transferConfig = { remoteZipFile: `/tmp/${baseName}.7z`, localPath };
  let dbStats = { shortVersion: "N/A", rowCounts: {} };
  let mainCommand = "";

  // 3. Logic xử lý lệnh theo loại Database
  if (dbType === "postgresql" || dbType === "postgres") {
    const remoteFile = `/tmp/${baseName}.sql`;
    // Sử dụng nháy đơn cho mật khẩu như logic bản cũ để an toàn nhất
    mainCommand = `export PGPASSWORD='${formData.dbPassword}' && pg_dump -h localhost -U "${formData.dbUser}" -d "${dbName}" -f "${remoteFile}" && 7za a -mx1 -p${safeZipPass} -mhe=on "${transferConfig.remoteZipFile}" "${remoteFile}" && chmod 644 "${transferConfig.remoteZipFile}" && rm -f "${remoteFile}"`;
    try {
      const pg = new PgClient({ host: formData.server, user: formData.dbUser, password: formData.dbPassword, database: dbName, port: formData.dbPort || 5432 });
      await pg.connect(); dbStats = await getPgStats(pg); await pg.end();
    } catch (e) { }
  }
  else if (dbType === "mysql") {
    const remoteFile = `/tmp/${baseName}.sql`; 
    const scriptFile = `/tmp/run_mysql_${timestamp}.sh`;
    
    const safeDbPassMySQL = shellQuote(formData.dbPassword || "");
    const safeZipPassMySQL = shellQuote(zipPass || "admin123");

    // Script tối ưu: Kiểm tra file tồn tại trước khi nén và ghi log lỗi ra file riêng
    const scriptContent = `
#!/bin/bash
mysqldump -h localhost -u "${formData.dbUser}" -p${safeDbPassMySQL} --column-statistics=0 --skip-lock-tables "${dbName}" > "${remoteFile}" 2> /tmp/dump_error.log
if [ -f "${remoteFile}" ]; then
  # Chạy nén với quyền ưu tiên, ghi log ra /tmp/zip_log.txt
  7za a -mx1 -p${safeZipPassMySQL} -mhe=on "${transferConfig.remoteZipFile}" "${remoteFile}" > /tmp/zip_log.txt 2>&1
  if [ $? -eq 0 ] && [ -f "${transferConfig.remoteZipFile}" ]; then
    chmod 644 "${transferConfig.remoteZipFile}"
    rm -f "${remoteFile}"
  fi
fi
rm -f "${scriptFile}"
    `.trim();

    mainCommand = `echo ${shellQuote(scriptContent)} > ${scriptFile} && chmod +x ${scriptFile} && bash ${scriptFile}`;
    
    console.log(">>> MySQL Hardened Script Mode Active");

    try {
      const connection = await mysql.createConnection({
        host: formData.server,
        user: formData.dbUser,
        password: formData.dbPassword,
        database: dbName,
        port: Number(formData.dbPort) || 3306,
      });
      dbStats = await getMysqlStats(connection, dbName); 
      await connection.end();
    } catch (e) { 
      console.error("MySQL Stats fail:", e.message);
    }
  }
  else if (dbType === "mongodb") {
    const remoteDir = `/tmp/${baseName}_dir`;
    // Thoát dấu nháy đơn trong mật khẩu MongoDB
    const mongoPassSafe = `'${formData.dbPassword.replace(/'/g, "'\\''")}'`;
    mainCommand = `mongodump --host localhost --username ${formData.dbUser} --password ${mongoPassSafe} --authenticationDatabase admin --db ${dbName} --out ${remoteDir} && 7za a -mx1 -p${safeZipPass} -mhe=on "${transferConfig.remoteZipFile}" ${remoteDir} && chmod 644 "${transferConfig.remoteZipFile}" && rm -rf ${remoteDir}`;
    try {
      const mClient = new MongoClient(`mongodb://${formData.dbUser}:${encodeURIComponent(formData.dbPassword)}@localhost:27017/${dbName}?authSource=admin`);
      await mClient.connect(); dbStats = await getMongoStats(mClient, dbName); await mClient.close();
    } catch (e) { }
  }
  else if (dbType === "sqlserver" || dbType === "mssql") {
    const sqlPath = "/opt/mssql-tools18/bin/sqlcmd";
    const remoteBaseMssql = `/var/opt/mssql/data/${baseName}`;
    const remoteFile = `${remoteBaseMssql}.bak`;

    // Giữ remoteZipFile ở /tmp để SFTP đọc không bị dính quyền thư mục mssql
    const dbPassSafe = `'${formData.dbPassword.replace(/'/g, "'\\''")}'`;

    mainCommand = `touch "${remoteFile}" && chmod 777 "${remoteFile}" && ${sqlPath} -S localhost -U "${formData.dbUser}" -P ${dbPassSafe} -C -Q "BACKUP DATABASE [${dbName}] TO DISK='${remoteFile}' WITH FORMAT, INIT" && [ -s "${remoteFile}" ] && 7za a -mx1 -p${safeZipPass} -mhe=on "${transferConfig.remoteZipFile}" "${remoteFile}" && chmod 644 "${transferConfig.remoteZipFile}" && rm -f "${remoteFile}"`;

    console.log("SQL Server Optimized Command:", mainCommand);
    try {
      const pool = await mssql.connect({ user: formData.dbUser, password: formData.dbPassword, server: formData.server, database: dbName, options: { encrypt: true, trustServerCertificate: true } });
      dbStats = await getSqlServerStats(pool); await mssql.close();
    } catch (e) { }
  }

  // 4. Thực thi SSH
  const result = await executeSshBackup(
    { host: formData.server, port: formData.sshPort || 22, username: formData.user, password: formData.password },
    transferConfig,
    mainCommand,
    sendProgress,
    onSshReady
  );

  if (result.success) {
    sendProgress("Hoàn tất!", 100);
    return { success: true, filePath: localPath, fileName: `${baseName}.7z`, dbName, stats: dbStats };
  }
  return result;
}