const express = require("express");
const pool = require("../../database/db");
const {
    isPlainObject,
    sendValidationError,
    parsePagination,
    parseInteger,
    parseText,
    validateResourceId,
    sendList,
    handleDatabaseError
} = require("./routeUtils");

const router = express.Router();
const MAX_CLASSES = 10000;

const attendanceColumns = `
    id,
    subject,
    attended,
    total,
    created_at AS "createdAt",
    updated_at AS "updatedAt"`;

function validateAttendancePayload(body, { partial = false } = {}) {
    if (!isPlainObject(body)) {
        return { error: "Request body must be a JSON object." };
    }

    const record = {};
    const fields = ["subject", "attended", "total"];

    for (const field of fields) {
        const isPresent = Object.hasOwn(body, field);
        if (partial && !isPresent) continue;
        if (!isPresent) return { error: `${field} is required.` };

        if (field === "subject") {
            const subject = parseText(body.subject, {
                field: "Subject",
                maxLength: 100
            });
            if (subject.error) return subject;
            record.subject = subject.value;
            continue;
        }

        const value = parseInteger(body[field]);
        const minimum = field === "attended" ? 0 : 1;
        if (value === null || value < minimum || value > MAX_CLASSES) {
            return {
                error: `${field === "attended" ? "Attended classes" : "Total classes"} must be an integer between ${minimum} and ${MAX_CLASSES}.`
            };
        }
        record[field] = value;
    }

    if (partial && Object.keys(record).length === 0) {
        return { error: "Provide at least one attendance field to update." };
    }

    if (
        record.attended !== undefined &&
        record.total !== undefined &&
        record.attended > record.total
    ) {
        return { error: "Attended classes cannot exceed total classes." };
    }

    return { value: record };
}

router.get("/", async (req, res) => {
    const pagination = parsePagination(req.query);
    if (pagination.error) return sendValidationError(res, pagination.error);

    const params = [req.user.id];
    let whereClause = "WHERE user_id = $1";
    if (req.query.search !== undefined) {
        const search = parseText(req.query.search, {
            field: "Search",
            maxLength: 100
        });
        if (search.error) return sendValidationError(res, search.error);
        params.push(`%${search.value}%`);
        whereClause = "WHERE user_id = $1 AND subject ILIKE $2";
    }

    try {
        const countResult = await pool.query(
            `SELECT COUNT(*)::int AS total FROM attendance ${whereClause}`,
            params
        );
        const total = countResult.rows[0].total;
        const result = await pool.query(
            `SELECT ${attendanceColumns}
             FROM attendance
             ${whereClause}
             ORDER BY subject ASC, id ASC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, pagination.limit, pagination.offset]
        );
        return sendList(res, pagination, total, result.rows);
    } catch (error) {
        return handleDatabaseError(res, error, "Failed to fetch attendance records.");
    }
});

router.get("/:id", validateResourceId, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ${attendanceColumns} FROM attendance WHERE id = $1 AND user_id = $2`,
            [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Attendance record not found." });
        }
        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        return handleDatabaseError(res, error, "Failed to fetch attendance record.");
    }
});

router.post("/", async (req, res) => {
    const validation = validateAttendancePayload(req.body);
    if (validation.error) return sendValidationError(res, validation.error);

    const record = validation.value;
    try {
        const result = await pool.query(
            `INSERT INTO attendance (subject, attended, total, user_id)
             VALUES ($1, $2, $3, $4)
             RETURNING ${attendanceColumns}`,
            [record.subject, record.attended, record.total, req.user.id]
        );
        return res.status(201).json({
            success: true,
            message: "Attendance record created successfully.",
            data: result.rows[0]
        });
    } catch (error) {
        return handleDatabaseError(
            res,
            error,
            "Failed to create attendance record.",
            "An attendance record for this subject already exists."
        );
    }
});

async function updateAttendance(req, res, partial) {
    const validation = validateAttendancePayload(req.body, { partial });
    if (validation.error) return sendValidationError(res, validation.error);

    const currentResult = await pool.query(
        "SELECT attended, total FROM attendance WHERE id = $1 AND user_id = $2",
        [req.params.id, req.user.id]
    );
    if (currentResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Attendance record not found." });
    }

    const candidate = { ...currentResult.rows[0], ...validation.value };
    if (candidate.attended > candidate.total) {
        return sendValidationError(res, "Attended classes cannot exceed total classes.");
    }

    const fieldToColumn = { subject: "subject", attended: "attended", total: "total" };
    const entries = Object.entries(validation.value);
    const values = entries.map(([, value]) => value);
    const updates = entries.map(
        ([field], index) => `${fieldToColumn[field]} = $${index + 1}`
    );

    try {
        const result = await pool.query(
            `UPDATE attendance
             SET ${updates.join(", ")}
             WHERE id = $${values.length + 1} AND user_id = $${values.length + 2}
             RETURNING ${attendanceColumns}`,
            [...values, req.params.id, req.user.id]
        );
        return res.status(200).json({
            success: true,
            message: "Attendance record updated successfully.",
            data: result.rows[0]
        });
    } catch (error) {
        return handleDatabaseError(
            res,
            error,
            "Failed to update attendance record.",
            "An attendance record for this subject already exists."
        );
    }
}

router.put("/:id", validateResourceId, (req, res) => updateAttendance(req, res, false));
router.patch("/:id", validateResourceId, (req, res) => updateAttendance(req, res, true));

router.delete("/:id", validateResourceId, async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM attendance WHERE id = $1 AND user_id = $2 RETURNING ${attendanceColumns}`,
            [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Attendance record not found." });
        }
        return res.status(200).json({
            success: true,
            message: "Attendance record deleted successfully.",
            data: result.rows[0]
        });
    } catch (error) {
        return handleDatabaseError(res, error, "Failed to delete attendance record.");
    }
});

module.exports = router;
