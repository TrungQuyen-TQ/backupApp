import { MongoClient } from "mongodb";
import fs from "node:fs";
import path from "node:path";
import SftpClient from "ssh2-sftp-client";
import archiver from "archiver";
import registerFormat from "archiver-zip-encryptable";

/**
 * Hàm lấy thống kê dữ liệu thực tế từ MongoDB
 */
export async function getMongoStats(client, dbName) {
  const db = client.db(dbName);
  const collections = await db.listCollections().toArray();

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
export async function backupMongoDB(dbConfig, event) { // SỬA: Thêm tham số event
  const sendProgress = (msg, percent) => {
    if (event) {
      event.sender.send("backup-progress", { message: msg, progress: percent });
    }
  };

  console.log("Starting MongoDB backup:", dbConfig.database);

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

  const finalZipName = `MONGODB_${dbConfig.database}_${formattedTime}.zip`;
  const rawDumpName = `${dbConfig.database}_${Date.now()}.gz`;

  const filePathOnWindows = path.join(tempDirOnWindows, rawDumpName);
  const zipPathOnWindows = path.join(tempDirOnWindows, finalZipName);
  const filePathOnUbuntu = `/tmp/${rawDumpName}`;
  const passwordPath = path.join(process.cwd(), "configs", "passwordzip.json");

  // 2. Đọc mật khẩu Zip
  let backupPassword = "DefaultPassword123";
  try {
    if (fs.existsSync(passwordPath)) {
      const rawData = fs.readFileSync(passwordPath, "utf8");
      backupPassword = JSON.parse(rawData).password;
    }
  } catch (e) { console.error("Lỗi mật khẩu zip:", e.message); }

  const sftp = new SftpClient();
  const user = encodeURIComponent(dbConfig.dbUser);
  const pass = encodeURIComponent(dbConfig.dbPassword);
  const uri = `mongodb://${user}:${pass}@${dbConfig.server}:${dbConfig.port}/?authSource=admin`;
  const client = new MongoClient(uri);

  try {
    // 3. Kết nối lấy Stats
    sendProgress("Đang kết nối MongoDB lấy thông tin...", 10);
    await client.connect();
    const stats = await getDatabaseStats(client, dbConfig.database);
    await client.close();

    // 4. Kết nối SSH để chạy mongodump
    sendProgress("Đang kết nối SSH tới Server...", 30);
    await sftp.connect({
      host: dbConfig.server,
      port: Number(dbConfig.sshPort) || 22,
      username: dbConfig.user,
      password: dbConfig.password,
    });

    sendProgress("Đang thực thi mongodump --archive...", 50);
    const dumpCommand = `mongodump --uri="${uri}" --archive=${filePathOnUbuntu} --gzip`;

    await new Promise((resolve, reject) => {
      sftp.client.exec(dumpCommand, (err, stream) => {
        if (err) return reject(err);
        stream.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`mongodump failed code ${code}`));
          })
          .on("data", () => sendProgress("Đang kết xuất dữ liệu BSON...", 60));
      });
    });

    // 5. Kéo file về và dọn dẹp Ubuntu
    sendProgress("Đang tải bản lưu trữ về máy local...", 80);
    await sftp.fastGet(filePathOnUbuntu, filePathOnWindows);
    await sftp.delete(filePathOnUbuntu);
    await sftp.end();

    // 6. Nén Zip và đặt mật khẩu
    sendProgress("Đang nén ZIP và mã hóa dữ liệu...", 95);
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPathOnWindows);
      const archive = archiver("zip-encryptable", { zlib: { level: 9 }, password: backupPassword });
      output.on("close", resolve);
      archive.on("error", reject);
      archive.pipe(output);
      archive.file(filePathOnWindows, { name: rawDumpName });
      archive.finalize();
    });

    if (fs.existsSync(filePathOnWindows)) fs.unlinkSync(filePathOnWindows);

    sendProgress("Hoàn tất backup MongoDB!", 100);

    return {
      success: true,
      filePath: zipPathOnWindows,
      fileName: finalZipName,
      dbName: dbConfig.database,
      stats: { rowCounts: stats.rowCounts, version: stats.shortVersion },
    };
  } catch (err) {
    sendProgress(`Lỗi: ${err.message}`, 0);
    await client.close();
    try { await sftp.end(); } catch (e) {}
    if (fs.existsSync(filePathOnWindows)) fs.unlinkSync(filePathOnWindows);
    return { success: false, error: err.message };
  }
}