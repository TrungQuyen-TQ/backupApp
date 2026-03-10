import { MongoClient } from 'mongodb';
import { ipcMain } from 'electron';

export const registerMongoHandlers = () => {
  ipcMain.handle("mongo:get-databases", async (event, dbConfig) => {
    // Lưu ý: Nếu pass có ký tự đặc biệt, bạn nên dùng encodeURIComponent(dbConfig.dbPassword)
    console.log("MongoDB Config:", dbConfig);
    const user = encodeURIComponent(dbConfig.dbUser);
    const pass = encodeURIComponent(dbConfig.dbPassword);
    const uri = `mongodb://${user}:${pass}@${dbConfig.server}:${dbConfig.port}/?authSource=admin`;
    const client = new MongoClient(uri);
    
    try {
      await client.connect();
      const adminDb = client.db().admin();
      const result = await adminDb.listDatabases();
      await client.close();
      
      const dbs = result.databases
        .map(db => db.name)
        .filter(name => !['admin', 'config', 'local'].includes(name));

      return { success: true, databases: dbs };
    } catch (err) {
      if (client) await client.close();
      return { success: false, error: err.message };
    }
  });
};