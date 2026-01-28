import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import { google } from "googleapis";
import started from "electron-squirrel-startup";
import sql from "mssql";

// Sử dụng require cho thư viện xác thực
const { authenticate } = require('@google-cloud/local-auth');

if (started) {
  app.quit();
}

// 1. CẤU HÌNH ĐƯỜNG DẪN
// client_secret.json để trong thư mục configs của dự án
const CREDENTIALS_PATH = path.join(process.cwd(), "configs", "client_secret.json");
// token.json lưu vào AppData hệ thống để tránh lỗi "Read-only" và lỗi quyền ghi
const TOKEN_PATH = path.join(app.getPath('userData'), "token.json");

/**
 * Hàm xác thực OAuth2 - Đã sửa lỗi "Login Required"
 */
async function getAuthenticatedClient() {
  // Kiểm tra nếu đã có token cũ
  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const tokenData = fs.readFileSync(TOKEN_PATH, 'utf8');
      const credentials = JSON.parse(tokenData);
      console.log("Phát hiện Token cũ, đang khởi tạo client...");
      
      // Tạo đối tượng auth từ credentials cũ
      const auth = google.auth.fromJSON(credentials);
      return auth;
    } catch (e) {
      console.warn("Token cũ hỏng, đang tiến hành xóa và đăng nhập lại.");
      if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH);
    }
  }

  // Luồng đăng nhập mới nếu chưa có token hoặc token hỏng
  try {
    console.log("Đang mở trình duyệt để xác thực Google...");
    const client = await authenticate({
      keyfilePath: CREDENTIALS_PATH,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
      port: 3000, // Cố định cổng để tránh bị Firewall chặn
    });

    if (client.credentials) {
      // Lưu token vào thư mục userData
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(client.credentials));
      console.log("Đã lưu Token thành công tại:", TOKEN_PATH);
      
      // QUAN TRỌNG: Tạo và trả về đối tượng OAuth2 chuẩn từ credentials mới
      const auth = new google.auth.OAuth2();
      auth.setCredentials(client.credentials);
      return auth;
    }
  } catch (error) {
    console.error("LỖI XÁC THỰC GOOGLE:");
    if (error.response) console.error("Chi tiết từ Google API:", error.response.data);
    throw error;
  }
}

// --- HANDLER: UPLOAD LÊN GOOGLE DRIVE ---
ipcMain.handle("upload-to-drive", async (event, filePath) => {
  try {
    // Lấy auth đã được xác thực
    const auth = await getAuthenticatedClient();
    if (!auth) throw new Error("Không thể xác thực tài khoản Google.");

    const drive = google.drive({ version: "v3", auth });

    const fileName = path.basename(filePath);
    const media = {
      mimeType: "application/octet-stream",
      body: fs.createReadStream(filePath),
    };

    console.log(`Đang upload file ${fileName} lên Google Drive...`);
    const response = await drive.files.create({
      requestBody: { name: fileName },
      media: media,
      fields: "id",
    });

    console.log("Upload lên My Drive thành công! ID:", response.data.id);
    return { success: true, fileId: response.data.id, fileName: fileName };
  } catch (error) {
    console.error("Lỗi Drive:", error.message);
    return { success: false, error: error.message };
  }
});

// --- HANDLER: TẠO BACKUP SQL SERVER ---
ipcMain.handle("create-sql-backup", async (event, dbConfig) => {
  const backupDir = "C:/hls_output";
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const fileName = `${dbConfig.database}_${Date.now()}.bak`;
  const filePath = path.join(backupDir, fileName);

  const sqlConfig = {
    user: dbConfig.user,
    password: dbConfig.password,
    server: dbConfig.server,
    database: dbConfig.database,
    port: Number(dbConfig.port),
    options: { encrypt: true, trustServerCertificate: true },
  };

  try {
    const pool = await sql.connect(sqlConfig);
    const query = `BACKUP DATABASE [${dbConfig.database}] TO DISK = '${filePath}'`;
    await pool.request().query(query);
    await pool.close();
    console.log("Đã tạo file backup tại:", filePath);
    return { success: true, filePath: filePath, fileName: fileName };
  } catch (err) {
    console.error("Lỗi SQL Backup:", err.message);
    return { success: false, error: err.message };
  }
});

// --- HANDLER: TEST KẾT NỐI SQL ---
ipcMain.handle("test-connection", async (event, dbConfig) => {
  try {
    const sqlConfig = {
      user: dbConfig.user,
      password: dbConfig.password,
      server: dbConfig.server,
      database: dbConfig.database,
      port: Number(dbConfig.port),
      options: { encrypt: true, trustServerCertificate: true, connectTimeout: 5000 },
    };
    const pool = await sql.connect(sqlConfig);
    await pool.close();
    return { success: true, message: "Kết nối thành công!" };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Khởi tạo cửa sổ ứng dụng
const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1050,
    height: 850,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
};

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});