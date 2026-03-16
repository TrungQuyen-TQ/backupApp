import { MongoClient } from "mongodb";
import fs from "node:fs";
import path from "node:path";
import SftpClient from "ssh2-sftp-client";
import archiver from "archiver";
import registerFormat from "archiver-zip-encryptable";

// Đăng ký định dạng nén bảo mật

/**
 * Hàm lấy thống kê dữ liệu thực tế từ MongoDB
 */
async function getDatabaseStats(client, dbName) {
  const db = client.db(dbName);
  const collections = await db.listCollections().toArray();

  // Lấy phiên bản server
  const admin = db.admin();
  const info = await admin.serverStatus();
  const shortVersion = info.version;

  let rowCounts = {};
  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    rowCounts[col.name] = count;
  }

  return { shortVersion, rowCounts };
}

/**
 * Logic chính xử lý Backup MongoDB
 */
export async function backupMongoDB(dbConfig) {
  console.log("Starting MongoDB backup with config:", dbConfig.database);

  // 1. Khởi tạo đường dẫn và thư mục tạm
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

  const finalZipName = `MONGODB_${dbConfig.database}_${formattedTime}.zip`; // Tên file ZIP cuối cùng
  const rawDumpName = `${dbConfig.database}_${Date.now()}.gz`; // Tên file tạm trung gian

  const filePathOnWindows = path.join(tempDirOnWindows, rawDumpName);
  const zipPathOnWindows = path.join(tempDirOnWindows, finalZipName);

  // Đường dẫn tạm trên Ubuntu (thư mục /tmp có quyền ghi cao)
  const filePathOnUbuntu = `/tmp/${rawDumpName}`;
  const passwordPath = path.join(process.cwd(), "configs", "passwordzip.json");

  // 2. Đọc mật khẩu Zip
  let backupPassword = "DefaultPassword123";
  try {
    if (fs.existsSync(passwordPath)) {
      const rawData = fs.readFileSync(passwordPath, "utf8");
      const config = JSON.parse(rawData);
      backupPassword = config.password;
    }
  } catch (error) {
    console.error("Lỗi đọc passwordzip.json:", error.message);
  }

  const sftp = new SftpClient();
  const user = encodeURIComponent(dbConfig.dbUser);
  const pass = encodeURIComponent(dbConfig.dbPassword);
  const uri = `mongodb://${user}:${pass}@${dbConfig.server}:${dbConfig.port}/?authSource=admin`;
  const client = new MongoClient(uri);

  try {
    // 3. Kết nối lấy Stats
    await client.connect();
    const stats = await getDatabaseStats(client, dbConfig.database);
    await client.close();

    // 4. Kết nối SSH để chạy mongodump
    await sftp.connect({
      host: dbConfig.server,
      port: Number(dbConfig.sshPort) || 22,
      username: dbConfig.user,
      password: dbConfig.password,
    });

    // Lệnh mongodump xuất ra file nén đơn lẻ (--archive)
    const dumpCommand = `mongodump --uri="${uri}" --archive=${filePathOnUbuntu} --gzip`;

    await new Promise((resolve, reject) => {
      sftp.client.exec(dumpCommand, (err, stream) => {
        if (err) return reject(err);
        stream
          .on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`mongodump failed with code ${code}`));
          })
          .on("data", (data) => console.log(data.toString()));
      });
    });

    // 5. Kéo file về và dọn dẹp Ubuntu
    await sftp.fastGet(filePathOnUbuntu, filePathOnWindows);
    await sftp.delete(filePathOnUbuntu);
    await sftp.end();

    // 6. Nén Zip và đặt mật khẩu
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPathOnWindows);
      const archive = archiver("zip-encryptable", {
        zlib: { level: 9 },
        password: backupPassword,
      });

      output.on("close", resolve);
      archive.on("error", reject);

      archive.pipe(output);
      archive.file(filePathOnWindows, { name: rawDumpName });
      archive.finalize();
    });

    // 7. Dọn dẹp file dump thô trên Windows
    if (fs.existsSync(filePathOnWindows)) {
      fs.unlinkSync(filePathOnWindows);
    }

    return {
      success: true,
      filePath: zipPathOnWindows,
      fileName: finalZipName,
      dbName: dbConfig.database,
      stats: {
        rowCounts: stats.rowCounts,
        version: stats.shortVersion,
      },
    };
  } catch (err) {
    await client.close();
    try {
      await sftp.end();
    } catch (e) {}
    if (fs.existsSync(filePathOnWindows)) fs.unlinkSync(filePathOnWindows);
    console.error("Lỗi quy trình backup MongoDB:", err.message);
    return { success: false, error: `Lỗi: ${err.message}` };
  }
}
