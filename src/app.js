const express = require("express");
const path = require("path");

const app = express();

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
app.use("/api/students", studentRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/focus-sessions", focusSessionRoutes);
app.use("/api/dashboard", dashboardRoutes);

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
