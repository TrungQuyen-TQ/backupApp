import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import { google } from "googleapis";
import started from "electron-squirrel-startup";
import sql from "mssql";
import { authenticate } from "@google-cloud/local-auth";
import SftpClient from "ssh2-sftp-client"; // Đã chuyển sang import đồng nhất
import archiver from "archiver";
import zipEncryptable from "archiver-zip-encryptable";
import { testConnectionHandlers } from "./handlers/testConnectionHandlers.js";
import { backupHandlers } from "./handlers/backupHandlers.js";
import { fileURLToPath } from "node:url";
import { registerMSSQLHandlers } from "./ipc/db-mssql.js";
import { registerMySQLHandlers } from "./ipc/db-mysql.js";
import { registerMongoHandlers } from "./ipc/db-mongo.js";
import { registerPostgresHandlers } from "./ipc/db-postgres.js";
import cron from "node-cron";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Đăng ký định dạng nén (bọc try-catch để tránh lỗi registerFormat) ---
try {
  const registeredFormats = archiver.registeredFormats || {};
  if (!registeredFormats["zip-encryptable"]) {
    archiver.registerFormat("zip-encryptable", zipEncryptable);
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

// main.js

// Thêm đường dẫn tới file config mới
const DRIVE_ACCOUNTS_PATH = path.join(CONFIG_DIR, "drive_accounts.json");

// Handler để đọc danh sách tài khoản
ipcMain.handle("get-drive-accounts", async () => {
  try {
    if (!fs.existsSync(DRIVE_ACCOUNTS_PATH)) {
      // Tạo file mặc định nếu chưa tồn tại
      const defaultData = [
        { email: "linhnguyen05211@gmail.com", label: "Drive Cá Nhân" },
      ];
      fs.writeFileSync(
        DRIVE_ACCOUNTS_PATH,
        JSON.stringify(defaultData, null, 2),
      );
      return { success: true, accounts: defaultData };
    }
    const data = fs.readFileSync(DRIVE_ACCOUNTS_PATH, "utf8");
    return { success: true, accounts: JSON.parse(data) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// main.js - Cập nhật hàm lấy Token theo Email
async function getAuthenticatedClient(email) {
  // KIỂM TRA AN TOÀN: Nếu email không tồn tại hoặc không phải string
  if (!email || typeof email !== 'string') {
    throw new Error(`Email xác thực không hợp lệ: ${email}`);
  }

  // const safeEmail = email.replace(/[^a-z0-9]/gi, "_");
  // const SPECIFIC_TOKEN_PATH = path.join(app.getPath("userData"), `token_${safeEmail}.json`);

  const safeEmail = email.replace(/[^a-z0-9]/gi, "_");
  const SPECIFIC_TOKEN_PATH = path.join(app.getPath("userData"), `token_${safeEmail}.json`);

  if (fs.existsSync(SPECIFIC_TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(SPECIFIC_TOKEN_PATH, "utf8"));
    const credentialsContent = fs.readFileSync(CREDENTIALS_PATH, "utf8");
    const keys =
      JSON.parse(credentialsContent).installed ||
      JSON.parse(credentialsContent).web;

    const auth = new google.auth.OAuth2(
      keys.client_id,
      keys.client_secret,
      keys.redirect_uris[0],
    );
    auth.setCredentials(token);
    return auth;
  }

  // Nếu chưa có token cho email này, bắt đầu quy trình đăng nhập mới
  const auth = await authenticate({
    keyfilePath: CREDENTIALS_PATH,
    scopes: SCOPES,
  });

  if (auth.credentials) {
    fs.writeFileSync(SPECIFIC_TOKEN_PATH, JSON.stringify(auth.credentials));
  }
  return auth;
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
      error: err.message,
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
          const relativePath = path
            .relative(tempDir, fullPath)
            .replace(/\\/g, "/");

          files.push({
            name: relativePath,
            path: fullPath,
            size: `${sizeInMB} MB`,
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

ipcMain.handle("upload-to-drive", async (event, { files, targetEmail }) => {
  try {
    // Kiểm tra log ở Terminal (màn hình đen) để chắc chắn email đã xuống tới đây
    console.log("Đang bắt đầu upload cho email:", targetEmail);

    const auth = await getAuthenticatedClient(targetEmail);
    const drive = google.drive({ version: "v3", auth });

    // 1. Tìm hoặc tạo folder SQL_Backups
    const list = await drive.files.list({
      q: "name = 'SQL_Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    });

    let folderId =
      list.data.files.length > 0
        ? list.data.files[0].id
        : (
            await drive.files.create({
              requestBody: {
                name: "SQL_Backups",
                mimeType: "application/vnd.google-apps.folder",
              },
              fields: "id",
            })
          ).data.id;

    const uploadResults = [];

    // 2. Vòng lặp upload từng file
    for (const fileObj of files) {
      try {
        const driveFileName = fileObj.name.replace(/\//g, " - ");
        const fileSize = fs.statSync(fileObj.path).size;
        let uploadedBytes = 0;
        let lastTime = Date.now();

        // THỰC HIỆN UPLOAD
        const res = await drive.files.create(
          {
            requestBody: { name: driveFileName, parents: [folderId] },
            media: { body: fs.createReadStream(fileObj.path) },
            fields: "id", // Yêu cầu trả về ID để xác nhận thành công
          },
          {
            onUploadProgress: (evt) => {
              const currentTime = Date.now();
              const duration = (currentTime - lastTime) / 1000;
              if (duration > 0.5) {
                const bytesSinceLast = evt.bytesRead - uploadedBytes;
                const speed = bytesSinceLast / duration / (1024 * 1024);

                event.sender.send("upload-progress", {
                  fileName: fileObj.name,
                  progress: Math.round((evt.bytesRead / fileSize) * 100),
                  speed: speed.toFixed(2) + " MB/s",
                });

                uploadedBytes = evt.bytesRead;
                lastTime = currentTime;
              }
            },
          },
        );

        // Log ra terminal để bạn debug: Nếu có ID nghĩa là file đã thực sự nằm trên Drive
        console.log(
          `✅ File [${driveFileName}] đã lên Drive. ID: ${res.data.id}`,
        );

        // 3. Xóa file local sau khi upload thành công
        /*
        if (fs.existsSync(fileObj.path)) {
          fs.unlinkSync(fileObj.path); 
        }
        */

        event.sender.send("file-done", {
          fileName: fileObj.name,
          status: "OK",
        });
        uploadResults.push({
          name: fileObj.name,
          success: true,
          driveId: res.data.id,
        });
      } catch (uploadError) {
        console.error(`❌ Lỗi upload file ${fileObj.name}:`, uploadError);
        event.sender.send("file-done", {
          fileName: fileObj.name,
          status: "Lỗi",
          error: uploadError.message,
        });
        uploadResults.push({ name: fileObj.name, success: false });
      }
    }

    return { success: true, results: uploadResults };
  } catch (error) {
    console.error("❌ Lỗi tổng quát upload-to-drive:", error);
    return { success: false, error: error.message };
  }
});

// Thêm đoạn này vào main.js (bên cạnh các ipcMain.handle khác)
ipcMain.handle("delete-temp-files", async (event, files) => {
  try {
    for (const file of files) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        console.log(`🗑️ Đã dọn dẹp file tạm: ${file.name}`);
      }
    }
    return { success: true };
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
    return { success: true, databases: result.recordset.map((r) => r.name) };
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
const VITE_WINDOW_NAME =
  typeof MAIN_WINDOW_VITE_NAME !== "undefined"
    ? MAIN_WINDOW_VITE_NAME
    : "main_window";
const createWindow = () => {
  const win = new BrowserWindow({
    width: 1100,
    height: 900,
    webPreferences: {
      // __dirname đã được định nghĩa chuẩn ở đầu file của bạn
      preload: path.join(__dirname, "preload.js"),
      disableBlinkFeatures: "AutomationControlled",
    },
  });

  // Kiểm tra biến Vite an toàn để tránh ReferenceError
  if (
    typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== "undefined" &&
    MAIN_WINDOW_VITE_DEV_SERVER_URL
  ) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    // Nếu là bản build, load file index.html
    // Lưu ý: path.join(__dirname, "../index.html") tùy thuộc vào cấu trúc thư mục out của bạn
    const indexPath = path.join(
      __dirname,
      "..",
      "renderer",
      "main_window",
      "index.html",
    );
    if (fs.existsSync(indexPath)) {
      win.loadFile(indexPath);
    } else {
      win.loadFile(path.join(__dirname, "../index.html"));
    }
  }
};

async function uploadFilesInternal(files, targetEmail) {
  try {
    const auth = await getAuthenticatedClient(targetEmail);
    const drive = google.drive({ version: "v3", auth });

    // 1. Tìm hoặc tạo folder SQL_Backups
    const list = await drive.files.list({
      q: "name = 'SQL_Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    });

    let folderId =
      list.data.files.length > 0
        ? list.data.files[0].id
        : (
            await drive.files.create({
              requestBody: {
                name: "SQL_Backups",
                mimeType: "application/vnd.google-apps.folder",
              },
              fields: "id",
            })
          ).data.id;

    // 2. Upload từng file
    for (const fileObj of files) {
      try {
        const driveFileName = fileObj.name.replace(/\//g, " - ");
        const res = await drive.files.create({
          requestBody: { name: driveFileName, parents: [folderId] },
          media: { body: fs.createReadStream(fileObj.path) },
          fields: "id",
        });
        console.log(
          `[Internal Upload] Thành công: ${driveFileName} ID: ${res.data.id}`,
        );
      } catch (err) {
        console.error(
          `[Internal Upload] Lỗi file ${fileObj.name}:`,
          err.message,
        );
        throw err;
      }
    }
    return { success: true };
  } catch (error) {
    console.error("❌ Lỗi upload nội bộ:", error);
    throw error;
  }
}

async function executeAutoBackup(task) {
  const { server, databases, targetEmails } = task;
  // targetEmails ở đây có thể là mảng string: ["mail1@gmail.com", "mail2@gmail.com"]

  for (const dbName of databases) {
    try {
      // 1. Tạo config cho DB cụ thể
      const dbConfig = { ...server, database: dbName };

      // 2. Gọi handler backup (đã có trong backupHandlers.js)
      console.log(`[Auto] Đang dump dữ liệu cho DB: ${dbName}`);
      const backupResult = await backupHandlers[dbConfig.dbType](dbConfig);

      if (backupResult.success) {
        const fileToUpload = {
          name: path.basename(backupResult.filePath),
          path: backupResult.filePath,
        };

        // 3. Vòng lặp đẩy lên từng Drive đã chọn
        // Lưu ý: Chúng ta tái sử dụng logic từ handler "upload-to-drive"
        // Tìm đến đoạn này trong executeAutoBackup của bạn và sửa lại:
        for (const emailEntry of targetEmails) {
          try {
            // Kiểm tra nếu emailEntry là object thì lấy thuộc tính .email, nếu là string thì dùng luôn
            const emailStr =
              typeof emailEntry === "object" ? emailEntry.email : emailEntry;

            console.log(
              `[Auto] Đang upload ${dbName} lên Drive của: ${emailStr}`,
            );

            await uploadFilesInternal([fileToUpload], emailStr);
          } catch (uploadErr) {
            // Sửa log lỗi để thấy rõ email nào bị lỗi
            const errEmail =
              typeof emailEntry === "object" ? emailEntry.email : emailEntry;
            console.error(
              `[Auto Error] Lỗi upload lên ${errEmail}:`,
              uploadErr.message,
            );
          }
        }

        // 4. Xóa file tạm sau khi đã đẩy lên tất cả Drive
        if (fs.existsSync(backupResult.filePath)) {
          fs.unlinkSync(backupResult.filePath);
          console.log(`[Auto] Đã dọn dẹp file tạm: ${fileToUpload.name}`);
        }
      }
    } catch (err) {
      console.error(
        `[Auto Error] Lỗi tổng quát cho DB ${dbName}:`,
        err.message,
      );
    }
  }
}

const AUTO_CONFIG_PATH = path.join(CONFIG_DIR, "auto_backups.json");
let activeJobs = {}; // Lưu các job đang chạy để có thể hủy/cập nhật

// --- HÀM HỖ TRỢ: Chuyển đổi từ UI sang Cron Expression ---
function getCronExpression(schedule) {
  const { interval, type, time } = schedule;

  // Ép kiểu về số nguyên dương, tối thiểu là 1
  const safeInterval = Math.max(1, Math.floor(parseFloat(interval)) || 1);

  if (type === "minute") {
    // Chạy mỗi X phút: */X * * * *
    return `*/${safeInterval} * * * *`;
  } else if (type === "hour") {
    // Chạy mỗi X giờ vào phút thứ 0: 0 */X * * *
    return `0 */${safeInterval} * * *`;
  } else {
    // Chạy mỗi X ngày vào lúc HH:mm
    if (!time || !time.includes(":")) return "0 0 * * *"; // Mặc định nửa đêm nếu lỗi
    const [hour, minute] = time.split(":");
    return `${parseInt(minute)} ${parseInt(hour)} */${safeInterval} * *`;
  }
}
// --- IPC HANDLE: Lưu và Kích hoạt ---
ipcMain.handle("save-auto-backup", async (event, config) => {
  try {
    // 1. Lưu vào file JSON để bảo toàn dữ liệu khi tắt app
    let currentConfigs = [];
    if (fs.existsSync(AUTO_CONFIG_PATH)) {
      const content = fs.readFileSync(AUTO_CONFIG_PATH, "utf8");
      // Nếu file có nội dung thì mới parse, không thì để mảng rỗng
      if (content.trim()) {
        currentConfigs = JSON.parse(content);
      }
    }

    // Gán ID để quản lý (nếu cùng server+type thì có thể ghi đè hoặc thêm mới)
    const newConfig = { ...config, id: Date.now() };
    currentConfigs.push(newConfig);
    fs.writeFileSync(AUTO_CONFIG_PATH, JSON.stringify(currentConfigs, null, 2));

    // 2. Thiết lập Cron Job thực tế
    const expression = getCronExpression(config.schedule);

    const job = cron.schedule(expression, () => {
      console.log(
        `[Cron] Bắt đầu chạy backup tự động cho: ${config.server.server}`,
      );
      executeAutoBackup(newConfig); // Gọi hàm Worker bạn đã viết
    });

    // Lưu vào bộ nhớ để quản lý
    activeJobs[newConfig.id] = job;

    console.log(`[Cron] Đã lập lịch thành công: ${expression}`);
    return { success: true };
  } catch (error) {
    console.error("Lỗi save-auto-backup:", error);
    return { success: false, error: error.message };
  }
});

// Thêm handler này vào main.js
ipcMain.handle("stop-auto-backup", async (event, taskId) => {
  try {
    // 1. Kiểm tra xem Job có tồn tại trong bộ nhớ không
    if (activeJobs[taskId]) {
      activeJobs[taskId].stop(); // Lệnh dừng node-cron
      delete activeJobs[taskId]; // Xóa khỏi bộ nhớ quản lý
      console.log(`[Cron] Đã dừng thành công Task: ${taskId}`);
    }

    // 2. Cập nhật lại file JSON (Chuyển trạng thái hoặc xóa)
    if (fs.existsSync(AUTO_CONFIG_PATH)) {
      let configs = JSON.parse(fs.readFileSync(AUTO_CONFIG_PATH, "utf8"));
      // Cách 1: Xóa hẳn task khỏi danh sách
      configs = configs.filter(task => task.id !== taskId);
      
      // Hoặc Cách 2: Thêm thuộc tính enabled: false nếu bạn muốn giữ lại cấu hình
      // configs = configs.map(task => task.id === taskId ? { ...task, enabled: false } : task);

      fs.writeFileSync(AUTO_CONFIG_PATH, JSON.stringify(configs, null, 2));
    }

    return { success: true };
  } catch (error) {
    console.error("Lỗi khi dừng backup:", error);
    return { success: false, error: error.message };
  }
});



// --- HÀM KHỞI TẠO: Chạy khi App vừa mở (app.whenReady) ---


function initAutoBackups() {
  if (fs.existsSync(AUTO_CONFIG_PATH)) {
    try {
      const content = fs.readFileSync(AUTO_CONFIG_PATH, "utf8");
      // Kiểm tra nếu file trống thì bỏ qua
      if (!content.trim()) return; 

      const configs = JSON.parse(content);
      configs.forEach(config => {
        const expression = getCronExpression(config.schedule);
        const job = cron.schedule(expression, () => {
          executeAutoBackup(config);
        });
        activeJobs[config.id] = job;
      });
      console.log(`[System] Đã khôi phục ${configs.length} lịch trình backup.`);
    } catch (e) {
      console.error("Lỗi khôi phục lịch backup:", e.message);
    }
  }
}


// 1. Handler lấy danh sách cấu hình để hiển thị lên giao diện
ipcMain.handle("get-auto-configs", async () => {
  try {
    if (fs.existsSync(AUTO_CONFIG_PATH)) {
      const data = fs.readFileSync(AUTO_CONFIG_PATH, "utf8");
      return { success: true, configs: JSON.parse(data) };
    }
    return { success: true, configs: [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 2. Sửa lại handler stopAllBackups (tên hàm phải khớp với React của bạn)
ipcMain.handle("stop-all-backups", async () => {
  try {
    // Dừng tất cả job trong RAM
    Object.keys(activeJobs).forEach(id => {
      activeJobs[id].stop();
      delete activeJobs[id];
    });
    // Xóa file cứng
    fs.writeFileSync(AUTO_CONFIG_PATH, JSON.stringify([], null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// CHỈ gọi createWindow khi app đã ready
app.whenReady().then(() => {
  initAutoBackups(); // Kích hoạt lại các lịch trình đã lưu
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
