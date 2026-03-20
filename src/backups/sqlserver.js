import sql from "mssql";
import fs from "node:fs";
import path from "node:path";
import SftpClient from "ssh2-sftp-client";
import archiver from "archiver";
import registerFormat from "archiver-zip-encryptable";

/**
 * Hàm lấy thống kê dữ liệu thực tế từ DB
 */
export async function getSqlServerStats(pool) {
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

/**
 * Logic chính xử lý Backup SQL Server
 */
export async function backupSQLServer(dbConfig, event) {
  console.log("Starting backup with config:", dbConfig.database);

  // Hàm hỗ trợ gửi tiến trình về UI
  const sendProgress = (msg, percent) => {
    if (event) {
      event.sender.send("backup-progress", { message: msg, progress: percent });
    }
  };

  // 1. Khởi tạo đường dẫn và tên file
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

  const finalZipName = `SQLSERVER_${dbConfig.database}_${formattedTime}.zip`;
  const rawBakName = `${dbConfig.database}_${Date.now()}.bak`;
  
  const filePathOnWindows = path.join(tempDirOnWindows, rawBakName);
  const zipPathOnWindows = path.join(tempDirOnWindows, finalZipName);
  const filePathOnUbuntu = `/var/opt/mssql/data/${rawBakName}`;
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

  try {
    // 3. Kết nối SQL Server
    sendProgress("Đang kết nối SQL Server...", 10);
    const pool = await sql.connect({
      user: dbConfig.dbUser,
      password: dbConfig.dbPassword,
      server: dbConfig.server,
      database: dbConfig.database,
      port: Number(dbConfig.port),
      options: { 
        encrypt: true, 
        trustServerCertificate: true, 
        connectTimeout: 10000 
      },
    });

    // 4. Lấy Stats
    sendProgress("Đang quét thống kê dữ liệu...", 25);
    const stats = await getDatabaseStats(pool);

    // 5. Chạy lệnh Backup trên Server
    sendProgress(`Đang thực thi lệnh BACKUP DATABASE...`, 45);
    await pool.request().query(
      `BACKUP DATABASE [${dbConfig.database}] TO DISK = '${filePathOnUbuntu}' WITH INIT`
    );
    await pool.close();

    // 6. Kết nối SSH và kéo file về
    sendProgress("Đang kết nối SSH để truyền file...", 65);
    await sftp.connect({
      host: dbConfig.server,
      port: Number(dbConfig.sshPort) || 22,
      username: dbConfig.user,
      password: dbConfig.password,
      readyTimeout: 15000,
    });

    sendProgress("Đang tải file .bak về máy local...", 80);
    await sftp.fastGet(filePathOnUbuntu, filePathOnWindows);
    await sftp.delete(filePathOnUbuntu);
    await sftp.end();

    // 7. Nén Zip và đặt mật khẩu
    sendProgress("Đang nén ZIP bảo mật...", 95);
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPathOnWindows);
      const archive = archiver('zip-encryptable', {
        zlib: { level: 9 },
        password: backupPassword 
      });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);
      archive.file(filePathOnWindows, { name: rawBakName });
      archive.finalize();
    });

    // 8. Dọn dẹp file tạm
    if (fs.existsSync(filePathOnWindows)) {
      fs.unlinkSync(filePathOnWindows);
    }

    sendProgress("Hoàn tất!", 100);

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
    try { await sftp.end(); } catch (e) { }
    if (fs.existsSync(filePathOnWindows)) fs.unlinkSync(filePathOnWindows);
    console.error("Lỗi quy trình backup:", err.message);
    return { success: false, error: `Lỗi quy trình: ${err.message}` };
  }
}