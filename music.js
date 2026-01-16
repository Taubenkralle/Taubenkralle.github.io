(() => {
  const shell = document.querySelector(".music-shell");
  if (!shell) return;

  const btn = shell.querySelector(".music-button");
  const src = shell.dataset.audio || "/audio/matrix.wav";
  let ctx = null;
  let buffer = null;
  let source = null;
  let gain = null;
  let isLoading = false;

  function resolveUrl(url){
    if (url.startsWith("/") && location.origin === "null"){
      return url.slice(1);
    }
    return url;
  }

  function setPlaying(isPlaying){
    btn.classList.toggle("playing", isPlaying);
  }

  async function loadBuffer(){
    if (buffer) return buffer;
    if (isLoading) return null;
    isLoading = true;
    btn.classList.add("loading");
    try{
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!ctx) ctx = new AudioCtx();
      const res = await fetch(resolveUrl(src));
      const data = await res.arrayBuffer();
      buffer = await ctx.decodeAudioData(data);
    }catch{
      buffer = null;
    }finally{
      isLoading = false;
      btn.classList.remove("loading");
    }
    return buffer;
  }

  function start(){
    if (!buffer || !ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    gain = ctx.createGain();
    gain.gain.value = 0.176;
    source.connect(gain).connect(ctx.destination);
    source.start(0);
    setPlaying(true);
  }

  function stop(){
    if (source){
      source.stop(0);
      source.disconnect();
      source = null;
    }
    setPlaying(false);
  }

  async function toggle(){
    if (source){
      stop();
      return;
    }
    const buf = await loadBuffer();
    if (!buf) return;
    start();
  }

  btn.addEventListener("click", toggle);

  document.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    const isTyping = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
    if (isTyping) return;
    if (e.key === "4"){
      e.preventDefault();
      toggle();
    }
  });
})();
