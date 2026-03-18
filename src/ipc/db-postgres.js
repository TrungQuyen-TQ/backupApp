import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { Client } from 'pg';

import { ipcMain } from 'electron';

export const registerPostgresHandlers = () => {
  ipcMain.handle("postgres:get-databases", async (event, dbConfig) => {
    const client = new Client({
      host: dbConfig.server,
      port: Number(dbConfig.port),
      user: dbConfig.dbUser,
      password: dbConfig.dbPassword,
      database: 'postgres', // Postgres cần kết nối vào 1 db mặc định trước
      connectionTimeoutMillis: 5000,
    });

    try {
      await client.connect();
      const res = await client.query(`
        SELECT datname FROM pg_database 
        WHERE datistemplate = false AND datname != 'postgres'
      `);
      await client.end();
      
      return { success: true, databases: res.rows.map(r => r.datname) };
    } catch (err) {
      // Đảm bảo đóng kết nối nếu có lỗi
      try { await client.end(); } catch (e) {}
      return { success: false, error: "Postgres Error: " + err.message };
    }
  });

  ipcMain.handle("postgres:backup-remote", async (event, { dbConfig, backupConfig }) => {
    const ssh = new SshClient();
    
    // Các thông số từ user truyền lên
    const { server, sshPort, user, password } = dbConfig; // Thông tin SSH
    const { dbName, dbUser, dbPassword, localPath, zipPassword } = backupConfig; // Thông tin DB & nén

    return new Promise((resolve) => {
      ssh.on('ready', () => {
        // 1. Định nghĩa file tạm trên server
        const remoteSqlFile = `/tmp/dump_${dbName}_${Date.now()}.sql`;
        const remoteZipFile = `${remoteSqlFile}.7z`;

        // 2. Lệnh: Xuất DB -> Nén 7z với mật khẩu -> Xóa file SQL tạm
        // Lưu ý: Dùng PGPASSWORD để dump không bị hỏi pass, 
        // Lệnh '7za' dùng cho CentOS, '7z' cho Ubuntu (Sử dụng '7za || 7z' để tương thích cả hai)
        const mainCommand = `
          export PGPASSWORD='${dbPassword}' && \
          pg_dump -h localhost -U ${dbUser} -d ${dbName} -f ${remoteSqlFile} && \
          (7za a -p'${zipPassword}' -mhe=on ${remoteZipFile} ${remoteSqlFile} || 7z a -p'${zipPassword}' -mhe=on ${remoteZipFile} ${remoteSqlFile}) && \
          rm -f ${remoteSqlFile}
        `;

        ssh.exec(mainCommand, (err, stream) => {
          if (err) return resolve({ success: false, error: "SSH Exec Error: " + err.message });

          stream.on('close', (code) => {
            if (code !== 0) return resolve({ success: false, error: `Backup failed on server (Code: ${code})` });

            // 3. Mở SFTP để kéo file về Local
            ssh.sftp((err, sftp) => {
              if (err) return resolve({ success: false, error: "SFTP Error: " + err.message });

              sftp.fastGet(remoteZipFile, localPath, {}, (downloadErr) => {
                if (downloadErr) return resolve({ success: false, error: "Download Error: " + downloadErr.message });

                // 4. Dọn dẹp file zip trên server sau khi tải xong
                sftp.unlink(remoteZipFile, () => {
                  ssh.end();
                  resolve({ success: true, message: "Backup & Download thành công!", path: localPath });
                });
              });
            });
          }).on('data', (data) => console.log('STDOUT: ' + data))
            .stderr.on('data', (data) => console.error('STDERR: ' + data));
        });
      }).on('error', (err) => {
        resolve({ success: false, error: "SSH Connection Error: " + err.message });
      }).connect({
        host: server,
        port: Number(sshPort) || 22,
        username: user,
        password: password,
        readyTimeout: 20000
      });
    });
  });
};