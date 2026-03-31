import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({

    server: {
    watch: {
      // Bảo Vite lờ đi sự thay đổi trong thư mục configs
      ignored: ['**/configs/**'], 
    },
  },
});