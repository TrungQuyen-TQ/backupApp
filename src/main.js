import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import { google } from "googleapis";
import started from "electron-squirrel-startup";
import sql from "mssql";
import { authenticate } from "@google-cloud/local-auth";
import SftpClient from "ssh2-sftp-client"; // Đã chuyển sang import đồng nhất
import archiver from 'archiver';
import zipEncryptable from 'archiver-zip-encryptable';
import { testConnectionHandlers } from "./handlers/testConnectionHandlers.js";
import { backupHandlers } from "./handlers/backupHandlers.js";
import { fileURLToPath } from 'node:url';
import { registerMSSQLHandlers } from "./ipc/db-mssql.js";
import { registerMySQLHandlers } from "./ipc/db-mysql.js";
import { registerMongoHandlers } from "./ipc/db-mongo.js";
import { registerPostgresHandlers } from "./ipc/db-postgres.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Đăng ký định dạng nén (bọc try-catch để tránh lỗi registerFormat) ---
try {
  const registeredFormats = archiver.registeredFormats || {};
  if (!registeredFormats['zip-encryptable']) {
    archiver.registerFormat('zip-encryptable', zipEncryptable);
  }
} catch (e) {
  console.warn("Format đã được đăng ký");
}

if (started) {
  app.quit();
}

// --- Cấu hình đường dẫn ---
const CONFIG_DIR = path.join(process.cwd(), "configs");
const CREDENTIALS_PATH = path.join(CONFIG_DIR, "client_secret.json");
const CONTACTS_PATH = path.join(CONFIG_DIR, "contacts.json");
const TOKEN_PATH = path.join(app.getPath("userData"), "token.json");
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/gmail.send",
];

async function getAuthenticatedClient() {
  try {
    // 1. Nếu đã có token lưu từ trước
    if (fs.existsSync(TOKEN_PATH)) {
      const tokenData = fs.readFileSync(TOKEN_PATH, "utf8");
      const token = JSON.parse(tokenData);

      const credentialsContent = fs.readFileSync(CREDENTIALS_PATH, "utf8");
      const keys = JSON.parse(credentialsContent).installed || JSON.parse(credentialsContent).web;

      const auth = new google.auth.OAuth2(
        keys.client_id,
        keys.client_secret,
        keys.redirect_uris[0]
      );

      auth.setCredentials(token);
      return auth;
    }

    // 2. NẾU CHƯA CÓ TOKEN: Tiến hành đăng nhập mới
    // Sử dụng thư viện authenticate từ @google-cloud/local-auth đã import ở đầu file
    const auth = await authenticate({
      keyfilePath: CREDENTIALS_PATH,
      scopes: SCOPES,
    });

    // 3. Lưu token mới lại để lần sau không phải đăng nhập nữa
    if (auth.credentials) {
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(auth.credentials));
    }

    return auth;
  } catch (error) {
    console.error("Lỗi xác thực Google:", error);
    // Trả về lỗi rõ ràng để UI có thể hiển thị
    throw new Error("unauthorized_client: Vui lòng kiểm tra cấu hình Google Cloud hoặc Test Users.");
  }
}

async function getDatabaseStats(pool) {
  const versionRaw = await pool.request().query("SELECT @@VERSION as version");
  const shortVersion = versionRaw.recordset[0].version
    .split("-")[0]
    .split("\n")[0]
    .trim();

  // Tự động quét tất cả các bảng người dùng tạo (không phải bảng hệ thống)
  const tablesQuery = await pool.request().query(`
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME NOT LIKE 'sys%'
  `);

  const allTables = tablesQuery.recordset.map((row) => row.TABLE_NAME);
  let rowCounts = {};

  for (const table of allTables) {
    try {
      const result = await pool
        .request()
        .query(`SELECT COUNT(*) as count FROM [${table}]`);
      rowCounts[table] = result.recordset[0].count;
    } catch (err) {
      rowCounts[table] = "N/A";
    }
  }
  return { shortVersion, rowCounts };
}

// ==========================================================
// 2. HÀM XÁC THỰC GOOGLE (OAuth2)
// ==========================================================

// ==========================================================
// 3. HÀM GỬI EMAIL THÔNG BÁO
// ==========================================================
async function sendEmailNotifications(auth, fileName, stats) {
  if (!fs.existsSync(CONTACTS_PATH)) return;
  const contacts = JSON.parse(fs.readFileSync(CONTACTS_PATH, "utf8"));
  const gmail = google.gmail({ version: "v1", auth });

  const tableRowsHtml = Object.entries(stats.rowCounts)
    .map(([table, count]) => `<li><b>${table}</b>: ${count} dòng</li>`)
    .join("");

  for (const email of contacts.emails) {
    try {
      const subject = `🔔 [Backup Report] ${fileName}`;
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
      const messageParts = [
        `To: ${email}`,
        "Content-Type: text/html; charset=utf-8",
        `Subject: ${utf8Subject}`,
        "",
        `<h3>Báo cáo Backup chi tiết</h3>`,
        `<p>Hệ thống vừa backup thành công file: <b>${fileName}</b></p>`,
        `<hr>`,
        `<p><b>Hệ thống:</b> ${stats.shortVersion}</p>`,
        `<p><b>Thống kê dữ liệu:</b></p>`,
        `<ul>${tableRowsHtml}</ul>`,
        `<br><p>Xác thực: <b>VERIFYONLY OK</b></p>`,
      ];
      const message = messageParts.join("\n");
      const encodedMessage = Buffer.from(message)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encodedMessage },
      });
    } catch (err) {
      console.error(`Lỗi gửi mail: ${err.message}`);
    }
  }
}

// ==========================================================
// 4. CÁC IPC HANDLERS (Đầu nối với giao diện)
// ==========================================================

ipcMain.handle("test-connection", async (event, dbConfig) => {
  console.log("Testing connection with config:", dbConfig);
  
  try {
    const handler = testConnectionHandlers[dbConfig.dbType];

    if (!handler) {
      throw new Error("Database type not supported");
    }

    return await handler(dbConfig);

  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
});

ipcMain.handle("check-database-info", async (event, dbConfig) => {
  try {
    const pool = await sql.connect({
      user: dbConfig.dbUser,
      password: dbConfig.dbPassword,
      server: dbConfig.server,
      database: dbConfig.database,
      port: Number(dbConfig.port),
      options: { encrypt: true, trustServerCertificate: true },
    });
    const stats = await getDatabaseStats(pool);
    await pool.close();
    return {
      success: true,
      version: stats.shortVersion,
      counts: stats.rowCounts,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("create-sql-backup", async (event, dbConfig) => {
 const handler = backupHandlers[dbConfig.dbType];

  if (!handler) {
    return { success: false, error: "Unsupported database type" };
  }

  return await handler(dbConfig);
});

ipcMain.handle("get-temp-files", async (event) => {
  try {
    const tempDir = path.join(process.cwd(), "src", "temp");
    if (!fs.existsSync(tempDir)) {
      return { success: true, files: [] };
    }

    const files = [];
    const readDirRecursive = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          readDirRecursive(fullPath);
        } else {
          const stats = fs.statSync(fullPath);
          const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

          // Use relative path for UI, replace backslashes with forward slashes 
          // to make it consistent across platforms
          const relativePath = path.relative(tempDir, fullPath).replace(/\\/g, '/');

          files.push({
            name: relativePath,
            path: fullPath,
            size: `${sizeInMB} MB`
          });
        }
      }
    };
    readDirRecursive(tempDir);

    return { success: true, files };
  } catch (error) {
    console.error("Lỗi đọc thư mục temp:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("upload-to-drive", async (event, { files }) => {
  try {
    const auth = await getAuthenticatedClient();
    const drive = google.drive({ version: "v3", auth });

    // --- Logic tìm/tạo folder (giữ nguyên) ---
    const list = await drive.files.list({
      q: "name = 'SQL_Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    });
    let folderId = list.data.files.length > 0 ? list.data.files[0].id : (await drive.files.create({
      requestBody: { name: "SQL_Backups", mimeType: "application/vnd.google-apps.folder" },
      fields: "id",
    })).data.id;

    const uploadResults = [];

    for (const fileObj of files) {
      try {
        const driveFileName = fileObj.name.replace(/\//g, ' - ');
        const fileSize = fs.statSync(fileObj.path).size;
        let uploadedBytes = 0;
        let lastTime = Date.now();

        await drive.files.create({
          requestBody: { name: driveFileName, parents: [folderId] },
          media: { body: fs.createReadStream(fileObj.path) },
        }, {
          // Theo dõi tiến trình upload
          onUploadProgress: (evt) => {
            const currentTime = Date.now();
            const duration = (currentTime - lastTime) / 1000; // giây
            if (duration > 0.5) { // Cập nhật mỗi 0.5s để tránh lag UI
              const bytesSinceLast = evt.bytesRead - uploadedBytes;
              const speed = (bytesSinceLast / duration) / (1024 * 1024); // MB/s
              
              // Gửi thông tin về Renderer
              event.sender.send("upload-progress", {
                fileName: fileObj.name,
                progress: Math.round((evt.bytesRead / fileSize) * 100),
                speed: speed.toFixed(2) + " MB/s"
              });

              uploadedBytes = evt.bytesRead;
              lastTime = currentTime;
            }
          }
        });

        // Xóa file local sau khi xong
        if (fs.existsSync(fileObj.path)) {
          fs.unlinkSync(fileObj.path);
        }

        // Gửi tín hiệu hoàn tất 1 file
        event.sender.send("file-done", { fileName: fileObj.name, status: "OK" });
        uploadResults.push({ name: fileObj.name, success: true });

      } catch (uploadError) {
        event.sender.send("file-done", { fileName: fileObj.name, status: "Lỗi", error: uploadError.message });
        uploadResults.push({ name: fileObj.name, success: false });
      }
    }

    return { success: true, results: uploadResults };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Thêm vào main.js
ipcMain.handle("get-databases-list", async (event, dbConfig) => {
  try {
    const pool = await sql.connect({
      user: dbConfig.dbUser,
      password: dbConfig.dbPassword,
      server: dbConfig.server,
      port: Number(dbConfig.port),
      options: { encrypt: true, trustServerCertificate: true },
    });
    // Truy vấn lấy danh sách database (loại trừ các database hệ thống)
    const result = await pool.request().query(`
      SELECT name FROM sys.databases 
      WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')
    `);
    await pool.close();
    return { success: true, databases: result.recordset.map(r => r.name) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// main.js
ipcMain.handle("test-ssh-connection", async (event, config) => {
  const sftp = new SftpClient();
  try {
    await sftp.connect({
      host: config.server,
      port: Number(config.sshPort) || 22, // SỬA: Lấy port từ input, mặc định là 22
      username: config.user,
      password: config.password,
      readyTimeout: 15000, // Timeout sau 5s nếu không kết nối được
    });
    await sftp.end();
    return { success: true };
  } catch (err) {
    // Trả về lỗi chi tiết để hiển thị lên UI
    return { success: false, error: "Kết nối Server thất bại: " + err.message };
  }
});

// ensure constants exist to avoid crash when plugin hasn't injected them
const VITE_WINDOW_NAME = typeof MAIN_WINDOW_VITE_NAME !== "undefined" ? MAIN_WINDOW_VITE_NAME : "main_window";
const createWindow = () => {
  const win = new BrowserWindow({
    width: 1100,
    height: 900,
    webPreferences: { 
      // __dirname đã được định nghĩa chuẩn ở đầu file của bạn
      preload: path.join(__dirname, "preload.js"),
      disableBlinkFeatures: "AutomationControlled"
    },
  });

  // Kiểm tra biến Vite an toàn để tránh ReferenceError
  if (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== "undefined" && MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    // Nếu là bản build, load file index.html
    // Lưu ý: path.join(__dirname, "../index.html") tùy thuộc vào cấu trúc thư mục out của bạn
    const indexPath = path.join(__dirname, "..", "renderer", "main_window", "index.html");
    if (fs.existsSync(indexPath)) {
      win.loadFile(indexPath);
    } else {
      win.loadFile(path.join(__dirname, "../index.html"));
    }
  }
};

// CHỈ gọi createWindow khi app đã ready
app.whenReady().then(() => {

  registerMSSQLHandlers();
  registerMySQLHandlers();
  registerMongoHandlers();
  registerPostgresHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});