import sql from "mssql";
import fs from "node:fs";
import path from "node:path";
import SftpClient from "ssh2-sftp-client";
import archiver from "archiver";
import registerFormat from "archiver-zip-encryptable";

/**
 * Hàm lấy thống kê dữ liệu thực tế từ DB
 */
async function getDatabaseStats(pool) {
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
export async function backupSQLServer(dbConfig) {
  console.log("Starting backup with config:", dbConfig);

  // 1. Khởi tạo đường dẫn và thư mục tạm
  const tempDirOnWindows = path.join(process.cwd(), "src", "temp");
  if (!fs.existsSync(tempDirOnWindows)) {
    fs.mkdirSync(tempDirOnWindows, { recursive: true });
  }

  const timestamp = Date.now();
  const bakFileName = `${dbConfig.database}_${timestamp}.bak`;
  const zipFileName = `${dbConfig.database}_${timestamp}.zip`;
  
  const filePathOnWindows = path.join(tempDirOnWindows, bakFileName);
  const zipPathOnWindows = path.join(tempDirOnWindows, zipFileName);
  const filePathOnUbuntu = `/var/opt/mssql/data/${bakFileName}`;
  const passwordPath = path.join(process.cwd(), "configs", "passwordzip.json");

  // 2. Đọc mật khẩu Zip từ file config
  let backupPassword = "DefaultPassword123";
  try {
    if (fs.existsSync(passwordPath)) {
      const rawData = fs.readFileSync(passwordPath, 'utf8');
      const config = JSON.parse(rawData);
      backupPassword = config.password;
      console.log("Password zip loaded from config.");
    } else {
      console.warn("Using default backup password.");
    }
  } catch (error) {
    console.error("Lỗi đọc passwordzip.json:", error.message);
  }

  const sftp = new SftpClient();

  try {
    // 3. Kết nối SQL Server, Lấy Stats và chạy lệnh Backup
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

    const stats = await getDatabaseStats(pool);

    await pool.request().query(
      `BACKUP DATABASE [${dbConfig.database}] TO DISK = '${filePathOnUbuntu}' WITH INIT`
    );
    await pool.close();

    // 4. Kết nối SFTP, Kéo file về và Xóa file trên Ubuntu
    await sftp.connect({
      host: dbConfig.server,
      port: Number(dbConfig.sshPort) || 22,
      username: dbConfig.user,
      password: dbConfig.password,
      readyTimeout: 15000,
    });

    await sftp.fastGet(filePathOnUbuntu, filePathOnWindows);
    await sftp.delete(filePathOnUbuntu);
    await sftp.end();

    // 5. Nén Zip và đặt mật khẩu
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPathOnWindows);
      const archive = archiver('zip-encryptable', {
        zlib: { level: 9 },
        password: backupPassword 
      });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);
      archive.file(filePathOnWindows, { name: bakFileName });
      archive.finalize();
    });

    // 6. Dọn dẹp file .bak thô trên Windows
    if (fs.existsSync(filePathOnWindows)) {
      fs.unlinkSync(filePathOnWindows);
    }

    return {
      success: true,
      filePath: zipPathOnWindows,
      fileName: zipFileName,
      dbName: dbConfig.database,
      stats: {
        rowCounts: stats.rowCounts,
        version: stats.shortVersion
      }
    };

  } catch (err) {
    try { await sftp.end(); } catch (e) { }
    if (fs.existsSync(filePathOnWindows)) fs.unlinkSync(filePathOnWindows);
    console.error("Lỗi quy trình backup:", err.message);
    return { success: false, error: `Lỗi quy trình: ${err.message}` };
  }
}