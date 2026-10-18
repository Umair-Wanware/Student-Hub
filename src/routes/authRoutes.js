const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../../database/db");

const router = express.Router();

// POST: Register a new user
router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validate required fields
        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            !name.trim() ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, email, and password are required."
            });
        }

        const normalizedName = name.trim();
        const normalizedEmail = email.trim().toLowerCase();

        if (normalizedName.length > 100 || normalizedEmail.length > 150) {
            return res.status(400).json({
                success: false,
                message: "Name or email is too long."
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address."
            });
        }

        if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters and no more than 72 bytes."
            });
        }

        // Hash the password before storing it
        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, name, email, role, created_at`,
            [normalizedName, normalizedEmail, passwordHash]
        );

        return res.status(201).json({
            success: true,
            message: "Account registered successfully.",
            data: result.rows[0]
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        console.error("Registration error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to register account."
        });
    }
});

// POST: Login an existing user
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Find the user
        const result = await pool.query(
            `SELECT id, name, email, password_hash, role
             FROM users
             WHERE email = $1`,
            [normalizedEmail]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const user = result.rows[0];

        // Verify password
        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        // Generate JWT
        const token = require("jsonwebtoken").sign(
            {
                userId: user.id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1h",
                issuer: "student-hub"
            }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            token,
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to log in."
        });
    }
});

module.exports = router;