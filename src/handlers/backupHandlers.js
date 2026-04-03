import { backupSQLServer } from "../backups/sqlserver.js";
import { backupMySQL } from "../backups/mysql.js";
import { backupMongoDB } from "../backups/mongodb.js";
import { universalBackupHandler } from "../backups/postgresdb.js";
export const backupHandlers = {
  postgres: universalBackupHandler,
  postgresql: universalBackupHandler, // Dự phòng cả 2 tên
  mysql: universalBackupHandler,
  mongodb: universalBackupHandler,
  sqlserver: universalBackupHandler
};