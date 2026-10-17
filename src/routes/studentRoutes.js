const express = require("express");
const router = express.Router();
const pool = require("../../database/db");

// GET: Retrieve all students
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM students ORDER BY id ASC"
        );

        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
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
router.put("/:id", async (req, res) => {
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
router.delete("/:id", async (req, res) => {
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