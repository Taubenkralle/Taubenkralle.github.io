(() => {
  const btn = document.querySelector("[data-theme-toggle]");
  if (!btn) return;

  const themes = ["onepiece", "matrix"];
  const body = document.body;
  const defaultTheme = body.dataset.defaultTheme || "matrix";
  const stored = localStorage.getItem("site-theme");
  const initial = themes.includes(stored) ? stored : defaultTheme;

  function applyTheme(theme){
    themes.forEach((item) => body.classList.remove(`theme-${item}`));
    body.classList.add(`theme-${theme}`);
    btn.dataset.theme = theme;
    btn.textContent = theme === "onepiece" ? "Theme: One Piece" : "Theme: Matrix";
    localStorage.setItem("site-theme", theme);
  }

  applyTheme(initial);

  btn.addEventListener("click", () => {
    const next = btn.dataset.theme === "onepiece" ? "matrix" : "onepiece";
    applyTheme(next);
  });
})();
