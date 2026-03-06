
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Test kết nối SQL Server
  testConnection: (formData) => ipcRenderer.invoke("test-connection", formData),

  // Kiểm tra thông số (Phiên bản & Quét số dòng các bảng)
  checkDatabaseInfo: (config) => ipcRenderer.invoke("check-database-info", config),

  // Tạo file backup .bak tại thư mục temp
  createSqlBackup: (dbConfig) => ipcRenderer.invoke("create-sql-backup", dbConfig),

  // Lấy danh sách file trong thư mục temp
  getTempFiles: () => ipcRenderer.invoke("get-temp-files"),

  // Upload lên Google Drive kèm theo dữ liệu thống kê để gửi Email
  uploadToDrive: (data) => ipcRenderer.invoke("upload-to-drive", data),

  // (Tùy chọn) Lưu cấu hình
  saveConfig: (config) => ipcRenderer.invoke("save-config", config),

  // Thêm vào preload.js
  getDatabasesList: (config) => ipcRenderer.invoke("get-databases-list", config),
  // Thêm vào preload.js
  onUploadProgress: (callback) => ipcRenderer.on("upload-progress", (event, value) => callback(value)),

  // Thêm dòng này
  testSSHConnection: (config) => ipcRenderer.invoke("test-ssh-connection", config),
});



