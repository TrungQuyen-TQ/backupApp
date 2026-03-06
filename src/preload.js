// const { contextBridge, ipcRenderer } = require("electron");

// contextBridge.exposeInMainWorld("electronAPI", {
//   // Hàm upload đã viết ở các bước trước
//   createSqlBackup: (dbConfig) =>
//     ipcRenderer.invoke("create-sql-backup", dbConfig),
//   uploadToDrive: (filePath) => ipcRenderer.invoke("upload-to-drive", filePath),

//   // 3. Hàm test kết nối (nếu bạn đã viết handler tương ứng trong main.js)
//   testConnection: (formData) => ipcRenderer.invoke("test-connection", formData),

//   // 4. (Tùy chọn) Lưu cấu hình để lần sau không phải nhập lại
//   saveConfig: (config) => ipcRenderer.invoke("save-config", config),

//   // Thêm dòng này vào trong contextBridge.exposeInMainWorld của preload.js
//   checkSqlVersion: (dbConfig) => ipcRenderer.invoke("check-sql-version", dbConfig),

//   checkDatabaseInfo: (config) => ipcRenderer.invoke("check-database-info", config),
// });


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
});



