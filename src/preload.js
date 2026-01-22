const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Hàm upload đã viết ở các bước trước
  createSqlBackup: (dbConfig) =>
    ipcRenderer.invoke("create-sql-backup", dbConfig),
  uploadToDrive: (filePath) => ipcRenderer.invoke("upload-to-drive", filePath),

  // 3. Hàm test kết nối (nếu bạn đã viết handler tương ứng trong main.js)
  testConnection: (formData) => ipcRenderer.invoke("test-connection", formData),

  // 4. (Tùy chọn) Lưu cấu hình để lần sau không phải nhập lại
  saveConfig: (config) => ipcRenderer.invoke("save-config", config),
});
