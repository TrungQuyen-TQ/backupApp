import sql from "mssql";

export async function testSQLServerConnection(dbConfig) {
  let pool;

  try {
    pool = await sql.connect({
      user: dbConfig.dbUser,
      password: dbConfig.dbPassword,
      server: dbConfig.server,
      port: Number(dbConfig.port),

      // không cần database khi test
      database: "master",

      options: {
        encrypt: true,
        trustServerCertificate: true
      },

      connectionTimeout: 5000
    });

    // đóng connection
    await pool.close();

    return {
      success: true,
      message: "Kết nối SQL Server thành công"
    };

  } catch (err) {

    if (pool) {
      try { await pool.close(); } catch {}
    }

    return {
      success: false,
      error: err.message
    };
  }
}