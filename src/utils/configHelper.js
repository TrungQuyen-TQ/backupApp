import fs from "fs";
import path from "path";
import { app } from "electron";

const USER_CONFIG_DIR = path.join(app.getPath("userData"), "configs");
if (!fs.existsSync(USER_CONFIG_DIR)) {
  fs.mkdirSync(USER_CONFIG_DIR, { recursive: true });
}

const BUNDLED_CONFIG_DIR = app.isPackaged
  ? path.join(__dirname, "configs")
  : path.join(process.cwd(), "configs");

/**
 * Đọc file config: ưu tiên userData trước, sau đó tới file đóng gói sẵn trong app
 */
export function getConfigFile(filename) {
  // 1. Kiểm tra trong userData (file người dùng đã từng lưu/sửa)
  const userPath = path.join(USER_CONFIG_DIR, filename);
  if (fs.existsSync(userPath)) return userPath;

  // 2. Kiểm tra trong gói ứng dụng (.vite/build/configs)
  const bundledPath = path.join(BUNDLED_CONFIG_DIR, filename);
  if (fs.existsSync(bundledPath)) return bundledPath;

  // 3. Kiểm tra trong root configs (dev mode)
  const rootPath = path.join(process.cwd(), "configs", filename);
  if (fs.existsSync(rootPath)) return rootPath;

  return userPath;
}

/**
 * Ghi file config: luôn luôn ghi vào userData để không bị lỗi read-only trong asar
 */
export function getWritableConfigFile(filename) {
  return path.join(USER_CONFIG_DIR, filename);
}

/**
 * Đọc và parse JSON từ file, tự động loại bỏ UTF-8 BOM (\uFEFF) nếu có
 */
export function readJsonFile(filePath, defaultValue = null) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").trim();
    if (!content) return defaultValue;
    return JSON.parse(content);
  } catch (err) {
    console.error(`Lỗi đọc JSON từ file ${filePath}:`, err.message);
    return defaultValue;
  }
}

/**
 * Lấy mật khẩu nén file zip/7z hiện tại
 */
export function getZipPassword() {
  const pPath = getConfigFile("passwordzip.json");
  const data = readJsonFile(pPath);
  if (data && data.password) return data.password;
  return "admin123";
}

/**
 * Lưu/Sửa mật khẩu nén file zip/7z mới vào userData
 */
export function saveZipPassword(newPassword) {
  const writePath = getWritableConfigFile("passwordzip.json");
  fs.writeFileSync(writePath, JSON.stringify({ password: newPassword }, null, 2), "utf8");
  return true;
}

