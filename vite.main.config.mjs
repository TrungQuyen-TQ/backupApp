import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  build: {
    rollupOptions: {
      // Các thư viện Node.js thuần hoặc thư viện native C++ bắt buộc phải để external
      external: [
        "electron",
        // Database Drivers
        "mssql",
        "mysql2",
        "mysql2/promise",
        "mongodb",
        // SSH & FTP
        "ssh2-sftp-client",
        "ssh2", // Thư viện lõi của sftp-client
        // Compression & Encryption
        "archiver",
        "archiver-zip-encryptable",
        // Google APIs (nếu bạn dùng)
        "googleapis",
        "google-auth-library",
        "@google-cloud/local-auth",
        // Optional dependencies của MongoDB/G-Auth
        "kerberos",
        "snappy",
        "aws4",
        "saslprep",
        // Node.js Built-in Modules (dùng prefix node: là tốt nhất)
        "node:path",
        "node:fs",
        "node:os",
        "node:child_process",
        "node:stream",
        "node:util",
        "node:events",
        "path", // Dự phòng cho các lib cũ không dùng prefix node:
        "fs",
        "os",
        "child_process"
      ],
    },
    // Tắt minify để dễ debug khi gặp lỗi liên quan đến đường dẫn file trong Main Process
    minify: false,
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "configs/*",
          dest: "configs",
        },
      ],
    }),
  ],
  resolve: {
    // Rất quan trọng: Báo cho Vite biết đây là môi trường Node, không phải Browser
    browserField: false,
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
});