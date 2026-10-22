const express = require("express");
const pool = require("../../database/db");
const {
    isPlainObject,
    sendValidationError,
    parsePagination,
    parseBoolean,
    parseDateOnly,
    parseText,
    validateResourceId,
    sendList,
    handleDatabaseError
} = require("./routeUtils");

const router = express.Router();
const PRIORITIES = new Set(["High", "Medium", "Low"]);

const taskColumns = `
    id,
    title,
    subject,
    TO_CHAR(due_date, 'YYYY-MM-DD') AS "dueDate",
    priority,
    completed,
    created_at AS "createdAt",
    updated_at AS "updatedAt"`;

function validateTaskPayload(body, { partial = false } = {}) {
    if (!isPlainObject(body)) {
        return { error: "Request body must be a JSON object." };
    }

    const task = {};
    const fields = ["title", "subject", "dueDate", "priority", "completed"];

    for (const field of fields) {
        const isPresent = Object.hasOwn(body, field);
        if (partial && !isPresent) continue;

        if (!isPresent && field === "completed") {
            task.completed = false;
            continue;
        }

        if (!isPresent) {
            return { error: `${field} is required.` };
        }

        if (field === "title" || field === "subject") {
            const result = parseText(body[field], {
                field: field === "dueDate" ? "Due date" : field[0].toUpperCase() + field.slice(1),
                maxLength: field === "title" ? 200 : 100
            });
            if (result.error) return result;
            task[field] = result.value;
            continue;
        }

        if (field === "dueDate") {
            const dueDate = parseDateOnly(body.dueDate);
            if (!dueDate) return { error: "Due date must be a valid YYYY-MM-DD date." };
            task.dueDate = dueDate;
            continue;
        }

        if (field === "priority") {
            if (!PRIORITIES.has(body.priority)) {
                return { error: "Priority must be High, Medium, or Low." };
            }
            task.priority = body.priority;
            continue;
        }

        if (typeof body.completed !== "boolean") {
            return { error: "Completed must be true or false." };
        }
        task.completed = body.completed;
    }

    if (partial && Object.keys(task).length === 0) {
        return { error: "Provide at least one task field to update." };
    }

    return { value: task };
}

async function getTaskById(id, userId) {
    const result = await pool.query(
        `SELECT ${taskColumns} FROM tasks WHERE id = $1 AND user_id = $2`,
        [id, userId]
    );
    return result.rows[0];
}

router.get("/", async (req, res) => {
    const pagination = parsePagination(req.query);
    if (pagination.error) return sendValidationError(res, pagination.error);

    const conditions = ["user_id = $1"];
    const params = [req.user.id];

    if (req.query.completed !== undefined) {
        const completed = parseBoolean(req.query.completed);
        if (completed === null) {
            return sendValidationError(res, "Completed must be true or false.");
        }
        params.push(completed);
        conditions.push(`completed = $${params.length}`);
    }

    if (req.query.search !== undefined) {
        const search = parseText(req.query.search, {
            field: "Search",
            maxLength: 100
        });
        if (search.error) return sendValidationError(res, search.error);

        params.push(`%${search.value}%`);
        conditions.push(`(title ILIKE $${params.length} OR subject ILIKE $${params.length})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
        const countResult = await pool.query(
            `SELECT COUNT(*)::int AS total FROM tasks ${whereClause}`,
            params
        );
        const total = countResult.rows[0].total;
        const result = await pool.query(
            `SELECT ${taskColumns}
             FROM tasks
             ${whereClause}
             ORDER BY completed ASC, due_date ASC, id DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, pagination.limit, pagination.offset]
        );

        return sendList(res, pagination, total, result.rows);
    } catch (error) {
        return handleDatabaseError(res, error, "Failed to fetch tasks.");
    }
});

router.get("/:id", validateResourceId, async (req, res) => {
    try {
        const task = await getTaskById(req.params.id, req.user.id);
        if (!task) {
            return res.status(404).json({ success: false, message: "Task not found." });
        }
        return res.status(200).json({ success: true, data: task });
    } catch (error) {
        return handleDatabaseError(res, error, "Failed to fetch task.");
    }
});

router.post("/", async (req, res) => {
    const validation = validateTaskPayload(req.body);
    if (validation.error) return sendValidationError(res, validation.error);

    const task = validation.value;
    try {
        const result = await pool.query(
            `INSERT INTO tasks (title, subject, due_date, priority, completed, user_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING ${taskColumns}`,
            [task.title, task.subject, task.dueDate, task.priority, task.completed, req.user.id]
        );
        return res.status(201).json({
            success: true,
            message: "Task created successfully.",
            data: result.rows[0]
        });
    } catch (error) {
        return handleDatabaseError(res, error, "Failed to create task.");
    }
});

async function updateTask(req, res, partial) {
    const validation = validateTaskPayload(req.body, { partial });
    if (validation.error) return sendValidationError(res, validation.error);

    const fieldToColumn = {
        title: "title",
        subject: "subject",
        dueDate: "due_date",
        priority: "priority",
        completed: "completed"
    };
    const entries = Object.entries(validation.value);
    const values = entries.map(([, value]) => value);
    const updates = entries.map(
        ([field], index) => `${fieldToColumn[field]} = $${index + 1}`
    );

    try {
        const result = await pool.query(
            `UPDATE tasks
             SET ${updates.join(", ")}
             WHERE id = $${values.length + 1} AND user_id = $${values.length + 2}
             RETURNING ${taskColumns}`,
            [...values, req.params.id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Task not found." });
        }
        return res.status(200).json({
            success: true,
            message: "Task updated successfully.",
            data: result.rows[0]
        });
    } catch (error) {
        return handleDatabaseError(res, error, "Failed to update task.");
    }
}

router.put("/:id", validateResourceId, (req, res) => updateTask(req, res, false));
router.patch("/:id", validateResourceId, (req, res) => updateTask(req, res, true));

router.delete("/:id", validateResourceId, async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING ${taskColumns}`,
            [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Task not found." });
        }
        return res.status(200).json({
            success: true,
            message: "Task deleted successfully.",
            data: result.rows[0]
        });
    } catch (error) {
        return handleDatabaseError(res, error, "Failed to delete task.");
    }
});

module.exports = router;