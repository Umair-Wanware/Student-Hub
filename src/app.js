const express = require("express");
const path = require("path");
const helmet = require("helmet");
const session = require("express-session");
const connectPgSimple = require("connect-pg-simple");
const pool = require("../database/db");
const { requireAdmin, requireAuth, requireCsrf } = require("./middleware/auth");

const app = express();

if (!process.env.SESSION_SECRET || Buffer.byteLength(process.env.SESSION_SECRET) < 32) {
    throw new Error("SESSION_SECRET must be set to a random value of at least 32 bytes.");
}

app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false);

// Routes
const studentRoutes = require("./routes/studentRoutes");
const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const noteRoutes = require("./routes/noteRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const focusSessionRoutes = require("./routes/focusSessionRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const {
    notFoundHandler,
    errorHandler
} = require("./middleware/errorHandler");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "data:", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"]
        }
    }
}));
const PgSession = connectPgSimple(session);
app.use(session({
    name: "studenthub.sid",
    store: new PgSession({
        pool,
        tableName: "session",
        ttl: 12 * 60 * 60,
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax"
    }
}));
app.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    return requireCsrf(req, res, next);
});

// Serve frontend files
app.use(express.static(path.join(__dirname, "..", "public")));

// Health check API
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Student-Hub API is running!"
    });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/students", requireAuth, requireAdmin, studentRoutes);
app.use("/api/tasks", requireAuth, taskRoutes);
app.use("/api/notes", requireAuth, noteRoutes);
app.use("/api/attendance", requireAuth, attendanceRoutes);
app.use("/api/focus-sessions", requireAuth, focusSessionRoutes);
app.use("/api/dashboard", requireAuth, dashboardRoutes);

// Handle unknown API routes
app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found"
    });
});

// Handle other unknown routes and errors
app.use(notFoundHandler);
app.use(errorHandler);

// Export the Express application
module.exports = app;
