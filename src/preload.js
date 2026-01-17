const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Hàm upload đã viết ở các bước trước
  uploadToDrive: (filePath) => ipcRenderer.invoke('upload-to-drive', filePath),
  // Hàm test kết nối SQL (nếu bạn cần dùng)
  testConnection: (formData) => ipcRenderer.send('test-connection', formData)
});