
console.log("main.js is running!");

document.addEventListener("DOMContentLoaded", () => {
    // LocalStorage Initializers
    let tasks = JSON.parse(localStorage.getItem("studysphere_tasks")) || [
        { id: 1, title: "Data Structures Practical", subject: "CS201", dueDate: "2026-10-25", priority: "High", completed: false },
        { id: 2, title: "Statistics Quiz Revision", subject: "STATS", dueDate: "2026-10-22", priority: "Medium", completed: true }
    ];

    let notes = JSON.parse(localStorage.getItem("studysphere_notes")) || [
        { id: 1, title: "OS Deadlock Conditions", content: "1. Mutual Exclusion\n2. Hold & Wait\n3. No Preemption\n4. Circular Wait", date: "2026-10-17" }
    ];

    let attendanceData = JSON.parse(localStorage.getItem("studysphere_attendance")) || [
        { id: 1, subject: "Computer Networks", attended: 18, total: 20 },
        { id: 2, subject: "DBMS", attended: 15, total: 20 }
    ];

    // Pomodoro Timer Variables
    let timerInterval = null;
    let timeLeft = 25 * 60;
    let isTimerRunning = false;

    const pageContent = document.getElementById("page-content");

    // Check that the main page container exists.
    if (!pageContent) {
        console.error(
            'Error: Element with id="page-content" was not found in index.html.'
        );
        return;
    }

    // Save the original dashboard HTML before switching pages.
    const originalDashboard = pageContent.innerHTML;

    const pages = {
        students: {
            title: "Students",
            description: "Manage student records and profiles.",
            icon: "fa-users"
        },
        courses: {
            title: "Courses",
            description: "Manage courses and course information.",
            icon: "fa-book-open"
        },
        attendance: {
            title: "Attendance",
            description: "Track daily student attendance.",
            icon: "fa-calendar-check"
        },
        examinations: {
            title: "Examinations",
            description: "Manage examination records and results.",
            icon: "fa-graduation-cap"
        }
    };

    let cachedStudents = [];

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function initials(name) {
        return String(name || "?")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part.charAt(0).toUpperCase())
            .join("");
    }

    function studentCode(id) {
        return `STU-${new Date().getFullYear()}-${String(id).padStart(3, "0")}`;
    }

    function studentRow(student, index) {
        const avatarClasses = ["purple", "blue", "green", "orange"];
        const avatarClass = avatarClasses[index % avatarClasses.length];

        return `
            <tr>
                <td>
                    <div class="student-cell">
                        <div class="student-avatar ${avatarClass}">${escapeHTML(initials(student.name))}</div>
                        <div>
                            <h4>${escapeHTML(student.name)}</h4>
                            <p>${escapeHTML(student.email)}</p>
                        </div>
                    </div>
                </td>
                <td>${escapeHTML(studentCode(student.id))}</td>
                <td>${escapeHTML(student.course)}</td>
                <td><span class="status active-status">Active</span></td>
                <td>
                    <button class="action-button" type="button"
                        aria-label="More actions for ${escapeHTML(student.name)}"
                        title="Student ID: ${escapeHTML(student.id)}">
                        <i class="fa-solid fa-ellipsis"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    function renderStudents(students) {
        cachedStudents = Array.isArray(students) ? students : [];

        const tableBody = document.getElementById("studentsTableBody");
        if (tableBody) {
            if (cachedStudents.length === 0) {
                tableBody.innerHTML = `
                    <tr><td colspan="5">No students found. Add your first student.</td></tr>
                `;
            } else {
                tableBody.innerHTML = cachedStudents
                    .map((student, index) => studentRow(student, index))
                    .join("");
            }
        }

        const totalCount = document.getElementById("totalStudentsCount");
        if (totalCount) {
            totalCount.textContent = cachedStudents.length.toLocaleString();
        }

        const studentsCount = document.getElementById("studentsPageCount");
        if (studentsCount) {
            studentsCount.textContent = `${cachedStudents.length} student${cachedStudents.length === 1 ? "" : "s"}`;
        }
    }

    async function loadStudents() {
        const tableBody = document.getElementById("studentsTableBody");
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="5">Loading students...</td></tr>';
        }

        try {
            const response = await fetch(API_URL);
            const result = await response.json();

            if (!response.ok || result.success === false) {
                throw new Error(result.message || "Could not load students.");
            }

            renderStudents(result.data || []);
        } catch (error) {
            console.error("Unable to load students:", error);
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr><td colspan="5">Could not load students. Check that the backend is running.</td></tr>
                `;
            }
        }
    }

    function updateGreeting() {
        const heading = pageContent.querySelector(
            ".welcome-section h2"
        );

        if (!heading) return;

        const hour = new Date().getHours();

        let greeting = "Welcome back";

        if (hour < 12) {
            greeting = "Good morning";
        } else if (hour < 17) {
            greeting = "Good afternoon";
        } else {
            greeting = "Good evening";
        }

        heading.textContent = `${greeting}, Admin! 👋`;
    }

    function studentsPageMarkup() {
        return `
            <section class="welcome-section page-heading">
                <div>
                    <h2><i class="fa-solid fa-users"></i> Students</h2>
                    <p>Manage student records and profiles.</p>
                </div>
                <button class="primary-button" id="addStudentButton" type="button">
                    <i class="fa-solid fa-plus"></i> Add Student
                </button>
            </section>

            <section class="content-card">
                <div class="section-header">
                    <div>
                        <h2>All Students</h2>
                        <p id="studentsPageCount">Loading students...</p>
                    </div>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>STUDENT</th>
                                <th>STUDENT ID</th>
                                <th>COURSE</th>
                                <th>STATUS</th>
                                <th>ACTION</th>
                            </tr>
                        </thead>
                        <tbody id="studentsTableBody">
                            <tr><td colspan="5">Loading students...</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>
        `;
    }

    function showPage(page) {
        // Use Dashboard as the fallback for an invalid page.
        if (page !== "dashboard" && !pages[page]) {
            page = "dashboard";
        }

        // Update active sidebar link.
        navLinks.forEach(link => {
            link.classList.toggle("active", link.dataset.page === page);
        });

        // Update topbar heading and breadcrumb.
        const topbarHeading = document.querySelector(
            ".topbar h1"
        );

        const breadcrumb = document.querySelector(
            ".breadcrumb"
        );

        const pageTitle = page === "dashboard"
            ? "Dashboard"
            : pages[page].title;

        if (topbarHeading) {
            topbarHeading.textContent = pageTitle;
        }

        if (breadcrumb) {
            breadcrumb.textContent = `Pages / ${pageTitle}`;
        }

        // Restore the original dashboard.
        if (page === "dashboard") {
            pageContent.innerHTML = originalDashboard;
            updateGreeting();
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        // Display the selected section.
        const selectedPage = pages[page];

        pageContent.innerHTML = `
            <section class="welcome-section page-heading">
                <div>
                    <h2>
                        <i class="fa-solid ${selectedPage.icon}"></i>
                        ${selectedPage.title}
                    </h2>
                    <p>${selectedPage.description}</p>
                </div>
            </section>

            <section class="content-card placeholder-card">
                <div class="placeholder-icon">
                    <i class="fa-solid ${selectedPage.icon}"></i>
                </div>

                <h3>${selectedPage.title} Management</h3>

                <p>
                    This section is ready for development.
                    We will add its features in the next steps.
                </p>
            </section>
        `;

        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // Handle sidebar clicks.
    navLinks.forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();

            const page = link.dataset.page;
            history.replaceState(null, "", `#${page}`);
            showPage(page);
        });
    });

    window.addEventListener("hashchange", () => {
        const page = window.location.hash.slice(1) || "dashboard";
        showPage(page);
    });

    // Open the page specified in the URL, or Dashboard by default.
    const initialPage =
        window.location.hash.slice(1) || "dashboard";

    showPage(initialPage);

    console.log("Student Management System initialized.");
});