import fs from "fs";
import path from "path";
import { Client as SshClient } from "ssh2";
import { Client } from "pg";
import mysql from "mysql2/promise";
import { getMysqlStats } from "./mysql.js";
import { MongoClient } from "mongodb";
import mssql from "mssql";
import { getSqlServerStats } from "./sqlserver.js";
import { getMongoStats } from "./mongodb.js";

/**
 * Hàm thực thi SSH dùng chung cho mọi loại Database
 */
export async function executeSshBackup(
  sshConfig,
  transferConfig,
  mainCommand,
  onProgress,
  onSshReady // <--- THÊM THAM SỐ NÀY ĐỂ NHẬN CALLBACK TỪ TRÊN XUỐNG
) {
  return new Promise((resolve) => {
    const ssh = new SshClient();
    const { host, port, username, password } = sshConfig;
    const { remoteZipFile, localPath } = transferConfig;


    // 🔴 QUAN TRỌNG: Gửi đối tượng SSH ra ngoài main.js ngay lập tức
    // if (onSshReady) {
    //   onSshReady({
    //     stop: async () => {
    //       try {
    //         ssh.end(); // Ngắt kết nối SSH ngay lập tức
    //         console.log("--- Đã ngắt tiến trình SSH từ nút Hủy ---");
    //       } catch (e) { console.error("Lỗi khi ngắt SSH:", e); }
    //     }
    //   });
    // }

    if (onSshReady) {
      onSshReady({
        stop: async () => {
          try {
            // TRƯỚC KHI NGẮT SSH: Gửi lệnh xóa các file tạm có thể đang dở dang
            // Lệnh này sẽ xóa cả file .bak và file .7z dựa trên đường dẫn đang chạy
            const cleanupCmd = `rm -f ${transferConfig.remoteZipFile} ${transferConfig.remoteZipFile.replace('.7z', '.bak')}`;
            
            ssh.exec(cleanupCmd, () => {
              ssh.end(); // Sau khi ra lệnh xóa thì mới đóng kết nối
              console.log("--- Đã dọn dẹp Server và ngắt SSH ---");
            });
          } catch (e) { 
            console.error("Lỗi khi dọn dẹp server:", e);
            ssh.end(); 
          }
        }
      });
    }
    

    ssh
      .on("ready", () => {
        // Thực thi lệnh bất kỳ (Postgres dump hoặc Mongo dump)
        onProgress("Đang nén dữ liệu trên Server (Vui lòng chờ)...", 45);
        ssh.exec(mainCommand, (err, stream) => {
          if (err) {
            ssh.end();
            return resolve({
              success: false,
              error: "SSH Exec Error: " + err.message,
            });
          }

          let stderr = "";
          stream.stderr.on("data", (data) => {
            stderr += data.toString();
          });
          stream.on("data", (data) => console.log("STDOUT: " + data));

          stream.on("close", (code) => {
            if (code !== 0) {
              ssh.end();
              return resolve({
                success: false,
                error: `Lỗi Server (Code ${code}): ${stderr}`,
              });
            }
            onProgress("Nén thành công. Đang bắt đầu tải file về máy...", 70);
            // Tải file nén về máy
            ssh.sftp((err, sftp) => {
              if (err) {
                ssh.end();
                return resolve({
                  success: false,
                  error: "SFTP Error: " + err.message,
                });
              }

              sftp.fastGet(remoteZipFile, localPath, {}, (downloadErr) => {
                if (downloadErr) {
                  ssh.end();
                  return resolve({
                    success: false,
                    error: "Download Error: " + downloadErr.message,
                  });
                }
                onProgress("Đang dọn dẹp file tạm trên Server...", 98);
                // Xóa file trên server sau khi kéo về thành công
                sftp.unlink(remoteZipFile, () => {
                  ssh.end();
                  resolve({
                    success: true,
                    message: "Thành công!",
                    path: localPath,
                  });
                });
              });
            });
          });
        });
      })
      .on("error", (err) => {
        resolve({
          success: false,
          error: "Kết nối SSH thất bại: " + err.message,
        });
      })
      .connect({
        host,
        port: Number(port) || 22,
        username,
        password,
        readyTimeout: 20000,
      });
  });
}

async function getDatabaseStats(client, dbName) {
  // 1. Lấy phiên bản server Postgres
  const versionRes = await client.query("SELECT version();");
  const fullVersion = versionRes.rows[0].version;
  // Trích xuất số phiên bản ngắn (vd: 15.3)
  const shortVersion = fullVersion.split(" ")[1];

  // 2. Lấy danh sách các bảng và số lượng hàng (row count)
  // Truy vấn tất cả bảng trong schema 'public'
  const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

  const tables = tablesRes.rows;
  let rowCounts = {};

  for (const table of tables) {
    const tableName = table.table_name;
    // Đếm số lượng bản ghi trong từng bảng
    const countRes = await client.query(`SELECT COUNT(*) FROM "${tableName}"`);
    rowCounts[tableName] = parseInt(countRes.rows[0].count);
  }

  return { shortVersion, rowCounts };
}

export async function universalBackupHandler(formData, event, onSshReady) {
  console.log("Backup Config Received:", formData);
  
  const sendProgress = (msg, percent) => {
    if (event) {
      event.sender.send("backup-progress", { message: msg, progress: percent });
    }
  };

  sendProgress("Bắt đầu quy trình backup...", 5);

  const timestamp = Date.now();
  const localDir = formData.localPath;
  const dbName = formData.database;
  const dbType = formData.dbType;
  
  // 1. Đọc mật khẩu Zip
  const passwordPath = path.join(process.cwd(), "configs", "passwordzip.json");
  let backupPassword = "admin123";
  try {
    if (fs.existsSync(passwordPath)) {
      const config = JSON.parse(fs.readFileSync(passwordPath, "utf8"));
      backupPassword = config.password;
    }
  } catch (error) {
    console.warn("Không đọc được file mật khẩu, dùng mặc định.");
  }

  // 2. CHUẨN BỊ BIẾN CƠ BẢN
  const safeDbPass = JSON.stringify(formData.dbPassword);
  const safeZipPass = JSON.stringify(backupPassword);
  
  // Mặc định remoteBase ở /tmp, riêng SQL Server sẽ ghi đè lại trong case
  let remoteBase = `/tmp/backup_${dbType}_${dbName}_${timestamp}`;
  let remoteZipFile = `${remoteBase}.7z`;
  
  const finalFileName = `backup_${dbType}_${dbName}_${timestamp}.7z`;
  const fullLocalPath = path.join(localDir, finalFileName);

  // --- QUAN TRỌNG: KHỞI TẠO transferConfig TRƯỚC KHI VÀO SWITCH CASE ---
  const transferConfig = {
    remoteZipFile: remoteZipFile, // Sẽ được cập nhật lại nếu là SQL Server
    localPath: fullLocalPath,
  };

  let dbStats = { shortVersion: "N/A", rowCounts: {} };
  let mainCommand = "";

  // 3. Kiểm tra thư mục local
  if (!fs.existsSync(localDir)) {
    try {
      fs.mkdirSync(localDir, { recursive: true });
    } catch (err) {
      return { success: false, error: `Không thể tạo thư mục: ${err.message}` };
    }
  }

  // 4. SWITCH CASE THEO LOẠI DB
  switch (dbType) {
    case "postgres": {
      const remoteFile = `${remoteBase}.sql`;
      mainCommand = `export PGPASSWORD=${safeDbPass} && pg_dump -h localhost -U ${formData.dbUser} -d ${dbName} -f ${remoteFile} && (7za a -p${safeZipPass} -mhe=on ${remoteZipFile} ${remoteFile} || 7z a -p${safeZipPass} -mhe=on ${remoteZipFile} ${remoteFile}) && rm -f ${remoteFile}`;

      const pgClient = new Client({
        host: formData.server,
        port: formData.dbPort || 5432,
        user: formData.dbUser,
        password: formData.dbPassword,
        database: dbName,
      });
      try {
        await pgClient.connect();
        dbStats = await getDatabaseStats(pgClient, dbName);
        await pgClient.end();
      } catch (err) { console.error("Stats fail:", err.message); }
      break;
    }

    case "mysql": {
      const remoteFile = `${remoteBase}.sql`;
      mainCommand = `export MYSQL_PWD=${formData.dbPassword} && mysqldump -h localhost -u ${formData.dbUser} ${dbName} > ${remoteFile} && (7za a -p${safeZipPass} -mhe=on ${remoteZipFile} ${remoteFile} || 7z a -p${safeZipPass} -mhe=on ${remoteZipFile} ${remoteFile}) && rm -f ${remoteFile}`;
      try {
        const connection = await mysql.createConnection({
          host: formData.server,
          user: formData.dbUser,
          password: formData.dbPassword,
          database: formData.database,
          port: Number(formData.dbPort) || 3306,
        });
        dbStats = await getMysqlStats(connection, formData.database);
        await connection.end();
      } catch (e) { console.error("MySQL Stats fail"); }
      break;
    }

    case "mongodb": {
      const remoteDir = `${remoteBase}_dir`;
      const rawPass = formData.dbPassword;
      const encodedPass = encodeURIComponent(rawPass);
      const mongoUri = `mongodb://${formData.dbUser}:${encodedPass}@localhost:27017/${dbName}?authSource=admin`;
      const mClient = new MongoClient(mongoUri, { connectTimeoutMS: 5000 });
      const shellSafePass = `'${rawPass.replace(/'/g, "'\\''")}'`;

      mainCommand = `mongodump --host localhost --username ${formData.dbUser} --password ${shellSafePass} --authenticationDatabase admin --db ${dbName} --out ${remoteDir} && (7za a -p${safeZipPass} -mhe=on ${remoteZipFile} ${remoteDir} || 7z a -p${safeZipPass} -mhe=on ${remoteZipFile} ${remoteDir}) && rm -rf ${remoteDir}`;
      try {
        sendProgress("Đang kết nối MongoDB lấy stats...", 20);
        await mClient.connect();
        dbStats = await getMongoStats(mClient, dbName);
        await mClient.close();
      } catch (err) {
        console.error("Mongo Stats Error:", err.message);
        if (mClient) await mClient.close();
      }
      break;
    }

    case "sqlserver": {
      // Đổi sang thư mục mssql data để tránh lỗi Permission 31
      // 1. Phải khai báo biến sqlPath ở đây
      const sqlPath = "/opt/mssql-tools18/bin/sqlcmd"; 

      const remoteBaseMssql = `/var/opt/mssql/data/backup_${dbName}_${timestamp}`;
      const remoteFile = `${remoteBaseMssql}.bak`;
      const remoteZipFileSql = `${remoteBaseMssql}.7z`; 

      transferConfig.remoteZipFile = remoteZipFileSql;

      // 2. Bây giờ dùng ${sqlPath} mới không bị lỗi "not defined"
      mainCommand = `touch ${remoteFile} && chmod 777 ${remoteFile} && ${sqlPath} -S localhost -U "${formData.dbUser}" -P '${formData.dbPassword}' -C -Q "BACKUP DATABASE [${dbName}] TO DISK='${remoteFile}' WITH FORMAT, INIT" && [ -s ${remoteFile} ] && 7za a -p${safeZipPass} -mhe=on ${remoteZipFileSql} ${remoteFile} ; rm -f ${remoteFile}`;

      console.log("SQL Server Optimized Command:", mainCommand);

      const sqlConfig = {
        user: formData.dbUser,
        password: formData.dbPassword,
        server: formData.server,
        database: dbName,
        port: Number(formData.dbPort) || 1433,
        options: { encrypt: true, trustServerCertificate: true },
      };

      try {
        sendProgress("Đang kết nối SQL Server lấy stats...", 20);
        const pool = await mssql.connect(sqlConfig);
        dbStats = await getSqlServerStats(pool);
        await mssql.close();
      } catch (err) {
        console.error("SQL Server Stats Error:", err.message);
        try { await mssql.close(); } catch (e) {}
      }
      break;
    }
  }

  // 5. Cấu hình SSH
  const sshConfig = {
    host: formData.server,
    port: formData.sshPort || 22,
    username: formData.user,
    password: formData.password,
  };

  console.log("Thực hiện lệnh SSH:", mainCommand);

  // 6. Thực hiện Backup
  const backupResult = await executeSshBackup(
    sshConfig,
    transferConfig,
    mainCommand,
    sendProgress,
    onSshReady
  );

  if (backupResult.success) {
    sendProgress("Hoàn tất quy trình backup!", 100);
    return {
      success: true,
      filePath: fullLocalPath,
      fileName: finalFileName,
      dbName: dbName,
      stats: dbStats,
    };
  } else {
    return backupResult;
  }
}
