import sql from "mssql";
import fs from "node:fs";
import path from "node:path";
import SftpClient from "ssh2-sftp-client";

// Hàm bổ trợ lấy stats (nên để trong file này nếu chỉ dùng cho SQL Server)
async function getDatabaseStats(pool) {
  const versionRaw = await pool.request().query("SELECT @@VERSION as version");
  const shortVersion = versionRaw.recordset[0].version.split("-")[0].split("\n")[0].trim();

  const tablesQuery = await pool.request().query(`
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME NOT LIKE 'sys%'
  `);

  const allTables = tablesQuery.recordset.map((row) => row.TABLE_NAME);
  let rowCounts = {};

  for (const table of allTables) {
    try {
      const result = await pool.request().query(`SELECT COUNT(*) as count FROM [${table}]`);
      rowCounts[table] = result.recordset[0].count;
    } catch (err) {
      rowCounts[table] = "N/A";
    }
  }
  return { shortVersion, rowCounts };
}

export async function backupSQLServer(dbConfig, sshConfig) {
  const tempDirOnWindows = path.join(process.cwd(), "src", "temp");
  if (!fs.existsSync(tempDirOnWindows)) {
    fs.mkdirSync(tempDirOnWindows, { recursive: true });
  }

  const fileName = `${dbConfig.database}_${Date.now()}.bak`;
  const filePathOnWindows = path.join(tempDirOnWindows, fileName);
  const filePathOnUbuntu = `/var/opt/mssql/data/${fileName}`;

  const sftp = new SftpClient();
  let pool;

  try {
    // 1. Kết nối và Backup trên Server
    pool = await sql.connect({
      user: dbConfig.user,
      password: dbConfig.password,
      server: dbConfig.server,
      database: dbConfig.database,
      port: Number(dbConfig.port),
      options: { encrypt: true, trustServerCertificate: true },
    });

    const stats = await getDatabaseStats(pool);

    await pool.request().query(
      `BACKUP DATABASE [${dbConfig.database}] TO DISK = '${filePathOnUbuntu}' WITH INIT`
    );
    await pool.close();

    // 2. Kéo file về qua SFTP
    await sftp.connect(sshConfig);
    await sftp.fastGet(filePathOnUbuntu, filePathOnWindows);
    await sftp.delete(filePathOnUbuntu);
    await sftp.end();

    return { 
      success: true, 
      filePath: filePathOnWindows, 
      fileName, 
      stats 
    };

  } catch (err) {
    if (pool) await pool.close();
    try { await sftp.end(); } catch (e) { /* ignore */ }
    throw new Error(`Lỗi quy trình SQL Server: ${err.message}`);
  }
}