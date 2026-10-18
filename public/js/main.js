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
    const navLinks = document.querySelectorAll(".nav-link");
    const themeToggleBtn = document.getElementById("theme-toggle");

    // Save Data Helpers
    const saveTasks = () => localStorage.setItem("studysphere_tasks", JSON.stringify(tasks));
    const saveNotes = () => localStorage.setItem("studysphere_notes", JSON.stringify(notes));
    const saveAttendance = () => localStorage.setItem("studysphere_attendance", JSON.stringify(attendanceData));

    // Theme Switcher
    themeToggleBtn.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        const icon = themeToggleBtn.querySelector("i");
        if (document.body.classList.contains("dark-mode")) {
            icon.className = "fa-solid fa-sun";
        } else {
            icon.className = "fa-solid fa-moon";
        }
    });

    // Update Dashboard Stats Widget
    function refreshStats() {
        const pendingCount = tasks.filter(t => !t.completed).length;
        const pendingElem = document.getElementById("stat-pending-count");
        if (pendingElem) pendingElem.textContent = pendingCount;

        const notesElem = document.getElementById("stat-notes-count");
        if (notesElem) notesElem.textContent = notes.length;

        const attElem = document.getElementById("stat-attendance-avg");
        if (attElem) {
            const totalAttended = attendanceData.reduce((acc, curr) => acc + curr.attended, 0);
            const totalLectures = attendanceData.reduce((acc, curr) => acc + curr.total, 0);
            const avg = totalLectures > 0 ? Math.round((totalAttended / totalLectures) * 100) : 0;
            attElem.textContent = `${avg}%`;
        }

        renderDashboardTasks();
    }

    function renderDashboardTasks() {
        const container = document.getElementById("dashboard-task-list");
        if (!container) return;

        const pending = tasks.filter(t => !t.completed).slice(0, 3);
        if (pending.length === 0) {
            container.innerHTML = `<p style="font-size: 12px; color: var(--muted);">No pending tasks! Enjoy your break. 🎉</p>`;
            return;
        }

        container.innerHTML = pending.map(t => `
            <div class="task-item">
                <div class="task-left">
                    <input type="checkbox" onchange="window.toggleTaskStatus(${t.id})" ${t.completed ? 'checked' : ''}>
                    <div>
                        <p class="task-title">${t.title}</p>
                        <span class="task-meta">${t.subject} • Due: ${t.dueDate}</span>
                    </div>
                </div>
                <span class="badge ${t.priority.toLowerCase()}">${t.priority}</span>
            </div>
        `).join("");
    }

    // Task Functions Globally Scoped
    window.toggleTaskStatus = (id) => {
        tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
        saveTasks();
        refreshStats();
        const currentHash = window.location.hash.slice(1);
        if (currentHash === "tasks") renderTasksPage();
    };

    window.deleteTask = (id) => {
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
        refreshStats();
        renderTasksPage();
    };

    // Render Dynamic Page Views
    function showPage(page) {
        navLinks.forEach(link => {
            link.classList.toggle("active", link.dataset.page === page);
        });

        const topbarHeading = document.querySelector(".topbar h1");
        const breadcrumb = document.querySelector(".breadcrumb");

        if (topbarHeading) topbarHeading.textContent = page.charAt(0).toUpperCase() + page.slice(1);
        if (breadcrumb) breadcrumb.textContent = `Pages / ${page.charAt(0).toUpperCase() + page.slice(1)}`;

        if (page === "dashboard") {
            location.reload(); // Simple reload restores dashboard template or re-renders base HTML
            return;
        }

        if (page === "tasks") {
            renderTasksPage();
        } else if (page === "focus zone") {
            renderPomodoroPage();
        } else if (page === "attendance") {
            renderAttendancePage();
        } else if (page === "notes") {
            renderNotesPage();
        } else if (page === "analytics") {
            renderAnalyticsPage();
        }
    }

    // View Renders
   function renderFocusPage() { // <-- function rename kar dein
    pageContent.innerHTML = `
        <section class="content-card pomodoro-box">
            <h2>Focus Zone</h2>
            <p style="font-size:12px; color:var(--muted);">Stay focused for 25 minutes, then take a short break.</p>
            <div class="timer-display" id="timer-text">25:00</div>
            <div class="timer-controls">
                <button id="start-timer-btn" class="primary-button"><i class="fa-solid fa-play"></i> Start Session</button>
                <button id="reset-timer-btn" class="secondary-button"><i class="fa-solid fa-rotate-left"></i> Reset</button>
            </div>
        </section>
        }
                
                <form id="add-task-form" style="margin-bottom: 24px;">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Task Title</label>
                            <input type="text" id="task-title-input" class="form-control" placeholder="Assignment name" required>
                        </div>
                        <div class="form-group">
                            <label>Subject</label>
                            <input type="text" id="task-subject-input" class="form-control" placeholder="e.g. CS201" required>
                        </div>
                        <div class="form-group">
                            <label>Due Date</label>
                            <input type="date" id="task-date-input" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label>Priority</label>
                            <select id="task-priority-input" class="form-control">
                                <option value="High">High</option>
                                <option value="Medium" selected>Medium</option>
                                <option value="Low">Low</option>
                            </select>
                        </div>
                    </div>
                    <button type="submit" class="primary-button"><i class="fa-solid fa-plus"></i> Add Task</button>
                </form>

                <div class="task-list">
                    ${tasks.map(t => `
                        <div class="task-item">
                            <div class="task-left">
                                <input type="checkbox" onchange="window.toggleTaskStatus(${t.id})" ${t.completed ? 'checked' : ''}>
                                <div>
                                    <p class="task-title ${t.completed ? 'completed' : ''}">${t.title}</p>
                                    <span class="task-meta">${t.subject} • Due: ${t.dueDate}</span>
                                </div>
                            </div>
                            <div style="display:flex; gap:10px; align-items:center;">
                                <span class="badge ${t.priority.toLowerCase()}">${t.priority}</span>
                                <button onclick="window.deleteTask(${t.id})" style="background:none; border:none; color:var(--red);"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </section>
        `;

        document.getElementById("add-task-form").addEventListener("submit", (e) => {
            e.preventDefault();
            const newTask = {
                id: Date.now(),
                title: document.getElementById("task-title-input").value,
                subject: document.getElementById("task-subject-input").value,
                dueDate: document.getElementById("task-date-input").value,
                priority: document.getElementById("task-priority-input").value,
                completed: false
            };
            tasks.push(newTask);
            saveTasks();
            renderTasksPage();
            refreshStats();
        });
    }

    function renderPomodoroPage() {
        pageContent.innerHTML = `
            <section class="content-card focus zone-box">
                <h2>Focus Timer</h2>
                <p style="font-size:12px; color:var(--muted);">Stay focused for 25 minutes, then take a 5-minute break.</p>
                <div class="timer-display" id="timer-text">25:00</div>
                <div class="timer-controls">
                    <button id="start-timer-btn" class="primary-button"><i class="fa-solid fa-play"></i> Start Session</button>
                    <button id="reset-timer-btn" class="secondary-button"><i class="fa-solid fa-rotate-left"></i> Reset</button>
                </div>
            </section>
        `;

        const timerText = document.getElementById("timer-text");
        const startBtn = document.getElementById("start-timer-btn");
        const resetBtn = document.getElementById("reset-timer-btn");

        const updateTimerDisplay = () => {
            const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
            const secs = (timeLeft % 60).toString().padStart(2, '0');
            timerText.textContent = `${mins}:${secs}`;
        };

        startBtn.addEventListener("click", () => {
            if (isTimerRunning) {
                clearInterval(timerInterval);
                isTimerRunning = false;
                startBtn.innerHTML = `<i class="fa-solid fa-play"></i> Resume`;
            } else {
                isTimerRunning = true;
                startBtn.innerHTML = `<i class="fa-solid fa-pause"></i> Pause`;
                timerInterval = setInterval(() => {
                    if (timeLeft > 0) {
                        timeLeft--;
                        updateTimerDisplay();
                    } else {
                        clearInterval(timerInterval);
                        alert("Focus session finished! Take a break.");
                        timeLeft = 25 * 60;
                        updateTimerDisplay();
                    }
                }, 1000);
            }
        });

        resetBtn.addEventListener("click", () => {
            clearInterval(timerInterval);
            isTimerRunning = false;
            timeLeft = 25 * 60;
            updateTimerDisplay();
            startBtn.innerHTML = `<i class="fa-solid fa-play"></i> Start Session`;
        });
    }

    function renderAttendancePage() {
        pageContent.innerHTML = `
            <section class="content-card">
                <h2>Attendance & CGPA Tracker</h2>
                <div style="margin-top:20px; display:grid; gap:16px;">
                    ${attendanceData.map(a => {
                        const pct = Math.round((a.attended / a.total) * 100);
                        return `
                            <div class="task-item">
                                <div>
                                    <p class="task-title">${a.subject}</p>
                                    <span class="task-meta">Attended ${a.attended} /${a.total} lectures</span>
                                </div>
                                <span class="badge ${pct >= 75 ? 'low' : 'high'}">${pct}% Attendance</span>
                            </div>
                        `;
                    }).join("")}
                </div>
            </section>
        `;
    }

    function renderNotesPage() {
        pageContent.innerHTML = `
            <section class="content-card">
                <h2>Quick Study Notes</h2>
                <form id="note-form" style="margin:20px 0;">
                    <div class="form-group" style="margin-bottom:12px;">
                        <input type="text" id="note-title" class="form-control" placeholder="Note Title" required>
                    </div>
                    <div class="form-group" style="margin-bottom:12px;">
                        <textarea id="note-content" class="form-control" rows="3" placeholder="Write key points..." required></textarea>
                    </div>
                    <button type="submit" class="primary-button">Save Note</button>
                </form>

                <div style="display:grid; gap:12px;">
                    ${notes.map(n => `
                        <div class="task-item" style="flex-direction:column; align-items:flex-start;">
                            <p class="task-title">${n.title}</p>
                            <span class="task-meta">${n.date}</span>
                            <p style="font-size:12px; margin-top:8px; white-space:pre-line;">${n.content}</p>
                        </div>
                    `).join("")}
                </div>
            </section>
        `;

        document.getElementById("note-form").addEventListener("submit", (e) => {
            e.preventDefault();
            notes.push({
                id: Date.now(),
                title: document.getElementById("note-title").value,
                content: document.getElementById("note-content").value,
                date: new Date().toISOString().split('T')[0]
            });
            saveNotes();
            renderNotesPage();
            refreshStats();
        });
    }

    function renderAnalyticsPage() {
        pageContent.innerHTML = `
            <section class="content-card" style="text-align:center; padding:40px;">
                <i class="fa-solid fa-chart-pie" style="font-size:48px; color:var(--primary); margin-bottom:16px;"></i>
                <h2>Productivity Insights</h2>
                <p style="color:var(--muted); font-size:13px; max-width:400px; margin:8px auto;">
                    You have completed <b>${tasks.filter(t => t.completed).length}</b> assignment tasks and maintained an average attendance rate of <b>${document.getElementById("stat-attendance-avg")?.textContent || "0%"}</b>.
                </p>
            </section>
        `;
    }

    // Navigation Click Listeners
    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            history.replaceState(null, "", `#${page}`);
            showPage(page);
        });
    });

    window.addEventListener("hashchange", () => {
        const page = window.location.hash.slice(1) || "dashboard";
        showPage(page);
    });

    // Init
    refreshStats();
});