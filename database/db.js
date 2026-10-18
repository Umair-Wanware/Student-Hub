require("dotenv").config({ quiet: true });

const { Pool } = require("pg");

const requiredVariables = [
    "DB_HOST",
    "DB_NAME",
    "DB_USER",
];

const missingVariables = requiredVariables.filter(
    (key) => !process.env[key]
);

if (missingVariables.length > 0) {
    throw new Error(
        `Missing database configuration: ${missingVariables.join(", ")}`
    );
}

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

pool.on("connect", () => {
    console.log("PostgreSQL connection established.");
});

pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL error:", error.message);
});

module.exports = pool;
