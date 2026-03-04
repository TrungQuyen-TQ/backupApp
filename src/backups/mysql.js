const { exec } = require('child_process');
const path = require('path');

export async function backupMySQL(config) {
  return new Promise((resolve, reject) => {
    const fileName = `backup_${Date.now()}.sql`;
    const filePath = path.join(config.backupDir, fileName);
    
    // Câu lệnh mysqldump
    const cmd = `mysqldump -h ${config.host} -u ${config.user} -p${config.password} ${config.database} > "${filePath}"`;

    exec(cmd, (error) => {
      if (error) reject(error);
      else resolve({ success: true, filePath });
    });
  });
}