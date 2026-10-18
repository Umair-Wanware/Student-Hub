function notFoundHandler(req, res, next) {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
}

function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

    console.error("Server error:", err.message);

    const statusCode = err.type === "entity.parse.failed"
        ? 400
        : err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        message: statusCode === 400 && err.type === "entity.parse.failed"
            ? "Request body must contain valid JSON."
            : statusCode === 500
            ? "Internal server error."
            : err.message
    });
}

module.exports = {
    notFoundHandler,
    errorHandler
};
