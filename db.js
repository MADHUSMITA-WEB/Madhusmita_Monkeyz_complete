require("dotenv").config();

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test Database Connection
(async () => {
    try {
        const connection = await pool.getConnection();

        console.log("✅ MySQL Connected Successfully");
        console.log("Host     :", process.env.DB_HOST);
        console.log("Database :", process.env.DB_NAME);
        console.log("Port     :", process.env.DB_PORT || 3306);

        connection.release();
    } catch (err) {
        console.error("❌ Database Connection Error:", err.message);
        process.exit(1);
    }
})();

module.exports = pool;
