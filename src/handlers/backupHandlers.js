import { backupSQLServer } from "../backups/sqlserver.js";
import { backupMySQL } from "../backups/mysql.js";
import { backupMongoDB } from "../backups/mongodb.js";
export const backupHandlers = {
  sqlserver: backupSQLServer,
  mysql: backupMySQL,
  mongodb: backupMongoDB
};