import mysql from 'mysql2/promise';
import { ipcMain } from 'electron';

export const registerMySQLHandlers = () => {
  ipcMain.handle("mysql:get-databases", async (event, dbConfig) => {
    let connection;
    try {
      connection = await mysql.createConnection({
        host: dbConfig.server,
        port: Number(dbConfig.port),
        user: dbConfig.dbUser,
        password: dbConfig.dbPassword,
      });
      
      const [rows] = await connection.query("SHOW DATABASES");
      await connection.end();
      
      const dbs = rows
        .map(r => r.Database)
        .filter(db => !['information_schema', 'mysql', 'performance_schema', 'sys'].includes(db));
        
      return { success: true, databases: dbs };
    } catch (err) {
      if (connection) await connection.end();
      return { success: false, error: err.message };
    }
  });
};