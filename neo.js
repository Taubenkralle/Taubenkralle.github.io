(() => {
  const DEFAULT_LINES = [
    "Wake up, Neo...",
    "The Matrix has you...",
    "Follow the white rabbit."
  ];
  const WHITE_RABBIT_LINES = [
    "Knock, Knock, Neo."
  ];

  const TYPE_MS = 40;

  function makeOverlay(){
    const overlay = document.createElement("div");
    overlay.className = "neo-overlay";
    const text = document.createElement("div");
    text.className = "neo-text";
    const caret = document.createElement("span");
    caret.className = "neo-caret";
    text.appendChild(caret);
    overlay.appendChild(text);
    document.body.appendChild(overlay);
    return { overlay, text, caret };
  }

  function sleep(ms){
    return new Promise((r) => setTimeout(r, ms));
  }

  async function typeLine(el, caret, line){
    caret.remove();
    el.textContent = "";
    for (let i = 0; i < line.length; i++){
      el.textContent += line[i];
      await sleep(TYPE_MS);
    }
    el.appendChild(caret);
  }

  function waitForAdvance(){
    return new Promise((resolve) => {
      function onKey(e){
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        document.removeEventListener("keydown", onKey);
        resolve();
      }
      document.addEventListener("keydown", onKey);
    });
  }

  async function run(){
    const mode = document.body.dataset.neo || "wake";
    const lines = mode === "knock" ? WHITE_RABBIT_LINES : DEFAULT_LINES;
    const { overlay, text, caret } = makeOverlay();
    for (let i = 0; i < lines.length; i++){
      await typeLine(text, caret, lines[i]);
      await waitForAdvance();
    }
    overlay.remove();
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", run);
  }else{
    run();
  }
})();
