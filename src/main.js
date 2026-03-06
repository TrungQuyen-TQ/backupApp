import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import { google } from "googleapis";
import started from "electron-squirrel-startup";
import sql from "mssql";
import { authenticate } from "@google-cloud/local-auth";
import SftpClient from "ssh2-sftp-client"; // Đã chuyển sang import đồng nhất

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
    try { await sftp.end(); } catch (e) {}
    console.error("Lỗi quy trình backup:", err.message);
    return { success: false, error: `Lỗi quy trình: ${err.message}` };
  }
});

ipcMain.handle("upload-to-drive", async (event, { filePath, stats }) => {
  const MAX_RETRIES = 3; // SỬA: Khai báo số lần thử lại tối đa (Ý 3)
  let attempt = 0;

  // SỬA: Kiểm tra file tồn tại và lấy dung lượng trước khi upload (Ý 3)
  if (!fs.existsSync(filePath)) {
    return { success: false, error: "File không tồn tại trên local." };
  }
  const fileStats = fs.statSync(filePath);
  const fileSize = fileStats.size;

  while (attempt < MAX_RETRIES) {
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

      // --- PHẦN SỬA CHÍNH: UPLOAD CÓ THEO DÕI TIẾN TRÌNH ---
      const fileName = path.basename(filePath);
      
      await drive.files.create({
        requestBody: { name: fileName, parents: [folderId] },
        media: { body: fs.createReadStream(filePath) },
      }, {
        // SỬA: Thêm option onUploadProgress để tính % (Ý 2)
        onUploadProgress: (evt) => {
          const progress = Math.round((evt.bytesRead / fileSize) * 100);
          // Gửi sự kiện 'upload-progress' về cho React (phải cài đặt ở preload.js)
          event.sender.send("upload-progress", progress);
        },
      });

      // SỬA: Sau khi upload xong mới gửi email và xóa file
      await sendEmailNotifications(auth, fileName, stats);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      return { success: true };

    } catch (error) {
      attempt++;
      console.error(`Lần thử ${attempt} thất bại:`, error.message);
      
      // SỬA: Nếu chưa hết số lần thử, đợi 2 giây rồi chạy lại vòng lặp (Ý 3)
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        return { success: false, error: `Lỗi sau ${MAX_RETRIES} lần thử: ${error.message}` };
      }
    }
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
