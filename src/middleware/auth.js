const crypto = require("crypto");

function requireAuth(req, res, next) {
    if (!req.session?.userId) {
        return res.status(401).json({
            success: false,
            message: "Please log in to continue."
        });
    }

    req.user = {
        id: req.session.userId,
        role: req.session.role
    };
    return next();
}

function requireAdmin(req, res, next) {
    if (req.user?.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Administrator access is required."
        });
    }
    return next();
}

function getCsrfToken(req) {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    }
    return req.session.csrfToken;
}

function requireCsrf(req, res, next) {
    const expected = req.session?.csrfToken;
    const supplied = req.get("x-csrf-token");

    if (
        typeof expected !== "string" ||
        typeof supplied !== "string" ||
        expected.length !== supplied.length ||
        !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
    ) {
        return res.status(403).json({
            success: false,
            message: "Invalid or missing CSRF token. Refresh the page and try again."
        });
    }

    return next();
}

module.exports = {
    getCsrfToken,
    requireAdmin,
    requireAuth,
    requireCsrf
};