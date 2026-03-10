import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('pg');

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
};