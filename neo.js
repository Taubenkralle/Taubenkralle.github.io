(() => {
  const DEFAULT_LINES = [
    "Wake up, Neo...",
    "The Matrix has you...",
    "Follow the white rabbit."
  ];
  const WHITE_RABBIT_LINES = [
    "Knock, Knock, Neo."
  ];

  const BASE_MS = 32;
  const JITTER_MS = 28;

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

  function nextDelay(ch, prev){
    let ms = BASE_MS + Math.random() * JITTER_MS;
    if (ch === " ") ms += 18;
    if (/[.,!?]/.test(ch)) ms += 140;
    if (prev && /[.,!?]/.test(prev)) ms += 40;
    return ms;
  }

  async function typeLine(el, caret, line){
    caret.remove();
    el.textContent = "";
    let prev = "";
    for (let i = 0; i < line.length; i++){
      const ch = line[i];
      el.textContent += ch;
      await sleep(nextDelay(ch, prev));
      prev = ch;
    }
    el.appendChild(caret);
  }

  function waitForAdvance(skip){
    return new Promise((resolve) => {
      function onKey(e){
        if (e.key === "Escape"){
          e.preventDefault();
          document.removeEventListener("keydown", onKey);
          skip();
          return;
        }
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        document.removeEventListener("keydown", onKey);
        resolve();
      }
      document.addEventListener("keydown", onKey);
    });
  }

  async function run(){
    const mode = document.body.dataset.neo;
    if (!mode) return;
    const lines = mode === "knock" ? WHITE_RABBIT_LINES : DEFAULT_LINES;
    const { overlay, text, caret } = makeOverlay();
    let aborted = false;
    const skip = () => {
      aborted = true;
      overlay.remove();
    };
    for (let i = 0; i < lines.length; i++){
      if (aborted) return;
      await typeLine(text, caret, lines[i]);
      await waitForAdvance(skip);
    }
    overlay.remove();
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", run);
  }else{
    run();
  }
})();
