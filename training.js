(() => {
  const canvas = document.getElementById("training-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const BASE_WIDTH = 720;
  const BASE_HEIGHT = 480;
  const GRID_COLS = 12;
  const GRID_ROWS = 8;
  const CELL = BASE_WIDTH / GRID_COLS;

  canvas.width = BASE_WIDTH;
  canvas.height = BASE_HEIGHT;

  const SAVE_KEY = "matrix.training.save";
  const AUTO_RESUME_KEY = "matrix.training.autoResume";
  const MAP_KEY = "matrix.training.map";

  const towerTypes = {
    pulse: { label: "Pulse", cost: 70, range: 95, damage: 10, cooldown: 0.55, burnDps: 6, burnTime: 2.2, color: "#00ff99" },
    snare: { label: "Snare", cost: 90, range: 80, damage: 6, cooldown: 0.85, slow: 0.5, slowTime: 1.2, color: "#00cc55" },
    arc: { label: "Arc", cost: 120, range: 120, damage: 18, cooldown: 1.15, chain: 2, chainRange: 70, chainFalloff: 0.65, empTime: 0.35, color: "#66ffcc" }
  };

  const enemyTypes = {
    basic: { label: "Basic", hp: 40, speed: 55, reward: 10, color: "#00ff66" },
    fast: { label: "Fast", hp: 26, speed: 85, reward: 9, color: "#66ff99" },
    tank: { label: "Tank", hp: 90, speed: 38, reward: 16, color: "#00cc55", armor: 0.2 },
    shield: { label: "Shield", hp: 60, speed: 46, reward: 13, color: "#33ffcc", armor: 0.35 },
    swarm: { label: "Swarm", hp: 18, speed: 95, reward: 6, color: "#00ffcc" },
    regen: { label: "Regen", hp: 70, speed: 42, reward: 14, color: "#5bffb3", regen: 6 },
    boss: { label: "Boss", hp: 260, speed: 30, reward: 40, color: "#b6ffea", armor: 0.25 }
  };

  const upgradeMultipliers = [
    { range: 1, damage: 1, cooldown: 1 },
    { range: 1.2, damage: 1.4, cooldown: 0.85 },
    { range: 1.45, damage: 1.8, cooldown: 0.72 }
  ];

  const maps = [
    {
      id: "core",
      name: "Core Run",
      points: [
        [0.5, 3.5],
        [4.5, 3.5],
        [4.5, 1.5],
        [9.5, 1.5],
        [9.5, 6.5],
        [11.5, 6.5]
      ]
    },
    {
      id: "splice",
      name: "Splice Grid",
      points: [
        [0.5, 6.5],
        [3.5, 6.5],
        [3.5, 2.5],
        [7.5, 2.5],
        [7.5, 5.5],
        [11.5, 5.5]
      ]
    }
  ];

  let currentMap = null;
  let pathPoints = [];
  let pathTiles = new Set();

  const ui = {
    credits: document.querySelector("[data-stat='credits']"),
    wave: document.querySelector("[data-stat='wave']"),
    lives: document.querySelector("[data-stat='lives']"),
    status: document.querySelector("[data-stat='status']"),
    start: document.getElementById("training-start"),
    pause: document.getElementById("training-pause"),
    upgrade: document.getElementById("training-upgrade"),
    sell: document.getElementById("training-sell"),
    selected: document.querySelector("[data-selected]"),
    preview: document.querySelector("[data-preview]"),
    mapSelect: document.getElementById("training-map"),
    mapApply: document.getElementById("training-map-apply"),
    export: document.getElementById("training-export"),
    import: document.getElementById("training-import"),
    reset: document.getElementById("training-reset"),
    autoResume: document.getElementById("training-autoresume")
  };

  const costSpans = document.querySelectorAll("[data-cost]");
  costSpans.forEach((span) => {
    const key = span.dataset.cost;
    if (towerTypes[key]) span.textContent = towerTypes[key].cost;
  });

  function buildPath(map){
    const points = map.points.map(([gx, gy]) => ({ x: gx * CELL, y: gy * CELL }));
    const tiles = new Set();
    for (let i = 0; i < points.length - 1; i++){
      const a = points[i];
      const b = points[i + 1];
      const ax = Math.round(a.x / CELL - 0.5);
      const ay = Math.round(a.y / CELL - 0.5);
      const bx = Math.round(b.x / CELL - 0.5);
      const by = Math.round(b.y / CELL - 0.5);
      const dx = Math.sign(bx - ax);
      const dy = Math.sign(by - ay);
      let x = ax;
      let y = ay;
      tiles.add(`${x},${y}`);
      while (x !== bx || y !== by){
        x += dx;
        y += dy;
        tiles.add(`${x},${y}`);
      }
    }
    return { points, tiles };
  }

  function setMap(mapId, options = {}){
    const map = maps.find((m) => m.id === mapId) || maps[0];
    const built = buildPath(map);
    currentMap = map;
    pathPoints = built.points;
    pathTiles = built.tiles;
    game.mapId = map.id;
    if (ui.mapSelect) ui.mapSelect.value = map.id;
    localStorage.setItem(MAP_KEY, map.id);
    if (options.reset){
      resetGame();
      flashStatus("Map Reset");
    }else if (!options.silent){
      flashStatus("Map geladen");
    }
  }

  let selectedType = "pulse";
  let selectedTower = null;
  let hoverTile = null;

  const game = {
    money: 140,
    lives: 20,
    wave: 0,
    towers: [],
    enemies: [],
    shots: [],
    waveActive: false,
    spawner: null,
    paused: false,
    mapId: maps[0].id
  };

  function resetGame(){
    game.money = 140;
    game.lives = 20;
    game.wave = 0;
    game.towers = [];
    game.enemies = [];
    game.shots = [];
    game.waveActive = false;
    game.spawner = null;
    game.paused = false;
    selectedTower = null;
    updateSelection();
    updateHud("Bereit");
  }

  function getTowerStats(tower){
    const base = towerTypes[tower.type];
    const mult = upgradeMultipliers[tower.level] || upgradeMultipliers[0];
    return {
      range: base.range * mult.range,
      damage: base.damage * mult.damage,
      cooldown: base.cooldown * mult.cooldown,
      slow: base.slow,
      slowTime: base.slowTime,
      burnDps: base.burnDps,
      burnTime: base.burnTime,
      chain: base.chain,
      chainRange: base.chainRange,
      chainFalloff: base.chainFalloff,
      empTime: base.empTime
    };
  }

  function nextUpgradeCost(tower){
    if (tower.level >= 2) return null;
    const base = towerTypes[tower.type].cost;
    return Math.floor(base * (tower.level + 1) * 0.8);
  }

  function updateHud(statusText){
    if (ui.credits) ui.credits.textContent = game.money.toString();
    if (ui.wave) ui.wave.textContent = game.wave.toString();
    if (ui.lives) ui.lives.textContent = game.lives.toString();
    if (ui.status && statusText) ui.status.textContent = statusText;
    if (ui.pause) ui.pause.textContent = game.paused ? "Resume" : "Pause";
    updatePreview();
  }

  function flashStatus(text){
    if (!ui.status) return;
    ui.status.textContent = text;
    ui.status.classList.remove("flash");
    void ui.status.offsetWidth;
    ui.status.classList.add("flash");
  }

  function buildWaveStats(wave){
    const stats = {
      basic: 6 + wave * 2,
      fast: Math.max(0, wave - 1),
      tank: Math.max(0, Math.floor((wave - 1) / 3)),
      shield: Math.max(0, Math.floor((wave - 2) / 2)),
      swarm: Math.max(0, wave - 2),
      regen: Math.max(0, Math.floor((wave - 3) / 3)),
      boss: wave % 5 === 0 ? 1 : 0
    };
    return stats;
  }

  function updatePreview(){
    if (!ui.preview) return;
    const waveNum = game.waveActive ? game.wave : game.wave + 1;
    const stats = buildWaveStats(waveNum);
    const parts = [];
    Object.keys(stats).forEach((key) => {
      const count = stats[key];
      if (!count) return;
      const label = enemyTypes[key]?.label || key;
      parts.push(`${count} ${label}`);
    });
    const prefix = game.waveActive ? `Welle ${game.wave}` : `Next ${waveNum}`;
    ui.preview.textContent = parts.length ? `${prefix}: ${parts.join(" | ")}` : `${prefix}: ruhig`;
  }

  function updateSelection(){
    if (!ui.selected) return;
    if (selectedTower){
      const cost = nextUpgradeCost(selectedTower);
      ui.selected.textContent = `${towerTypes[selectedTower.type].label} L${selectedTower.level}`;
      ui.upgrade.disabled = !cost || game.money < cost;
      ui.sell.disabled = false;
      if (cost) ui.upgrade.textContent = `Upgrade (${cost})`;
    }else{
      ui.selected.textContent = "Kein Tower";
      ui.upgrade.disabled = true;
      ui.sell.disabled = true;
      ui.upgrade.textContent = "Upgrade";
    }
  }

  function startWave(){
    if (game.waveActive) return;
    game.wave += 1;
    const queue = buildWaveQueue(game.wave);
    game.spawner = { queue, index: 0, timer: 0 };
    game.waveActive = true;
    updateHud(`Welle ${game.wave}`);
  }

  function buildWaveQueue(wave){
    const queue = [];
    const stats = buildWaveStats(wave);
    Object.keys(stats).forEach((type) => {
      for (let i = 0; i < stats[type]; i++) queue.push(type);
    });
    return queue.sort(() => Math.random() - 0.5);
  }

  function spawnEnemy(type){
    const base = enemyTypes[type];
    const start = pathPoints[0];
    const enemy = {
      type,
      x: start.x,
      y: start.y,
      hp: base.hp,
      maxHp: base.hp,
      speed: base.speed,
      reward: base.reward,
      pathIndex: 1,
      slowTimer: 0,
      slowFactor: 1,
      burnTimer: 0,
      burnDps: 0,
      stunTimer: 0
    };
    game.enemies.push(enemy);
  }

  function updateSpawner(dt){
    if (!game.spawner) return;
    game.spawner.timer -= dt;
    if (game.spawner.timer > 0) return;
    if (game.spawner.index >= game.spawner.queue.length){
      game.spawner = null;
      return;
    }
    const type = game.spawner.queue[game.spawner.index];
    spawnEnemy(type);
    game.spawner.index += 1;
    game.spawner.timer = 0.6;
  }

  function updateEnemies(dt){
    for (let i = game.enemies.length - 1; i >= 0; i--){
      const enemy = game.enemies[i];
      if (enemy.burnTimer > 0){
        enemy.burnTimer -= dt;
        applyDamage(enemy, enemy.burnDps * dt);
      }
      const regen = enemyTypes[enemy.type]?.regen || 0;
      if (regen > 0){
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + regen * dt);
      }
      if (enemy.hp <= 0){
        game.enemies.splice(i, 1);
        game.money += enemyTypes[enemy.type].reward;
        continue;
      }
      if (enemy.slowTimer > 0){
        enemy.slowTimer -= dt;
        enemy.slowFactor = enemy.slowTimer > 0 ? enemy.slowFactor : 1;
      }
      if (enemy.stunTimer > 0){
        enemy.stunTimer -= dt;
        continue;
      }
      const speed = enemy.speed * enemy.slowFactor;
      let remaining = speed * dt;
      while (remaining > 0 && enemy.pathIndex < pathPoints.length){
        const target = pathPoints[enemy.pathIndex];
        const dx = target.x - enemy.x;
        const dy = target.y - enemy.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= remaining){
          enemy.x = target.x;
          enemy.y = target.y;
          enemy.pathIndex += 1;
          remaining -= dist;
        }else{
          enemy.x += (dx / dist) * remaining;
          enemy.y += (dy / dist) * remaining;
          remaining = 0;
        }
      }
      if (enemy.pathIndex >= pathPoints.length){
        game.enemies.splice(i, 1);
        game.lives -= 1;
        updateHud("Durchbruch");
        if (game.lives <= 0){
          updateHud("System Down");
          game.waveActive = false;
          game.spawner = null;
        }
      }
    }
  }

  function findTarget(tower, stats){
    let best = null;
    let bestScore = -Infinity;
    for (const enemy of game.enemies){
      const dx = enemy.x - tower.x;
      const dy = enemy.y - tower.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > stats.range * stats.range) continue;
      const score = enemy.pathIndex + (enemy.hp < 20 ? 0.2 : 0);
      if (score > bestScore){
        bestScore = score;
        best = enemy;
      }
    }
    return best;
  }

  function applyDamage(enemy, damage){
    const armor = enemyTypes[enemy.type]?.armor || 0;
    const final = damage * (1 - armor);
    enemy.hp -= final;
  }

  function addShot(x1, y1, x2, y2, color){
    game.shots.push({ x1, y1, x2, y2, ttl: 0.12, color });
  }

  function killEnemy(enemy){
    const idx = game.enemies.indexOf(enemy);
    if (idx < 0) return;
    game.enemies.splice(idx, 1);
    game.money += enemyTypes[enemy.type].reward;
  }

  function updateTowers(dt){
    for (const tower of game.towers){
      tower.cooldown -= dt;
      if (tower.cooldown > 0) continue;
      const stats = getTowerStats(tower);
      const target = findTarget(tower, stats);
      if (!target) continue;
      tower.cooldown = stats.cooldown;
      applyDamage(target, stats.damage);
      if (stats.slow){
        target.slowTimer = stats.slowTime;
        target.slowFactor = stats.slow;
      }
      if (stats.burnDps && stats.burnTime){
        target.burnDps = stats.burnDps;
        target.burnTimer = Math.max(target.burnTimer, stats.burnTime);
      }
      if (stats.empTime){
        target.stunTimer = Math.max(target.stunTimer, stats.empTime);
      }
      const shotColor = towerTypes[tower.type].color;
      addShot(tower.x, tower.y, target.x, target.y, shotColor);
      const hitList = new Set([target]);
      if (stats.chain){
        let chained = 0;
        const chainRangeSq = stats.chainRange * stats.chainRange;
        const candidates = game.enemies.filter((e) => e !== target);
        candidates.sort((a, b) => {
          const da = (a.x - target.x) ** 2 + (a.y - target.y) ** 2;
          const db = (b.x - target.x) ** 2 + (b.y - target.y) ** 2;
          return da - db;
        });
        for (const enemy of candidates){
          if (chained >= stats.chain) break;
          const dx = enemy.x - target.x;
          const dy = enemy.y - target.y;
          if ((dx * dx + dy * dy) > chainRangeSq) continue;
          applyDamage(enemy, stats.damage * stats.chainFalloff);
          addShot(target.x, target.y, enemy.x, enemy.y, shotColor);
          hitList.add(enemy);
          chained += 1;
        }
      }
      hitList.forEach((enemy) => {
        if (enemy.hp <= 0) killEnemy(enemy);
      });
    }
  }

  function updateShots(dt){
    for (let i = game.shots.length - 1; i >= 0; i--){
      const shot = game.shots[i];
      shot.ttl -= dt;
      if (shot.ttl <= 0) game.shots.splice(i, 1);
    }
  }

  function updateGame(dt){
    if (game.paused || game.lives <= 0) return;
    if (game.waveActive){
      updateSpawner(dt);
      if (!game.spawner && game.enemies.length === 0){
        game.waveActive = false;
        updateHud("Welle beendet");
      }
    }
    updateEnemies(dt);
    updateTowers(dt);
    updateShots(dt);
    updateSelection();
  }

  function drawGrid(){
    ctx.strokeStyle = "rgba(0,255,102,0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= GRID_COLS; x++){
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, BASE_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= GRID_ROWS; y++){
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(BASE_WIDTH, y * CELL);
      ctx.stroke();
    }
  }

  function drawPath(){
    ctx.fillStyle = "rgba(0,255,102,0.08)";
    for (const tile of pathTiles){
      const [x, y] = tile.split(",").map(Number);
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
    ctx.strokeStyle = "rgba(0,255,102,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (let i = 1; i < pathPoints.length; i++){
      ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    }
    ctx.stroke();
  }

  function drawTowers(){
    for (const tower of game.towers){
      ctx.fillStyle = towerTypes[tower.type].color;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.stroke();
      ctx.fillStyle = "#021008";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tower.level.toString(), tower.x, tower.y);
    }
  }

  function drawEnemies(){
    for (const enemy of game.enemies){
      const base = enemyTypes[enemy.type];
      ctx.fillStyle = base.color;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.stroke();
      ctx.fillStyle = "#03140a";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = enemy.type === "boss" ? "B" : enemy.type === "tank" ? "T" : enemy.type === "fast" ? "F" : enemy.type === "shield" ? "S" : enemy.type === "swarm" ? "W" : enemy.type === "regen" ? "R" : "D";
      ctx.fillText(label, enemy.x, enemy.y);
    }
  }

  function drawShots(){
    ctx.lineWidth = 2;
    for (const shot of game.shots){
      ctx.strokeStyle = shot.color;
      ctx.globalAlpha = Math.min(1, shot.ttl / 0.12);
      ctx.beginPath();
      ctx.moveTo(shot.x1, shot.y1);
      ctx.lineTo(shot.x2, shot.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawHover(){
    if (!hoverTile || !selectedType) return;
    const key = `${hoverTile.x},${hoverTile.y}`;
    if (pathTiles.has(key)) return;
    if (game.towers.some((t) => t.gridX === hoverTile.x && t.gridY === hoverTile.y)) return;
    ctx.fillStyle = "rgba(0,255,153,0.15)";
    ctx.fillRect(hoverTile.x * CELL, hoverTile.y * CELL, CELL, CELL);
  }

  function drawSelection(){
    if (!selectedTower) return;
    const stats = getTowerStats(selectedTower);
    ctx.strokeStyle = "rgba(0,255,153,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(selectedTower.x, selectedTower.y, stats.range, 0, Math.PI * 2);
    ctx.stroke();
  }

  function draw(){
    ctx.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    ctx.fillStyle = "#041008";
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    drawPath();
    drawGrid();
    drawHover();
    drawSelection();
    drawShots();
    drawTowers();
    drawEnemies();
    drawCore();
  }

  function drawCore(){
    const goal = pathPoints[pathPoints.length - 1];
    ctx.fillStyle = "rgba(0,255,153,0.2)";
    ctx.fillRect(goal.x - 20, goal.y - 20, 40, 40);
    ctx.strokeStyle = "rgba(0,255,153,0.6)";
    ctx.strokeRect(goal.x - 20, goal.y - 20, 40, 40);
  }

  function placeTower(gridX, gridY){
    const key = `${gridX},${gridY}`;
    if (pathTiles.has(key)) return false;
    if (game.towers.some((t) => t.gridX === gridX && t.gridY === gridY)) return false;
    const type = towerTypes[selectedType];
    if (!type || game.money < type.cost) return false;
    game.money -= type.cost;
    game.towers.push({
      type: selectedType,
      gridX,
      gridY,
      x: gridX * CELL + CELL / 2,
      y: gridY * CELL + CELL / 2,
      level: 1,
      cooldown: 0
    });
    updateSelection();
    return true;
  }

  function selectTowerAt(gridX, gridY){
    selectedTower = game.towers.find((t) => t.gridX === gridX && t.gridY === gridY) || null;
    updateSelection();
  }

  function upgradeSelected(){
    if (!selectedTower) return;
    const cost = nextUpgradeCost(selectedTower);
    if (!cost || game.money < cost) return;
    game.money -= cost;
    selectedTower.level += 1;
    updateSelection();
  }

  function sellSelected(){
    if (!selectedTower) return;
    const idx = game.towers.indexOf(selectedTower);
    if (idx < 0) return;
    const baseCost = towerTypes[selectedTower.type].cost;
    const refund = Math.floor(baseCost * (0.5 + selectedTower.level * 0.15));
    game.money += refund;
    game.towers.splice(idx, 1);
    selectedTower = null;
    updateSelection();
  }

  function pointerToGrid(evt){
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (evt.clientX - rect.left) * scaleX;
    const y = (evt.clientY - rect.top) * scaleY;
    const gridX = Math.floor(x / CELL);
    const gridY = Math.floor(y / CELL);
    if (gridX < 0 || gridX >= GRID_COLS || gridY < 0 || gridY >= GRID_ROWS) return null;
    return { gridX, gridY };
  }

  function serializeGame(){
    return {
      version: 2,
      money: game.money,
      lives: game.lives,
      wave: game.wave,
      mapId: game.mapId,
      towers: game.towers.map((t) => ({
        type: t.type,
        gridX: t.gridX,
        gridY: t.gridY,
        level: t.level,
        cooldown: t.cooldown
      })),
      enemies: game.enemies.map((e) => ({
        type: e.type,
        x: e.x,
        y: e.y,
        hp: e.hp,
        maxHp: e.maxHp,
        pathIndex: e.pathIndex,
        slowTimer: e.slowTimer,
        slowFactor: e.slowFactor,
        burnTimer: e.burnTimer,
        burnDps: e.burnDps,
        stunTimer: e.stunTimer
      })),
      waveActive: game.waveActive,
      spawner: game.spawner ? {
        queue: game.spawner.queue,
        index: game.spawner.index,
        timer: game.spawner.timer
      } : null,
      paused: game.paused
    };
  }

  function applySave(data){
    if (!data || (data.version !== 1 && data.version !== 2)) return false;
    const mapId = data.mapId || localStorage.getItem(MAP_KEY) || maps[0].id;
    setMap(mapId, { silent: true });
    game.money = data.money ?? 140;
    game.lives = data.lives ?? 20;
    game.wave = data.wave ?? 0;
    game.towers = Array.isArray(data.towers) ? data.towers.map((t) => ({
      type: t.type,
      gridX: t.gridX,
      gridY: t.gridY,
      x: t.gridX * CELL + CELL / 2,
      y: t.gridY * CELL + CELL / 2,
      level: t.level ?? 1,
      cooldown: t.cooldown ?? 0
    })) : [];
    game.enemies = Array.isArray(data.enemies) ? data.enemies.map((e) => ({
      type: e.type,
      x: e.x,
      y: e.y,
      hp: e.hp,
      maxHp: e.maxHp ?? enemyTypes[e.type]?.hp ?? 40,
      speed: enemyTypes[e.type]?.speed ?? 50,
      reward: enemyTypes[e.type]?.reward ?? 8,
      pathIndex: e.pathIndex ?? 1,
      slowTimer: e.slowTimer ?? 0,
      slowFactor: e.slowFactor ?? 1,
      burnTimer: e.burnTimer ?? 0,
      burnDps: e.burnDps ?? 0,
      stunTimer: e.stunTimer ?? 0
    })) : [];
    game.waveActive = !!data.waveActive;
    game.spawner = data.spawner ? {
      queue: data.spawner.queue ?? [],
      index: data.spawner.index ?? 0,
      timer: data.spawner.timer ?? 0
    } : null;
    game.paused = !!data.paused;
    selectedTower = null;
    updateSelection();
    updateHud(game.waveActive ? `Welle ${game.wave}` : "Bereit");
    return true;
  }

  function saveGame(){
    try{
      const payload = serializeGame();
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    }catch (err){
      console.warn("save failed", err);
    }
  }

  function loadGame(){
    try{
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      return applySave(data);
    }catch (err){
      console.warn("load failed", err);
      return false;
    }
  }

  function exportSave(){
    const payload = serializeGame();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "training-save.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function importSave(file){
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const data = JSON.parse(reader.result);
        if (applySave(data)){
          saveGame();
        }
      }catch (err){
        console.warn("import failed", err);
      }
    };
    reader.readAsText(file);
  }

  function quickSave(){
    saveGame();
    flashStatus("Quick Save");
  }

  function quickLoad(){
    const ok = loadGame();
    if (ok) applyAutoResume();
    flashStatus(ok ? "Quick Load" : "Kein Save");
  }

  canvas.addEventListener("mousemove", (evt) => {
    const pos = pointerToGrid(evt);
    hoverTile = pos ? { x: pos.gridX, y: pos.gridY } : null;
  });

  canvas.addEventListener("mouseleave", () => {
    hoverTile = null;
  });

  canvas.addEventListener("click", (evt) => {
    const pos = pointerToGrid(evt);
    if (!pos) return;
    const hasTower = game.towers.some((t) => t.gridX === pos.gridX && t.gridY === pos.gridY);
    if (hasTower){
      selectTowerAt(pos.gridX, pos.gridY);
      return;
    }
    selectedTower = null;
    updateSelection();
    placeTower(pos.gridX, pos.gridY);
  });

  document.querySelectorAll(".tower-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedType = btn.dataset.tower;
      document.querySelectorAll(".tower-btn").forEach((b) => b.classList.toggle("active", b === btn));
    });
    if (btn.dataset.tower === selectedType) btn.classList.add("active");
  });

  if (ui.mapSelect){
    ui.mapSelect.innerHTML = maps.map((map) => `<option value="${map.id}">${map.name}</option>`).join("");
    const storedMap = localStorage.getItem(MAP_KEY) || maps[0].id;
    setMap(storedMap, { silent: true });
  }else{
    setMap(maps[0].id, { silent: true });
  }

  if (ui.start){
    ui.start.addEventListener("click", startWave);
  }
  if (ui.pause){
    ui.pause.addEventListener("click", () => {
      game.paused = !game.paused;
      updateHud(game.paused ? "Pause" : "Bereit");
    });
  }
  if (ui.upgrade){
    ui.upgrade.addEventListener("click", upgradeSelected);
  }
  if (ui.sell){
    ui.sell.addEventListener("click", sellSelected);
  }
  if (ui.export){
    ui.export.addEventListener("click", exportSave);
  }
  if (ui.import){
    ui.import.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importSave(file);
      e.target.value = "";
    });
  }
  if (ui.reset){
    ui.reset.addEventListener("click", () => {
      localStorage.removeItem(SAVE_KEY);
      resetGame();
    });
  }

  if (ui.mapApply && ui.mapSelect){
    ui.mapApply.addEventListener("click", () => {
      const nextMap = ui.mapSelect.value;
      if (game.waveActive || game.enemies.length){
        flashStatus("Map gesperrt");
        return;
      }
      if (nextMap === game.mapId) return;
      setMap(nextMap, { reset: true });
    });
  }

  function isAutoResume(){
    return localStorage.getItem(AUTO_RESUME_KEY) !== "0";
  }

  function applyAutoResume(){
    if (!isAutoResume()) return;
    if (game.waveActive || game.enemies.length){
      game.paused = false;
      flashStatus("Auto Resume");
    }
  }

  if (ui.autoResume){
    ui.autoResume.checked = isAutoResume();
    ui.autoResume.addEventListener("change", () => {
      localStorage.setItem(AUTO_RESUME_KEY, ui.autoResume.checked ? "1" : "0");
      flashStatus(ui.autoResume.checked ? "Auto Resume an" : "Auto Resume aus");
    });
  }

  document.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    const isTyping = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
    if (isTyping) return;
    if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "S" || e.key === "s")){
      e.preventDefault();
      quickSave();
    }
    if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "L" || e.key === "l")){
      e.preventDefault();
      quickLoad();
    }
  });

  let lastTime = null;
  function loop(time){
    if (!lastTime) lastTime = time;
    const dt = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;
    updateGame(dt);
    draw();
    requestAnimationFrame(loop);
  }

  loadGame();
  applyAutoResume();
  if (!game.waveActive && !game.enemies.length){
    updateHud("Bereit");
  }
  updateSelection();
  requestAnimationFrame(loop);

  setInterval(saveGame, 2000);
  window.addEventListener("beforeunload", saveGame);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveGame();
  });
})();
