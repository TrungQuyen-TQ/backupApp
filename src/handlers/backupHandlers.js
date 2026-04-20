// backupHandlers.js
import { backupSQLServer } from "../backups/sqlserver.js";
import { backupMySQL } from "../backups/mysql.js";
import { backupMongoDB } from "../backups/mongodb.js";
// backupHandlers.js
import { universalBackupHandler as universalHandler } from "../backups/postgresdb.js";

export const backupHandlers = {
  mongodb: universalHandler,
  mysql: universalHandler,
  sqlserver: universalHandler,
  mssql: universalHandler,
  postgresql: universalHandler,
  postgres: universalHandler
};