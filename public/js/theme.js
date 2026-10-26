// Light / dark theme: follows the system unless you pick one. The choice is
// applied before paint by the inline script in partials/head.ejs.
const ORDER = ["system", "light", "dark"];
const LABEL = { system: "Theme: system", light: "Theme: light", dark: "Theme: dark" };

function current() {
  try {
    return localStorage.getItem("theme") || "system";
  } catch (_) {
    return document.documentElement.dataset.theme || "system";
  }
}

function apply(theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    if (theme === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", theme);
  } catch (_) {
    // Private mode: the choice lasts for this page only.
  }
}

document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
  btn.textContent = LABEL[current()];
  btn.addEventListener("click", () => {
    const next = ORDER[(ORDER.indexOf(current()) + 1) % ORDER.length];
    apply(next);
    btn.textContent = LABEL[next];
  });
});
