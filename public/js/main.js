console.log("main.js is running!");

const API_URL = "/api/students";

document.addEventListener("DOMContentLoaded", () => {
    const navLinks = document.querySelectorAll(".nav-link");
    const pageContent = document.getElementById("page-content");

    if (!pageContent) {
        console.error('Error: Element with id="page-content" was not found in index.html.');
        return;
    }

    // Preserve the original dashboard markup and its styling.
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
        const heading = pageContent.querySelector(".welcome-section h2");
        if (!heading) return;

        const hour = new Date().getHours();
        let greeting = "Welcome back";
        if (hour < 12) greeting = "Good morning";
        else if (hour < 17) greeting = "Good afternoon";
        else greeting = "Good evening";

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
        if (page !== "dashboard" && !pages[page]) page = "dashboard";

        navLinks.forEach(link => {
            link.classList.toggle("active", link.dataset.page === page);
        });

        const topbarHeading = document.querySelector(".topbar h1");
        const breadcrumb = document.querySelector(".breadcrumb");
        const pageTitle = page === "dashboard" ? "Dashboard" : pages[page].title;

        if (topbarHeading) topbarHeading.textContent = pageTitle;
        if (breadcrumb) breadcrumb.textContent = `Pages / ${pageTitle}`;

        if (page === "dashboard") {
            pageContent.innerHTML = originalDashboard;
            updateGreeting();
            renderStudents(cachedStudents);
            loadStudents();
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        if (page === "students") {
            pageContent.innerHTML = studentsPageMarkup();
            renderStudents(cachedStudents);
            loadStudents();
        } else {
            const selectedPage = pages[page];
            pageContent.innerHTML = `
                <section class="welcome-section page-heading">
                    <div>
                        <h2><i class="fa-solid ${selectedPage.icon}"></i> ${selectedPage.title}</h2>
                        <p>${selectedPage.description}</p>
                    </div>
                </section>
                <section class="content-card placeholder-card">
                    <div class="placeholder-icon">
                        <i class="fa-solid ${selectedPage.icon}"></i>
                    </div>
                    <h3>${selectedPage.title} Management</h3>
                    <p>This section is ready for development. We will add its features in the next steps.</p>
                </section>
            `;
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function ensureModal() {
        if (document.getElementById("studentModal")) return;

        const style = document.createElement("style");
        style.textContent = `
            .student-modal-overlay {
                position: fixed; inset: 0; z-index: 1000; display: none;
                align-items: center; justify-content: center; padding: 20px;
                background: rgba(15, 23, 42, .58);
            }
            .student-modal-overlay.open { display: flex; }
            .student-modal {
                width: min(100%, 520px); background: #fff; border-radius: 18px;
                padding: 26px; box-shadow: 0 24px 70px rgba(0,0,0,.22);
            }
            .student-modal-header {
                display: flex; align-items: flex-start; justify-content: space-between;
                gap: 16px; margin-bottom: 20px;
            }
            .student-modal-header h2 { margin: 0 0 6px; }
            .student-modal-header p { margin: 0; color: #64748b; }
            .student-modal-close {
                border: 0; background: transparent; font-size: 24px; cursor: pointer;
            }
            .student-form-grid { display: grid; gap: 14px; }
            .student-form-grid label { display: grid; gap: 7px; font-weight: 600; }
            .student-form-grid input {
                width: 100%; box-sizing: border-box; padding: 11px 12px;
                border: 1px solid #dbe2ea; border-radius: 9px; font: inherit;
            }
            .student-form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
            .student-form-message { min-height: 20px; margin: 12px 0 0; color: #b42318; }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement("div");
        overlay.className = "student-modal-overlay";
        overlay.id = "studentModal";
        overlay.innerHTML = `
            <section class="student-modal" role="dialog" aria-modal="true" aria-labelledby="studentModalTitle">
                <div class="student-modal-header">
                    <div>
                        <h2 id="studentModalTitle">Add Student</h2>
                        <p>Enter the student's details below.</p>
                    </div>
                    <button class="student-modal-close" id="closeStudentModal" type="button" aria-label="Close">&times;</button>
                </div>
                <form id="addStudentForm">
                    <div class="student-form-grid">
                        <label>Full name
                            <input name="name" required maxlength="100" autocomplete="name" placeholder="e.g. Umair Wanware">
                        </label>
                        <label>Email address
                            <input name="email" type="email" required maxlength="150" autocomplete="email" placeholder="student@example.com">
                        </label>
                        <label>Course
                            <input name="course" required maxlength="100" placeholder="e.g. Computer Science">
                        </label>
                        <label>Academic year
                            <input name="year" type="number" min="1" max="10" step="1" required placeholder="e.g. 3">
                        </label>
                    </div>
                    <p class="student-form-message" id="studentFormMessage" role="status" aria-live="polite"></p>
                    <div class="student-form-actions">
                        <button class="secondary-button" id="cancelStudentModal" type="button">Cancel</button>
                        <button class="primary-button" id="submitStudentButton" type="submit">Save Student</button>
                    </div>
                </form>
            </section>
        `;
        document.body.appendChild(overlay);
    }

    function openStudentModal() {
        ensureModal();
        const modal = document.getElementById("studentModal");
        modal.classList.add("open");
        const nameInput = modal.querySelector('input[name="name"]');
        if (nameInput) nameInput.focus();
    }

    function closeStudentModal() {
        const modal = document.getElementById("studentModal");
        if (modal) modal.classList.remove("open");
    }

    // Delegated handlers keep working when the dashboard contents are re-rendered.
    document.addEventListener("click", event => {
        if (event.target.closest("#addStudentButton")) {
            openStudentModal();
        }
        if (event.target.closest("#closeStudentModal, #cancelStudentModal")) {
            closeStudentModal();
        }
        if (event.target.id === "studentModal") {
            closeStudentModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeStudentModal();
    });

    document.addEventListener("submit", async event => {
        if (event.target.id !== "addStudentForm") return;
        event.preventDefault();

        const form = event.target;
        const message = document.getElementById("studentFormMessage");
        const submitButton = document.getElementById("submitStudentButton");
        const formData = new FormData(form);
        const year = Number(formData.get("year"));

        const student = {
            name: String(formData.get("name") || "").trim(),
            email: String(formData.get("email") || "").trim(),
            course: String(formData.get("course") || "").trim(),
            year
        };

        if (!student.name || !student.email || !student.course ||
            !Number.isInteger(year) || year < 1 || year > 10) {
            message.textContent = "Please enter valid details in every field.";
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Saving...";
        message.textContent = "";

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(student)
            });
            const result = await response.json();

            if (!response.ok || result.success === false) {
                throw new Error(result.message || "Unable to add student.");
            }

            form.reset();
            closeStudentModal();
            await loadStudents();
        } catch (error) {
            console.error("Unable to add student:", error);
            message.textContent = error.message || "Unable to add student. Please try again.";
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Save Student";
        }
    });

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

    ensureModal();
    const initialPage = window.location.hash.slice(1) || "dashboard";
    showPage(initialPage);
    console.log("Student Management System initialized.");
});
