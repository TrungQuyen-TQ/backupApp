// backupHandlers.js
import { universalBackupHandler as universalHandler } from "../backups/UniversalBackup.js";

export const backupHandlers = {
  mongodb: universalHandler,
  mysql: universalHandler,
  sqlserver: universalHandler,
  mssql: universalHandler,
  postgresql: universalHandler,
  postgres: universalHandler
};