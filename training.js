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
  const CAMPAIGN_KEY = "matrix.training.campaign";
  const SOUND_KEY = "matrix.training.sound";
  const HIGHSCORE_KEY = "matrix.training.highscore";
  const HIGHSCORES_KEY = "matrix.training.highscores";
  const MIXER_KEY = "matrix.training.mixer";
  const SLOT_KEY = "matrix.training.slot";
  const DAILY_KEY = "matrix.training.daily";
  const DAILY_DATE_KEY = "matrix.training.dailyDate";
  const DAILY_SCORES_KEY = "matrix.training.dailyScores";
  const DAILY_STREAK_KEY = "matrix.training.dailyStreak";
  const DAILY_LAST_KEY = "matrix.training.dailyLastRun";
  const SLOT_COUNT = 3;
  const STREAK_BONUS = 25;
  const MAX_ENEMIES = 120;
  const LOGIC_DT = 1 / 30;
  const MAX_SHOTS = 240;

  const sfx = {
    ctx: null,
    last: {},
    muted: false,
    volumes: { ui: 1, hit: 1, boss: 1, type: 1 },
    init(){
      if (this.ctx) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
    },
    play(name){
      if (this.muted) return;
      const volume = this.volumes[name] ?? 1;
      if (volume <= 0) return;
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") this.ctx.resume();
      const now = performance.now();
      const cooldown = { hit: 90, type: 40, ui: 120, boss: 180 }[name] || 100;
      if (this.last[name] && now - this.last[name] < cooldown) return;
      this.last[name] = now;
      const config = {
        ui: { freq: 520, dur: 0.08, type: "triangle", vol: 0.05 },
        type: { freq: 740, dur: 0.03, type: "square", vol: 0.03 },
        hit: { freq: 180, dur: 0.05, type: "square", vol: 0.04 },
        boss: { freq: 120, dur: 0.35, type: "sawtooth", vol: 0.06 }
      }[name] || { freq: 440, dur: 0.06, type: "sine", vol: 0.04 };
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = config.type;
      osc.frequency.value = config.freq;
      gain.gain.value = config.vol * volume;
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + config.dur);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + config.dur);
    }
  };

  const towerTypes = {
    pulse: { label: "Pulse", cost: 70, range: 95, damage: 10, cooldown: 0.55, burnDps: 6, burnTime: 2.2, color: "#00ff99" },
    snare: { label: "Snare", cost: 90, range: 80, damage: 6, cooldown: 0.85, slow: 0.5, slowTime: 1.2, color: "#00cc55" },
    arc: { label: "Arc", cost: 120, range: 120, damage: 18, cooldown: 1.15, chain: 2, chainRange: 70, chainFalloff: 0.65, empTime: 0.35, color: "#66ffcc" }
  };

  const towerBranches = {
    pulse: [
      { id: "inferno", name: "Inferno", icon: "I", desc: "Burn++", color: "#ffb347", level2: { burnDps: 4, burnTime: 1.2 }, level3: { damage: 1.15 } },
      { id: "focus", name: "Focus", icon: "F", desc: "Range+Damage", color: "#8fd1ff", level2: { range: 1.2, damage: 1.15 }, level3: { range: 1.1, damage: 1.2 } }
    ],
    snare: [
      { id: "glue", name: "Glue", icon: "G", desc: "Slow++", color: "#7fffc2", level2: { slow: 0.35, slowTime: 1.6, range: 1.1 }, level3: { range: 1.15 } },
      { id: "decay", name: "Decay", icon: "D", desc: "DoT", color: "#d0ff86", level2: { burnDps: 4, burnTime: 2.2, damage: 1.2 }, level3: { damage: 1.25 } }
    ],
    arc: [
      { id: "relay", name: "Relay", icon: "R", desc: "More Chains", color: "#7fb0ff", level2: { chain: 2, chainRange: 25 }, level3: { chain: 1, chainFalloff: 0.8 } },
      { id: "surge", name: "Surge", icon: "S", desc: "EMP++", color: "#ff7fbf", level2: { empTime: 0.25, damage: 1.15 }, level3: { damage: 1.25 } }
    ]
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
    },
    {
      id: "loop",
      name: "Loop Trace",
      points: [
        [0.5, 1.5],
        [5.5, 1.5],
        [5.5, 5.5],
        [2.5, 5.5],
        [2.5, 3.5],
        [9.5, 3.5],
        [9.5, 6.5],
        [11.5, 6.5]
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
    campaignStage: document.querySelector("[data-campaign='stage']"),
    campaignTarget: document.querySelector("[data-campaign='target']"),
    campaignProgress: document.querySelector("[data-campaign='progress']"),
    branchBox: document.getElementById("training-branch"),
    branchA: document.getElementById("training-branch-a"),
    branchB: document.getElementById("training-branch-b"),
    sound: document.getElementById("training-sound"),
    help: document.getElementById("training-help"),
    helpModal: document.getElementById("training-help-modal"),
    helpClose: document.getElementById("training-help-close"),
    glitch: document.getElementById("training-glitch"),
    summary: document.getElementById("training-summary"),
    summaryClose: document.getElementById("training-summary-close"),
    summaryWave: document.querySelector("[data-summary='wave']"),
    summaryCredits: document.querySelector("[data-summary='credits']"),
    summaryLives: document.querySelector("[data-summary='lives']"),
    summaryKills: document.querySelector("[data-summary='kills']"),
    summaryBonus: document.querySelector("[data-summary='bonus']"),
    campaignHigh: document.querySelector("[data-campaign='high']"),
    scores: document.getElementById("training-scores"),
    dailyScores: document.getElementById("training-daily-scores"),
    slotSelect: document.getElementById("training-slot"),
    slotLoad: document.getElementById("training-slot-load"),
    slotPreview: document.getElementById("training-slot-preview"),
    streak: document.getElementById("training-streak"),
    daily: document.getElementById("training-daily"),
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
    mapId: maps[0].id,
    kills: 0,
    summaryLock: false,
    lastSummaryWave: 0,
    logicAccumulator: 0
  };

  const campaignStages = [
    { mapId: "core", targetWave: 3, rewardCredits: 60, rewardLives: 1 },
    { mapId: "splice", targetWave: 4, rewardCredits: 80, rewardLives: 1 },
    { mapId: "loop", targetWave: 5, rewardCredits: 110, rewardLives: 2 }
  ];

  function loadCampaign(){
    try{
      const raw = localStorage.getItem(CAMPAIGN_KEY);
      if (!raw) return { stage: 0 };
      const data = JSON.parse(raw);
      return { stage: Math.max(0, Math.min(campaignStages.length - 1, data.stage || 0)) };
    }catch{
      return { stage: 0 };
    }
  }

  const campaign = loadCampaign();
  let highScore = parseInt(localStorage.getItem(HIGHSCORE_KEY) || "0", 10) || 0;
  let summaryState = { kills: 0, bonus: 0 };
  let scores = loadScores();
  let dailyScores = loadDailyScores();
  let dailyMode = localStorage.getItem(DAILY_KEY) === "1";
  let dailySeed = localStorage.getItem(DAILY_DATE_KEY) || "";
  let dailyStreak = parseInt(localStorage.getItem(DAILY_STREAK_KEY) || "0", 10) || 0;
  let dailyLast = localStorage.getItem(DAILY_LAST_KEY) || "";
  if (!dailySeed){
    dailySeed = getDailySeed();
    localStorage.setItem(DAILY_DATE_KEY, dailySeed);
  }

  function saveCampaign(){
    localStorage.setItem(CAMPAIGN_KEY, JSON.stringify({ stage: campaign.stage }));
  }

  function updateCampaignUI(){
    if (!campaignStages.length) return;
    const stage = campaignStages[campaign.stage];
    if (ui.campaignStage) ui.campaignStage.textContent = `Stage ${campaign.stage + 1}`;
    if (ui.campaignTarget) ui.campaignTarget.textContent = `Ziel: Welle ${stage.targetWave}`;
    if (ui.campaignTarget && stage.rewardCredits){
      ui.campaignTarget.textContent += ` | Bonus: +${stage.rewardCredits}C`;
    }
    if (ui.campaignProgress){
      const progress = Math.min(1, game.wave / stage.targetWave);
      ui.campaignProgress.style.width = `${Math.round(progress * 100)}%`;
    }
    if (ui.campaignHigh){
      ui.campaignHigh.textContent = `Highscore: ${highScore}`;
    }
    if (ui.streak){
      ui.streak.textContent = `Daily Streak: ${dailyStreak}`;
    }
  }

  function getSlotId(){
    return localStorage.getItem(SLOT_KEY) || "1";
  }

  function setSlotId(id){
    localStorage.setItem(SLOT_KEY, id);
  }

  function slotKey(id){
    return `${SAVE_KEY}.slot${id}`;
  }

  function populateSlots(){
    if (!ui.slotSelect) return;
    ui.slotSelect.innerHTML = "";
    for (let i = 1; i <= SLOT_COUNT; i++){
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `Slot ${i}`;
      ui.slotSelect.appendChild(opt);
    }
    ui.slotSelect.value = getSlotId();
    updateSlotPreview();
  }

  function ensureLegacyMigration(){
    const legacy = localStorage.getItem(SAVE_KEY);
    if (!legacy) return;
    const key = slotKey("1");
    if (!localStorage.getItem(key)){
      localStorage.setItem(key, legacy);
    }
  }

  function updateSlotPreview(){
    if (!ui.slotPreview) return;
    const key = slotKey(getSlotId());
    const raw = localStorage.getItem(key);
    if (!raw){
      ui.slotPreview.textContent = "Slot leer";
      return;
    }
    try{
      const data = JSON.parse(raw);
      const wave = data.wave ?? 0;
      const mapId = data.mapId || "-";
      const credits = data.money ?? 0;
      const lives = data.lives ?? 0;
      const kills = data.kills ?? 0;
      const savedAt = data.savedAt ? new Date(data.savedAt).toLocaleDateString("de-DE") : "-";
      ui.slotPreview.textContent = `Welle ${wave} | Map ${mapId} | C ${credits} | L ${lives} | K ${kills} | ${savedAt}`;
    }catch{
      ui.slotPreview.textContent = "Slot defekt";
    }
  }

  function loadScores(){
    try{
      const raw = localStorage.getItem(HIGHSCORES_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    }catch{
      return [];
    }
  }

  function loadDailyScores(){
    try{
      const raw = localStorage.getItem(DAILY_SCORES_KEY);
      const data = raw ? JSON.parse(raw) : {};
      return typeof data === "object" && data ? data : {};
    }catch{
      return {};
    }
  }

  function saveDailyScores(){
    localStorage.setItem(DAILY_SCORES_KEY, JSON.stringify(dailyScores));
  }

  function saveScores(){
    localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(scores.slice(0, 5)));
  }

  function updateScoresUI(){
    if (!ui.scores) return;
    ui.scores.innerHTML = "";
    const items = scores.slice(0, 5);
    if (!items.length){
      const li = document.createElement("li");
      li.textContent = "keine runs";
      ui.scores.appendChild(li);
      return;
    }
    items.forEach((entry, idx) => {
      const li = document.createElement("li");
      const left = document.createElement("span");
      const right = document.createElement("span");
      left.textContent = `#${idx + 1} W${entry.wave}`;
      right.textContent = `${entry.kills}K`;
      li.appendChild(left);
      li.appendChild(right);
      ui.scores.appendChild(li);
    });
  }

  function updateDailyScoresUI(){
    if (!ui.dailyScores) return;
    ui.dailyScores.innerHTML = "";
    const list = dailyScores[dailySeed] || [];
    if (!list.length){
      const li = document.createElement("li");
      li.textContent = "keine runs";
      ui.dailyScores.appendChild(li);
      return;
    }
    list.slice(0, 5).forEach((entry, idx) => {
      const li = document.createElement("li");
      const left = document.createElement("span");
      const right = document.createElement("span");
      left.textContent = `#${idx + 1} W${entry.wave}`;
      right.textContent = `${entry.kills}K`;
      li.appendChild(left);
      li.appendChild(right);
      ui.dailyScores.appendChild(li);
    });
  }

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
    const stats = {
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
      empTime: base.empTime,
      armorPierce: 0
    };
    if (tower.path){
      const branches = towerBranches[tower.type] || [];
      const branch = branches.find((b) => b.id === tower.path);
      if (branch){
        if (tower.level >= 2) applyStatMods(stats, branch.level2);
        if (tower.level >= 3) applyStatMods(stats, branch.level3);
      }
    }
    return stats;
  }

  function nextUpgradeCost(tower){
    if (tower.level >= 3) return null;
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
    updateCampaignUI();
  }

  function flashStatus(text){
    if (!ui.status) return;
    ui.status.textContent = text;
    ui.status.classList.remove("flash");
    void ui.status.offsetWidth;
    ui.status.classList.add("flash");
  }

  function triggerGlitch(){
    if (!ui.glitch) return;
    ui.glitch.classList.remove("active");
    void ui.glitch.offsetWidth;
    ui.glitch.classList.add("active");
    sfx.play("boss");
  }

  function applyStatMods(stats, mods){
    if (!mods) return;
    if (mods.range) stats.range *= mods.range;
    if (mods.damage) stats.damage *= mods.damage;
    if (mods.cooldown) stats.cooldown *= mods.cooldown;
    if (mods.slow) stats.slow = mods.slow;
    if (mods.slowTime) stats.slowTime *= mods.slowTime;
    if (mods.burnDps) stats.burnDps = (stats.burnDps || 0) + mods.burnDps;
    if (mods.burnTime) stats.burnTime = (stats.burnTime || 0) * mods.burnTime;
    if (mods.chain) stats.chain = (stats.chain || 0) + mods.chain;
    if (mods.chainRange) stats.chainRange = (stats.chainRange || 0) + mods.chainRange;
    if (mods.chainFalloff) stats.chainFalloff = Math.max(stats.chainFalloff || 0, mods.chainFalloff);
    if (mods.empTime) stats.empTime = (stats.empTime || 0) + mods.empTime;
    if (mods.armorPierce) stats.armorPierce += mods.armorPierce;
  }

  function buildWaveStats(wave){
    const stats = {
      basic: Math.round(6 + wave * 1.8),
      fast: Math.max(0, wave - 1),
      swarm: Math.max(0, Math.floor(wave / 2)),
      tank: Math.max(0, Math.floor((wave - 1) / 3)),
      shield: Math.max(0, Math.floor((wave - 2) / 2)),
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
      const branchLabel = getBranchLabel(selectedTower);
      const branchText = branchLabel ? ` ${branchLabel}` : "";
      ui.selected.textContent = `${towerTypes[selectedTower.type].label} L${selectedTower.level}${branchText}`;
      ui.upgrade.disabled = !cost || game.money < cost || (!selectedTower.path && selectedTower.level === 1);
      ui.sell.disabled = false;
      if (cost) ui.upgrade.textContent = `Upgrade (${cost})`;
    }else{
      ui.selected.textContent = "Kein Tower";
      ui.upgrade.disabled = true;
      ui.sell.disabled = true;
      ui.upgrade.textContent = "Upgrade";
    }
    updateBranchUI();
  }

  function getBranchLabel(tower){
    if (!tower.path) return "";
    const branches = towerBranches[tower.type] || [];
    const branch = branches.find((b) => b.id === tower.path);
    return branch ? `[${branch.name}]` : "";
  }

  function getBranchStyle(tower){
    if (!tower || !tower.path) return null;
    const branches = towerBranches[tower.type] || [];
    const branch = branches.find((b) => b.id === tower.path);
    return branch ? { color: branch.color, name: branch.name, icon: branch.icon || branch.name[0] } : null;
  }

  function updateBranchUI(){
    if (!ui.branchBox || !ui.branchA || !ui.branchB) return;
    if (!selectedTower || selectedTower.level !== 1 || selectedTower.path){
      ui.branchBox.hidden = true;
      return;
    }
    const branches = towerBranches[selectedTower.type] || [];
    if (branches.length < 2){
      ui.branchBox.hidden = true;
      return;
    }
    const cost = nextUpgradeCost(selectedTower) || 0;
    ui.branchBox.hidden = false;
    ui.branchA.textContent = `${branches[0].name} (${cost})`;
    ui.branchA.dataset.branch = branches[0].id;
    ui.branchA.dataset.tip = branches[0].desc;
    ui.branchB.textContent = `${branches[1].name} (${cost})`;
    ui.branchB.dataset.branch = branches[1].id;
    ui.branchB.dataset.tip = branches[1].desc;
    ui.branchA.disabled = game.money < cost;
    ui.branchB.disabled = game.money < cost;
  }

  function hashSeed(str){
    let h = 2166136261;
    for (let i = 0; i < str.length; i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function makeRng(seed){
    let state = seed >>> 0;
    return () => {
      state = Math.imul(1664525, state) + 1013904223;
      return ((state >>> 0) % 10000) / 10000;
    };
  }

  function getDailySeed(){
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function shuffleQueue(queue, wave){
    if (!dailyMode) return queue.sort(() => Math.random() - 0.5);
    const seed = hashSeed(`${dailySeed}:${wave}`);
    const rng = makeRng(seed);
    for (let i = queue.length - 1; i > 0; i--){
      const j = Math.floor(rng() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    return queue;
  }

  function startWave(){
    if (game.waveActive) return;
    game.wave += 1;
    game.summaryLock = false;
    const queue = buildWaveQueue(game.wave);
    game.spawner = { queue, index: 0, timer: 0 };
    game.waveActive = true;
    sfx.play("ui");
    updateHud(`Welle ${game.wave}`);
  }

  function buildWaveQueue(wave){
    const queue = [];
    const stats = buildWaveStats(wave);
    Object.keys(stats).forEach((type) => {
      for (let i = 0; i < stats[type]; i++) queue.push(type);
    });
    return shuffleQueue(queue, wave).slice(0, MAX_ENEMIES);
  }

  function spawnEnemyAt(type, x, y, pathIndex){
    const base = enemyTypes[type];
    const enemy = {
      type,
      x,
      y,
      hp: base.hp,
      maxHp: base.hp,
      speed: base.speed,
      reward: base.reward,
      pathIndex,
      slowTimer: 0,
      slowFactor: 1,
      burnTimer: 0,
      burnDps: 0,
      stunTimer: 0,
      bossSpawnTimer: type === "boss" ? 3.8 : 0,
      bossShieldTimer: type === "boss" ? 6 : 0,
      shieldTimer: 0,
      shieldWarn: 0
    };
    game.enemies.push(enemy);
    if (type === "boss"){
      triggerGlitch();
    }
  }

  function spawnEnemy(type){
    if (game.enemies.length >= MAX_ENEMIES) return;
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
      stunTimer: 0,
      bossSpawnTimer: type === "boss" ? 3.8 : 0,
      bossShieldTimer: type === "boss" ? 6 : 0,
      shieldTimer: 0,
      shieldWarn: 0
    };
    game.enemies.push(enemy);
    if (type === "boss"){
      triggerGlitch();
    }
  }

  function updateSpawner(dt){
    if (!game.spawner) return;
    if (game.enemies.length >= MAX_ENEMIES){
      game.spawner.timer = Math.max(game.spawner.timer, 0.25);
      return;
    }
    game.spawner.timer -= dt;
    if (game.spawner.timer > 0) return;
    if (game.spawner.index >= game.spawner.queue.length){
      game.spawner = null;
      return;
    }
    const type = game.spawner.queue[game.spawner.index];
    spawnEnemy(type);
    game.spawner.index += 1;
    const base = 0.7 - Math.min(0.35, game.wave * 0.02);
    game.spawner.timer = Math.max(0.32, base);
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
        killEnemy(enemy);
        continue;
      }
      if (enemy.type === "boss"){
        enemy.bossSpawnTimer -= dt;
        if (enemy.bossSpawnTimer <= 0){
          enemy.bossSpawnTimer = 4.2;
          spawnEnemyAt("swarm", enemy.x, enemy.y, enemy.pathIndex);
        }
        enemy.bossShieldTimer -= dt;
        if (enemy.bossShieldTimer <= 0){
          enemy.bossShieldTimer = 7.5;
          applyBossShield(enemy);
        }
        if (enemy.shieldTimer <= 0 && enemy.bossShieldTimer <= 1.1 && enemy.shieldWarn <= 0){
          enemy.shieldWarn = 0.8;
        }
      }
      if (enemy.shieldTimer > 0){
        enemy.shieldTimer -= dt;
      }
      if (enemy.shieldWarn > 0){
        enemy.shieldWarn -= dt;
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

  function applyDamage(enemy, damage, armorPierce = 0){
    const baseArmor = enemyTypes[enemy.type]?.armor || 0;
    const armor = Math.max(0, baseArmor - armorPierce);
    const shield = enemy.shieldTimer > 0 ? 0.35 : 0;
    const final = damage * (1 - armor) * (1 - shield);
    enemy.hp -= final;
  }

  function addShot(x1, y1, x2, y2, color){
    if (game.shots.length >= MAX_SHOTS) return;
    game.shots.push({ x1, y1, x2, y2, ttl: 0.12, color });
  }

  function killEnemy(enemy){
    const idx = game.enemies.indexOf(enemy);
    if (idx < 0) return;
    game.enemies.splice(idx, 1);
    game.money += enemyTypes[enemy.type].reward;
    game.kills += 1;
    sfx.play("hit");
  }

  function updateTowers(dt){
    for (const tower of game.towers){
      tower.cooldown -= dt;
      if (tower.cooldown > 0) continue;
      const stats = getTowerStats(tower);
      const target = findTarget(tower, stats);
      if (!target) continue;
      tower.cooldown = stats.cooldown;
      applyDamage(target, stats.damage, stats.armorPierce);
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
          applyDamage(enemy, stats.damage * stats.chainFalloff, stats.armorPierce);
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
        showWaveSummary();
        handleCampaignProgress();
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
      const branch = getBranchStyle(tower);
      if (branch && branch.color){
        ctx.strokeStyle = branch.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, 17, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.stroke();
      ctx.fillStyle = "#021008";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = branch ? branch.icon : tower.level.toString();
      ctx.fillText(label, tower.x, tower.y);
    }
  }

  function drawEnemies(){
    for (const enemy of game.enemies){
      const base = enemyTypes[enemy.type];
      ctx.fillStyle = base.color;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, 10, 0, Math.PI * 2);
      ctx.fill();
      if (enemy.shieldWarn > 0 && enemy.shieldTimer <= 0){
        const pulse = 0.5 + 0.5 * Math.sin(frameTime / 80);
        ctx.strokeStyle = `rgba(120,200,255,${0.2 + pulse * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (enemy.shieldTimer > 0){
        ctx.strokeStyle = "rgba(120,200,255,0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, 16, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (enemy.burnTimer > 0){
        ctx.strokeStyle = "rgba(255,200,100,0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, 12, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (enemy.stunTimer > 0){
        const pulse = 0.5 + 0.5 * Math.sin(frameTime / 120);
        ctx.strokeStyle = `rgba(120,255,255,${0.35 + pulse * 0.35})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, 14, 0, Math.PI * 2);
        ctx.stroke();
      }
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
      cooldown: 0,
      path: null
    });
    sfx.play("ui");
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
    if (!selectedTower.path && selectedTower.level === 1) return;
    game.money -= cost;
    selectedTower.level += 1;
    sfx.play("ui");
    updateSelection();
  }

  function chooseBranch(branchId){
    if (!selectedTower || selectedTower.path || selectedTower.level !== 1) return;
    const cost = nextUpgradeCost(selectedTower);
    if (!cost || game.money < cost) return;
    selectedTower.path = branchId;
    selectedTower.level += 1;
    game.money -= cost;
    sfx.play("ui");
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
      version: 6,
      money: game.money,
      lives: game.lives,
      wave: game.wave,
      mapId: game.mapId,
      kills: game.kills,
      savedAt: Date.now(),
      towers: game.towers.map((t) => ({
        type: t.type,
        gridX: t.gridX,
        gridY: t.gridY,
        level: t.level,
        cooldown: t.cooldown,
        path: t.path || null
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
    if (!data || (data.version !== 1 && data.version !== 2 && data.version !== 3 && data.version !== 4 && data.version !== 5 && data.version !== 6)) return false;
    const mapId = data.mapId || localStorage.getItem(MAP_KEY) || maps[0].id;
    setMap(mapId, { silent: true });
    game.money = data.money ?? 140;
    game.lives = data.lives ?? 20;
    game.wave = data.wave ?? 0;
    game.kills = data.kills ?? 0;
    game.lastSummaryWave = data.lastSummaryWave ?? data.wave ?? 0;
    game.towers = Array.isArray(data.towers) ? data.towers.map((t) => ({
      type: t.type,
      gridX: t.gridX,
      gridY: t.gridY,
      x: t.gridX * CELL + CELL / 2,
      y: t.gridY * CELL + CELL / 2,
      level: t.level ?? 1,
      cooldown: t.cooldown ?? 0,
      path: t.path ?? null
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
    if (game.waveActive){
      const emptyQueue = !game.spawner || !game.spawner.queue || game.spawner.queue.length === 0;
      if (emptyQueue && game.enemies.length === 0){
        game.waveActive = false;
        game.spawner = null;
      }
    }
    game.summaryLock = true;
    if (ui.summary) ui.summary.hidden = true;
    selectedTower = null;
    updateSelection();
    updateHud(game.waveActive ? `Welle ${game.wave}` : "Bereit");
    return true;
  }

  function saveGame(){
    try{
      const payload = serializeGame();
      const key = slotKey(getSlotId());
      localStorage.setItem(key, JSON.stringify(payload));
      updateSlotPreview();
    }catch (err){
      console.warn("save failed", err);
    }
  }

  function loadGame(){
    try{
      const key = slotKey(getSlotId());
      let raw = localStorage.getItem(key);
      if (!raw){
        ensureLegacyMigration();
        raw = localStorage.getItem(key);
      }
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
    flashStatus(`Quick Save S${getSlotId()}`);
  }

  function quickLoad(){
    const ok = loadGame();
    if (ok) applyAutoResume();
    flashStatus(ok ? `Quick Load S${getSlotId()}` : "Kein Save");
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
  if (ui.branchA){
    ui.branchA.addEventListener("click", () => {
      chooseBranch(ui.branchA.dataset.branch);
    });
  }
  if (ui.branchB){
    ui.branchB.addEventListener("click", () => {
      chooseBranch(ui.branchB.dataset.branch);
    });
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
      const key = slotKey(getSlotId());
      localStorage.removeItem(key);
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
      sfx.play("ui");
    });
  }

  if (ui.slotSelect){
    populateSlots();
    ui.slotSelect.addEventListener("change", () => {
      setSlotId(ui.slotSelect.value);
      flashStatus(`Slot ${ui.slotSelect.value}`);
      updateSlotPreview();
    });
  }
  if (ui.slotLoad){
    ui.slotLoad.addEventListener("click", () => {
      const ok = loadGame();
      if (ok) applyAutoResume();
      flashStatus(ok ? `Slot ${getSlotId()} geladen` : "Slot leer");
      updateSlotPreview();
    });
  }

  function setDailyMode(on){
    dailyMode = on;
    localStorage.setItem(DAILY_KEY, on ? "1" : "0");
    dailySeed = getDailySeed();
    localStorage.setItem(DAILY_DATE_KEY, dailySeed);
    if (ui.daily){
      ui.daily.textContent = on ? "Daily: ON" : "Daily Run";
      ui.daily.classList.toggle("sound-off", !on);
    }
    resetGame();
    flashStatus(on ? "Daily Mode" : "Daily aus");
    updateDailyScoresUI();
  }

  if (ui.daily){
    setDailyMode(dailyMode);
    ui.daily.addEventListener("click", () => {
      setDailyMode(!dailyMode);
      sfx.play("ui");
    });
  }

  function lockMaps(){
    if (!ui.mapSelect) return;
    const unlocked = campaign.stage + 1;
    const allowed = campaignStages.slice(0, unlocked).map((s) => s.mapId);
    Array.from(ui.mapSelect.options).forEach((opt) => {
      opt.disabled = !allowed.includes(opt.value);
    });
  }

  function handleCampaignProgress(){
    const stage = campaignStages[campaign.stage];
    if (!stage) return;
    if (game.wave >= stage.targetWave && campaign.stage < campaignStages.length - 1){
      campaign.stage += 1;
      if (stage.rewardCredits){
        game.money += stage.rewardCredits;
      }
      if (stage.rewardLives){
        game.lives += stage.rewardLives;
      }
      saveCampaign();
      lockMaps();
      updateCampaignUI();
      flashStatus("Stage freigeschaltet");
      sfx.play("ui");
    }else{
      updateCampaignUI();
    }
  }

  function showWaveSummary(){
    if (game.summaryLock || game.lastSummaryWave === game.wave) return;
    game.summaryLock = true;
    game.lastSummaryWave = game.wave;
    updateHighscore();
    recordScore();
    const bonus = recordDailyScore() || 0;
    summaryState = {
      kills: game.kills,
      bonus
    };
    animateSummary();
    if (ui.summary) ui.summary.hidden = false;
    sfx.play("ui");
  }

  function closeWaveSummary(){
    if (ui.summary){
      ui.summary.hidden = true;
      ui.summary.setAttribute("hidden", "");
    }
  }

  function animateSummary(){
    const from = { wave: 0, credits: 0, lives: 0, kills: 0, bonus: 0 };
    const to = {
      wave: game.wave,
      credits: game.money,
      lives: game.lives,
      kills: summaryState.kills,
      bonus: summaryState.bonus
    };
    const start = performance.now();
    const duration = 600;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      const wave = Math.round(from.wave + (to.wave - from.wave) * ease);
      const credits = Math.round(from.credits + (to.credits - from.credits) * ease);
      const lives = Math.round(from.lives + (to.lives - from.lives) * ease);
      const kills = Math.round(from.kills + (to.kills - from.kills) * ease);
      const bonus = Math.round(from.bonus + (to.bonus - from.bonus) * ease);
      if (ui.summaryWave) ui.summaryWave.textContent = `Welle ${wave}`;
      if (ui.summaryCredits) ui.summaryCredits.textContent = `Credits: ${credits}`;
      if (ui.summaryLives) ui.summaryLives.textContent = `Integritaet: ${lives}`;
      if (ui.summaryKills) ui.summaryKills.textContent = `Kills: ${kills}`;
      if (ui.summaryBonus) ui.summaryBonus.textContent = `Bonus: ${bonus}`;
      if (t === 1) sfx.play("ui");
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function recordScore(){
    const entry = {
      wave: game.wave,
      kills: game.kills,
      time: Date.now()
    };
    scores.push(entry);
    scores.sort((a, b) => b.wave - a.wave || b.kills - a.kills || a.time - b.time);
    scores = scores.slice(0, 5);
    saveScores();
    updateScoresUI();
  }

  function recordDailyScore(){
    if (!dailyMode) return 0;
    const list = dailyScores[dailySeed] || [];
    list.push({ wave: game.wave, kills: game.kills, time: Date.now() });
    list.sort((a, b) => b.wave - a.wave || b.kills - a.kills || a.time - b.time);
    dailyScores[dailySeed] = list.slice(0, 5);
    saveDailyScores();
    updateDailyScoresUI();
    return updateDailyStreak();
  }

  function updateDailyStreak(){
    const today = getDailySeed();
    if (dailyLast === today) return;
    let bonus = 0;
    if (!dailyLast){
      dailyStreak = 1;
      bonus = STREAK_BONUS;
    }else{
      const last = new Date(dailyLast);
      const current = new Date(today);
      const diffDays = Math.round((current - last) / 86400000);
      if (diffDays === 1){
        dailyStreak += 1;
        bonus = STREAK_BONUS;
      }else{
        dailyStreak = 1;
        bonus = STREAK_BONUS;
      }
    }
    dailyLast = today;
    localStorage.setItem(DAILY_STREAK_KEY, String(dailyStreak));
    localStorage.setItem(DAILY_LAST_KEY, dailyLast);
    updateCampaignUI();
    if (bonus){
      game.money += bonus;
    }
    return bonus;
  }

  function applyBossShield(enemy){
    enemy.shieldTimer = 2.2;
    enemy.shieldWarn = 0;
  }

  if (ui.summaryClose){
    ui.summaryClose.addEventListener("click", closeWaveSummary);
  }
  if (ui.summary){
    ui.summary.hidden = true;
    ui.summary.setAttribute("hidden", "");
    ui.summary.addEventListener("click", (e) => {
      if (e.target === ui.summary) closeWaveSummary();
    });
  }

  function updateHighscore(){
    if (game.wave > highScore){
      highScore = game.wave;
      localStorage.setItem(HIGHSCORE_KEY, String(highScore));
      updateCampaignUI();
    }
  }

  function openHelp(){
    if (!ui.helpModal) return;
    ui.helpModal.hidden = false;
    runTypewriter();
    sfx.play("ui");
  }

  function closeHelp(){
    if (!ui.helpModal) return;
    ui.helpModal.hidden = true;
  }

  if (ui.help){
    ui.help.addEventListener("click", openHelp);
  }
  if (ui.helpClose){
    ui.helpClose.addEventListener("click", closeHelp);
  }
  if (ui.helpModal){
    ui.helpModal.addEventListener("click", (e) => {
      const closeBtn = e.target.closest && e.target.closest("#training-help-close");
      if (closeBtn || e.target === ui.helpModal) closeHelp();
    });
  }

  function runTypewriter(){
    const line = ui.helpModal ? ui.helpModal.querySelector("[data-typewriter]") : null;
    if (!line) return;
    const full = line.dataset.fulltext || line.textContent;
    line.dataset.fulltext = full;
    line.textContent = "";
    let i = 0;
    const step = () => {
      if (i > full.length) return;
      line.textContent = full.slice(0, i);
      if (i % 2 === 0) sfx.play("type");
      i += 1;
      setTimeout(step, 35);
    };
    step();
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (ui.helpModal && !ui.helpModal.hidden){
      e.preventDefault();
      closeHelp();
    }
    if (ui.summary && !ui.summary.hidden){
      e.preventDefault();
      closeWaveSummary();
    }
  });

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

  document.addEventListener("pointerdown", () => {
    sfx.init();
    if (sfx.ctx && sfx.ctx.state === "suspended") sfx.ctx.resume();
  }, { once: true });

  function isSoundOn(){
    return localStorage.getItem(SOUND_KEY) !== "0";
  }

  function setSound(on){
    localStorage.setItem(SOUND_KEY, on ? "1" : "0");
    sfx.muted = !on;
    if (ui.sound){
      ui.sound.classList.toggle("sound-off", !on);
      ui.sound.textContent = on ? "Sound" : "Mute";
    }
  }

  if (ui.sound){
    setSound(isSoundOn());
    ui.sound.addEventListener("click", () => {
      setSound(!isSoundOn());
      sfx.play("ui");
    });
  }

  function loadMixer(){
    try{
      const raw = localStorage.getItem(MIXER_KEY);
      const data = raw ? JSON.parse(raw) : null;
      if (data && typeof data === "object"){
        sfx.volumes = { ...sfx.volumes, ...data };
      }
    }catch{
      return;
    }
  }

  function saveMixer(){
    localStorage.setItem(MIXER_KEY, JSON.stringify(sfx.volumes));
  }

  function bindMixer(){
    const sliders = document.querySelectorAll("[data-sfx]");
    sliders.forEach((input) => {
      const key = input.dataset.sfx;
      const value = Math.round((sfx.volumes[key] ?? 1) * 100);
      input.value = value.toString();
      input.addEventListener("input", () => {
        sfx.volumes[key] = Number(input.value) / 100;
        saveMixer();
      });
    });
  }

  let lastTime = null;
  let frameTime = 0;
  function loop(time){
    if (!lastTime) lastTime = time;
    const dt = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;
    frameTime = time;
    game.logicAccumulator += dt;
    while (game.logicAccumulator >= LOGIC_DT){
      updateGame(LOGIC_DT);
      game.logicAccumulator -= LOGIC_DT;
    }
    draw();
    requestAnimationFrame(loop);
  }

  loadGame();
  applyAutoResume();
  updateCampaignUI();
  lockMaps();
  loadMixer();
  bindMixer();
  updateScoresUI();
  updateDailyScoresUI();
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
