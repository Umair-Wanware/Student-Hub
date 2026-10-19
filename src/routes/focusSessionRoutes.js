const express = require("express");
const pool = require("../../database/db");
const {
    isPlainObject,
    sendValidationError,
    parsePagination,
    parseInteger,
    parseDateOnly,
    parseDateTime,
    validateResourceId,
    sendList,
    handleDatabaseError
} = require("./routeUtils");

const router = express.Router();
const MAX_DURATION_MINUTES = 1440;

const sessionColumns = `
    id,
    duration_minutes AS "durationMinutes",
    completed_at AS "completedAt",
    created_at AS "createdAt"`;

function validateFocusSession(body) {
    if (!isPlainObject(body)) {
        return { error: "Request body must be a JSON object." };
    }

    const durationMinutes = parseInteger(body.durationMinutes);
    if (
        durationMinutes === null ||
        durationMinutes < 1 ||
        durationMinutes > MAX_DURATION_MINUTES
    ) {
        return {
            error: `Duration minutes must be an integer between 1 and ${MAX_DURATION_MINUTES}.`
        };
    }

    let completedAt;
    if (body.completedAt !== undefined) {
        completedAt = parseDateTime(body.completedAt);
        if (!completedAt) {
            return { error: "Completed at must be a valid ISO-8601 date and time." };
        }
    }

    return { value: { durationMinutes, completedAt } };
}

router.get("/", async (req, res) => {
    const pagination = parsePagination(req.query);
    if (pagination.error) return sendValidationError(res, pagination.error);

    const params = [req.user.id];
    let whereClause = "WHERE user_id = $1";
    if (req.query.date !== undefined) {
        const date = parseDateOnly(req.query.date);
        if (!date) return sendValidationError(res, "Date must be a valid YYYY-MM-DD date.");
        params.push(date);
        whereClause = "WHERE user_id = $1 AND completed_at::date = $2::date";
    }

    try {
        const countResult = await pool.query(
            `SELECT COUNT(*)::int AS total FROM focus_sessions ${whereClause}`,
            params
        );
        const total = countResult.rows[0].total;
        const result = await pool.query(
            `SELECT ${sessionColumns}
             FROM focus_sessions
             ${whereClause}
             ORDER BY completed_at DESC, id DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, pagination.limit, pagination.offset]
        );
        return sendList(res, pagination, total, result.rows);
    } catch (error) {
        return handleDatabaseError(res, error, "Failed to fetch focus sessions.");
    }
});

router.post("/", async (req, res) => {
    const validation = validateFocusSession(req.body);
    if (validation.error) return sendValidationError(res, validation.error);

    const session = validation.value;
    try {
        const result = await pool.query(
            `INSERT INTO focus_sessions (duration_minutes, completed_at, user_id)
             VALUES ($1, COALESCE($2::timestamptz, CURRENT_TIMESTAMP), $3)
             RETURNING ${sessionColumns}`,
            [session.durationMinutes, session.completedAt || null, req.user.id]
        );
        return res.status(201).json({
            success: true,
            message: "Focus session recorded successfully.",
            data: result.rows[0]
        });
    } catch (error) {
        return handleDatabaseError(res, error, "Failed to record focus session.");
    }
});

router.delete("/:id", validateResourceId, async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM focus_sessions WHERE id = $1 AND user_id = $2 RETURNING ${sessionColumns}`,
            [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Focus session not found." });
        }
        return res.status(200).json({
            success: true,
            message: "Focus session deleted successfully.",
            data: result.rows[0]
        });
    } catch (error) {
        return handleDatabaseError(res, error, "Failed to delete focus session.");
    }
});

module.exports = router;
