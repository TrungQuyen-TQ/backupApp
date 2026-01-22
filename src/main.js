import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs";
import { google } from "googleapis";
import started from "electron-squirrel-startup";
import sql from "mssql";
import SftpClient from "ssh2-sftp-client";

const KEY_FILE_PATH = path.join(process.cwd(), "key.json");
const DRIVE_FOLDER_ID = "1Gjka784n-W7xfyynkeQdSM_Yap2Rf-4N";

if (started) {
  app.quit();
}

ipcMain.handle("create-sql-backup", async (event, dbConfig) => {
  const sftp = new SftpClient();
  console.log("dang tao file .bak");
  try {
    // 1. Ép kiểu dữ liệu để tránh lỗi "must be of type number"
    const sqlConfig = {
      user: dbConfig.user,
      password: dbConfig.password,
      server: dbConfig.server,
      database: dbConfig.database,
      port: Number(dbConfig.port), // Sửa lỗi ở đây
      options: {
        encrypt: true,
        trustServerCertificate: true,
      },
    };

    const pool = await sql.connect(sqlConfig);

    // 2. Đường dẫn lưu trữ
    const remotePath = `/var/opt/mssql/backup/remote_backup.bak`;
    const outputFolder = "C:/hls_output";
    const localPath = path.join(outputFolder, "sql_server_backup.bak");

    if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
}

    // 3. Thực hiện Backup trên Ubuntu
    const query = `BACKUP DATABASE [${dbConfig.database}] TO DISK = '${remotePath}' WITH FORMAT, INIT;`;
    await pool.request().query(query);
    await pool.close(); // Đóng kết nối SQL sau khi xong

    // 4. Kết nối SFTP và kéo file về
    await sftp.connect({
      host: dbConfig.server,
      port: Number(26266), // Ép kiểu port SSH
      username: "root",
      password: "+Shl6|$#^",
    });

    await sftp.fastGet(remotePath, localPath);

    // 5. Xóa file trên Ubuntu sau khi đã tải về Windows thành công (để dọn dẹp server)
    await sftp.delete(remotePath);
    await sftp.end();

    return { success: true, filePath: localPath };
  } catch (err) {
    if (sftp) await sftp.end();
    console.error("Lỗi quy trình:", err.message);
    return { success: false, error: "Lỗi quy trình: " + err.message };
  }
});

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      // Đảm bảo đường dẫn preload.js chính xác trong cấu trúc Vite
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // mainWindow.webContents.openDevTools(); // Mở console để debug
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// --- IPC HANDLERS: XỬ LÝ LOGIC BACKEND ---

// 1. Xử lý Upload lên Google Drive
ipcMain.handle("upload-to-drive-test", async (event, filePath) => {
  try {
    if (!fs.existsSync(KEY_FILE_PATH)) throw new Error(`Thiếu file key.json`);
    if (!fs.existsSync(filePath)) throw new Error(`File nguồn không tồn tại`);

    const driveFileName = `backup_${new Date().getTime()}.bak`;

    const auth = new google.auth.GoogleAuth({
      keyFile: KEY_FILE_PATH,
      scopes: ["https://www.googleapis.com/auth/drive"], // Mở rộng scope để ghi vào thư mục được chia sẻ
    });

    const drive = google.drive({ version: "v3", auth });

    const fileMetadata = {
      name: driveFileName,
      parents: [DRIVE_FOLDER_ID],
    };

    const media = {
      // Đổi mimeType thành binary để phù hợp với file .bak
      mimeType: "application/octet-stream",
      body: fs.createReadStream(filePath),
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id",
    });

    console.log("Upload thành công! ID:", response.data.id);

    // Tự động dọn dẹp file ở máy Windows sau khi đã lên Drive thành công
    fs.unlinkSync(filePath);

    return { success: true, fileId: response.data.id, fileName: driveFileName };
  } catch (error) {
    console.error("Lỗi Drive:", error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("upload-to-drive", async (event, filePath) => {
  try {
    // 1. Kiểm tra các file cần thiết
    if (!fs.existsSync(KEY_FILE_PATH)) {
      throw new Error(`Không tìm thấy file key.json tại: ${KEY_FILE_PATH}`);
    }
    if (!fs.existsSync(filePath)) {
      throw new Error(`File nguồn không tồn tại: ${filePath}`);
    }

    // 2. Tạo tên file mới với timestamp để tránh ghi đè trên Drive
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const originalExt = path.extname(filePath); // Lấy đuôi .sql hoặc .bak
    const driveFileName = `backup_${timestamp}${originalExt}`;

    // 3. Khởi tạo quyền truy cập Google
    const auth = new google.auth.GoogleAuth({
      keyFile: KEY_FILE_PATH,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    const drive = google.drive({ version: "v3", auth });

    // 4. Thiết lập thông tin file cho Google Drive
    const fileMetadata = {
      name: driveFileName,
      parents: [DRIVE_FOLDER_ID],
    };

    const media = {
      mimeType: "application/x-sql",
      body: fs.createReadStream(filePath),
    };

    // 5. Thực hiện Upload
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id",
    });

    console.log("Upload thành công! ID:", response.data.id);

    // 6. (Tùy chọn) Xóa file tạm ở Local sau khi đã upload xong thành công
    // fs.unlinkSync(filePath);

    return { success: true, fileId: response.data.id, fileName: driveFileName };
  } catch (error) {
    console.error("Lỗi hệ thống:", error.message);
    return { success: false, error: error.message };
  }
});

// 2. (Gợi ý thêm) Handler để lưu thông tin cấu hình SQL vào file cục bộ
ipcMain.handle("save-config", async (event, config) => {
  try {
    const configPath = path.join(app.getPath("userData"), "db-config.json");
    fs.writeFileSync(configPath, JSON.stringify(config));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
