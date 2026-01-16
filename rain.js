(() => {
  const canvas = document.getElementById("rain");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let drops = [];
  const fontSize = 16;

  function resize(){
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);

    const cols = Math.floor(window.innerWidth / fontSize);
    drops = Array(cols).fill(0).map(() => Math.random() * (window.innerHeight / fontSize));
    ctx.font = fontSize + "px ui-monospace, Menlo, monospace";
  }

  function draw(){
    if (document.body.classList.contains("rain-hidden")){
      requestAnimationFrame(draw);
      return;
    }
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0,0,window.innerWidth,window.innerHeight);

    for (let i = 0; i < drops.length; i++){
      const text = chars[Math.floor(Math.random()*chars.length)];
      const x = i * fontSize;
      const y = drops[i] * fontSize;

      ctx.fillStyle = (Math.random() < 0.02) ? "#b6ffcc" : "#00ff66";
      ctx.fillText(text, x, y);

      if (y > window.innerHeight && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener("resize", resize);
  draw();
})();
