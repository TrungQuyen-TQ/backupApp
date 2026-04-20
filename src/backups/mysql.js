import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import SftpClient from "ssh2-sftp-client";
import archiver from "archiver";
import registerFormat from "archiver-zip-encryptable";

/**
 * Hàm lấy thống kê dữ liệu thực tế từ MySQL
 */
export async function getMysqlStats(connection, dbName) {
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

/**
 * Logic chính xử lý Backup MySQL
 */
export async function backupMySQL(dbConfig, event) {
  const sendProgress = (msg, percent) => {
    if (event) event.sender.send("backup-progress", { message: msg, progress: percent });
  };

  console.log("Starting MySQL backup with config:", dbConfig.database);

  // 1. Khởi tạo đường dẫn
  const tempDirOnWindows = path.join(process.cwd(), "src", "temp");
  if (!fs.existsSync(tempDirOnWindows)) {
    fs.mkdirSync(tempDirOnWindows, { recursive: true });
  }

  const now = new Date();
  const formattedTime = now.getFullYear() + 
                  String(now.getMonth() + 1).padStart(2, '0') + 
                  String(now.getDate()).padStart(2, '0') + "_" + 
                  String(now.getHours()).padStart(2, '0') + 
                  String(now.getMinutes()).padStart(2, '0');

  const finalZipName = `MYSQL_${dbConfig.database}_${formattedTime}.zip`;
  const rawSqlName = `${dbConfig.database}_${Date.now()}.sql`;
  
  const filePathOnWindows = path.join(tempDirOnWindows, rawSqlName);
  const zipPathOnWindows = path.join(tempDirOnWindows, finalZipName);
  const filePathOnUbuntu = `/tmp/${rawSqlName}`;
  const passwordPath = path.join(process.cwd(), "configs", "passwordzip.json");

  // 2. Đọc mật khẩu Zip
  let backupPassword = "DefaultPassword123";
  try {
    if (fs.existsSync(passwordPath)) {
      const rawData = fs.readFileSync(passwordPath, 'utf8');
      const config = JSON.parse(rawData);
      backupPassword = config.password;
    }
  } catch (error) {
    console.error("Lỗi đọc passwordzip.json:", error.message);
  }

  const sftp = new SftpClient();
  let connection;

  try {
    // 3. Kết nối MySQL để lấy Stats
    sendProgress("Đang kết nối MySQL...", 10);
    connection = await mysql.createConnection({
      host: dbConfig.server,
      user: dbConfig.dbUser,
      password: dbConfig.dbPassword,
      database: dbConfig.database,
      port: Number(dbConfig.port) || 3306,
    });

    sendProgress("Đang lấy thống kê bảng dữ liệu...", 25);
    const stats = await getMysqlStats(connection, dbConfig.database);
    await connection.end();

    // 4. Kết nối SSH
    sendProgress("Đang thiết lập kết nối SSH...", 40);
    await sftp.connect({
      host: dbConfig.server,
      port: Number(dbConfig.sshPort) || 22,
      username: dbConfig.user,
      password: dbConfig.password,
    });

    // 5. Chạy lệnh mysqldump (CHỈ CHẠY 1 LẦN)
    const dumpCommand = `mysqldump -u ${dbConfig.dbUser} -p'${dbConfig.dbPassword}' ${dbConfig.database} > ${filePathOnUbuntu}`;
    
    sendProgress("Đang thực thi mysqldump trên Server...", 55);
    await new Promise((resolve, reject) => {
      if (!sftp.client) return reject(new Error("SSH client not connected"));
      
      sftp.client.exec(dumpCommand, (err, stream) => {
        if (err) return reject(err);
        stream
          .on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`mysqldump failed with code: ${code}`));
          })
          .on("data", () => {
             // Cập nhật nhẹ tiến trình khi có luồng dữ liệu phản hồi
             sendProgress("Đang xuất dữ liệu SQL...", 60);
          })
          .stderr.on("data", (data) => console.error("STDERR: " + data));
      });
    });

    // 6. Kéo file về local
    sendProgress("Đang truyền file .sql về máy local...", 75);
    await sftp.fastGet(filePathOnUbuntu, filePathOnWindows);
    await sftp.delete(filePathOnUbuntu);
    await sftp.end();

    // 7. Nén Zip và mật khẩu
    sendProgress("Đang nén ZIP bảo mật...", 90);
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPathOnWindows);
      const archive = archiver('zip-encryptable', {
        zlib: { level: 9 },
        password: backupPassword 
      });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);
      archive.file(filePathOnWindows, { name: rawSqlName });
      archive.finalize();
    });

    // 8. Dọn dẹp
    if (fs.existsSync(filePathOnWindows)) {
      fs.unlinkSync(filePathOnWindows);
    }
    
    sendProgress("Hoàn tất backup MySQL!", 100);

    return {
      success: true,
      filePath: zipPathOnWindows,
      fileName: finalZipName,
      dbName: dbConfig.database,
      stats: {
        rowCounts: stats.rowCounts,
        version: stats.shortVersion
      }
    };

  } catch (err) {
    sendProgress(`Lỗi: ${err.message}`, 0);
    if (connection) await connection.end().catch(() => {});
    try { await sftp.end(); } catch (e) { }
    if (fs.existsSync(filePathOnWindows)) fs.unlinkSync(filePathOnWindows);
    
    console.error("Lỗi quy trình backup MySQL:", err.message);
    return { success: false, error: `Lỗi: ${err.message}` };
  }
}