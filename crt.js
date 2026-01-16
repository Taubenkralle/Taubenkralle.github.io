(() => {
  const DURATION_MS = 500;

  function isInternalLink(a){
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#")) return false;
    if (a.target && a.target !== "_self") return false;
    if (a.hasAttribute("download")) return false;
    try{
      const url = new URL(href, location.href);
      return url.origin === location.origin;
    }catch{
      return false;
    }
  }

  function addOverlay(){
    const overlay = document.createElement("div");
    overlay.className = "crt-overlay";
    document.body.appendChild(overlay);
  }

  function playOn(){
    document.body.classList.add("crt-on");
    window.setTimeout(() => {
      document.body.classList.remove("crt-on");
    }, DURATION_MS);
  }

  function playOffAndNavigate(url){
    document.body.classList.add("crt-off");
    window.setTimeout(() => {
      location.href = url;
    }, DURATION_MS);
  }

  function init(){
    addOverlay();
    playOn();

    document.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!isInternalLink(a)) return;
      e.preventDefault();
      const url = a.href;
      playOffAndNavigate(url);
    });
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  }else{
    init();
  }
})();
