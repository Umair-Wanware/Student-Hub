const pool = require("./database/db");

async function testConnection() {
    try {
        const result = await pool.query(
            "SELECT current_database(), current_user"
        );

        console.log("Database connection successful!");
        console.log("Database:", result.rows[0].current_database);
        console.log("PostgreSQL user:", result.rows[0].current_user);
    } catch (error) {
        console.error("Database connection failed:");
        console.error(error.message);
    } finally {
        await pool.end();
    }
}

testConnection();