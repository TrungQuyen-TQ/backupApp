import fs from 'fs';
import path from 'path';
import { Client as SshClient } from 'ssh2';
import pg from 'pg';
const { Client } = pg;

// Note: Always include the .js extension in Vite/ESM imports
/**
 * Hàm nội bộ thực thi các lệnh qua SSH (Logic lõi)
 */
async function executeSshBackup(sshConfig, backupConfig, sendProgress) {

  return new Promise((resolve) => {
    const ssh = new SshClient();
    const { host, port, username, password } = sshConfig;
    const { dblist, dbUser, dbPassword, localPath, zipPassword } = backupConfig;

    ssh.on('ready', () => {
      sendProgress("Đang thực thi pg_dump và nén file trên Server...", 30);
      const remoteSqlFile = `/tmp/dump_${dblist}_${Date.now()}.sql`;
      const remoteZipFile = `${remoteSqlFile}.7z`;

      // SỬ DỤNG JSON.stringify để bọc mật khẩu có ký tự đặc biệt ($#^"|) 
      // giúp an toàn hơn khi truyền vào lệnh Shell
      // Thay vì JSON.stringify, hãy dùng dấu nháy đơn của Shell
      const safeDbPass = `'${dbPassword.replace(/'/g, "'\\''")}'`;
      // Thay vì JSON.stringify(zipPassword), hãy làm tương tự pass DB:
      const safeZipPass = `'${zipPassword.replace(/'/g, "'\\''")}'`;
      const mainCommand = `
        export PGPASSWORD=${safeDbPass} && \
        pg_dump -h localhost -U ${dbUser} -d ${dblist} -f ${remoteSqlFile} && \
        (7za a -p${safeZipPass} -mhe=on ${remoteZipFile} ${remoteSqlFile} || 7z a -p${safeZipPass} -mhe=on ${remoteZipFile} ${remoteSqlFile}) && \
        rm -f ${remoteSqlFile}
      `;

      ssh.exec(mainCommand, (err, stream) => {
        if (err) {
          ssh.end();
          return resolve({ success: false, error: "SSH Exec Error: " + err.message });
        }



        stream.on('data', (data) => console.log('STDOUT: ' + data));
        let stderr = '';
        stream.stderr.on('data', (data) => {
          stderr += data.toString();
        });


        // Cập nhật khi có dữ liệu chạy qua
        stream.on('data', () => sendProgress("Đang xuất dữ liệu Postgres...", 45));

        stream.on('close', (code) => {
          if (code !== 0) {
            ssh.end();
            // Trả về stderr để biết chính xác pg_dump hay 7z bị lỗi gì
            return resolve({ success: false, error: `Lỗi Server (Code ${code}): ${stderr}` });
          }

          sendProgress("Đang chuẩn bị SFTP để tải file...", 65);

          ssh.sftp((err, sftp) => {
            if (err) {
              ssh.end();
              return resolve({ success: false, error: "SFTP Error: " + err.message });
            }

            sendProgress("Đang tải file backup .7z về máy local...", 80);

            // Tải file về localPath đã được chuẩn bị sẵn
            sftp.fastGet(remoteZipFile, localPath, {}, (downloadErr) => {
              if (downloadErr) {
                ssh.end();
                return resolve({ success: false, error: "Download Error: " + downloadErr.message });
              }

              sftp.unlink(remoteZipFile, () => {
                ssh.end();
                sendProgress("Hoàn tất quy trình Postgres!", 100);
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

async function getDatabaseStats(client, dbName) {
  // 1. Lấy phiên bản server Postgres
  const versionRes = await client.query("SELECT version();");
  const fullVersion = versionRes.rows[0].version;
  // Trích xuất số phiên bản ngắn (vd: 15.3)
  const shortVersion = fullVersion.split(' ')[1];

  // 2. Lấy danh sách các bảng và số lượng hàng (row count)
  // Truy vấn tất cả bảng trong schema 'public'
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);

  const tables = tablesRes.rows;
  let rowCounts = {};

  for (const table of tables) {
    const tableName = table.table_name;
    // Đếm số lượng bản ghi trong từng bảng
    const countRes = await client.query(`SELECT COUNT(*) FROM "${tableName}"`);
    rowCounts[tableName] = parseInt(countRes.rows[0].count);
  }

  return { shortVersion, rowCounts };
}

/**
 * HÀM CHÍNH: Được gọi từ Main Process
 * Đảm nhiệm việc tiền xử lý dữ liệu, đọc config và tạo thư mục
 */


export async function backupPostgresSql(formData, event) {

  const sendProgress = (msg, percent) => {
    if (event) event.sender.send("backup-progress", { message: msg, progress: percent });
  };

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


  sendProgress("Đang quét thống kê Database Postgres...", 10);
  // 2. Lấy Thống kê (Stats) từ Database qua port 5432 (hoặc dbPort)
  let dbStats = { shortVersion: "N/A", rowCounts: {} };
  const pgClient = new Client({
    host: formData.server,
    port: formData.dbPort || 5432,
    user: formData.dbUser,
    password: formData.dbPassword,
    database: formData.database,
  });

  try {
    await pgClient.connect();
    dbStats = await getDatabaseStats(pgClient, formData.database);
    await pgClient.end();
  } catch (err) {
    console.error("Lấy stats thất bại (có thể do port 5432 bị chặn):", err.message);
    // Vẫn tiếp tục để thực hiện backup qua SSH (port 22)
  }

  // 3. Kiểm tra và tạo thư mục localPath
  const localDir = formData.localPath;
  if (!fs.existsSync(localDir)) {
    try {
      fs.mkdirSync(localDir, { recursive: true });
    } catch (err) {
      return { success: false, error: `Không thể tạo thư mục: ${err.message}` };
    }
  }


  sendProgress("Đang thiết lập kết nối SSH...", 20);
  // 4. Chuẩn bị cấu hình chi tiết
  const finalFileName = `backup_${formData.database}_${Date.now()}.7z`;
  const fullLocalPath = path.join(localDir, finalFileName);

  const sshConfig = {
    host: formData.server,
    port: formData.sshPort || 22,
    username: formData.user,
    password: formData.password
  };

  const backupConfig = {
    dblist: formData.database,
    dbUser: formData.dbUser,
    dbPassword: formData.dbPassword,
    localPath: fullLocalPath,
    zipPassword: backupPassword
  };

  // 5. Gọi logic SSH thực hiện Backup & Download
  const backupResult = await executeSshBackup(sshConfig, backupConfig, sendProgress);

  // 6. Trả về kết quả cuối cùng cho Client (Dựa trên yêu cầu của bạn)
  if (backupResult.success) {
    return {
      success: true,
      filePath: fullLocalPath,
      fileName: finalFileName,
      dbName: formData.database,
      stats: {
        rowCounts: dbStats.rowCounts,
        version: dbStats.shortVersion,
      },
    };
  } else {
    // Trả về lỗi từ executeSshBackup nếu có
    return backupResult;
  }
}

// Thêm dòng này ở cuối file
export const universalBackupHandler = backupPostgresSql;