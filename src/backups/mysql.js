import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import SftpClient from "ssh2-sftp-client";
import archiver from "archiver";
import registerFormat from "archiver-zip-encryptable";

// Đăng ký định dạng nén có mật khẩu

/**
 * Hàm lấy thống kê dữ liệu thực tế từ MySQL
 * Sử dụng information_schema để lấy số dòng nhanh (xấp xỉ) hoặc COUNT(*) để chính xác
 */
async function getDatabaseStats(connection, dbName) {
  // 1. Lấy phiên bản MySQL
  const [versionRows] = await connection.query("SELECT VERSION() as version");
  const shortVersion = versionRows[0].version;

  // 2. Lấy danh sách bảng và số dòng (Sử dụng information_schema để tối ưu hiệu năng)
  const [tables] = await connection.query(`
    SELECT TABLE_NAME, TABLE_ROWS 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
  `, [dbName]);

  let rowCounts = {};
  for (const row of tables) {
    // Lưu ý: TABLE_ROWS trong information_schema có thể là con số xấp xỉ với InnoDB.
    // Nếu cần chính xác 100%, dùng: SELECT COUNT(*) FROM table_name
    rowCounts[row.TABLE_NAME] = row.TABLE_ROWS || 0;
  }

  return { shortVersion, rowCounts };
}

/**
 * Logic chính xử lý Backup MySQL
 */
export async function backupMySQL(dbConfig) {
  console.log("Starting MySQL backup with config:", dbConfig.database);

  // 1. Khởi tạo đường dẫn
  const tempDirOnWindows = path.join(process.cwd(), "src", "temp");
  if (!fs.existsSync(tempDirOnWindows)) {
    fs.mkdirSync(tempDirOnWindows, { recursive: true });
  }

  const timestamp = Date.now();
  const sqlFileName = `${dbConfig.database}_${timestamp}.sql`;
  const zipFileName = `${dbConfig.database}_${timestamp}.zip`;
  
  const filePathOnWindows = path.join(tempDirOnWindows, sqlFileName);
  const zipPathOnWindows = path.join(tempDirOnWindows, zipFileName);
  
  // Đường dẫn tạm trên Ubuntu (thường dùng /tmp để tránh lỗi quyền ghi)
  const filePathOnUbuntu = `/tmp/${sqlFileName}`;
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
    connection = await mysql.createConnection({
      host: dbConfig.server,
      user: dbConfig.dbUser,
      password: dbConfig.dbPassword,
      database: dbConfig.database,
      port: Number(dbConfig.port) || 3306,
    });

    const stats = await getDatabaseStats(connection, dbConfig.database);
    await connection.end();

    // 4. Chạy lệnh mysqldump thông qua SSH
    // Với MySQL, chúng ta thực hiện dump trực tiếp qua lệnh hệ thống thay vì query SQL
    await sftp.connect({
      host: dbConfig.server,
      port: Number(dbConfig.sshPort) || 22,
      username: dbConfig.user,
      password: dbConfig.password,
    });

    // Lệnh tạo file backup trên Ubuntu
    const dumpCommand = `mysqldump -u ${dbConfig.dbUser} -p'${dbConfig.dbPassword}' ${dbConfig.database} > ${filePathOnUbuntu}`;
    await sftp.client.exec(dumpCommand);

    // 5. Kéo file về và xóa trên Ubuntu
    await sftp.fastGet(filePathOnUbuntu, filePathOnWindows);
    await sftp.delete(filePathOnUbuntu);
    await sftp.end();

    // 6. Nén Zip và đặt mật khẩu
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPathOnWindows);
      const archive = archiver('zip-encryptable', {
        zlib: { level: 9 },
        password: backupPassword 
      });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);
      archive.file(filePathOnWindows, { name: sqlFileName });
      archive.finalize();
    });

    // 7. Dọn dẹp file .sql thô trên Windows
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
    if (connection) await connection.end().catch(() => {});
    try { await sftp.end(); } catch (e) { }
    if (fs.existsSync(filePathOnWindows)) fs.unlinkSync(filePathOnWindows);
    
    console.error("Lỗi quy trình backup MySQL:", err.message);
    return { success: false, error: `Lỗi: ${err.message}` };
  }
}