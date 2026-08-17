import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
const dependencies = Object.keys(pkg.dependencies || {});

export default defineConfig({
  build: {
    rollupOptions: {
      // Externalize all dependencies from package.json & built-ins so Node resolves them at runtime from app.asar/node_modules
      external: [
        "electron",
        ...dependencies,
        /^mysql2\/.*/,
        /^pg\/.*/,
        /^googleapis\/.*/,
        /^ssh2\/.*/,
        /^node:.*/
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