
console.log("main.js is running!");

document.addEventListener("DOMContentLoaded", () => {
    const navLinks = document.querySelectorAll(".nav-link");
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

    function showPage(page) {
        // Use Dashboard as the fallback for an invalid page.
        if (page !== "dashboard" && !pages[page]) {
            page = "dashboard";
        }

        // Update active sidebar link.
        navLinks.forEach(link => {
            link.classList.toggle(
                "active",
                link.dataset.page === page
            );
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

    // Handle browser back/forward and URL hash changes.
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
