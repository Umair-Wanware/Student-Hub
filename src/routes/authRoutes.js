const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const pool = require("../../database/db");
const { getCsrfToken, requireAuth } = require("../middleware/auth");
const { createRateLimit } = require("../middleware/rateLimit");

const router = express.Router();
const dummyPasswordHash = bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), 12);
const authRateLimit = createRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many attempts. Please try again in 15 minutes."
});
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
    return email.length <= 150 && emailPattern.test(email);
}

function validatePassword(password) {
    if (typeof password !== "string" || password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
        return "Password must be at least 12 characters and no more than 72 bytes.";
    }
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        return "Password must include an uppercase letter, lowercase letter, number, and symbol.";
    }
    return null;
}

function sessionCall(sessionObject, method) {
    return new Promise((resolve, reject) => {
        sessionObject[method](error => error ? reject(error) : resolve());
    });
}

router.get("/csrf", (req, res) => {
    res.status(200).json({ success: true, csrfToken: getCsrfToken(req) });
});

router.post("/register", authRateLimit, async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body || {};

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            typeof confirmPassword !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, email, password, and password confirmation are required."
            });
        }

        const normalizedName = name.trim();
        const normalizedEmail = email.trim().toLowerCase();

        if (!normalizedName || normalizedName.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Name is required and cannot exceed 100 characters."
            });
        }

        if (!validateEmail(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address."
            });
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).json({
                success: false,
                message: passwordError
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match." });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, name, email, role, created_at`,
            [normalizedName, normalizedEmail, passwordHash]
        );

        return res.status(201).json({
            success: true,
            message: "Account created. You can now log in.",
            user: result.rows[0]
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

router.post("/login", authRateLimit, async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const result = await pool.query(
            `SELECT id, name, email, password_hash, role
             FROM users
             WHERE email = $1`,
            [normalizedEmail]
        );

        const user = result.rows[0];
        const passwordMatches = await bcrypt.compare(password, user?.password_hash || dummyPasswordHash);
        if (!user || !passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        await sessionCall(req.session, "regenerate");
        req.session.userId = String(user.id);
        req.session.role = user.role;
        getCsrfToken(req);
        await sessionCall(req.session, "save");

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            user: {
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

router.post("/logout", (req, res) => {
    if (!req.session) {
        return res.status(200).json({ success: true, message: "Logged out." });
    }
    req.session.destroy(error => {
        res.clearCookie("studenthub.sid", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/"
        });
        if (error) {
            console.error("Logout error:", error.message);
            return res.status(500).json({ success: false, message: "Failed to log out." });
        }
        return res.status(200).json({ success: true, message: "Logged out." });
    });
});

router.get("/me", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, email, role, created_at AS "createdAt"
             FROM users WHERE id = $1`,
            [req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: "Please log in to continue." });
        }
        return res.status(200).json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error("Account lookup error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to load account." });
    }
});

router.patch("/profile", requireAuth, async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return res.status(400).json({ success: false, message: "Request body must be an object." });
    }
    const allowedFields = new Set(["name", "email"]);
    if (Object.keys(body).some(field => !allowedFields.has(field)) || !Object.keys(body).length) {
        return res.status(400).json({ success: false, message: "Only name and email can be updated." });
    }

    const name = body.name === undefined ? undefined : typeof body.name === "string" ? body.name.trim() : null;
    const email = body.email === undefined ? undefined : typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
    if (name === null || (name !== undefined && (!name || name.length > 100))) {
        return res.status(400).json({ success: false, message: "Name is required and cannot exceed 100 characters." });
    }
    if (email === null || (email !== undefined && !validateEmail(email))) {
        return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }

    const updates = [];
    const values = [];
    if (name !== undefined) { values.push(name); updates.push(`name = $${values.length}`); }
    if (email !== undefined) { values.push(email); updates.push(`email = $${values.length}`); }
    values.push(req.user.id);

    try {
        const result = await pool.query(
            `UPDATE users SET ${updates.join(", ")} WHERE id = $${values.length}
             RETURNING id, name, email, role, created_at AS "createdAt"`,
            values
        );
        return res.status(200).json({ success: true, message: "Profile updated.", user: result.rows[0] });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ success: false, message: "An account with this email already exists." });
        }
        console.error("Profile update error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to update profile." });
    }
});

router.patch("/password", requireAuth, async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    if ([currentPassword, newPassword, confirmPassword].some(value => typeof value !== "string" || !value)) {
        return res.status(400).json({ success: false, message: "Current password, new password, and confirmation are required." });
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });
    if (newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, message: "New passwords do not match." });
    }

    let client;
    let transactionOpen = false;
    try {
        client = await pool.connect();
        await client.query("BEGIN");
        transactionOpen = true;
        const userResult = await client.query(
            "SELECT password_hash FROM users WHERE id = $1 FOR UPDATE",
            [req.user.id]
        );
        if (
            !userResult.rows.length ||
            Buffer.byteLength(currentPassword, "utf8") > 72 ||
            !(await bcrypt.compare(currentPassword, userResult.rows[0].password_hash))
        ) {
            await client.query("ROLLBACK");
            transactionOpen = false;
            return res.status(400).json({ success: false, message: "Current password is incorrect." });
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);
        await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, req.user.id]);
        await client.query(
            `DELETE FROM session
             WHERE sid <> $1 AND sess->>'userId' = $2`,
            [req.sessionID, String(req.user.id)]
        );
        await client.query("COMMIT");
        transactionOpen = false;
        await sessionCall(req.session, "regenerate");
        req.session.userId = String(req.user.id);
        req.session.role = req.user.role;
        getCsrfToken(req);
        await sessionCall(req.session, "save");

        return res.status(200).json({ success: true, message: "Password changed. Other sessions have been signed out." });
    } catch (error) {
        if (transactionOpen) await client.query("ROLLBACK").catch(() => {});
        console.error("Password update error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to change password." });
    } finally {
        client?.release();
    }
});

module.exports = router;