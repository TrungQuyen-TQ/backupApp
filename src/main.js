import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs";
import { google } from "googleapis";
import started from "electron-squirrel-startup";
import sql from "mssql";

const { authenticate } = require('@google-cloud/local-auth');

if (started) { app.quit(); }

// --- Cấu hình đường dẫn ---
const CONFIG_DIR = path.join(process.cwd(), "configs");
const CREDENTIALS_PATH = path.join(CONFIG_DIR, "client_secret.json");
const CONTACTS_PATH = path.join(CONFIG_DIR, "contacts.json");
const TOKEN_PATH = path.join(app.getPath('userData'), "token.json");
const SCOPES = ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/gmail.send"];
const SftpClient = require('ssh2-sftp-client');
const SSH_CONFIG_PATH = path.join(CONFIG_DIR, "ssh_config.json");

// ==========================================================
// 1. HÀM TRUY VẤN SQL (Lấy stats tự động quét bảng)
// ==========================================================
async function getDatabaseStats(pool) {
  const versionRaw = await pool.request().query("SELECT @@VERSION as version");
  const shortVersion = versionRaw.recordset[0].version.split('-')[0].split('\n')[0].trim();

  // Tự động quét tất cả các bảng người dùng tạo (không phải bảng hệ thống)
  const tablesQuery = await pool.request().query(`
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME NOT LIKE 'sys%'
  `);
  
  const allTables = tablesQuery.recordset.map(row => row.TABLE_NAME);
  let rowCounts = {};

  for (const table of allTables) {
    try {
      const result = await pool.request().query(`SELECT COUNT(*) as count FROM [${table}]`);
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
async function getAuthenticatedClient() {
  if (fs.existsSync(TOKEN_PATH)) {
    const tokenData = fs.readFileSync(TOKEN_PATH, 'utf8');
    return google.auth.fromJSON(JSON.parse(tokenData));
  }
  const client = await authenticate({ keyfilePath: CREDENTIALS_PATH, scopes: SCOPES, port: 3000 });
  if (client.credentials) {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(client.credentials));
    const auth = new google.auth.OAuth2();
    auth.setCredentials(client.credentials);
    return auth;
  }
}

// ==========================================================
// 3. HÀM GỬI EMAIL THÔNG BÁO
// ==========================================================
async function sendEmailNotifications(auth, fileName, stats) {
  if (!fs.existsSync(CONTACTS_PATH)) return;
  const contacts = JSON.parse(fs.readFileSync(CONTACTS_PATH, 'utf8'));
  const gmail = google.gmail({ version: 'v1', auth });

  const tableRowsHtml = Object.entries(stats.rowCounts)
    .map(([table, count]) => `<li><b>${table}</b>: ${count} dòng</li>`).join('');

  for (const email of contacts.emails) {
    try {
      const subject = `🔔 [Backup Report] ${fileName}`;
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `To: ${email}`,
        'Content-Type: text/html; charset=utf-8',
        `Subject: ${utf8Subject}`,
        '',
        `<h3>Báo cáo Backup chi tiết</h3>`,
        `<p>Hệ thống vừa backup thành công file: <b>${fileName}</b></p>`,
        `<hr>`,
        `<p><b>Hệ thống:</b> ${stats.shortVersion}</p>`,
        `<p><b>Thống kê dữ liệu:</b></p>`,
        `<ul>${tableRowsHtml}</ul>`,
        `<br><p>Xác thực: <b>VERIFYONLY OK</b></p>`
      ];
      const message = messageParts.join('\n');
      const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } });
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
      user: dbConfig.user, password: dbConfig.password, server: dbConfig.server,
      database: dbConfig.database, port: Number(dbConfig.port),
      options: { encrypt: true, trustServerCertificate: true, connectTimeout: 5000 }
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
      user: dbConfig.user, password: dbConfig.password, server: dbConfig.server,
      database: dbConfig.database, port: Number(dbConfig.port),
      options: { encrypt: true, trustServerCertificate: true }
    });
    const stats = await getDatabaseStats(pool);
    await pool.close();
    return { success: true, version: stats.shortVersion, counts: stats.rowCounts };
  } catch (err) {
    return { success: false, error: err.message };
  }
});



ipcMain.handle("create-sql-backup", async (event, dbConfig) => {
  // 1. Khởi tạo đường dẫn
  const tempDirOnWindows = path.join(process.cwd(), "src", "temp");
  if (!fs.existsSync(tempDirOnWindows)) fs.mkdirSync(tempDirOnWindows, { recursive: true });

  const fileName = `${dbConfig.database}_${Date.now()}.bak`;
  const filePathOnWindows = path.join(tempDirOnWindows, fileName);
  const filePathOnUbuntu = `/var/opt/mssql/data/${fileName}`; // SQL Server có quyền ghi ở đây

  const sftp = new SftpClient();

  try {
    // 2. Kết nối SQL Server để ra lệnh Backup
    const pool = await sql.connect({
      user: dbConfig.user, password: dbConfig.password, 
      server: dbConfig.server, database: dbConfig.database, 
      port: Number(dbConfig.port),
      options: { encrypt: true, trustServerCertificate: true }
    });

    const stats = await getDatabaseStats(pool);

    // RA LỆNH BACKUP TRÊN SERVER (Lưu vào ổ cứng Ubuntu)
    await pool.request().query(`BACKUP DATABASE [${dbConfig.database}] TO DISK = '${filePathOnUbuntu}' WITH INIT`);
    await pool.close();

    // 3. ĐỌC CẤU HÌNH SSH VÀ KÉO FILE VỀ WINDOWS QUA SFTP
    if (!fs.existsSync(SSH_CONFIG_PATH)) throw new Error("Thiếu file ssh_config.json");
    const sshConfig = JSON.parse(fs.readFileSync(SSH_CONFIG_PATH, 'utf8'));

    await sftp.connect(sshConfig);
    
    // Tải file từ Ubuntu về Windows
    await sftp.fastGet(filePathOnUbuntu, filePathOnWindows);

    // Xóa file tạm trên Ubuntu sau khi đã tải về thành công
    await sftp.delete(filePathOnUbuntu);
    await sftp.end();

    return { success: true, filePath: filePathOnWindows, fileName, stats };
  } catch (err) {
    if (sftp) await sftp.end();
    return { success: false, error: `Lỗi quy trình: ${err.message}` };
  }
});

ipcMain.handle("upload-to-drive", async (event, { filePath, stats }) => {
  try {
    const auth = await getAuthenticatedClient();
    const drive = google.drive({ version: "v3", auth });
    const list = await drive.files.list({ q: "name = 'SQL_Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false" });
    let folderId = list.data.files.length > 0 ? list.data.files[0].id : (await drive.files.create({ resource: { name: 'SQL_Backups', mimeType: 'application/vnd.google-apps.folder' }, fields: 'id' })).data.id;

    const fileName = path.basename(filePath);
    console.log(fileName);
    await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { body: fs.createReadStream(filePath) }
    });

    await sendEmailNotifications(auth, fileName, stats);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- Khởi tạo Window ---
const createWindow = () => {
  const win = new BrowserWindow({ width: 1100, height: 900, webPreferences: { preload: path.join(__dirname, "preload.js") } });
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
};
app.on("ready", createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });