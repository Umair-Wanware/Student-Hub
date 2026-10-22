document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = "/api";
    const pageContent = document.getElementById("page-content");
    const navLinks = [...document.querySelectorAll(".nav-link")];
    const themeToggle = document.getElementById("theme-toggle");
    let csrfToken = null;
    let currentUser = null;
    const pageTitles = {
        dashboard: "Dashboard",
        tasks: "Assignments & Tasks",
        "focus-zone": "Focus Zone",
        attendance: "Attendance",
        notes: "Quick Notes",
        analytics: "Analytics",
        account: "Account"
    };
    const focusState = {
        duration: 25,
        secondsRemaining: 25 * 60,
        interval: null,
        running: false
    };

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function today() {
        return new Date().toISOString().slice(0, 10);
    }

    function formatDate(value) {
        if (!value) return "No date";
        const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
        return Number.isNaN(date.getTime())
            ? String(value)
            : new Intl.DateTimeFormat(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric"
            }).format(date);
    }

    function formatMinutes(minutes) {
        const value = Number(minutes) || 0;
        const hours = Math.floor(value / 60);
        const remainingMinutes = value % 60;
        return hours ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
    }

    function greeting() {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 17) return "Good afternoon";
        return "Good evening";
    }

    function showNotice(message, type = "success") {
        let notice = document.getElementById("app-notice");
        if (!notice) {
            notice = document.createElement("div");
            notice.id = "app-notice";
            document.body.appendChild(notice);
        }
        notice.className = `app-notice ${type}`;
        notice.textContent = message;
        clearTimeout(showNotice.timeout);
        showNotice.timeout = setTimeout(() => notice.remove(), 4200);
    }

    async function api(path, options = {}) {
        const method = options.method || "GET";
        const headers = { ...options.headers };
        if (options.body) headers["Content-Type"] = "application/json";
        if (!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
            if (!csrfToken) {
                const csrfResponse = await fetch(`${API_BASE}/auth/csrf`, { credentials: "same-origin" });
                const csrfPayload = await csrfResponse.json();
                csrfToken = csrfPayload.csrfToken;
            }
            headers["X-CSRF-Token"] = csrfToken;
        }
        const response = await fetch(`${API_BASE}${path}`, {
            ...options,
            method,
            credentials: "same-origin",
            headers
        });
        const contentType = response.headers.get("content-type") || "";
        const payload = contentType.includes("application/json")
            ? await response.json()
            : null;

        if (!response.ok || !payload?.success) {
            if (response.status === 401 && path !== "/auth/me") {
                window.location.replace("/login.html");
            }
            throw new Error(payload?.message || "The request could not be completed.");
        }
        return payload;
    }

    function currentPage() {
        const page = decodeURIComponent(window.location.hash.slice(1) || "dashboard");
        return Object.hasOwn(pageTitles, page) ? page : "dashboard";
    }

    function updateChrome(page) {
        const title = pageTitles[page];
        document.title = `${title} · StudySphere`;
        document.querySelector(".topbar h1").textContent = title;
        document.querySelector(".breadcrumb").textContent = `Pages / ${title}`;
        navLinks.forEach(link => link.classList.toggle("active", link.dataset.page === page));
        document.querySelectorAll("[data-user-name]").forEach(element => {
            element.textContent = currentUser?.name || "Student";
        });
        document.querySelectorAll("[data-user-role]").forEach(element => {
            element.textContent = currentUser?.role || "Student";
        });
    }

    function renderError(error) {
        pageContent.innerHTML = `
            <section class="content-card empty-state">
                <i class="fa-solid fa-triangle-exclamation empty-state-icon"></i>
                <h2>Could not load this page</h2>
                <p>${escapeHTML(error.message || "Please check that the server is running.")}</p>
                <button class="primary-button" type="button" id="retry-page-button"><i class="fa-solid fa-rotate-right"></i> Try again</button>
            </section>
        `;
        document.getElementById("retry-page-button")?.addEventListener("click", () => renderPage(currentPage()));
    }

    function taskItem(task, { compact = false } = {}) {
        const priority = String(task.priority || "Medium").toLowerCase();
        const completed = Boolean(task.completed);
        const id = Number(task.id);
        return `
            <article class="task-item ${completed ? "is-complete" : ""}">
                <div class="task-left">
                    <input type="checkbox" class="task-toggle" data-id="${id}" ${completed ? "checked" : ""} aria-label="Mark ${escapeHTML(task.title)} as complete">
                    <div>
                        <p class="task-title ${completed ? "completed" : ""}">${escapeHTML(task.title)}</p>
                        <span class="task-meta">${escapeHTML(task.subject)} · Due ${escapeHTML(formatDate(task.dueDate))}</span>
                    </div>
                </div>
                <div class="task-actions">
                    <span class="badge ${priority}">${escapeHTML(task.priority)}</span>
                    ${compact ? "" : `<button class="icon-text-button delete-task" data-id="${id}" type="button" aria-label="Delete ${escapeHTML(task.title)}"><i class="fa-solid fa-trash"></i></button>`}
                </div>
            </article>
        `;
    }

    function bindTaskActions(container, refresh) {
        container.querySelectorAll(".task-toggle").forEach(input => {
            input.addEventListener("change", async event => {
                const control = event.currentTarget;
                control.disabled = true;
                try {
                    await api(`/tasks/${control.dataset.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ completed: control.checked })
                    });
                    await refresh();
                } catch (error) {
                    control.checked = !control.checked;
                    control.disabled = false;
                    showNotice(error.message, "error");
                }
            });
        });

        container.querySelectorAll(".delete-task").forEach(button => {
            button.addEventListener("click", async event => {
                const taskId = event.currentTarget.dataset.id;
                if (!window.confirm("Delete this task?")) return;
                try {
                    await api(`/tasks/${taskId}`, { method: "DELETE" });
                    showNotice("Task deleted.");
                    await refresh();
                } catch (error) {
                    showNotice(error.message, "error");
                }
            });
        });
    }

    function dashboardMarkup() {
        return `
            <section class="welcome-section">
                <div><h2>${greeting()}, ${escapeHTML(currentUser?.name || "Student")}</h2><p>Stay organized, protect your focus, and keep moving forward.</p></div>
                <a href="#tasks" class="primary-button"><i class="fa-solid fa-plus"></i> Add new task</a>
            </section>
            <section class="stats-grid">
                <article class="stat-card"><div class="stat-top"><span>Pending Tasks</span><div class="stat-icon purple"><i class="fa-solid fa-clock"></i></div></div><h2 id="stat-pending-count">–</h2><p class="stat-description">Assignments to complete</p></article>
                <article class="stat-card"><div class="stat-top"><span>Total Notes</span><div class="stat-icon blue"><i class="fa-solid fa-file-lines"></i></div></div><h2 id="stat-notes-count">–</h2><p class="stat-description">Saved quick notes</p></article>
                <article class="stat-card"><div class="stat-top"><span>Attendance Avg</span><div class="stat-icon green"><i class="fa-solid fa-chart-simple"></i></div></div><h2 id="stat-attendance-avg">–</h2><p class="stat-description">Across tracked subjects</p></article>
                <article class="stat-card"><div class="stat-top"><span>Focus Time</span><div class="stat-icon orange"><i class="fa-solid fa-fire"></i></div></div><h2 id="stat-focus-time">–</h2><p class="stat-description">Recorded today</p></article>
            </section>
            <section class="content-card">
                <div class="section-header"><div><h2>Upcoming assignments</h2><p>Your next unfinished tasks.</p></div><a href="#tasks" class="secondary-button">Manage all <i class="fa-solid fa-arrow-right"></i></a></div>
                <div id="dashboard-task-list" class="task-list-container"></div>
            </section>
        `;
    }

    async function renderDashboard() {
        pageContent.innerHTML = dashboardMarkup();
        try {
            const { data } = await api("/dashboard");
            document.getElementById("stat-pending-count").textContent = data.pendingTasks;
            document.getElementById("stat-notes-count").textContent = data.totalNotes;
            document.getElementById("stat-attendance-avg").textContent = `${Math.round(data.attendanceAverage)}%`;
            document.getElementById("stat-focus-time").textContent = formatMinutes(data.focusMinutesToday);
            const list = document.getElementById("dashboard-task-list");
            list.innerHTML = data.upcomingTasks.length
                ? data.upcomingTasks.map(task => taskItem(task, { compact: true })).join("")
                : `<div class="empty-inline"><i class="fa-solid fa-circle-check"></i> No pending tasks. Enjoy your break!</div>`;
            bindTaskActions(list, renderDashboard);
        } catch (error) {
            renderError(error);
        }
    }

    function tasksMarkup() {
        return `
            <section class="welcome-section page-heading"><div><h2>Assignments & tasks</h2><p>Plan work, set priorities, and tick things off.</p></div></section>
            <section class="content-card">
                <div class="section-header"><div><h2>Add a task</h2><p>Everything starts with a clear next step.</p></div></div>
                <form id="task-form"><div class="form-grid">
                    <label class="form-group">Task title<input class="form-control" name="title" maxlength="200" required placeholder="e.g. Finish database assignment"></label>
                    <label class="form-group">Subject<input class="form-control" name="subject" maxlength="100" required placeholder="e.g. CS201"></label>
                    <label class="form-group">Due date<input class="form-control" name="dueDate" type="date" value="${today()}" required></label>
                    <label class="form-group">Priority<select class="form-control" name="priority"><option>High</option><option selected>Medium</option><option>Low</option></select></label>
                </div><button class="primary-button" type="submit"><i class="fa-solid fa-plus"></i> Add task</button></form>
            </section>
            <section class="content-card"><div class="section-header"><div><h2>Your tasks</h2><p id="task-count">Loading tasks…</p></div></div><div id="tasks-list" class="task-list-container"></div></section>
        `;
    }

    async function loadTasks() {
        const list = document.getElementById("tasks-list");
        const count = document.getElementById("task-count");
        if (!list || !count) return;
        list.innerHTML = `<div class="loading-inline">Loading tasks…</div>`;
        try {
            const result = await api("/tasks?limit=100");
            count.textContent = `${result.total} task${result.total === 1 ? "" : "s"}`;
            list.innerHTML = result.data.length
                ? result.data.map(task => taskItem(task)).join("")
                : `<div class="empty-inline"><i class="fa-solid fa-list-check"></i> Add your first task above.</div>`;
            bindTaskActions(list, loadTasks);
        } catch (error) {
            list.innerHTML = `<p class="inline-error">${escapeHTML(error.message)}</p>`;
        }
    }

    async function renderTasks() {
        pageContent.innerHTML = tasksMarkup();
        const form = document.getElementById("task-form");
        form.addEventListener("submit", async event => {
            event.preventDefault();
            const button = form.querySelector("button[type=submit]");
            const values = new FormData(form);
            button.disabled = true;
            try {
                await api("/tasks", { method: "POST", body: JSON.stringify({
                    title: values.get("title"), subject: values.get("subject"),
                    dueDate: values.get("dueDate"), priority: values.get("priority"), completed: false
                }) });
                form.reset();
                form.elements.dueDate.value = today();
                showNotice("Task added.");
                await loadTasks();
            } catch (error) {
                showNotice(error.message, "error");
            } finally {
                button.disabled = false;
            }
        });
        await loadTasks();
    }

    function attendanceMarkup() {
        return `
            <section class="welcome-section page-heading"><div><h2>Attendance tracker</h2><p>Keep an eye on your attendance across every subject.</p></div></section>
            <section class="content-card"><div class="section-header"><div><h2>Add a subject</h2><p>Enter classes attended and total classes.</p></div></div>
                <form id="attendance-form"><div class="form-grid">
                    <label class="form-group">Subject<input class="form-control" name="subject" maxlength="100" required placeholder="e.g. Computer Networks"></label>
                    <label class="form-group">Classes attended<input class="form-control" name="attended" type="number" min="0" step="1" required placeholder="18"></label>
                    <label class="form-group">Total classes<input class="form-control" name="total" type="number" min="1" step="1" required placeholder="20"></label>
                </div><button class="primary-button" type="submit"><i class="fa-solid fa-plus"></i> Save attendance</button></form>
            </section>
            <section class="content-card"><div class="section-header"><div><h2>Tracked subjects</h2><p id="attendance-count">Loading…</p></div></div><div id="attendance-list" class="record-grid"></div></section>
        `;
    }

    function attendanceCard(record) {
        const percentage = Math.round((record.attended / record.total) * 100);
        return `
            <article class="record-card">
                <div class="record-card-header"><h3>${escapeHTML(record.subject)}</h3><button class="icon-text-button delete-attendance" data-id="${Number(record.id)}" aria-label="Delete ${escapeHTML(record.subject)}"><i class="fa-solid fa-trash"></i></button></div>
                <strong>${percentage}%</strong><span>${record.attended} of ${record.total} classes attended</span>
                <div class="progress-track"><div class="progress-fill ${percentage < 75 ? "warning" : ""}" style="width:${Math.max(0, Math.min(100, percentage))}%"></div></div>
            </article>
        `;
    }

    async function loadAttendance() {
        const list = document.getElementById("attendance-list");
        const count = document.getElementById("attendance-count");
        if (!list || !count) return;
        try {
            const result = await api("/attendance?limit=100");
            count.textContent = `${result.total} subject${result.total === 1 ? "" : "s"} tracked`;
            list.innerHTML = result.data.length
                ? result.data.map(attendanceCard).join("")
                : `<div class="empty-inline"><i class="fa-solid fa-chart-simple"></i> Add a subject to start tracking attendance.</div>`;
            list.querySelectorAll(".delete-attendance").forEach(button => button.addEventListener("click", async event => {
                if (!window.confirm("Delete this attendance record?")) return;
                try {
                    await api(`/attendance/${event.currentTarget.dataset.id}`, { method: "DELETE" });
                    showNotice("Attendance record deleted.");
                    await loadAttendance();
                } catch (error) { showNotice(error.message, "error"); }
            }));
        } catch (error) {
            list.innerHTML = `<p class="inline-error">${escapeHTML(error.message)}</p>`;
        }
    }

    async function renderAttendance() {
        pageContent.innerHTML = attendanceMarkup();
        const form = document.getElementById("attendance-form");
        form.addEventListener("submit", async event => {
            event.preventDefault();
            const button = form.querySelector("button[type=submit]");
            const values = new FormData(form);
            button.disabled = true;
            try {
                await api("/attendance", { method: "POST", body: JSON.stringify({
                    subject: values.get("subject"), attended: Number(values.get("attended")), total: Number(values.get("total"))
                }) });
                form.reset();
                showNotice("Attendance saved.");
                await loadAttendance();
            } catch (error) {
                showNotice(error.message, "error");
            } finally {
                button.disabled = false;
            }
        });
        await loadAttendance();
    }

    function notesMarkup() {
        return `
            <section class="welcome-section page-heading"><div><h2>Quick notes</h2><p>Capture ideas, concepts, and revision reminders in one place.</p></div></section>
            <section class="content-card"><div class="section-header"><div><h2>New note</h2><p>Notes are saved to your StudySphere workspace.</p></div></div>
                <form id="note-form"><div class="form-grid note-form-grid">
                    <label class="form-group">Title<input class="form-control" name="title" maxlength="200" required placeholder="e.g. OS deadlock conditions"></label>
                    <label class="form-group">Date<input class="form-control" name="date" type="date" value="${today()}" required></label>
                </div><label class="form-group">Note<textarea class="form-control note-textarea" name="content" maxlength="10000" required placeholder="Write your note here…"></textarea></label>
                <button class="primary-button" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save note</button></form>
            </section>
            <section class="content-card"><div class="section-header"><div><h2>Saved notes</h2><p id="note-count">Loading…</p></div></div><div id="notes-list" class="note-grid"></div></section>
        `;
    }

    function noteCard(note) {
        return `
            <article class="note-card">
                <div class="record-card-header"><div><h3>${escapeHTML(note.title)}</h3><span class="task-meta">${escapeHTML(formatDate(note.date))}</span></div><button class="icon-text-button delete-note" data-id="${Number(note.id)}" aria-label="Delete ${escapeHTML(note.title)}"><i class="fa-solid fa-trash"></i></button></div>
                <p>${escapeHTML(note.content)}</p>
            </article>
        `;
    }

    async function loadNotes() {
        const list = document.getElementById("notes-list");
        const count = document.getElementById("note-count");
        if (!list || !count) return;
        try {
            const result = await api("/notes?limit=100");
            count.textContent = `${result.total} note${result.total === 1 ? "" : "s"}`;
            list.innerHTML = result.data.length
                ? result.data.map(noteCard).join("")
                : `<div class="empty-inline"><i class="fa-solid fa-note-sticky"></i> Save your first note above.</div>`;
            list.querySelectorAll(".delete-note").forEach(button => button.addEventListener("click", async event => {
                if (!window.confirm("Delete this note?")) return;
                try {
                    await api(`/notes/${event.currentTarget.dataset.id}`, { method: "DELETE" });
                    showNotice("Note deleted.");
                    await loadNotes();
                } catch (error) { showNotice(error.message, "error"); }
            }));
        } catch (error) {
            list.innerHTML = `<p class="inline-error">${escapeHTML(error.message)}</p>`;
        }
    }

    async function renderNotes() {
        pageContent.innerHTML = notesMarkup();
        const form = document.getElementById("note-form");
        form.addEventListener("submit", async event => {
            event.preventDefault();
            const button = form.querySelector("button[type=submit]");
            const values = new FormData(form);
            button.disabled = true;
            try {
                await api("/notes", { method: "POST", body: JSON.stringify({
                    title: values.get("title"), content: values.get("content"), date: values.get("date")
                }) });
                form.reset();
                form.elements.date.value = today();
                showNotice("Note saved.");
                await loadNotes();
            } catch (error) {
                showNotice(error.message, "error");
            } finally {
                button.disabled = false;
            }
        });
        await loadNotes();
    }

    function updateTimerDisplay() {
        const timer = document.getElementById("focus-timer");
        if (!timer) return;
        const minutes = Math.floor(focusState.secondsRemaining / 60).toString().padStart(2, "0");
        const seconds = (focusState.secondsRemaining % 60).toString().padStart(2, "0");
        timer.textContent = `${minutes}:${seconds}`;
    }

    function stopFocusTimer() {
        clearInterval(focusState.interval);
        focusState.interval = null;
        focusState.running = false;
    }

    async function recordFocusSession(duration) {
        await api("/focus-sessions", {
            method: "POST",
            body: JSON.stringify({ durationMinutes: duration })
        });
    }

    function focusMarkup() {
        return `
            <section class="welcome-section page-heading"><div><h2>Focus zone</h2><p>Start a distraction-free session and record the time you invest in studying.</p></div></section>
            <section class="content-card pomodoro-box">
                <label class="form-group focus-duration-control">Session length (minutes)<input class="form-control" id="focus-duration" type="number" min="1" max="1440" value="${focusState.duration}"></label>
                <div class="timer-display" id="focus-timer">25:00</div>
                <div class="timer-controls"><button class="primary-button" id="focus-start" type="button"><i class="fa-solid fa-play"></i> Start session</button><button class="secondary-button" id="focus-reset" type="button"><i class="fa-solid fa-rotate-left"></i> Reset</button><button class="secondary-button" id="focus-record" type="button"><i class="fa-solid fa-check"></i> Record now</button></div>
                <p class="timer-help">A completed timer is recorded automatically. “Record now” logs the selected session length.</p>
            </section>
        `;
    }

    async function renderFocus() {
        pageContent.innerHTML = focusMarkup();
        const durationInput = document.getElementById("focus-duration");
        const startButton = document.getElementById("focus-start");
        const resetButton = document.getElementById("focus-reset");
        const recordButton = document.getElementById("focus-record");
        updateTimerDisplay();

        const setDuration = () => {
            const duration = Number(durationInput.value);
            if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
                throw new Error("Enter a session length between 1 and 1440 minutes.");
            }
            focusState.duration = duration;
            return duration;
        };

        startButton.addEventListener("click", () => {
            try {
                const duration = setDuration();
                if (focusState.secondsRemaining > duration * 60 || focusState.secondsRemaining === 0) {
                    focusState.secondsRemaining = duration * 60;
                }
                if (focusState.running) {
                    stopFocusTimer();
                    startButton.innerHTML = `<i class="fa-solid fa-play"></i> Resume session`;
                    return;
                }
                focusState.running = true;
                startButton.innerHTML = `<i class="fa-solid fa-pause"></i> Pause session`;
                focusState.interval = setInterval(async () => {
                    focusState.secondsRemaining -= 1;
                    updateTimerDisplay();
                    if (focusState.secondsRemaining > 0) return;
                    stopFocusTimer();
                    try {
                        await recordFocusSession(focusState.duration);
                        showNotice("Focus session recorded. Great work!");
                    } catch (error) { showNotice(error.message, "error"); }
                    focusState.secondsRemaining = focusState.duration * 60;
                    updateTimerDisplay();
                    startButton.innerHTML = `<i class="fa-solid fa-play"></i> Start session`;
                }, 1000);
            } catch (error) { showNotice(error.message, "error"); }
        });

        resetButton.addEventListener("click", () => {
            try {
                stopFocusTimer();
                focusState.secondsRemaining = setDuration() * 60;
                startButton.innerHTML = `<i class="fa-solid fa-play"></i> Start session`;
                updateTimerDisplay();
            } catch (error) { showNotice(error.message, "error"); }
        });

        recordButton.addEventListener("click", async () => {
            try {
                const duration = setDuration();
                recordButton.disabled = true;
                await recordFocusSession(duration);
                showNotice(`${duration}-minute focus session recorded.`);
            } catch (error) { showNotice(error.message, "error"); }
            finally { recordButton.disabled = false; }
        });
    }

    async function renderAnalytics() {
        pageContent.innerHTML = `<section class="content-card loading-state">Preparing your study overview…</section>`;
        try {
            const [dashboard, tasks, attendance] = await Promise.all([
                api("/dashboard"), api("/tasks?limit=100"), api("/attendance?limit=100")
            ]);
            const completed = tasks.data.filter(task => task.completed).length;
            const taskCompletion = tasks.total ? Math.round((completed / tasks.total) * 100) : 0;
            const strongestSubject = attendance.data
                .map(item => ({ ...item, percentage: Math.round((item.attended / item.total) * 100) }))
                .sort((left, right) => right.percentage - left.percentage)[0];
            pageContent.innerHTML = `
                <section class="welcome-section page-heading"><div><h2>Analytics</h2><p>A concise view of your current study momentum.</p></div></section>
                <section class="analytics-grid">
                    <article class="content-card metric-card"><span>Task completion</span><strong>${taskCompletion}%</strong><p>${completed} of ${tasks.total} tasks completed</p></article>
                    <article class="content-card metric-card"><span>Attendance average</span><strong>${Math.round(dashboard.data.attendanceAverage)}%</strong><p>Across ${attendance.total} tracked subjects</p></article>
                    <article class="content-card metric-card"><span>Focus today</span><strong>${formatMinutes(dashboard.data.focusMinutesToday)}</strong><p>Time logged in focused sessions</p></article>
                    <article class="content-card metric-card"><span>Strongest attendance</span><strong>${strongestSubject ? `${strongestSubject.percentage}%` : "–"}</strong><p>${escapeHTML(strongestSubject?.subject || "Add a subject to begin")}</p></article>
                </section>
                <section class="content-card"><div class="section-header"><div><h2>What to do next</h2><p>Use these signals to choose your next study block.</p></div></div>
                    <ul class="insight-list">
                        <li>${dashboard.data.pendingTasks ? `${dashboard.data.pendingTasks} task${dashboard.data.pendingTasks === 1 ? " is" : "s are"} still pending.` : "All current tasks are complete."}</li>
                        <li>${dashboard.data.totalNotes} saved note${dashboard.data.totalNotes === 1 ? " is" : "s are"} ready for revision.</li>
                        <li>${dashboard.data.attendanceAverage < 75 ? "Consider prioritizing classes with lower attendance." : "Your attendance is on track."}</li>
                    </ul>
                </section>
            `;
        } catch (error) { renderError(error); }
    }

    async function renderAccount() {
        pageContent.innerHTML = `
            <section class="welcome-section page-heading"><div><h2>Your account</h2><p>Manage your profile and sign-in details.</p></div></section>
            <section class="content-card account-summary">
                <div class="section-header"><div><h2>Profile details</h2><p>Your account information and access level.</p></div></div>
                <dl class="account-details">
                    <div><dt>Full name</dt><dd>${escapeHTML(currentUser.name)}</dd></div>
                    <div><dt>Email address</dt><dd>${escapeHTML(currentUser.email)}</dd></div>
                    <div><dt>Role</dt><dd>${escapeHTML(currentUser.role)}</dd></div>
                    <div><dt>Created</dt><dd>${escapeHTML(formatDate(currentUser.createdAt))}</dd></div>
                </dl>
            </section>
            <section class="content-card">
                <div class="section-header"><div><h2>Update profile</h2><p>Change your name or email address.</p></div></div>
                <form id="profile-form"><div class="form-grid">
                    <label class="form-group">Full name<input class="form-control" name="name" maxlength="100" required value="${escapeHTML(currentUser.name)}"></label>
                    <label class="form-group">Email address<input class="form-control" name="email" type="email" maxlength="150" required value="${escapeHTML(currentUser.email)}"></label>
                </div><button class="primary-button" type="submit">Save profile</button></form>
            </section>
            <section class="content-card">
                <div class="section-header"><div><h2>Change password</h2><p>Use 12+ characters with upper and lowercase letters, a number, and a symbol.</p></div></div>
                <form id="password-form"><div class="form-grid">
                    <label class="form-group">Current password<input class="form-control" name="currentPassword" type="password" autocomplete="current-password" required></label>
                    <label class="form-group">New password<input class="form-control" name="newPassword" type="password" autocomplete="new-password" minlength="12" pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,}" title="Use at least 12 characters with uppercase and lowercase letters, a number, and a symbol." required></label>
                    <label class="form-group">Confirm new password<input class="form-control" name="confirmPassword" type="password" autocomplete="new-password" minlength="12" pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,}" title="Use at least 12 characters with uppercase and lowercase letters, a number, and a symbol." required></label>
                </div><button class="primary-button" type="submit">Change password</button></form>
            </section>
        `;

        document.getElementById("profile-form").addEventListener("submit", async event => {
            event.preventDefault();
            const form = event.currentTarget;
            const button = form.querySelector("button[type=submit]");
            const values = new FormData(form);
            button.disabled = true;
            try {
                const result = await api("/auth/profile", { method: "PATCH", body: JSON.stringify({ name: values.get("name"), email: values.get("email") }) });
                currentUser = { ...currentUser, ...result.user };
                updateChrome("account");
                showNotice("Profile updated.");
                await renderAccount();
            } catch (error) { showNotice(error.message, "error"); }
            finally { button.disabled = false; }
        });

        document.getElementById("password-form").addEventListener("submit", async event => {
            event.preventDefault();
            const form = event.currentTarget;
            const button = form.querySelector("button[type=submit]");
            const values = new FormData(form);
            button.disabled = true;
            try {
                await api("/auth/password", { method: "PATCH", body: JSON.stringify(Object.fromEntries(values)) });
                csrfToken = null;
                form.reset();
                showNotice("Password changed. Other sessions have been signed out.");
            } catch (error) { showNotice(error.message, "error"); }
            finally { button.disabled = false; }
        });
    }

    async function renderPage(page) {
        const selectedPage = Object.hasOwn(pageTitles, page) ? page : "dashboard";
        updateChrome(selectedPage);
        if (selectedPage === "dashboard") return renderDashboard();
        if (selectedPage === "tasks") return renderTasks();
        if (selectedPage === "focus-zone") return renderFocus();
        if (selectedPage === "attendance") return renderAttendance();
        if (selectedPage === "notes") return renderNotes();
        if (selectedPage === "account") return renderAccount();
        return renderAnalytics();
    }

    function applyTheme() {
        const isDark = localStorage.getItem("studysphere_theme") === "dark";
        document.body.classList.toggle("dark-mode", isDark);
        themeToggle.querySelector("i").className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
    }

    themeToggle.addEventListener("click", () => {
        const isDark = !document.body.classList.contains("dark-mode");
        localStorage.setItem("studysphere_theme", isDark ? "dark" : "light");
        applyTheme();
    });
    document.getElementById("logout-button").addEventListener("click", async () => {
        const button = document.getElementById("logout-button");
        button.disabled = true;
        try {
            await api("/auth/logout", { method: "POST" });
            window.location.replace("/login.html");
        } catch (error) {
            showNotice(error.message, "error");
            button.disabled = false;
        }
    });
    window.addEventListener("hashchange", () => renderPage(currentPage()));
    applyTheme();
    api("/auth/me").then(({ user }) => {
        currentUser = user;
        updateChrome(currentPage());
        renderPage(currentPage());
    }).catch(() => window.location.replace("/login.html"));
});
