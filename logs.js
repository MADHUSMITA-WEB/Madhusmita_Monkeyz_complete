// Prints the ActivityLog table from MySQL in the terminal.
//
//   node logs.js              -> last 50 logs
//   node logs.js 100          -> last 100 logs
//   node logs.js 50 PAYMENT   -> last 50 logs whose Action starts with PAYMENT
//
// Works locally and on the hosted server (it reads the same .env).
require("dotenv").config();

const mysql = require("mysql2/promise");

(async () => {
    const limit = Math.min(parseInt(process.argv[2], 10) || 50, 1000);
    const action = (process.argv[3] || "").toUpperCase();

    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });

    try {
        const [rows] = await conn.query(
            `SELECT LogId, Action, UserId, Email, Details,
                    DATE_FORMAT(CreatedAt, '%Y-%m-%d %H:%i:%s') AS CreatedAt
             FROM ActivityLog
             ${action ? "WHERE Action LIKE ?" : ""}
             ORDER BY LogId DESC
             LIMIT ${limit}`,
            action ? [action + "%"] : []
        );

        if (rows.length === 0) {
            console.log("No logs found.");
        } else {
            console.table(rows.reverse());
        }
    } catch (err) {
        console.error("Could not read logs:", err.sqlMessage || err.message);
        process.exitCode = 1;
    } finally {
        await conn.end();
    }
})();
