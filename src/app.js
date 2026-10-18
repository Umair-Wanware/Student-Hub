const express = require("express");
const path = require("path");

const app = express();

const{
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

// Student routes
const studentRoutes = require("./routes/studentRoutes");
const { error } = require("console");

app.use("/api/students", studentRoutes);

// Handle unknown API routes
app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found"
    });
});

module.exports = app;
app.use(notFoundHandler);
app.use(errorHandler);