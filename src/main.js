import { app, BrowserWindow, ipcMain, shell, dialog } from "electron";
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
// main.js
import { Menu } from 'electron';

// Thêm dòng này để vô hiệu hóa Menu toàn cục
Menu.setApplicationMenu(null);

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
// Đảm bảo đường dẫn configs luôn đúng
const CONFIG_DIR = path.join(process.cwd(), "configs");
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR);

const CREDENTIALS_PATH = path.join(CONFIG_DIR, "client_secret.json");
const CONTACTS_PATH = path.join(CONFIG_DIR, "contacts.json");
const TOKEN_PATH = path.join(app.getPath("userData"), "token.json");
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/gmail.send",
  // THÊM 2 DÒNG NÀY ĐỂ LẤY ĐƯỢC EMAIL
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

const HISTORY_BACKUP_PATH = path.join(CONFIG_DIR, "history_backup.json");
const HISTORY_UPLOAD_PATH = path.join(CONFIG_DIR, "history_upload.json");
const INFO_PATH = path.join(CONFIG_DIR, "info.json");

// Hàm phụ trợ lưu history
// main.js - Sửa lại hàm saveHistory một chút cho Linh
const saveHistory = (filePath, data) => {
  try {
    // Chỉ lưu nếu data có giá trị hợp lệ
    if (!data) return { success: false };

    let history = [];
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      history = content ? JSON.parse(content) : [];
    }

    // Đảm bảo stats luôn là một object để không bị lỗi undefined ở UI
    const secureData = {
      ...data,
      stats: data.stats || { rowCounts: {}, shortVersion: "N/A" },
    };

    history.unshift({
      ...secureData,
      id: Date.now(),
      timestamp: new Date().toLocaleString("vi-VN"),
    });
    fs.writeFileSync(filePath, JSON.stringify(history.slice(0, 100), null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};


// main.js
let activeConnections = {}; // Object để lưu các kết nối SSH đang chạy theo ID

// Trong main.js
let currentSshClient = null;
let currentBackupController = null;



// main.js - Sửa handler authorize-gmail
// ipcMain.handle("authorize-gmail", async (event) => {
//   try {
//     // 1. Mở trình duyệt để người dùng chọn tài khoản (login_hint để trống để họ tự chọn)
//     const auth = await authenticate({
//       keyfilePath: CREDENTIALS_PATH,
//       scopes: SCOPES,
//       authClientOptions: { prompt: 'select_account' }
//     });

//     if (auth.credentials) {
//       // 2. Dùng thư viện googleapis để lấy thông tin user
//       const oauth2 = google.oauth2({ version: 'v2', auth });
//       const userInfo = await oauth2.userinfo.get();
//       const email = userInfo.data.email;

//       // 3. Lưu token theo email vừa lấy được
//       const safeEmail = email.replace(/[^a-z0-9]/gi, "_");
//       const SPECIFIC_TOKEN_PATH = path.join(app.getPath("userData"), `token_${safeEmail}.json`);
//       fs.writeFileSync(SPECIFIC_TOKEN_PATH, JSON.stringify(auth.credentials));

//       // Trả về email để Frontend tự động điền vào danh sách
//       return { success: true, email: email };
//     }
//     return { success: false, error: "Không lấy được thông tin" };
//   } catch (error) {
//     return { success: false, error: error.message };
//   }
// });


// main.js
// main.js
ipcMain.handle("authorize-gmail", async (event) => {
  try {
    // 1. Mở trình duyệt xác thực
    const auth = await authenticate({
      keyfilePath: CREDENTIALS_PATH,
      scopes: SCOPES,
      authClientOptions: { prompt: 'select_account' }
    });

    if (auth && auth.credentials) {
      // --- BƯỚC QUAN TRỌNG NHẤT: Đảm bảo Client có Token để gọi API ---
      // Chúng ta tạo một OAuth2 client mới và nạp credentials vào
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials(auth.credentials);

      // 2. Dùng oauth2Client đã có token để lấy thông tin user
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email;

      if (!email) throw new Error("Không lấy được email từ Google.");

      // 3. Lưu token theo email như cũ
      const safeEmail = email.replace(/[^a-z0-9]/gi, "_");
      const SPECIFIC_TOKEN_PATH = path.join(app.getPath("userData"), `token_${safeEmail}.json`);
      fs.writeFileSync(SPECIFIC_TOKEN_PATH, JSON.stringify(auth.credentials));

      console.log(`✅ Xác thực thành công cho: ${email}`);

      // Trả về kết quả cho React cập nhật UI
      return { success: true, email: email };
    }
    
    return { success: false, error: "Xác thực không hoàn tất." };
  } catch (error) {
    console.error("Lỗi authorize-gmail chi tiết:", error);
    // Nếu là lỗi 401, thông báo rõ cho người dùng
    const errorMsg = error.response?.data?.error?.message || error.message;
    return { success: false, error: errorMsg };
  }
});

// Sửa handler stop-backup-process
ipcMain.handle("stop-backup-process", async () => {
  if (currentBackupController) {
    await currentBackupController.stop(); // Dừng tất cả mọi thứ
    currentBackupController = null;
    return { success: true };
  }
  return { success: false, error: "Không có tiến trình nào" };
});


ipcMain.handle("save-backup-history", (event, data) =>
  saveHistory(HISTORY_BACKUP_PATH, data),
);
ipcMain.handle("save-upload-history", (event, data) =>
  saveHistory(HISTORY_UPLOAD_PATH, data),
);

ipcMain.handle("get-history", (event, type) => {
  try {
    const filePath =
      type === "backup" ? HISTORY_BACKUP_PATH : HISTORY_UPLOAD_PATH;
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data);
    }
    return [];
  } catch (e) {
    return [];
  }
});

// main.js

// Handler xóa từng bản ghi
ipcMain.handle("delete-history-item", async (event, { type, id }) => {
  try {
    const filePath =
      type === "backup" ? HISTORY_BACKUP_PATH : HISTORY_UPLOAD_PATH;
    if (fs.existsSync(filePath)) {
      let history = JSON.parse(fs.readFileSync(filePath, "utf8"));
      history = history.filter((item) => item.id !== id);
      fs.writeFileSync(filePath, JSON.stringify(history, null, 2));
      return { success: true };
    }
    return { success: false, error: "File không tồn tại" };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handler xóa sạch lịch sử của một Tab
ipcMain.handle("clear-all-history", async (event, type) => {
  try {
    const filePath =
      type === "backup" ? HISTORY_BACKUP_PATH : HISTORY_UPLOAD_PATH;
    fs.writeFileSync(filePath, JSON.stringify([], null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

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

// main.js


async function getAuthenticatedClient(email) {
  if (!email || typeof email !== "string") {
    throw new Error(`Email xác thực không hợp lệ: ${email}`);
  }

  const safeEmail = email.replace(/[^a-z0-9]/gi, "_");
  const SPECIFIC_TOKEN_PATH = path.join(
    app.getPath("userData"),
    `token_${safeEmail}.json`,
  );

  // 1. Kiểm tra nếu đã có Token lưu trong máy rồi thì dùng luôn
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

  // 2. Nếu CHƯA CÓ Token, bắt đầu quy trình đăng nhập mới (OAuth2)
  // SỬA LẠI ĐOẠN NÀY CHO CHUẨN:
  const auth = await authenticate({
    keyfilePath: CREDENTIALS_PATH,
    scopes: SCOPES,
    authClientOptions: {
      prompt: 'select_account',    // Buộc Google hiện màn hình chọn tài khoản
      login_hint: email,           // Gợi ý đúng Email Linh đã chọn từ giao diện
      include_granted_scopes: true // Đảm bảo lấy đủ quyền
    }
  });

  // 3. Lưu Token vừa lấy được vào file để lần sau không phải đăng nhập lại
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

// Thêm vào main.js cùng các handler khác
// ipcMain.handle("update-drive-accounts", async (event, accounts) => {
//   try {
//     const DRIVE_ACCOUNTS_PATH = path.join(
//       process.cwd(),
//       "configs",
//       "drive_accounts.json",
//     );
//     fs.writeFileSync(DRIVE_ACCOUNTS_PATH, JSON.stringify(accounts, null, 2));
//     return { success: true };
//   } catch (error) {
//     return { success: false, error: error.message };
//   }
// });


// main.js - Thay thế handler update-drive-accounts của Linh bằng đoạn này
ipcMain.handle("update-drive-accounts", async (event, updatedAccounts) => {
  try {
    const DRIVE_ACCOUNTS_PATH = path.join(process.cwd(), "configs", "drive_accounts.json");

    // 1. Đọc danh sách cũ từ đúng file drive_accounts.json của Linh
    let oldAccounts = [];
    if (fs.existsSync(DRIVE_ACCOUNTS_PATH)) {
      const content = fs.readFileSync(DRIVE_ACCOUNTS_PATH, "utf8");
      oldAccounts = content ? JSON.parse(content) : [];
    }

    // 2. Tìm những email vừa bị xóa khỏi giao diện
    const deletedAccounts = oldAccounts.filter(
      old => !updatedAccounts.find(updated => updated.email === old.email)
    );

    // 3. Xóa file token vật lý tương ứng trong AppData
    deletedAccounts.forEach(acc => {
      const safeEmail = acc.email.replace(/[^a-z0-9]/gi, "_");
      const tokenPath = path.join(app.getPath("userData"), `token_${safeEmail}.json`);
      
      if (fs.existsSync(tokenPath)) {
        fs.unlinkSync(tokenPath); // Xóa file thật trên ổ cứng
        console.log(`🗑️ Đã xóa file token vật lý: ${acc.email}`);
      }
    });

    // 4. Ghi lại danh sách tài khoản mới vào file drive_accounts.json
    fs.writeFileSync(DRIVE_ACCOUNTS_PATH, JSON.stringify(updatedAccounts, null, 2));
    
    return { success: true };
  } catch (error) {
    console.error("Lỗi khi cập nhật và xóa token:", error);
    return { success: false, error: error.message };
  }
});

// main.js hoặc src/ipc/db-postgres.js
ipcMain.handle("create-postgres-backup", async (event, dbConfig) => {
  // Đảm bảo truyền 'event' là tham số thứ 2
  return await backupPostgresSql(dbConfig, event);
});


// ipcMain.handle("create-sql-backup", async (event, dbConfig) => {
//   const handler = backupHandlers[dbConfig.dbType];
//   if (!handler) return { success: false, error: "Unsupported type" };

//   // THÊM: Truyền 'event' vào làm tham số thứ 2
//   return await handler(dbConfig, event); 
// });


// main.js
// main.js - Tìm handler create-sql-backup
// ipcMain.handle("create-sql-backup", async (event, dbConfig) => {
//   const handler = backupHandlers[dbConfig.dbType];
//   if (!handler) return { success: false, error: "Unsupported type" };

//   try {
//     // Gọi backup và truyền vào callback để lấy SshClient ra ngoài
//     const result = await handler(dbConfig, event, (client) => {
//        currentSshClient = client; // Lưu lại kết nối đang chạy vào biến toàn cục
//     });

//     currentSshClient = null; // Backup xong (thành công) thì xóa biến
//     return result;
//   } catch (err) {
//     currentSshClient = null; // Lỗi cũng xóa biến
//     return { success: false, error: err.message };
//   }
// });

// ipcMain.handle("create-sql-backup", async (event, dbConfig) => {
//   const handler = backupHandlers[dbConfig.dbType];
//   return await handler(dbConfig, event, (controller) => {
//     currentBackupController = controller; // Lưu object chứa hàm stop()
//   });
// });

// main.js - Tìm handler create-sql-backup

ipcMain.handle("create-sql-backup", async (event, dbConfig) => {
  const handler = backupHandlers[dbConfig.dbType];
  if (!handler) return { success: false, error: "Unsupported type" };

  // Gọi handler và truyền vào callback để lấy object chứa hàm stop()
  return await handler(dbConfig, event, (controller) => {
    currentBackupController = controller; 
  });
});



ipcMain.handle("get-temp-files", async (event, localPath) => {
  console.log("temp files path:", localPath);
  try {
    const targetDir =
      localPath && localPath.trim() !== ""
        ? localPath
        : path.join(process.cwd(), "src", "temp");

    if (!fs.existsSync(targetDir)) {
      return { success: false, error: "Thư mục không tồn tại" };
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

          const relativePath = path
            .relative(targetDir, fullPath)
            .replace(/\\/g, "/");

          files.push({
            name: relativePath,
            path: fullPath,
            size: `${sizeInMB} MB`,
            createdAt: stats.mtime, // 👉 thêm luôn cho UI cột ngày
          });
        }
      }
    };

    readDirRecursive(targetDir);

    return { success: true, files };
  } catch (error) {
    console.error("Lỗi đọc thư mục:", error);
    return { success: false, error: error.message };
  }
});


ipcMain.handle("upload-to-drive", async (event, { files, targetEmail, folderName }) => {
  try {
    // 1. XÁC THỰC DUY NHẤT 1 LẦN: Lấy auth ngay đầu hàm để tránh lặp lại trình duyệt
    console.log("--- Bắt đầu quy trình xác thực cho:", targetEmail, "---");
    const auth = await getAuthenticatedClient(targetEmail);
    const drive = google.drive({ version: "v3", auth });
    // Dùng folderName động từ Linh truyền xuống
    const targetFolderName = folderName || "SQL_Backups";

    // 2. Tìm hoặc tạo folder theo tên Linh đã điền
    const list = await drive.files.list({
      q: `name = '${targetFolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    });

    let folderId =
      list.data.files.length > 0
        ? list.data.files[0].id
        : (
            await drive.files.create({
              requestBody: {
                name: targetFolderName,
                mimeType: "application/vnd.google-apps.folder",
              },
              fields: "id",
            })
          ).data.id;

    // 3. Tính toán tổng dung lượng toàn bộ Batch để hiển thị % chính xác
    const totalBatchSize = files.reduce(
      (acc, f) => acc + fs.statSync(f.path).size,
      0,
    );
    
    let totalUploadedBeforeCurrentFile = 0;
    const uploadResults = [];

    console.log(`--- Chuẩn bị upload ${files.length} file ---`);

    // 4. Vòng lặp upload từng file - Sử dụng chung thực thể 'drive' đã xác thực
    for (const fileObj of files) {
      try {
        const driveFileName = fileObj.name.replace(/\//g, " - ");
        const fileSize = fs.statSync(fileObj.path).size;

        let lastBytesRead = 0;
        let lastTime = Date.now();

        // THỰC HIỆN UPLOAD FILE (Không gọi lại trình duyệt nhờ dùng chung 'drive')
        const res = await drive.files.create(
          {
            requestBody: { name: driveFileName, parents: [folderId] },
            media: { body: fs.createReadStream(fileObj.path) },
            fields: "id",
          },
          {
            onUploadProgress: (evt) => {
              const currentTime = Date.now();
              const duration = (currentTime - lastTime) / 1000;

              if (duration > 0.5) {
                const bytesSinceLast = evt.bytesRead - lastBytesRead;
                const speedMBps = bytesSinceLast / duration / (1024 * 1024);

                const overallUploaded = totalUploadedBeforeCurrentFile + evt.bytesRead;
                const overallProgress = Math.round((overallUploaded / totalBatchSize) * 100);

                event.sender.send("upload-progress", {
                  fileName: fileObj.name,
                  progress: overallProgress > 100 ? 100 : overallProgress,
                  speed: speedMBps.toFixed(2) + " MB/s",
                });

                lastBytesRead = evt.bytesRead;
                lastTime = currentTime;
              }
            },
          },
        );

        console.log(`✅ Thành công: [${driveFileName}]`);

        // Cộng dồn dung lượng file hoàn thành để tính % cho file kế tiếp
        totalUploadedBeforeCurrentFile += fileSize;

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
        console.error(`❌ Lỗi tại file ${fileObj.name}:`, uploadError.message);
        
        // Nếu lỗi 1 file, vẫn cộng size vào để thanh Progress không bị "nhảy ngược"
        totalUploadedBeforeCurrentFile += fs.statSync(fileObj.path).size;

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
    console.error("❌ Lỗi hệ thống trong upload-to-drive:", error);
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



// 1. Handler LƯU cấu hình: Sửa đường dẫn để đảm bảo ghi được file
ipcMain.handle("save-login-config", async (event, newConfig) => {
  console.log("Saving login config:", newConfig);
  
  // SỬA: Sử dụng CONFIG_DIR (thường trỏ đến thư mục làm việc) thay vì getAppPath
  // Vì getAppPath trong bản build sẽ trỏ vào file .asar (chỉ đọc), không ghi được
  const filePath = path.join(CONFIG_DIR, 'info.json');
  console.log("Đường dẫn lưu info.json:", filePath);

  try {
    let data = { serverConfigs: [] };

    // 1. Đọc file cũ nếu tồn tại
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      // Kiểm tra nếu file có nội dung thì mới parse
      data = fileContent ? JSON.parse(fileContent) : { serverConfigs: [] };
    }

    // 2. Kiểm tra trùng lặp dựa trên nhãn (label)
    const existingIndex = data.serverConfigs.findIndex(
      (item) => item.label.toLowerCase() === newConfig.label.toLowerCase()
    );

    if (existingIndex > -1) {
      // Nếu đã có thì cập nhật thông tin mới (đè lên)
      data.serverConfigs[existingIndex] = newConfig;
    } else {
      // Nếu chưa có thì thêm mới vào danh sách
      data.serverConfigs.push(newConfig);
    }

    // 3. Ghi lại vào file với định dạng đẹp (indent 2)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");

    return { success: true };
  } catch (error) {
    console.error("Lỗi lưu info.json:", error);
    return { success: false, error: error.message };
  }
});

// 2. Handler LẤY cấu hình: Giúp React lấy danh sách "danh bạ" server
// ipcMain.handle("get-login-configs", async () => {
//   const filePath = path.join(CONFIG_DIR, 'info.json');
//   try {
//     if (fs.existsSync(filePath)) {
//       const content = fs.readFileSync(filePath, "utf-8");
//       return content ? JSON.parse(content) : { serverConfigs: [] };
//     }
//     return { serverConfigs: [] };
//   } catch (error) {
//     console.error("Lỗi đọc info.json:", error);
//     return { serverConfigs: [] };
//   }
// });



// main.js
// main.js - Sửa lại chính xác hàm này
ipcMain.handle('get-login-configs', async () => {
  try {
    // 1. Dùng trực tiếp CONFIG_DIR để đảm bảo đồng nhất với lệnh GHI
    const filePath = path.join(CONFIG_DIR, 'info.json'); 
    
    // 2. Kiểm tra nếu file không tồn tại thì trả về mảng rỗng ngay, không để lỗi crash
    if (!fs.existsSync(filePath)) {
      return { success: true, serverConfigs: [] };
    }

    const data = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(data);
    
    // 3. Log ra terminal của Electron để bạn kiểm tra xem Backend đã thấy gì
    console.log(">>> Backend đọc được từ info.json:", json.serverConfigs?.length || 0, "servers");

    return { success: true, serverConfigs: json.serverConfigs || [] }; 
  } catch (error) {
    console.error("Lỗi get-login-configs:", error.message);
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

  // 2. Ép hiển thị thanh cuộn VÀ loại trừ icon cụ thể
  // main.js
  // main.js
  win.webContents.on("did-finish-load", () => {
    // win.webContents
    //   .executeJavaScript(
    //     `
    //   document.querySelectorAll('*').forEach(el => {
    //     // 1. CHỐT CHẶN: Tuyệt đối không can thiệp vào Input, Icon và các thành phần Form
    //     const isInputArea = el.closest('.MuiFormControl-root') || 
    //                         el.closest('.MuiInputBase-root') ||
    //                         el.tagName === 'SVG' ||
    //                         el.tagName === 'INPUT' ||
    //                         el.classList.contains('MuiSvgIcon-root');

    //     if (isInputArea) {
    //       return; // Bỏ qua hoàn toàn khu vực nhập liệu và icon mắt
    //     }

    //     // 2. Chỉ kích hoạt cuộn cho các container chứa danh sách hoặc nội dung lớn
    //     // scrollHeight > clientHeight + 5 để tránh hiện thanh cuộn thừa do sai số pixel
    //     if (el.scrollHeight > el.clientHeight + 5) {
    //       el.style.overflowY = 'auto'; // Dùng auto để MUI tự xử lý mượt hơn
    //       el.style.display = 'block';
    //     }
    //   });
    // `,
    //   )
    //   .catch((err) => console.error("Lỗi thực thi Scrolling Script:", err));
  });
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
    console.log(`[Cron] Yêu cầu dừng Task ID: ${taskId}`);
    console.log(`[Cron] Active Jobs hiện tại:`, activeJobs);
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
      configs = configs.filter((task) => task.id !== taskId);

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
      configs.forEach((config) => {
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
    Object.keys(activeJobs).forEach((id) => {
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

ipcMain.handle("open-directory-dialog", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"], // Chỉ cho phép chọn thư mục
  });

  if (result.canceled) {
    return null;
  } else {
    return result.filePaths[0]; // Trả về đường dẫn thư mục đầu tiên được chọn
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
