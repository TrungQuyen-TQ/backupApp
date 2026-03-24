import { backupSQLServer } from "../backups/sqlserver.js";
import { backupMySQL } from "../backups/mysql.js";
import { backupMongoDB } from "../backups/mongodb.js";
import { universalBackupHandler } from "../backups/postgresdb.js";
export const backupHandlers = {
  sqlserver: universalBackupHandler,
  mysql: universalBackupHandler,
  mongodb: universalBackupHandler,
  postgresql: universalBackupHandler

};