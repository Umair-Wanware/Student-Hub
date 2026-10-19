const express = require("express");
const pool = require("../../database/db");
const { handleDatabaseError } = require("./routeUtils");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                (SELECT COUNT(*)::int FROM tasks WHERE user_id = $1 AND completed = false) AS "pendingTasks",
                (SELECT COUNT(*)::int FROM notes WHERE user_id = $1) AS "totalNotes",
                COALESCE(
                    (SELECT ROUND(SUM(attended)::numeric / NULLIF(SUM(total), 0) * 100, 2) FROM attendance WHERE user_id = $1),
                    0
                )::float AS "attendanceAverage",
                COALESCE(
                    (SELECT SUM(duration_minutes)::int
                     FROM focus_sessions
                     WHERE user_id = $1 AND completed_at::date = CURRENT_DATE),
                    0
                ) AS "focusMinutesToday"
        `, [req.user.id]);
        const upcomingTasks = await pool.query(`
            SELECT
                id,
                title,
                subject,
                TO_CHAR(due_date, 'YYYY-MM-DD') AS "dueDate",
                priority,
                completed
            FROM tasks
            WHERE user_id = $1 AND completed = false
            ORDER BY due_date ASC, id DESC
            LIMIT 5
        `, [req.user.id]);

        return res.status(200).json({
            success: true,
            data: {
                ...result.rows[0],
                upcomingTasks: upcomingTasks.rows
            }
        });
    } catch (error) {
        return handleDatabaseError(res, error, "Failed to fetch dashboard data.");
    }
});

module.exports = router;
