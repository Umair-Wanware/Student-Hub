const { Pool } = require("pg");

const pool = new Pool({
    user: process.env.DB_USER || process.env.USER,
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || "student_hub",
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432
});

// Test the database connection
pool.on("connect", () => {
    console.log("Connected to PostgreSQL");
});

pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL error:", error.message);
});

module.exports = pool;