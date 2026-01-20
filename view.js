(() => {
  const KEY = "wiki.view.wide";
  const UI_KEY = "wiki.view.uiHidden";
  const RAIN_KEY = "wiki.view.rainHidden";

  const toggleBtn = document.querySelector(".view-toggle");

  function setWide(on){
    document.body.classList.toggle("wide-text", on);
    if (toggleBtn){
      toggleBtn.classList.toggle("active", on);
      toggleBtn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    if (on){
      localStorage.setItem(KEY, "1");
    }else{
      localStorage.removeItem(KEY);
    }
  }

  function setUiHidden(on){
    document.body.classList.toggle("ui-hidden", on);
    if (on){
      localStorage.setItem(UI_KEY, "1");
    }else{
      localStorage.removeItem(UI_KEY);
    }
  }

  function setRainHidden(on){
    document.body.classList.toggle("rain-hidden", on);
    if (on){
      localStorage.setItem(RAIN_KEY, "1");
    }else{
      localStorage.removeItem(RAIN_KEY);
    }
  }

  function getTrainingUrl(){
    const homeLink = document.querySelector("a.home-mini, a.home");
    if (homeLink){
      const homeUrl = new URL(homeLink.getAttribute("href"), window.location.href);
      return new URL("training.html", homeUrl).toString();
    }
    return "training.html";
  }

  function init(){
    if (localStorage.getItem(KEY) === "1"){
      setWide(true);
    }
    if (localStorage.getItem(UI_KEY) === "1"){
      setUiHidden(true);
    }
    if (!document.body.dataset.rainFixed && localStorage.getItem(RAIN_KEY) === "1"){
      setRainHidden(true);
    }

    if (toggleBtn){
      toggleBtn.addEventListener("click", () => {
        setWide(!document.body.classList.contains("wide-text"));
      });
    }

    document.addEventListener("keydown", (e) => {
      const active = document.activeElement;
      const isTyping = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
      if (isTyping) return;
      if (e.key === "5"){
        e.preventDefault();
        setWide(true);
      }
      if (e.key === "6"){
        e.preventDefault();
        setWide(false);
      }
      if (e.key === "7"){
        e.preventDefault();
        setUiHidden(!document.body.classList.contains("ui-hidden"));
      }
      if (e.key === "8" && !document.body.dataset.rainFixed){
        e.preventDefault();
        setRainHidden(!document.body.classList.contains("rain-hidden"));
      }
      if (e.key === "9"){
        e.preventDefault();
        window.location.href = getTrainingUrl();
      }
    });
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  }else{
    init();
  }
})();
