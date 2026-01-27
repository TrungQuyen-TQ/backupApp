import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default {
  build: {
    rollupOptions: {
      external: [
        'google-auth-library',
        'local-auth',
        'electron',
        'googleapis', // Thêm dòng này vào
        'mssql',      // Thêm cả mssql nếu bạn dùng để kết nối SQL Server
      ],
    },
  },
};
