const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {

  saveBackupHistory: (data) => ipcRenderer.invoke("save-backup-history", data),
  saveUploadHistory: (data) => ipcRenderer.invoke("save-upload-history", data),
  getHistory: (type) => ipcRenderer.invoke("get-history", type),
  selectFolder: () => ipcRenderer.invoke('open-directory-dialog'),


  // preload.js
  deleteHistoryItem: (data) => ipcRenderer.invoke("delete-history-item", data),
  clearAllHistory: (type) => ipcRenderer.invoke("clear-all-history", type),

  // preload.js
  updateDriveAccounts: (accounts) => ipcRenderer.invoke("update-drive-accounts", accounts),

  // Test kết nối SQL Server
  testConnection: (formData) => ipcRenderer.invoke("test-connection", formData),

  // Kiểm tra thông số (Phiên bản & Quét số dòng các bảng)
  checkDatabaseInfo: (config) =>
    ipcRenderer.invoke("check-database-info", config),

  // Tạo file backup .bak tại thư mục temp
  createSqlBackup: (dbConfig) =>
    ipcRenderer.invoke("create-sql-backup", dbConfig),

  // Lấy danh sách file trong thư mục temp
  getTempFiles: (localPath) => ipcRenderer.invoke("get-temp-files", localPath),

  uploadToDrive: (data) => ipcRenderer.invoke("upload-to-drive", data),
  onUploadProgress: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on("upload-progress", subscription);

    // Trả về một hàm CHƯA CHẠY để React gọi khi cần cleanup
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

  getDriveAccounts: () => ipcRenderer.invoke("get-drive-accounts"),
  deleteTempFiles: (files) => ipcRenderer.invoke("delete-temp-files", files),
  // Thêm dòng này
  testSSHConnection: (config) =>
    ipcRenderer.invoke("test-ssh-connection", config),

  stopAutoBackup: (taskId) => ipcRenderer.invoke("stop-auto-backup", taskId),
  getAutoConfigs: () => ipcRenderer.invoke("get-auto-configs"),
  stopAllBackups: () => ipcRenderer.invoke("stop-all-backups"),
  saveAutoBackup: (config) => ipcRenderer.invoke("save-auto-backup", config),

  // Trong preload.js
stopBackupProcess: () => ipcRenderer.invoke("stop-backup-process"),



  // preload.js thêm vào trong contextBridge
  onBackupProgress: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on("backup-progress", subscription);
    return () => ipcRenderer.removeListener("backup-progress", subscription);
  },

  db: {
    getMSSQL: (config) => ipcRenderer.invoke("mssql:get-databases", config),
    getMySQL: (config) => ipcRenderer.invoke("mysql:get-databases", config),
    getMongo: (config) => ipcRenderer.invoke("mongo:get-databases", config),
    getPostgres: (config) =>
      ipcRenderer.invoke("postgres:get-databases", config),
  },
});
