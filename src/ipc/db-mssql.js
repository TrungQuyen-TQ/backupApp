import sql from 'mssql';
import { ipcMain } from 'electron';

export const registerMSSQLHandlers = () => {
  ipcMain.handle("mssql:get-databases", async (event, dbConfig) => {
    try {
      const pool = await sql.connect({
        user: dbConfig.dbUser,
        password: dbConfig.dbPassword,
        server: dbConfig.server,
        port: Number(dbConfig.port),
        options: { encrypt: true, trustServerCertificate: true },
      });
      
      const result = await pool.request().query(`
        SELECT name FROM sys.databases 
        WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')
      `);
      
      await pool.close();
      return { success: true, databases: result.recordset.map(r => r.name) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
};