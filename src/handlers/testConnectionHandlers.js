import { testSQLServerConnection } from "../connection/sqlserver.js";
import { testMongoConnection } from "../connection/mongodb.js";
import { testMySQLConnection } from "../connection/mysql.js";
import { testPostgresConnection } from "../connection/postgresdb.js"; 
export const testConnectionHandlers = {
  sqlserver: testSQLServerConnection,
  mongodb: testMongoConnection,
  mysql: testMySQLConnection,
  postgresql: testPostgresConnection
    // Sau này có thể thêm các handler khác cho MySQL, PostgreSQL, v.v.
};