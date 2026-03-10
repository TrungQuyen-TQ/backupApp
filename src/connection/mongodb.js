import { MongoClient } from "mongodb";

export async function testMongoConnection(dbConfig) {
  let client;

  try {
    const encodedPassword = encodeURIComponent(dbConfig.dbPassword);

    const uri = `mongodb://${dbConfig.dbUser}:${encodedPassword}@${dbConfig.server}:${dbConfig.port}/restaurant_db?authSource=admin`;
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 15000,
    });

    await client.connect();
    await client.close();

    return {
      success: true,
      message: "Kết nối MongoDB thành công"
     };
  } catch (err) {
    if (client) {
      try {
        await client.close();
      } catch {}
    }

    return {
      success: false,
      error: err.message,
    };
  }
}
