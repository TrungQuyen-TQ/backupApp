const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Test kết nối SQL Server
  testConnection: (formData) => ipcRenderer.invoke("test-connection", formData),

  // Kiểm tra thông số (Phiên bản & Quét số dòng các bảng)
  checkDatabaseInfo: (config) =>
    ipcRenderer.invoke("check-database-info", config),

  // Tạo file backup .bak tại thư mục temp
  createSqlBackup: (dbConfig) =>
    ipcRenderer.invoke("create-sql-backup", dbConfig),

  // Lấy danh sách file trong thư mục temp
  getTempFiles: () => ipcRenderer.invoke("get-temp-files"),

  uploadToDrive: (data) => ipcRenderer.invoke("upload-to-drive", data),
  onUploadProgress: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on("upload-progress", subscription);

    // TRẢ VỀ một hàm để cleanup
    return () => {
      ipcRenderer.removeListener("upload-progress", subscription);
    };
  },

  onFileDone: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on("file-done", subscription);

    return () => {
      ipcRenderer.removeListener("file-done", subscription);
    };
  },

  // (Tùy chọn) Lưu cấu hình
  saveConfig: (config) => ipcRenderer.invoke("save-config", config),

  // Thêm vào preload.js
  getDatabasesList: (config) =>
    ipcRenderer.invoke("get-databases-list", config),
  // Thêm vào preload.js
  onUploadProgress: (callback) =>
    ipcRenderer.on("upload-progress", (event, value) => callback(value)),
  getDriveAccounts: () => ipcRenderer.invoke("get-drive-accounts"),
  // Thêm dòng này
  testSSHConnection: (config) =>
    ipcRenderer.invoke("test-ssh-connection", config),

  stopAutoBackup: (taskId) => ipcRenderer.invoke("stop-auto-backup", taskId),
  getAutoConfigs: () => ipcRenderer.invoke("get-auto-configs"),
  stopAllBackups: () => ipcRenderer.invoke("stop-all-backups"),
  saveAutoBackup: (config) => ipcRenderer.invoke("save-auto-backup", config),

  db: {
    getMSSQL: (config) => ipcRenderer.invoke("mssql:get-databases", config),
    getMySQL: (config) => ipcRenderer.invoke("mysql:get-databases", config),
    getMongo: (config) => ipcRenderer.invoke("mongo:get-databases", config),
    getPostgres: (config) =>
      ipcRenderer.invoke("postgres:get-databases", config),
  },
});
