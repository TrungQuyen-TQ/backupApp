import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  build: {
    rollupOptions: {
      // Các thư viện Node.js thuần hoặc thư viện lớn nên để external
      external: [
        'electron',
        'googleapis',
        'google-auth-library',
        '@google-cloud/local-auth',
        'mssql',
        'ssh2-sftp-client',
        'node:path',
        'node:fs'
      ],
    },
  },
  plugins: [
    // Tự động copy thư mục configs vào thư mục out/dist khi build
    viteStaticCopy({
      targets: [
        {
          src: 'configs/*',
          dest: 'configs'
        }
      ]
    })
  ]
});