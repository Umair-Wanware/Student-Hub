const MAX_PAGE_SIZE = 100;

function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sendValidationError(res, message) {
    return res.status(400).json({
        success: false,
        message
    });
}

function parsePagination(query) {
    const page = parsePositiveInteger(query.page ?? "1");
    const limit = parsePositiveInteger(query.limit ?? "20");

    if (!page) {
        return { error: "Page must be a positive integer." };
    }

    if (!limit || limit > MAX_PAGE_SIZE) {
        return { error: `Limit must be between 1 and ${MAX_PAGE_SIZE}.` };
    }

    return {
        page,
        limit,
        offset: (page - 1) * limit
    };
}

function parsePositiveInteger(value) {
    const parsed = parseInteger(value);
    return parsed && parsed > 0 ? parsed : null;
}

function parseInteger(value) {
    if (typeof value === "number" && Number.isSafeInteger(value)) {
        return value;
    }

    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
        const parsed = Number(value.trim());
        return Number.isSafeInteger(parsed) ? parsed : null;
    }

    return null;
}

function parseBoolean(value) {
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return null;
}

function parseDateOnly(value) {
    if (typeof value !== "string") return null;

    const normalized = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;

    const date = new Date(`${normalized}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return null;

    return date.toISOString().slice(0, 10) === normalized
        ? normalized
        : null;
}

function parseDateTime(value) {
    if (typeof value !== "string") return null;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseText(value, { field, maxLength, required = true }) {
    if (value === undefined && !required) return { value: undefined };

    if (typeof value !== "string") {
        return { error: `${field} must be a string.` };
    }

    const normalized = value.trim();
    if (!normalized) {
        return { error: `${field} is required.` };
    }

    if (normalized.length > maxLength) {
        return { error: `${field} cannot exceed ${maxLength} characters.` };
    }

    return { value: normalized };
}

function validateResourceId(req, res, next) {
    if (!/^[1-9]\d*$/.test(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Resource ID must be a positive integer."
        });
    }

    return next();
}

function sendList(res, pagination, total, rows) {
    return res.status(200).json({
        success: true,
        count: rows.length,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
        data: rows
    });
}

function handleDatabaseError(res, error, fallbackMessage, duplicateMessage) {
    console.error(fallbackMessage, error.message);

    if (error.code === "23505" && duplicateMessage) {
        return res.status(409).json({
            success: false,
            message: duplicateMessage
        });
    }

    return res.status(500).json({
        success: false,
        message: fallbackMessage
    });
}

module.exports = {
    isPlainObject,
    sendValidationError,
    parsePagination,
    parseInteger,
    parseBoolean,
    parseDateOnly,
    parseDateTime,
    parseText,
    validateResourceId,
    sendList,
    handleDatabaseError
};
