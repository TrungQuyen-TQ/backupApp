import mysql from 'mysql2/promise';

/**
 * Kiểm tra kết nối tới MySQL Server
 * Trả về đúng cấu trúc giống hàm testSQLServerConnection của bạn
 */
export async function testMySQLConnection(dbConfig) {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: dbConfig.server,
      port: Number(dbConfig.port),
      user: dbConfig.dbUser,
      password: dbConfig.dbPassword,
      connectTimeout: 5000 // 5 giây timeout
    });

    // Kết nối thành công thì đóng lại ngay
    await connection.end();

    return {
      success: true,
      message: "Kết nối MySQL thành công"
    };

  } catch (err) {
    // Đảm bảo đóng connection nếu có lỗi phát sinh trong lúc đang mở
    if (connection) {
      try { await connection.end(); } catch (e) {}
    }

    return {
      success: false,
      error: "MySQL Error: " + err.message
    };
  }
}

