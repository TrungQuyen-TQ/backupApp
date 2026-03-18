import fs from 'fs';
import path from 'path';
import { Client as SshClient } from 'ssh2';
// Note: Always include the .js extension in Vite/ESM imports
/**
 * Hàm nội bộ thực thi các lệnh qua SSH (Logic lõi)
 */
async function executeSshBackup(sshConfig, backupConfig) {
  return new Promise((resolve) => {
    const ssh = new SshClient();
    const { host, port, username, password } = sshConfig;
    const { dbName, dbUser, dbPassword, localPath, zipPassword } = backupConfig;

    ssh.on('ready', () => {
      const remoteSqlFile = `/tmp/dump_${dbName}_${Date.now()}.sql`;
      const remoteZipFile = `${remoteSqlFile}.7z`;

      // SỬ DỤNG JSON.stringify để bọc mật khẩu có ký tự đặc biệt ($#^"|) 
      // giúp an toàn hơn khi truyền vào lệnh Shell
      const safeDbPass = JSON.stringify(dbPassword);
      const safeZipPass = JSON.stringify(zipPassword);

      const mainCommand = `
        export PGPASSWORD=${safeDbPass} && \
        pg_dump -h localhost -U ${dbUser} -d ${dbName} -f ${remoteSqlFile} && \
        (7za a -p${safeZipPass} -mhe=on ${remoteZipFile} ${remoteSqlFile} || 7z a -p${safeZipPass} -mhe=on ${remoteZipFile} ${remoteSqlFile}) && \
        rm -f ${remoteSqlFile}
      `;

      ssh.exec(mainCommand, (err, stream) => {
        if (err) {
          ssh.end();
          return resolve({ success: false, error: "SSH Exec Error: " + err.message });
        }

        stream.on('close', (code) => {
          if (code !== 0) {
            ssh.end();
            return resolve({ success: false, error: `Lỗi backup trên server (Code: ${code}). Kiểm tra pg_dump/7zip.` });
          }

          ssh.sftp((err, sftp) => {
            if (err) {
              ssh.end();
              return resolve({ success: false, error: "SFTP Error: " + err.message });
            }

            // Tải file về localPath đã được chuẩn bị sẵn
            sftp.fastGet(remoteZipFile, localPath, {}, (downloadErr) => {
              if (downloadErr) {
                ssh.end();
                return resolve({ success: false, error: "Download Error: " + downloadErr.message });
              }

              sftp.unlink(remoteZipFile, () => {
                ssh.end();
                resolve({ success: true, message: "Backup & Download thành công!", path: localPath });
              });
            });
          });
        });
      });
    })
    .on('error', (err) => {
      resolve({ success: false, error: "Kết nối SSH thất bại: " + err.message });
    })
    .connect({
      host,
      port: Number(port) || 22,
      username,
      password,
      readyTimeout: 20000
    });
  });
}

/**
 * HÀM CHÍNH: Được gọi từ Main Process
 * Đảm nhiệm việc tiền xử lý dữ liệu, đọc config và tạo thư mục
 */
export async function handlePostgresBackup(formData) {
  // 1. Đọc mật khẩu Zip từ file JSON
  const passwordPath = path.join(process.cwd(), "configs", "passwordzip.json");
  let backupPassword = "DefaultPassword123";
  try {
    if (fs.existsSync(passwordPath)) {
      const config = JSON.parse(fs.readFileSync(passwordPath, 'utf8'));
      backupPassword = config.password;
    }
  } catch (error) {
    console.warn("Không đọc được file mật khẩu, dùng mặc định.");
  }

  // 2. Kiểm tra và tạo thư mục localPath (Sử dụng mkdirSync với recursive)
  const localDir = formData.localPath;
  if (!fs.existsSync(localDir)) {
    try {
      fs.mkdirSync(localDir, { recursive: true });
    } catch (err) {
      return { success: false, error: `Không thể tạo thư mục: ${err.message}` };
    }
  }

  // 3. Chuẩn bị cấu hình chi tiết
  const sshConfig = {
    host: formData.server,
    port: formData.sshPort,
    username: formData.user,
    password: formData.password
  };

  const finalFileName = `backup_${formData.dbName || 'db'}_${Date.now()}.7z`;
  const backupConfig = {
    dbName: formData.dbName || 'postgres',
    dbUser: formData.dbUser,
    dbPassword: formData.dbPassword,
    localPath: path.join(localDir, finalFileName),
    zipPassword: backupPassword
  };

  // 4. Gọi logic SSH thực hiện
  return await executeSshBackup(sshConfig, backupConfig);
}
