import { app, BrowserWindow, ipcMain } from "electron";
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

// ==========================================================
// 1. CẤU HÌNH ĐƯỜNG DẪN DUY NHẤT (Sửa lỗi Duplicate Declaration)
// ==========================================================
const CONFIG_DIR = path.join(process.cwd(), "configs");
const CREDENTIALS_PATH = path.join(CONFIG_DIR, "client_secret.json");
const CONTACTS_PATH = path.join(CONFIG_DIR, "contacts.json");
const TOKEN_PATH = path.join(app.getPath('userData'), "token.json");

// Thêm scope gmail.send để gửi mail cho Team
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/gmail.send"
];

// ==========================================================
// 2. CÁC HÀM XỬ LÝ LOGIC (GOOGLE & EMAIL)
// ==========================================================

/**
 * Hàm gửi Email cho danh sách Team từ file contacts.json
 */
async function sendEmailNotifications(auth, fileName) {
  if (!fs.existsSync(CONTACTS_PATH)) {
    console.error("Không tìm thấy file configs/contacts.json");
    return;
  }

  const contacts = JSON.parse(fs.readFileSync(CONTACTS_PATH, 'utf8'));
  const gmail = google.gmail({ version: 'v1', auth });

  for (const email of contacts.emails) {
    try {
      const subject = '🔔 [Hệ thống] Backup Database thành công';
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `To: ${email}`,
        'Content-Type: text/html; charset=utf-8',
        `Subject: ${utf8Subject}`,
        '',
        `Chào bạn,<br><br>Hệ thống thông báo file backup <b>${fileName}</b> đã được upload lên Google Drive thành công.<br>Dữ liệu tạm thời tại thư mục <b>src/temp</b> đã được dọn dẹp tự động.`
      ];
      const message = messageParts.join('\n');
      const encodedMessage = Buffer.from(message)
        .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage },
      });
      console.log(`Đã gửi email thành công tới: ${email}`);
    } catch (err) {
      console.error(`Lỗi gửi mail tới ${email}:`, err.message);
    }
  }
}

/**
 * Hàm xác thực OAuth2 - Đảm bảo trả về đối tượng auth chuẩn
 */
async function getAuthenticatedClient() {
  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const tokenData = fs.readFileSync(TOKEN_PATH, 'utf8');
      const credentials = JSON.parse(tokenData);
      console.log("Phát hiện Token cũ, đang khởi tạo client...");
      return google.auth.fromJSON(credentials);
    } catch (e) {
      console.warn("Token cũ hỏng, đang tiến hành xóa và đăng nhập lại.");
      if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH);
    }
  }

  try {
    console.log("Đang mở trình duyệt để xác thực Google...");
    const client = await authenticate({
      keyfilePath: CREDENTIALS_PATH,
      scopes: SCOPES,
      port: 3000,
    });

    if (client.credentials) {
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(client.credentials));
      console.log("Đã lưu Token thành công tại:", TOKEN_PATH);
      
      const auth = new google.auth.OAuth2();
      auth.setCredentials(client.credentials);
      return auth;
    }
  } catch (error) {
    console.error("LỖI XÁC THỰC GOOGLE:", error.message);
    throw error;
  }
}

// ==========================================================
// 3. IPC MAIN HANDLERS (DÀNH CHO REACT GỌI)
// ==========================================================

// --- HANDLER: TẠO BACKUP TRONG THƯ MỤC TEMP ---
ipcMain.handle("create-sql-backup", async (event, dbConfig) => {
  const backupDir = path.join(process.cwd(), "src", "temp"); 
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
    console.log("Đã tạo file backup tạm thời tại:", filePath);
    return { success: true, filePath: filePath, fileName: fileName };
  } catch (err) {
    console.error("Lỗi SQL Backup:", err.message);
    return { success: false, error: err.message };
  }
});

// --- HANDLER: UPLOAD, GỬI MAIL VÀ DỌN DẸP ---
ipcMain.handle("upload-to-drive", async (event, filePath) => {
  try {
    const auth = await getAuthenticatedClient();
    const drive = google.drive({ version: "v3", auth });
    
    // Tìm hoặc tạo folder SQL_Backups
    const folderName = "SQL_Backups";
    let folderId = "";
    const listResponse = await drive.files.list({
      q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id)',
    });

    if (listResponse.data.files.length > 0) {
      folderId = listResponse.data.files[0].id;
    } else {
      const folder = await drive.files.create({
        resource: { name: folderName, mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id',
      });
      folderId = folder.data.id;
    }

    const fileName = path.basename(filePath);
    const response = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { body: fs.createReadStream(filePath) },
      fields: "id",
    });

    if (response.data.id) {
      console.log("Upload thành công. Đang gửi email cho Team...");
      
      // Gửi thông báo Gmail
      await sendEmailNotifications(auth, fileName);
      
      // TỰ ĐỘNG DỌN DẸP
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Đã dọn dẹp file tạm tại: ${filePath}`);
      }
    }
    return { success: true, fileId: response.data.id };
  } catch (error) {
    console.error("Lỗi Drive:", error.message);
    return { success: false, error: error.message };
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

// ==========================================================
// 4. KHỞI TẠO CỬA SỔ ỨNG DỤNG
// ==========================================================
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