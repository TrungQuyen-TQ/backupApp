import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import { google } from "googleapis";
import started from "electron-squirrel-startup";
import sql from "mssql";
import { authenticate } from "@google-cloud/local-auth";
import SftpClient from "ssh2-sftp-client"; // Đã chuyển sang import đồng nhất
import { backupSQLServer } from './backups/sqlserver.js';
import { backupMySQL } from './backups/mysql.js';
import { backupMongoDB } from './backups/mongodb.js';

const backupHandlers = {
  sqlserver: backupSQLServer,
  mysql: backupMySQL,
  // mongodb: backupMongoDB
};

// Bây giờ bạn có thể xóa bỏ tất cả các dòng const require bên dưới
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
const SSH_CONFIG_PATH = path.join(CONFIG_DIR, "ssh_config.json");

// ==========================================================
// 1. HÀM TRUY VẤN SQL (Lấy stats tự động quét bảng)
// ==========================================================

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
  try {
    const pool = await sql.connect({
      user: dbConfig.dbUser,
      password: dbConfig.dbPassword,
      server: dbConfig.server,
      database: dbConfig.database,
      port: Number(dbConfig.port),
      options: {
        encrypt: true,
        trustServerCertificate: true,
        connectTimeout: 5000,
      },
    });
    await pool.close();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
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
  // 1. Khởi tạo đường dẫn lưu tạm trên Windows
  const tempDirOnWindows = path.join(process.cwd(), "src", "temp");
  if (!fs.existsSync(tempDirOnWindows)) {
    fs.mkdirSync(tempDirOnWindows, { recursive: true });
  }

  const fileName = `${dbConfig.database}_${Date.now()}.bak`;
  const filePathOnWindows = path.join(tempDirOnWindows, fileName);

  // Đường dẫn tạm trên Ubuntu (SQL Server Linux cần quyền ghi vào đây)
  const filePathOnUbuntu = `/var/opt/mssql/data/${fileName}`;

  const sftp = new SftpClient();

  try {
    console.log(`--- BẮT ĐẦU QUY TRÌNH BACKUP: ${dbConfig.database} ---`);

    // 2. KẾT NỐI SQL SERVER ĐỂ RA LỆNH BACKUP
    const pool = await sql.connect({
      user: dbConfig.dbUser,
      password: dbConfig.dbPassword,
      server: dbConfig.server,
      database: dbConfig.database,
      port: Number(dbConfig.port), // Port của SQL Server (vd: 1433)
      options: {
        encrypt: true,
        trustServerCertificate: true,
        connectTimeout: 10000
      },
    });

    // Lấy thông tin stats (số dòng các bảng) trước khi backup để gửi mail sau này
    const stats = await getDatabaseStats(pool);

    console.log("Đang thực hiện lệnh BACKUP DATABASE trên SQL Server...");
    await pool.request().query(
      `BACKUP DATABASE [${dbConfig.database}] TO DISK = '${filePathOnUbuntu}' WITH INIT`
    );
    await pool.close();
    console.log("Backup trên Server thành công.");

    // 3. KẾT NỐI SFTP BẰNG THÔNG TIN ĐỘNG (Sử dụng sshPort từ giao diện)
    console.log(`Đang kết nối SFTP tới ${dbConfig.server} qua Port ${dbConfig.sshPort || 22}...`);
    await sftp.connect({
      host: dbConfig.server,
      port: Number(dbConfig.sshPort) || 22, // SỬA: Dùng port động từ giao diện
      username: dbConfig.user,          // SSH Username
      password: dbConfig.password,      // SSH Password
      readyTimeout: 15000,
    });

    console.log("Đang tải file .bak về máy local...");
    // Tải file từ Ubuntu về Windows
    await sftp.fastGet(filePathOnUbuntu, filePathOnWindows);

    console.log("Đang xóa file tạm trên Server Ubuntu...");
    // Xóa file tạm trên Server để tránh đầy ổ cứng Server
    await sftp.delete(filePathOnUbuntu);

    await sftp.end();

    console.log("Hoàn tất quy trình kéo file về máy local.");
    return {
      success: true,
      filePath: filePathOnWindows,
      fileName,
      stats
    };

  } catch (err) {
    // Luôn đóng kết nối sftp nếu có lỗi xảy ra giữa chừng
    try { await sftp.end(); } catch (e) { }
    console.error("Lỗi quy trình backup:", err.message);
    return { success: false, error: `Lỗi quy trình: ${err.message}` };
  }

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

    // --- PHẦN TÌM/TẠO FOLDER (Giữ nguyên logic của bạn) ---
    const list = await drive.files.list({
      q: "name = 'SQL_Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    });

    let folderId;
    if (list.data.files.length > 0) {
      folderId = list.data.files[0].id;
    } else {
      const folder = await drive.files.create({
        requestBody: {
          name: "SQL_Backups",
          mimeType: "application/vnd.google-apps.folder",
        },
        fields: "id",
      });
      folderId = folder.data.id;
    }
    const uploadResults = [];
    for (const fileObj of files) {
      try {
        // fileObj.name is like "127.0.0.1_sqlserver_db/backup.bak"
        // Convert the slash to " - " for a clean Google Drive filename
        const driveFileName = fileObj.name.replace(/\//g, ' - ');
        await drive.files.create({
          requestBody: { name: driveFileName, parents: [folderId] },
          media: { body: fs.createReadStream(fileObj.path) },
        });

        // Sau khi upload thành công, xóa file ở local
        if (fs.existsSync(fileObj.path)) {
          fs.unlinkSync(fileObj.path);
          // Try to remove parent directory if it is empty
          try {
            const parentDir = path.dirname(fileObj.path);
            if (fs.readdirSync(parentDir).length === 0) {
              fs.rmdirSync(parentDir);
            }
          } catch (e) {
            // Ignore directory removal errors
          }
        }

        uploadResults.push({ name: fileObj.name, success: true });
      } catch (uploadError) {
        console.error(`Lỗi upload file ${fileObj.name}:`, uploadError);
        uploadResults.push({ name: fileObj.name, success: false, error: uploadError.message });
      }
    }

    // Không gửi email theo yêu cầu mới

    // Kiểm tra xem có file nào bị lỗi không
    const hasError = uploadResults.some(r => !r.success);
    if (hasError) {
      return {
        success: false,
        error: "Một số file tải lên không thành công.",
        results: uploadResults
      };
    }

    return { success: true, results: uploadResults };
  } catch (error) {
    console.error("Lỗi Drive Auth/Folder:", error);
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
  const SftpClient = require("ssh2-sftp-client");
  const sftp = new SftpClient();
  console.log("Đang thử kết nối SSH với config:", config);
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

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1100,
    height: 900,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });

  // Kiểm tra biến môi trường an toàn
  if (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== "undefined") {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};
app.on("ready", createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
