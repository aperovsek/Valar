// Common header behavior for all pages: manual theme toggle + login button.
// Theme is chosen ONLY by the user toggle (persisted in localStorage).
// System/browser preferences are intentionally ignored.

const THEME_KEY = "theme";

const SUN_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
const MOON_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

function getTheme() {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("theme-toggle");
    if (btn) {
        btn.innerHTML = theme === "dark" ? SUN_ICON : MOON_ICON;
        btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
        btn.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
    }
}

function setupThemeToggle() {
    applyTheme(getTheme());
    const btn = document.getElementById("theme-toggle");
    if (btn) {
        btn.addEventListener("click", () => {
            const next = getTheme() === "dark" ? "light" : "dark";
            localStorage.setItem(THEME_KEY, next);
            applyTheme(next);
            window.dispatchEvent(new CustomEvent("themechange", { detail: next }));
        });
    }
}

function setupLoginButton() {
    const loginBtn = document.getElementById("login-btn");
    if (loginBtn) {
        loginBtn.addEventListener("click", () => {
            alert("Login functionality will be implemented in a future update.");
        });
    }
}

window.addEventListener("DOMContentLoaded", () => {
    setupThemeToggle();
    setupLoginButton();
});
