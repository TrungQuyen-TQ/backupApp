const { exec } = require('child_process');
const path = require('path');

export async function backupMySQL(config) {
  return new Promise((resolve, reject) => {
    const folderName = `${config.host || config.server || 'unknown-ip'}_${config.dbType || 'mysql'}_${config.database || 'unknown-db'}`;
    const tempDirOnWindows = path.join(process.cwd(), "src", "temp", folderName);
    if (!require('fs').existsSync(tempDirOnWindows)) {
      require('fs').mkdirSync(tempDirOnWindows, { recursive: true });
    }

    const fileName = `backup_${Date.now()}.sql`;
    const filePath = path.join(tempDirOnWindows, fileName);
    console.log("Đang tạo backup MySQL với cấu hình:", config);
    // Câu lệnh mysqldump
    const cmd = `mysqldump -h ${config.host} -u ${config.user} -p${config.password} ${config.database} > "${filePath}"`;

    exec(cmd, (error) => {
      if (error) reject(error);
      else resolve({ success: true, filePath });
    });
  });
}