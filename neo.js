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
  const DOUBLE_TAP_MS = 300;
  const DOUBLE_TAP_DIST = 24;

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

  async function typeLine(el, caret, line, isAborted){
    caret.remove();
    el.textContent = "";
    let prev = "";
    for (let i = 0; i < line.length; i++){
      if (isAborted()) return false;
      const ch = line[i];
      el.textContent += ch;
      await sleep(nextDelay(ch, prev));
      prev = ch;
    }
    el.appendChild(caret);
    return true;
  }

  function createTapController(skip, isAborted){
    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;
    let lastPointerDown = 0;
    let singleTimer = null;
    let advance = null;
    let destroyed = false;

    function clearTimer(){
      if (singleTimer){
        clearTimeout(singleTimer);
        singleTimer = null;
      }
    }

    function onPointer(e){
      if (e.isPrimary === false || destroyed) return;
      const now = Date.now();
      if (e.type === "click" && now - lastPointerDown < DOUBLE_TAP_MS + 50) return;
      if (e.type === "pointerdown") lastPointerDown = now;
      const x = "clientX" in e ? e.clientX : 0;
      const y = "clientY" in e ? e.clientY : 0;
      const dt = now - lastTapTime;
      const dx = x - lastTapX;
      const dy = y - lastTapY;
      if (dt > 0 && dt < DOUBLE_TAP_MS && (dx * dx + dy * dy) < (DOUBLE_TAP_DIST * DOUBLE_TAP_DIST)){
        e.preventDefault();
        clearTimer();
        if (!isAborted()) skip();
        return;
      }
      lastTapTime = now;
      lastTapX = x;
      lastTapY = y;
      e.preventDefault();
      clearTimer();
      if (advance){
        singleTimer = setTimeout(() => {
          if (!isAborted() && advance) advance();
        }, DOUBLE_TAP_MS);
      }
    }

    document.addEventListener("pointerdown", onPointer, { passive: false });
    document.addEventListener("click", onPointer);

    return {
      setAdvance(fn){
        if (destroyed) return;
        advance = fn;
      },
      clearAdvance(){
        if (destroyed) return;
        advance = null;
        clearTimer();
      },
      destroy(){
        if (destroyed) return;
        destroyed = true;
        clearTimer();
        document.removeEventListener("pointerdown", onPointer);
        document.removeEventListener("click", onPointer);
      }
    };
  }

  function waitForAdvance(skip, tapController){
    return new Promise((resolve) => {
      function cleanup(){
        document.removeEventListener("keydown", onKey);
        tapController.clearAdvance();
      }
      function onKey(e){
        if (e.key === "Escape"){
          e.preventDefault();
          cleanup();
          skip();
          return;
        }
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        cleanup();
        resolve();
      }
      document.addEventListener("keydown", onKey);
      tapController.setAdvance(() => {
        cleanup();
        resolve();
      });
    });
  }

  async function run(){
    const mode = document.body.dataset.neo;
    if (!mode) return;
    const lines = mode === "knock" ? WHITE_RABBIT_LINES : DEFAULT_LINES;
    const { overlay, text, caret } = makeOverlay();
    let aborted = false;
    let tapController;
    const skip = () => {
      aborted = true;
      overlay.remove();
      if (tapController) tapController.destroy();
    };
    const onEsc = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      document.removeEventListener("keydown", onEsc);
      skip();
    };
    tapController = createTapController(skip, () => aborted);
    document.addEventListener("keydown", onEsc);
    for (let i = 0; i < lines.length; i++){
      if (aborted) return;
      const ok = await typeLine(text, caret, lines[i], () => aborted);
      if (!ok || aborted) return;
      await waitForAdvance(skip, tapController);
      if (aborted) return;
    }
    overlay.remove();
    document.removeEventListener("keydown", onEsc);
    tapController.destroy();
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", run);
  }else{
    run();
  }
})();
