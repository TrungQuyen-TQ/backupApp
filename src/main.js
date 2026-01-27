import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import { google } from "googleapis";
import started from "electron-squirrel-startup";
import sql from "mssql";

// Sử dụng require để gọi thư viện xác thực ổn định
const { authenticate } = require('@google-cloud/local-auth');

const CREDENTIALS_PATH = path.join(process.cwd(), "configs", "client_secret.json");
const TOKEN_PATH = path.join(process.cwd(), "configs", "token.json");

if (started) {
  app.quit();
}

/**
 * Hàm xác thực OAuth2
 */
async function getAuthenticatedClient() {
  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const tokenData = fs.readFileSync(TOKEN_PATH, 'utf8');
      const credentials = JSON.parse(tokenData);
      return google.auth.fromJSON(credentials);
    } catch (e) {
      if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH);
    }
  }

  const client = await authenticate({
    keyfilePath: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  if (client.credentials) {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(client.credentials));
    return client;
  }
  throw new Error("Login Required");
}

// --- HANDLER 1: TẠO BACKUP SQL SERVER CỤC BỘ ---
ipcMain.handle("create-sql-backup", async (event, dbConfig) => {
  try {
    const sqlConfig = {
      user: dbConfig.user,
      password: dbConfig.password,
      server: dbConfig.server,
      database: dbConfig.database,
      port: Number(dbConfig.port),
      options: { encrypt: true, trustServerCertificate: true }
    };

    const pool = await sql.connect(sqlConfig);
    const outputFolder = "C:/hls_output";
    if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder, { recursive: true });
    
    const localPath = path.join(outputFolder, `${dbConfig.database}_${Date.now()}.bak`).replace(/\//g, '\\');

    const query = `BACKUP DATABASE [${dbConfig.database}] TO DISK = '${localPath}' WITH FORMAT, INIT;`;
    await pool.request().query(query);
    await pool.close();

    shell.showItemInFolder(localPath);
    return { success: true, filePath: localPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// --- HANDLER 2: UPLOAD LÊN THƯ MỤC GỐC DRIVE (ĐÃ SỬA) ---
ipcMain.handle("upload-to-drive", async (event, filePath) => {
  try {
    const auth = await getAuthenticatedClient();
    const drive = google.drive({ version: "v3", auth });
    
    const fileName = path.basename(filePath);
    const fileMetadata = {
      name: fileName,
      // ĐỂ TRỐNG PARENTS: File sẽ được đẩy lên thư mục gốc (My Drive)
      parents: [], 
    };

    const media = {
      mimeType: "application/octet-stream",
      body: fs.createReadStream(filePath),
    };

    const response = await drive.files.create({
      resource: fileMetadata,
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

// --- HANDLER 3: TEST KẾT NỐI SQL ---
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

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });