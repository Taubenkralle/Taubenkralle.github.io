(() => {
  const STORAGE_KEY = "wiki.bookmarks.v1";
  const MAX_LABEL = 80;

  function loadBookmarks(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    }catch{
      return [];
    }
  }

  function saveBookmarks(list){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function getSelectionLabel(){
    const sel = window.getSelection();
    if (!sel) return "";
    const text = sel.toString().trim().replace(/\s+/g, " ");
    if (!text) return "";
    if (text.length > MAX_LABEL) return text.slice(0, MAX_LABEL - 3) + "...";
    return text;
  }

  function getHeadingLabel(){
    const headings = document.querySelectorAll("main h1, main h2, main h3, main h4, main h5, main h6, h1, h2, h3, h4, h5, h6");
    if (!headings.length) return "";
    const anchorY = window.scrollY + 120;
    let best = "";
    let bestTop = -Infinity;
    headings.forEach((h) => {
      const top = h.getBoundingClientRect().top + window.scrollY;
      if (top <= anchorY && top > bestTop){
        const text = h.textContent.trim();
        if (text){
          bestTop = top;
          best = text;
        }
      }
    });
    return best;
  }

  function buildLabel(){
    return getSelectionLabel() || getHeadingLabel() || document.title || "Bookmark";
  }

  function createPanel(){
    const panel = document.createElement("aside");
    panel.id = "bm-panel";
    panel.className = "bm-panel";
    panel.innerHTML = `
      <div class="bm-header">
        <div class="bm-title">Bookmarks</div>
        <button class="bm-close" type="button" aria-label="Close">x</button>
      </div>
      <div class="bm-hint">Add: W | Jump: A | Open: D | Close: S</div>
      <div class="bm-actions">
        <button class="bm-add" type="button">+ Add</button>
        <button class="bm-clear" type="button">Clear</button>
      </div>
      <ul class="bm-list"></ul>
      <div class="bm-empty">No bookmarks yet.</div>
    `;

    const tab = document.createElement("button");
    tab.id = "bm-tab";
    tab.className = "bm-tab";
    tab.type = "button";
    tab.textContent = "BOOKMARKS";

    document.body.appendChild(panel);
    document.body.appendChild(tab);

    return { panel, tab };
  }

  function init(){
    const { panel, tab } = createPanel();
    const listEl = panel.querySelector(".bm-list");
    const emptyEl = panel.querySelector(".bm-empty");
    const addBtn = panel.querySelector(".bm-add");
    const clearBtn = panel.querySelector(".bm-clear");
    const closeBtn = panel.querySelector(".bm-close");

    let bookmarks = loadBookmarks();

    function render(){
      listEl.innerHTML = "";
      emptyEl.style.display = bookmarks.length ? "none" : "block";

      bookmarks.forEach((bm) => {
        const li = document.createElement("li");
        li.className = "bm-row";

        const jump = document.createElement("button");
        jump.type = "button";
        jump.className = "bm-jump";
        jump.innerHTML = `
          <span class="bm-label"></span>
          <span class="bm-meta"></span>
        `;
        jump.querySelector(".bm-label").textContent = bm.label;
        jump.querySelector(".bm-meta").textContent = bm.pageTitle || bm.page;

        const actions = document.createElement("div");
        actions.className = "bm-row-actions";

        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "bm-edit";
        edit.textContent = "edit";

        const del = document.createElement("button");
        del.type = "button";
        del.className = "bm-del";
        del.textContent = "x";

        actions.appendChild(edit);
        actions.appendChild(del);
        li.appendChild(jump);
        li.appendChild(actions);
        listEl.appendChild(li);

        jump.addEventListener("click", () => {
          if (bm.page === location.pathname){
            window.scrollTo({ top: bm.y, behavior: "smooth" });
          }else{
            location.href = `${bm.page}?bm=${encodeURIComponent(bm.id)}`;
          }
        });

        edit.addEventListener("click", () => {
          const next = prompt("Neuer Name:", bm.label);
          if (!next) return;
          bm.label = next.trim().slice(0, MAX_LABEL) || bm.label;
          saveBookmarks(bookmarks);
          render();
        });

        del.addEventListener("click", () => {
          bookmarks = bookmarks.filter((x) => x.id !== bm.id);
          saveBookmarks(bookmarks);
          render();
        });
      });
    }

    function addBookmark(){
      const label = buildLabel();
      const id = `bm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const item = {
        id,
        label,
        page: location.pathname,
        pageTitle: document.title,
        y: Math.round(window.scrollY),
        createdAt: Date.now()
      };
      bookmarks = [item, ...bookmarks];
      saveBookmarks(bookmarks);
      render();
      panel.classList.add("open");
    }

    function closePanel(){
      panel.classList.remove("open");
    }

    function openPanel(){
      panel.classList.add("open");
    }

    function togglePanel(){
      panel.classList.toggle("open");
    }

    function jumpToLatest(){
      if (!bookmarks.length) return;
      const bm = bookmarks[0];
      if (bm.page === location.pathname){
        window.scrollTo({ top: bm.y, behavior: "smooth" });
      }else{
        location.href = `${bm.page}?bm=${encodeURIComponent(bm.id)}`;
      }
    }

    addBtn.addEventListener("click", addBookmark);
    clearBtn.addEventListener("click", () => {
      if (!bookmarks.length) return;
      const ok = confirm("Alle Bookmarks loeschen?");
      if (!ok) return;
      bookmarks = [];
      saveBookmarks(bookmarks);
      render();
    });
    closeBtn.addEventListener("click", closePanel);
    tab.addEventListener("click", togglePanel);

    document.addEventListener("keydown", (e) => {
      const active = document.activeElement;
      const isTyping = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
      if (isTyping) return;
      if (e.key === "w" && !e.ctrlKey && !e.metaKey && !e.altKey){
        e.preventDefault();
        addBookmark();
      }
      if (e.key === "a" && !e.ctrlKey && !e.metaKey && !e.altKey){
        e.preventDefault();
        jumpToLatest();
      }
      if (e.key === "d" && !e.ctrlKey && !e.metaKey && !e.altKey){
        e.preventDefault();
        openPanel();
      }
      if (e.key === "s" && !e.ctrlKey && !e.metaKey && !e.altKey){
        e.preventDefault();
        closePanel();
      }
      if (e.key === "Escape"){
        closePanel();
      }
    });

    function jumpFromParam(){
      const params = new URLSearchParams(location.search);
      const id = params.get("bm");
      if (!id) return;
      const match = bookmarks.find((b) => b.id === id);
      if (match && match.page === location.pathname){
        requestAnimationFrame(() => {
          window.scrollTo({ top: match.y });
        });
      }
      params.delete("bm");
      const next = params.toString();
      const url = location.pathname + (next ? `?${next}` : "") + location.hash;
      history.replaceState({}, "", url);
    }

    render();
    jumpFromParam();
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  }else{
    init();
  }
})();
