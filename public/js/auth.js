document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("auth-form");
    const message = document.getElementById("auth-message");
    const submitButton = form.querySelector("[type=submit]");
    let csrfToken = null;

    for (const toggle of document.querySelectorAll("[data-password-toggle]")) {
        toggle.addEventListener("click", () => {
            const input = toggle.parentElement.querySelector("input");
            const isVisible = input.type === "text";
            input.type = isVisible ? "password" : "text";
            toggle.setAttribute("aria-label", isVisible ? "Show password" : "Hide password");
            toggle.innerHTML = `<i class="fa-regular fa-eye${isVisible ? "" : "-slash"}"></i>`;
        });
    }

    try {
        const csrfResponse = await fetch("/api/auth/csrf", { credentials: "same-origin" });
        const csrfPayload = await csrfResponse.json();
        if (!csrfResponse.ok || !csrfPayload.success) throw new Error("Could not start a secure session.");
        csrfToken = csrfPayload.csrfToken;
        const sessionResponse = await fetch("/api/auth/me", { credentials: "same-origin" });
        if (sessionResponse.ok) window.location.replace("/");
    } catch {
        message.textContent = "Could not connect. Check your connection and try again.";
        message.classList.add("is-error");
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        if (!csrfToken) {
            message.textContent = "Could not start a secure session. Refresh this page and try again.";
            message.className = "auth-message is-error";
            return;
        }

        const values = Object.fromEntries(new FormData(form));
        if (form.dataset.mode === "register" && values.password !== values.confirmPassword) {
            message.textContent = "Passwords do not match.";
            message.className = "auth-message is-error";
            return;
        }

        submitButton.disabled = true;
        submitButton.classList.add("is-loading");
        message.textContent = "";
        message.className = "auth-message";
        try {
            const response = await fetch(`/api/auth/${form.dataset.mode}`, {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
                body: JSON.stringify(values)
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || "Request failed.");
            if (form.dataset.mode === "register") {
                window.location.replace("/login.html?created=1");
                return;
            }
            window.location.replace("/");
        } catch (error) {
            message.textContent = error.message || "Could not complete the request.";
            message.className = "auth-message is-error";
        } finally {
            submitButton.disabled = false;
            submitButton.classList.remove("is-loading");
        }
    });

    if (new URLSearchParams(window.location.search).has("created")) {
        message.textContent = "Account created. Log in to continue.";
        message.classList.add("is-success");
    }
});