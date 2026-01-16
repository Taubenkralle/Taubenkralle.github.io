(() => {
  const DURATION_MS = 300;

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

  function init(){
    addOverlay();
    playOn();
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  }else{
    init();
  }
})();
