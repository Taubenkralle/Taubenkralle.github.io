(() => {
  function normalize(text){
    return (text || "")
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss");
  }

  function slugify(text){
    return normalize(text)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function ensureHeadingIds(headings){
    headings.forEach((h) => {
      if (!h.id){
        const slug = slugify(h.textContent || "");
        if (slug) h.id = slug;
      }
    });
  }

  function buildPanel(){
    const panel = document.createElement("aside");
    panel.className = "toc-panel";
    panel.innerHTML = `
      <div class="toc-header">
        <div class="toc-title">Inhalt</div>
        <button class="toc-close" type="button" aria-label="Close">x</button>
      </div>
      <ul class="toc-list"></ul>
      <div class="toc-empty">Keine Ueberschriften gefunden.</div>
    `;

    const tab = document.createElement("button");
    tab.className = "toc-tab";
    tab.type = "button";
    tab.textContent = "INHALT";

    document.body.appendChild(panel);
    document.body.appendChild(tab);

    return { panel, tab };
  }

  function init(){
    const headings = Array.from(document.querySelectorAll("main h1, main h2, main h3, main h4, h1, h2, h3, h4"));
    ensureHeadingIds(headings);

    const { panel, tab } = buildPanel();
    const listEl = panel.querySelector(".toc-list");
    const emptyEl = panel.querySelector(".toc-empty");
    const closeBtn = panel.querySelector(".toc-close");

    const filtered = headings.filter((h) => h.textContent && h.id);
    if (!filtered.length){
      emptyEl.style.display = "block";
    }else{
      emptyEl.style.display = "none";
      filtered.forEach((h) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        const level = h.tagName.replace("H", "");
        a.href = `#${h.id}`;
        a.dataset.level = level;
        a.textContent = h.textContent.trim();
        li.appendChild(a);
        listEl.appendChild(li);
      });
    }

    function setActive(id){
      const prev = listEl.querySelector(".toc-active");
      if (prev) prev.classList.remove("toc-active");
      if (!id) return;
      const next = listEl.querySelector(`a[href="#${CSS.escape(id)}"]`);
      if (next) next.classList.add("toc-active");
    }

    function updateActive(){
      const marker = window.scrollY + 140;
      let current = "";
      filtered.forEach((h) => {
        const top = h.getBoundingClientRect().top + window.scrollY;
        if (top <= marker) current = h.id;
      });
      setActive(current);
    }

    function open(){
      panel.classList.add("open");
    }

    function close(){
      panel.classList.remove("open");
    }

    document.addEventListener("keydown", (e) => {
      const active = document.activeElement;
      const isTyping = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
      if (isTyping) return;
      if (e.key === "1"){
        e.preventDefault();
        open();
      }
      if (e.key === "2"){
        e.preventDefault();
        close();
      }
    });

    tab.addEventListener("click", () => {
      panel.classList.toggle("open");
    });
    closeBtn.addEventListener("click", close);
    listEl.addEventListener("click", (e) => {
      const link = e.target.closest("a");
      if (!link) return;
      panel.classList.remove("open");
    });

    updateActive();
    window.addEventListener("scroll", updateActive, { passive: true });
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  }else{
    init();
  }
})();
