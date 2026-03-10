import pkg from 'pg';
const { Client } = pkg;

/**
 * Kiểm tra kết nối tới Postgres Server
 */
export async function testPostgresConnection(dbConfig) {
  const client = new Client({
    host: dbConfig.server,
    port: Number(dbConfig.port),
    user: dbConfig.dbUser,
    password: dbConfig.dbPassword,
    database: 'postgres', // Kết nối mặc định để test
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    await client.end();

    return {
      success: true,
      message: "Kết nối Postgres thành công"
    };

  } catch (err) {
    // Đảm bảo đóng client nếu lỗi xảy ra sau khi đã connect
    try { await client.end(); } catch (e) {}

    return {
      success: false,
      error: "Postgres Error: " + err.message
    };
  }
}

/**
 * Lấy danh sách Database từ Postgres Server
 */
