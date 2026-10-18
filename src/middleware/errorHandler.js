function notFoundHandler(req, res, next) {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
}

function errorHandler(err, req, res, next) {
    console.error("Server error:", err.message);

    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        message: statusCode === 500
            ? "Internal server error."
            : err.message
    });
}

module.exports = {
    notFoundHandler,
    errorHandler
};