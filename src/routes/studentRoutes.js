const express = require("express");
const router = express.Router();
const pool = require("../../database/db");

function validateStudentId(req, res, next){
    const {id} = req.params;
    if(!/^[1-9]\d*$/.test(id)){
        return res.status(400).json({
            success: false,
            message: "Student ID must be positive integer"
        });
    }
}

// GET: Retrieve students with pagination, search, and filters
router.get("/", async (req, res) => {
    try {
        const { page = "1", limit = "10", search, course, year } = req.query;

        // Validate pagination parameters
        if (
            typeof page !== "string" ||
            !/^\d+$/.test(page) ||
            Number(page) < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Page must be a positive integer."
            });
        }

        if (
            typeof limit !== "string" ||
            !/^\d+$/.test(limit) ||
            Number(limit) < 1 ||
            Number(limit) > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Limit must be between 1 and 100."
            });
        }

        const currentPage = Number(page);
        const pageSize = Number(limit);
        const offset = (currentPage - 1) * pageSize;

        // Build parameterized filters
        const conditions = [];
        const params = [];

        if (search !== undefined) {
            if (typeof search !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "Search must be a string."
                });
            }

            const term = search.trim();

            if (term.length > 100) {
                return res.status(400).json({
                    success: false,
                    message: "Search cannot exceed 100 characters."
                });
            }

            if (term) {
                params.push(`%${term}%`);
                const index = params.length;

                conditions.push(
                    `(name ILIKE $${index}
                    OR email ILIKE $${index}
                    OR course ILIKE $${index}
                    OR CAST(id AS TEXT) ILIKE $${index})`
                );
            }
        }

        if (course !== undefined) {
            if (typeof course !== "string" || !course.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Course must be a non-empty string."
                });
            }

            params.push(`%${course.trim()}%`);
            conditions.push(`course ILIKE $${params.length}`);
        }

        if (year !== undefined) {
            if (
                typeof year !== "string" ||
                !/^[1-6]$/.test(year)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Year must be an integer between 1 and 6."
                });
            }

            params.push(Number(year));
            conditions.push(`year = $${params.length}`);
        }

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        // Get total number of matching students
        const countResult = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM students
             ${whereClause}`,
            params
        );

        const total = countResult.rows[0].total;

        // Retrieve the requested page
        const studentsResult = await pool.query(
            `SELECT *
             FROM students
             ${whereClause}
             ORDER BY id ASC
             LIMIT $${params.length + 1}
             OFFSET $${params.length + 2}`,
            [...params, pageSize, offset]
        );

        res.status(200).json({
            success: true,
            count: studentsResult.rows.length,
            total,
            page: currentPage,
            limit: pageSize,
            totalPages: Math.ceil(total / pageSize),
            data: studentsResult.rows
        });
    } catch (error) {
        console.error("Error fetching students:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to fetch students."
        });
    }
});

// POST: Add a new student
router.post("/", async (req, res) => {
    const { name, email, course, year } = req.body;

    if (!name || !email || !course || year === undefined) {
        return res.status(400).json({
            success: false,
            message: "Name, email, course, and year are required."
        });
    }

    try {
        const result = await pool.query(
            `INSERT INTO students (name, email, course, year)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name, email, course, Number(year)]
        );

        res.status(201).json({
            success: true,
            message: "Student added successfully.",
            data: result.rows[0]
        });
    } catch (error) {
        console.error("Error adding student:", error.message);

        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "A student with this email already exists."
            });
        }

        if (error.code === "23514" || error.code === "22P02") {
            return res.status(400).json({
                success: false,
                message: "Invalid student year."
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to add student."
        });
    }
});

// PUT: Update an existing student
router.put("/:id", validateStudentId, async (req, res) => {
    const { id } = req.params;
    const { name, email, course, year } = req.body;

    if (!name || !email || !course || year === undefined) {
        return res.status(400).json({
            success: false,
            message: "Name, email, course, and year are required."
        });
    }

    try {
        const result = await pool.query(
            `UPDATE students
             SET name = $1, email = $2, course = $3, year = $4
             WHERE id = $5
             RETURNING *`,
            [name, email, course, Number(year), id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        res.json({
            success: true,
            message: "Student updated successfully.",
            data: result.rows[0]
        });
    } catch (error) {
        console.error("Error updating student:", error.message);

        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "That email address is already in use."
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to update student."
        });
    }
});

// DELETE: Remove a student
router.delete("/:id", validateStudentId, async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            "DELETE FROM students WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        res.json({
            success: true,
            message: "Student deleted successfully.",
            data: result.rows[0]
        });
    } catch (error) {
        console.error("Error deleting student:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to delete student."
        });
    }
});

module.exports = router;