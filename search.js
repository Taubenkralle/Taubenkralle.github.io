(() => {
  function normalize(text){
    return (text || "")
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss");
  }

  function tokenize(query){
    return normalize(query).split(/\s+/).filter(Boolean);
  }

  function scoreItem(item, tokens){
    const hay = normalize(`${item.title} ${item.keywords || ""} ${item.excerpt || ""}`);
    let score = 0;
    tokens.forEach((t) => {
      if (hay.includes(t)) score += 1;
    });
    return score;
  }

  function initSearch(shell){
    const toggle = shell.querySelector(".search-toggle");
    const panel = shell.querySelector(".search-panel");
    const input = shell.querySelector(".search-input");
    const close = shell.querySelector(".search-close");
    const results = shell.querySelector(".search-results");
    const empty = shell.querySelector(".search-empty");
    const indexPath = shell.dataset.index;

    let items = [];
    let loaded = false;

    function render(list){
      results.innerHTML = "";
      if (!list.length){
        empty.style.display = "block";
        return;
      }
      empty.style.display = "none";
      list.forEach((item) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <a href="${item.url}">
            <span class="search-title"></span>
            <span class="search-meta"></span>
          </a>
        `;
        li.querySelector(".search-title").textContent = item.title;
        li.querySelector(".search-meta").textContent = item.meta || item.url;
        results.appendChild(li);
      });
    }

    function open(){
      panel.hidden = false;
      input.focus();
    }

    function closePanel(){
      panel.hidden = true;
    }

    function togglePanel(){
      panel.hidden ? open() : closePanel();
    }

    function search(){
      const q = input.value.trim();
      if (!q){
        render([]);
        return;
      }
      const tokens = tokenize(q);
      const ranked = items
        .map((item) => ({ item, score: scoreItem(item, tokens) }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((row) => row.item);
      render(ranked);
    }

    async function loadIndex(){
      if (loaded) return;
      loaded = true;
      try{
        const res = await fetch(indexPath, { cache: "no-cache" });
        if (!res.ok) return;
        items = await res.json();
      }catch{
        items = [];
      }
    }

    toggle.addEventListener("click", async () => {
      if (panel.hidden) await loadIndex();
      togglePanel();
    });
    close.addEventListener("click", closePanel);
    input.addEventListener("input", search);

    document.addEventListener("keydown", (e) => {
      const active = document.activeElement;
      const isTyping = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
      if (isTyping) return;
      if (e.key === "/"){
        e.preventDefault();
        loadIndex().then(open);
      }
    });
  }

  function boot(){
    const shell = document.querySelector(".search-shell");
    if (!shell) return;
    initSearch(shell);
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})();
