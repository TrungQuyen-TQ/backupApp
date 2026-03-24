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
) {
  return new Promise((resolve) => {
    const ssh = new SshClient();
    const { host, port, username, password } = sshConfig;
    const { remoteZipFile, localPath } = transferConfig;

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

export async function universalBackupHandler(formData, event) {
  const sendProgress = (msg, percent) => {
    if (event) {
      event.sender.send("backup-progress", { message: msg, progress: percent });
    }
  };
  // --- KHAI BÁO CÁC BIẾN CẤU HÌNH TRƯỚC ---
  sendProgress("Bắt đầu quy trình backup...", 5);

  const timestamp = Date.now();
  const localDir = formData.localPath;
  const dbName = formData.database;
  const dbType = formData.dbType;
  // 1. Đọc mật khẩu Zip từ file JSON
  const passwordPath = path.join(process.cwd(), "configs", "passwordzip.json");
  let backupPassword = "DefaultPassword123";
  try {
    if (fs.existsSync(passwordPath)) {
      const config = JSON.parse(fs.readFileSync(passwordPath, "utf8"));
      backupPassword = config.password;
    }
  } catch (error) {
    console.warn("Không đọc được file mật khẩu, dùng mặc định.");
  }

  // 2. Chuẩn bị các biến cho lệnh nén (LÀM TRƯỚC KHI TẠO mainCommand)
  const safeDbPass = JSON.stringify(formData.dbPassword);
  const safeZipPass = JSON.stringify(backupPassword);
  const remoteBase = `/tmp/backup_${dbType}_${dbName}_${timestamp}`;
  const remoteZipFile = `${remoteBase}.7z`;
  const finalFileName = `backup_${dbType}_${dbName}_${timestamp}.7z`;
  const fullLocalPath = path.join(localDir, finalFileName);

  // 3. Lấy Thống kê (Stats)
  sendProgress("Đang kết nối Postgres lấy thông tin thống kê...", 15);
  let dbStats = { shortVersion: "N/A", rowCounts: {} };

  // 4. Kiểm tra và tạo thư mục localPath
  if (!fs.existsSync(localDir)) {
    try {
      fs.mkdirSync(localDir, { recursive: true });
    } catch (err) {
      return { success: false, error: `Không thể tạo thư mục: ${err.message}` };
    }
  }

  // 5. Tạo lệnh MainCommand (Lúc này các biến đã chắc chắn có giá trị)
  let mainCommand;

  switch (dbType) {
    case "postgres": {
      const remoteFile = `${remoteBase}.sql`;
      mainCommand = `export PGPASSWORD=${safeDbPass} && pg_dump -h localhost -U ${formData.dbUser} -d ${dbName} -f ${remoteFile} && (7za a -p${safeZipPass} -mhe=on ${remoteZipFile} ${remoteFile} || 7z a -p${safeZipPass} -mhe=on ${remoteZipFile} ${remoteFile}) && rm -f ${remoteFile}`;

      // Logic lấy stats của bạn
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
      } catch (err) {
        console.error("Stats fail:", err.message);
      }
      break;
    }

    case "mysql": {
      const remoteFile = `${remoteBase}.sql`;
      mainCommand = `export MYSQL_PWD=${formData.dbPassword} && mysqldump -h localhost -u ${formData.dbUser} ${dbName} > ${remoteFile} && (7za a -p${safeZipPass} -mhe=on ${remoteZipFile} ${remoteFile} || 7z a -p${safeZipPass} -mhe=on ${remoteZipFile} ${remoteFile}) && rm -f ${remoteFile}`;
      const connection = await mysql.createConnection({
        host: formData.server,
        user: formData.dbUser,
        password: formData.dbPassword,
        database: formData.database,
        port: Number(formData.dbPort) || 3306,
      });
      dbStats = await getMysqlStats(connection, formData.database);
      await connection.end();
      break;
    }

    case "mongodb": {
      // MongoDB dump ra thư mục nên dùng rm -rf
      const remoteDir = `${remoteBase}_dir`;
      const rawPass = formData.dbPassword; // Ví dụ: mk@123

      // --- PHẦN 1: Dùng cho MongoClient (Cần encode) ---
      const encodedPass = encodeURIComponent(rawPass); // Trở thành: mk%40123
      const mongoUri = `mongodb://${formData.dbUser}:${encodedPass}@localhost:27017/${dbName}?authSource=admin`;
      const mClient = new MongoClient(mongoUri, { connectTimeoutMS: 5000 });

      // --- PHẦN 2: Dùng cho mongodump qua SSH (Cần bọc nháy đơn, KHÔNG encode) ---
      // Hàm này đảm bảo mật khẩu gốc được bảo vệ an toàn khi truyền qua SSH
      const shellSafePass = `'${rawPass.replace(/'/g, "'\\''")}'`;

      mainCommand = `mongodump --host localhost --username ${formData.dbUser} --password ${shellSafePass} --authenticationDatabase admin --db ${dbName} --out ${remoteDir} && (7za a -p${shellSafePass} -mhe=on ${remoteZipFile} ${remoteDir} || 7z a -p${shellSafePass} -mhe=on ${remoteZipFile} ${remoteDir}) && rm -rf ${remoteDir}`;
      try {
        sendProgress("Đang kết nối MongoDB lấy stats...", 20);
        await mClient.connect();
        dbStats = await getMongoStats(mClient, dbName);
        await mClient.close();
        sendProgress("Lấy thông tin MongoDB thành công.", 30);
      } catch (err) {
        console.error("Mongo Stats Error:", err.message);
        sendProgress(
          "Không lấy được stats Mongo, vẫn tiếp tục backup SSH...",
          30,
        );
        if (mClient) await mClient.close();
      }
      break;
    }

    case "sqlserver": {
      const remoteFile = `${remoteBase}.bak`;
      const sqlPath = "/opt/mssql-tools18/bin/sqlcmd";
      mainCommand = `${sqlPath} -S localhost -U "${formData.dbUser}" -P '${formData.dbPassword}' -C -Q "BACKUP DATABASE [${dbName}] TO DISK='${remoteFile}'" && 7za a -p'${safeZipPass}' -mhe=on ${remoteZipFile} ${remoteFile} && rm -f ${remoteFile}`;

      console.log("SQL Server mainCommand:", mainCommand);
      const sqlConfig = {
        user: formData.dbUser,
        password: formData.dbPassword,
        server: formData.server,
        database: dbName,
        port: Number(formData.dbPort) || 1433,
        options: {
          encrypt: true, // Thường cần true nếu dùng Azure/Cloud
          trustServerCertificate: true, // Quan trọng khi dùng cert tự ký trên Linux
        },
      };

      try {
        sendProgress("Đang kết nối SQL Server lấy stats...", 20);
        const pool = await mssql.connect(sqlConfig);
        dbStats = await getSqlServerStats(pool); // Hàm bạn vừa gửi
        await mssql.close();
        sendProgress("Lấy thông tin SQL Server thành công.", 30);
      } catch (err) {
        console.error("SQL Server Stats Error:", err.message);
        sendProgress(
          "Không lấy được stats SQL Server, vẫn tiếp tục backup SSH...",
          30,
        );
        try {
          await mssql.close();
        } catch (e) {}
      }
      break;
    }
  }

  const sshConfig = {
    host: formData.server,
    port: formData.sshPort || 22,
    username: formData.user,
    password: formData.password,
  };

  const transferConfig = {
    remoteZipFile: remoteZipFile,
    localPath: fullLocalPath,
  };

  // 6. Thực hiện Backup
  const backupResult = await executeSshBackup(
    sshConfig,
    transferConfig,
    mainCommand,
    sendProgress,
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
