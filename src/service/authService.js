const { ipcMain } = require('electron');
const axios = require('axios');

ipcMain.handle('login-request', async (event, credentials) => {
  try {
    const response = await axios.post('https://api.your-partner.com/login', {
      username: credentials.username,
      password: credentials.password
    });

    if (response.data.token) {
      // Lưu token lại để dùng cho các bước SSH/SQL sau này
      // Ví dụ: lưu vào một biến global hoặc dùng thư viện keytar
      global.authToken = response.data.token; 
      return { success: true, data: response.data };
    }
  } catch (error) {
    return { success: false, message: error.response?.data?.message || 'Lỗi kết nối API' };
  }
});