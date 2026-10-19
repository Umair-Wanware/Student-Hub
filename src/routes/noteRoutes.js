const express = require("express");
const pool = require("../../database/db");
const {
    isPlainObject,
    sendValidationError,
    parsePagination,
    parseDateOnly,
    parseText,
    validateResourceId,
    sendList,
    handleDatabaseError
} = require("./routeUtils");

const router = express.Router();

const noteColumns = `
    id,
    title,
    content,
    TO_CHAR(note_date, 'YYYY-MM-DD') AS date,
    created_at AS "createdAt",
    updated_at AS "updatedAt"`;

function validateNotePayload(body, { partial = false } = {}) {
    if (!isPlainObject(body)) {
        return { error: "Request body must be a JSON object." };
    }

    const note = {};
    const fields = ["title", "content", "date"];

    for (const field of fields) {
        const isPresent = Object.hasOwn(body, field);
        if (partial && !isPresent) continue;

        if (!isPresent && field === "date" && !partial) continue;
        if (!isPresent) return { error: `${field} is required.` };

        if (field === "date") {
            const date = parseDateOnly(body.date);
            if (!date) return { error: "Date must be a valid YYYY-MM-DD date." };
            note.date = date;
            continue;
        }

        const value = parseText(body[field], {
            field: field === "title" ? "Title" : "Content",
            maxLength: field === "title" ? 200 : 10000
        });
        if (value.error) return value;
        note[field] = value.value;
    }

    if (partial && Object.keys(note).length === 0) {
        return { error: "Provide at least one note field to update." };
    }

    return { value: note };
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
        whereClause = `WHERE user_id = $1 AND (title ILIKE $2 OR content ILIKE $2)`;
    }

    try {
        const countResult = await pool.query(
            `SELECT COUNT(*)::int AS total FROM notes ${whereClause}`,
            params
        );
        const total = countResult.rows[0].total;
        const result = await pool.query(
            `SELECT ${noteColumns}
             FROM notes
             ${whereClause}
             ORDER BY note_date DESC, id DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, pagination.limit, pagination.offset]
        );
        return sendList(res, pagination, total, result.rows);
    } catch (error) {
        return handleDatabaseError(res, error, "Failed to fetch notes.");
    }
});

router.get("/:id", validateResourceId, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ${noteColumns} FROM notes WHERE id = $1 AND user_id = $2`,
            [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Note not found." });
        }
        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        return handleDatabaseError(res, error, "Failed to fetch note.");
    }
});

router.post("/", async (req, res) => {
    const validation = validateNotePayload(req.body);
    if (validation.error) return sendValidationError(res, validation.error);

    const note = validation.value;
    try {
        const result = await pool.query(
            `INSERT INTO notes (title, content, note_date, user_id)
             VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4)
             RETURNING ${noteColumns}`,
            [note.title, note.content, note.date || null, req.user.id]
        );
        return res.status(201).json({
            success: true,
            message: "Note created successfully.",
            data: result.rows[0]
        });
    } catch (error) {
        return handleDatabaseError(res, error, "Failed to create note.");
    }
});

async function updateNote(req, res, partial) {
    const validation = validateNotePayload(req.body, { partial });
    if (validation.error) return sendValidationError(res, validation.error);

    const fieldToColumn = { title: "title", content: "content", date: "note_date" };
    const entries = Object.entries(validation.value);
    const values = entries.map(([, value]) => value);
    const updates = entries.map(
        ([field], index) => `${fieldToColumn[field]} = $${index + 1}`
    );

    try {
        const result = await pool.query(
            `UPDATE notes
             SET ${updates.join(", ")}
             WHERE id = $${values.length + 1} AND user_id = $${values.length + 2}
             RETURNING ${noteColumns}`,
            [...values, req.params.id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Note not found." });
        }
        return res.status(200).json({
            success: true,
            message: "Note updated successfully.",
            data: result.rows[0]
        });
    } catch (error) {
        return handleDatabaseError(res, error, "Failed to update note.");
    }
}

router.put("/:id", validateResourceId, (req, res) => updateNote(req, res, false));
router.patch("/:id", validateResourceId, (req, res) => updateNote(req, res, true));

router.delete("/:id", validateResourceId, async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING ${noteColumns}`,
            [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Note not found." });
        }
        return res.status(200).json({
            success: true,
            message: "Note deleted successfully.",
            data: result.rows[0]
        });
    } catch (error) {
        return handleDatabaseError(res, error, "Failed to delete note.");
    }
});

module.exports = router;
