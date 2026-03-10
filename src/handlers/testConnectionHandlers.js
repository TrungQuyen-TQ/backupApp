import { testSQLServerConnection } from "../connection/sqlserver.js";
import { testMongoConnection } from "../connection/mongodb.js";
import { testMySQLConnection } from "../connection/mysql.js";
export const testConnectionHandlers = {
  sqlserver: testSQLServerConnection,
  mongodb: testMongoConnection,
  mysql: testMySQLConnection,
  //postgres: testPostgresConnection
    // Sau này có thể thêm các handler khác cho MySQL, PostgreSQL, v.v.
};