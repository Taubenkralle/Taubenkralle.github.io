(() => {
  const KEY = "wiki.view.wide";

  function setWide(on){
    document.body.classList.toggle("wide-text", on);
    if (on){
      localStorage.setItem(KEY, "1");
    }else{
      localStorage.removeItem(KEY);
    }
  }

  function init(){
    if (localStorage.getItem(KEY) === "1"){
      setWide(true);
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
    });
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  }else{
    init();
  }
})();
