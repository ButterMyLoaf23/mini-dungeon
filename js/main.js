// ---------- DOM helpers ----------
const $ = (id) => document.getElementById(id);

const el = {
  runMeta: $("uiRunMeta"),
  roomType: $("uiRoomType"),
  roomProgress: $("uiRoomProgress"),
  roomTitle: $("uiRoomTitle"),
  roomDesc: $("uiRoomDesc"),

  playerName: $("uiPlayerName"),
  playerHpText: $("uiPlayerHpText"),
  enemiesHpText: $("uiEnemiesHpText"),
  barPlayerHp: $("barPlayerHp"),
  barEnemiesHp: $("barEnemiesHp"),

  enemyList: $("uiEnemyList"),
  selTarget: $("selTarget"),

  uiClass: $("uiClass"),
  uiGold: $("uiGold"),
  uiPotions: $("uiPotions"),
  uiWeapon: $("uiWeapon"),
  uiStats: $("uiStats"),
  uiLevel: $("uiLevel"),
  uiXp: $("uiXp"),

  log: $("log"),

  // Setup
  name: $("name"),
  klass: $("klass"),
  boost: $("boost"),

  // Buttons
  btnStart: $("btnStart"),
  btnSave: $("btnSave"),
  btnLoad: $("btnLoad"),
  btnReset: $("btnReset"),

  btnAttack: $("btnAttack"),
  btnSpecial: $("btnSpecial"),
  btnPotion: $("btnPotion"),
  btnFlee: $("btnFlee"),

  btnLeft: $("btnLeft"),
  btnForward: $("btnForward"),
  btnRight: $("btnRight"),
  btnNextRoom: $("btnNextRoom"),

  // Level-up modal
  lvlOverlay: $("lvlOverlay"),
  btnLvlStr: $("btnLvlStr"),
  btnLvlDex: $("btnLvlDex"),
  btnLvlInt: $("btnLvlInt"),
  btnLvlCha: $("btnLvlCha"),
};

// ---------- RNG ----------
const d = (n) => Math.floor(Math.random() * n) + 1;
const d20 = () => d(20);
const d6 = () => d(6);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// ---------- Save/Load ----------
const SAVE_KEY = "miniDnD_save_v2";

// ---------- Game state ----------
const state = {
  started: false,
  runId: 0,
  roomIndex: 0,
  maxRooms: 15, // boss at final room
  room: null,

  player: null,
  enemies: [],
  awaitingNav: false,
  gameOver: false,

  levelUpPending: false,
  queuedLevelUps: 0,
};

// ---------- Logging ----------
function logLine(text, cssClass) {
  const div = document.createElement("div");
  div.textContent = text;
  if (cssClass) div.classList.add(cssClass);
  el.log.appendChild(div);
  el.log.scrollTop = el.log.scrollHeight;
}

// ---------- UI enable/disable ----------
function setActionButtons(enabled) {
  el.btnAttack.disabled = !enabled;
  el.btnSpecial.disabled = !enabled;
  el.btnPotion.disabled = !enabled;
  el.btnFlee.disabled = !enabled;
}

function setNavButtons(enabled) {
  el.btnLeft.disabled = !enabled;
  el.btnForward.disabled = !enabled;
  el.btnRight.disabled = !enabled;
  el.btnNextRoom.disabled = !enabled;
}

// ---------- Model ----------
function makePlayer(name, klass, boostStat) {
  const stats = { STR: 2, DEX: 2, INT: 2, CHA: 2 };
  stats[boostStat] += 2;

  const hpMax = 10 + stats.STR;
  const charges = klass === "Wizard" ? 3 : (klass === "Cleric" ? 2 : 0);

  return {
    name: name || "Hero",
    klass,
    stats,
    hp: hpMax,
    hpMax,
    charges,

    // inventory/loot
    gold: 0,
    potions: 1,
    weaponLevel: 0,

    // XP/Level
    level: 1,
    xp: 0,
    xpToNext: xpNeededForLevel(1),
  };
}

function makeEnemiesForRoom(roomIndex) {
  const isBossRoom = roomIndex === state.maxRooms;
  if (isBossRoom) {
    const hp = 30 + roomIndex * 2;
    return [{
      id: "boss",
      name: "Goblin King",
      hp,
      hpMax: hp,
      atkBonus: 3 + Math.floor(roomIndex / 3),
      isBoss: true,
    }];
  }

  const count = clamp(1 + Math.floor((roomIndex - 1) / 2), 1, 3);
  const enemies = [];
  for (let i = 0; i < count; i++) {
    const hp = 10 + roomIndex * 2 + (i * 2);
    enemies.push({
      id: `g${roomIndex}_${i}`,
      name: count === 1 ? "Goblin" : `Goblin ${i + 1}`,
      hp,
      hpMax: hp,
      atkBonus: Math.floor(roomIndex / 3),
      isBoss: false,
    });
  }
  return enemies;
}

function livingEnemies() {
  return state.enemies.filter(e => e.hp > 0);
}
function totalEnemyHp() {
  return state.enemies.reduce((sum, e) => sum + Math.max(0, e.hp), 0);
}
function totalEnemyHpMax() {
  return state.enemies.reduce((sum, e) => sum + e.hpMax, 0);
}

// ---------- Rooms ----------
function rollRoomType(roomIndex) {
  if (roomIndex === state.maxRooms) return "BOSS";
  const r = Math.random();
  if (r < 0.55) return "COMBAT";
  if (r < 0.72) return "TREASURE";
  if (r < 0.88) return "EVENT";
  return "REST";
}

function generateRoom(roomIndex, chosenDir) {
  const type = rollRoomType(roomIndex);
  if (type === "COMBAT") return { type, title: "Ambush!", desc: "Goblins leap from the shadows.", dir: chosenDir };
  if (type === "BOSS") return { type, title: "Throne Room", desc: "The Goblin King rises with a roar.", dir: chosenDir };
  if (type === "TREASURE") return { type, title: "Treasure Stash", desc: "A hidden cache behind loose stone.", dir: chosenDir };
  if (type === "REST") return { type, title: "Quiet Corner", desc: "You catch your breath and patch up.", dir: chosenDir };
  return { type, title: "Strange Happenings", desc: "Something unexpected happens…", dir: chosenDir };
}

// ---------- Targeting / enemy UI ----------
function updateTargets() {
  el.selTarget.innerHTML = "";
  const alive = livingEnemies();
  if (alive.length === 0) {
    el.selTarget.innerHTML = "<option>—</option>";
    el.selTarget.disabled = true;
    return;
  }
  el.selTarget.disabled = false;
  for (const e of alive) {
    const opt = document.createElement("option");
    opt.value = e.id;
    opt.textContent = `${e.name} (${e.hp}/${e.hpMax})${e.isBoss ? "" : ""}`;
    el.selTarget.appendChild(opt);
  }
}

function renderEnemyList() {
  el.enemyList.innerHTML = "";
  for (const e of state.enemies) {
    const row = document.createElement("div");
    row.className = "enemyCard";

    const left = document.createElement("div");
    left.className = "enemyName";
    left.textContent = e.name;

    if (e.isBoss) {
      const tag = document.createElement("span");
      tag.className = "bossTag";
      tag.textContent = "BOSS";
      left.appendChild(tag);
    }

    const right = document.createElement("div");
    right.className = "enemyHp";
    right.textContent = `${Math.max(0, e.hp)}/${e.hpMax}`;

    row.appendChild(left);
    row.appendChild(right);
    el.enemyList.appendChild(row);
  }
}

function setSpecialLabel() {
  const p = state.player;
  if (!p) { el.btnSpecial.textContent = "Special"; return; }
  if (p.klass === "Wizard") el.btnSpecial.textContent = "Cast Spell";
  else if (p.klass === "Cleric") el.btnSpecial.textContent = "Healing Prayer";
  else if (p.klass === "Rogue") el.btnSpecial.textContent = "Dodge";
  else el.btnSpecial.textContent = "Power Strike";
}

// ---------- XP / Leveling ----------
function xpNeededForLevel(level) {
  // XP to go from this level -> next
  // Level 1: 20, Level 2: 35, Level 3: 55, ...
  const L = Math.max(1, level);
  return Math.floor(20 + (L - 1) * 10 + (L - 1) * (L - 1) * 5);
}

function openLevelUpModal() {
  state.levelUpPending = true;
  setActionButtons(false);
  setNavButtons(false);
  el.lvlOverlay.classList.remove("hidden");
  el.lvlOverlay.setAttribute("aria-hidden", "false");
}

function closeLevelUpModal() {
  el.lvlOverlay.classList.add("hidden");
  el.lvlOverlay.setAttribute("aria-hidden", "true");
  state.levelUpPending = false;

  const inCombat = (state.room?.type === "COMBAT" || state.room?.type === "BOSS") && livingEnemies().length > 0;
  setActionButtons(inCombat && !state.gameOver);
  setNavButtons(state.awaitingNav && !state.gameOver);
}

function beginLevelUp() {
  if (!state.player) return;
  if (state.queuedLevelUps <= 0) return;
  openLevelUpModal();
}

function applyLevelChoice(statKey) {
  const p = state.player;
  if (!p || !state.levelUpPending) return;

  state.queuedLevelUps -= 1;

  p.level += 1;

  const hpGain = 4 + Math.floor(p.level / 2);
  p.hpMax += hpGain;
  p.hp = p.hpMax;

  p.stats[statKey] += 1;

  p.xpToNext = xpNeededForLevel(p.level);

  logLine(`LEVEL UP! You are now level ${p.level}.`, "loot");
  logLine(`You chose +1 ${statKey}. Max HP +${hpGain}.`, "loot");

  updateUI();

  if (state.queuedLevelUps > 0) beginLevelUp();
  else closeLevelUpModal();
}

function gainXp(amount) {
  const p = state.player;
  if (!p || state.gameOver) return;

  p.xp += amount;
  logLine(`You gain ${amount} XP.`);

  // Queue level-ups (supports multiple levels at once)
  while (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    state.queuedLevelUps += 1;
    // estimate next threshold for the queued levels (keeps UI sane)
    p.xpToNext = xpNeededForLevel((p.level || 1) + state.queuedLevelUps);
  }

  if (state.queuedLevelUps > 0 && !state.levelUpPending) beginLevelUp();
  updateUI();
}

// ---------- UI update ----------
function updateUI() {
  const p = state.player;

  el.runMeta.textContent = state.started ? `Run #${state.runId} • Room ${state.roomIndex}/${state.maxRooms}` : "Run: —";
  el.roomProgress.textContent = state.started ? `Room ${state.roomIndex} / ${state.maxRooms}` : "Room — / —";

  if (!p) {
    el.playerName.textContent = "—";
    el.playerHpText.textContent = "—";
    el.enemiesHpText.textContent = "—";
    el.uiClass.textContent = "—";
    el.uiGold.textContent = "—";
    el.uiPotions.textContent = "—";
    el.uiWeapon.textContent = "—";
    el.uiStats.textContent = "—";
    el.uiLevel.textContent = "—";
    el.uiXp.textContent = "—";

    el.roomType.textContent = "—";
    el.roomTitle.textContent = "Start a run";
    el.roomDesc.textContent = "Create your character and click Start.";

    el.barPlayerHp.style.width = "0%";
    el.barEnemiesHp.style.width = "0%";

    el.enemyList.innerHTML = "";
    el.selTarget.innerHTML = "<option>—</option>";
    el.selTarget.disabled = true;
    return;
  }

  el.playerName.textContent = p.name;
  el.playerHpText.textContent = `${p.hp}/${p.hpMax}`;
  el.enemiesHpText.textContent = `${totalEnemyHp()}/${totalEnemyHpMax()}`;

  el.uiClass.textContent = p.klass;
  el.uiGold.textContent = `${p.gold}g`;
  el.uiPotions.textContent = `${p.potions}`;
  el.uiWeapon.textContent = p.weaponLevel > 0 ? `+${p.weaponLevel} blade` : "Rusty";

  el.uiLevel.textContent = `${p.level}`;
  el.uiXp.textContent = `${p.xp}/${p.xpToNext}`;

  el.uiStats.textContent = `STR ${p.stats.STR} • DEX ${p.stats.DEX} • INT ${p.stats.INT} • CHA ${p.stats.CHA}`;

  const room = state.room;
  el.roomType.textContent = room ? room.type : "—";
  el.roomTitle.textContent = room ? room.title : "—";
  el.roomDesc.textContent = room ? room.desc : "—";

  const phpPct = (p.hpMax ? (p.hp / p.hpMax) : 0) * 100;
  el.barPlayerHp.style.width = `${clamp(phpPct, 0, 100)}%`;
  el.barPlayerHp.style.background = phpPct <= 25 ? "var(--bad)" : "var(--good)";

  const ehpMax = totalEnemyHpMax();
  const ehpPct = (ehpMax ? (totalEnemyHp() / ehpMax) : 0) * 100;
  el.barEnemiesHp.style.width = `${clamp(ehpPct, 0, 100)}%`;
  el.barEnemiesHp.style.background = ehpPct <= 25 ? "var(--bad)" : "var(--accent)";

  updateTargets();
  renderEnemyList();
  setSpecialLabel();
}

// ---------- Checks / mechanics ----------
function rollCheck(statKey, difficulty = 10) {
  const p = state.player;
  const roll = d20();
  const total = roll + p.stats[statKey];
  return { roll, total, success: total >= difficulty, difficulty };
}

function getTargetEnemy() {
  const id = el.selTarget.value;
  const alive = livingEnemies();
  if (!id) return alive[0] || null;
  return alive.find(e => e.id === id) || alive[0] || null;
}

function enemyTurn() {
  const p = state.player;
  const alive = livingEnemies();
  if (!p || alive.length === 0) return;

  for (const e of alive) {
    const roll = d20();
    const total = roll + e.atkBonus;
    const hit = total >= 10;

    if (hit) {
      const dmg = d6() + (e.isBoss ? 2 : 0);
      p.hp = clamp(p.hp - dmg, 0, p.hpMax);
      logLine(`${e.name}: d20(${roll})+${e.atkBonus}=${total} HIT • You take ${dmg}.`);
      el.barPlayerHp.classList.add("hit");
      setTimeout(() => el.barPlayerHp.classList.remove("hit"), 200);
    } else {
      logLine(`${e.name}: d20(${roll})+${e.atkBonus}=${total} MISS.`);
    }
    if (p.hp <= 0) break;
  }

  checkEndStates();
  updateUI();
}

function awardLoot() {
  const p = state.player;

  const gold = 4 + d6();
  p.gold += gold;

  const potionDrop = Math.random() < 0.25;
  const weaponDrop = Math.random() < 0.18;

  if (potionDrop) p.potions += 1;
  if (weaponDrop) p.weaponLevel = clamp(p.weaponLevel + 1, 0, 5);

  const parts = [`+${gold}g`];
  if (potionDrop) parts.push("+1 potion");
  if (weaponDrop) parts.push(`weapon +1 (now +${p.weaponLevel})`);
  logLine(`Loot: ${parts.join(", ")}.`, "loot");
}

function checkEndStates() {
  const p = state.player;
  if (!p) return;

  if (p.hp <= 0) {
    state.gameOver = true;
    setActionButtons(false);
    setNavButtons(false);
    logLine("You have no aura, no rizz, and no bitches. Game Over.");
    return;
  }

  if (livingEnemies().length === 0 && (state.room?.type === "COMBAT" || state.room?.type === "BOSS")) {
    setActionButtons(false);
    state.awaitingNav = true;

    // XP first, then loot
    const isBoss = state.room.type === "BOSS";
    gainXp(isBoss ? 50 : (10 + state.roomIndex));
    awardLoot();

    if (state.roomIndex === state.maxRooms) {
      state.gameOver = true;
      setNavButtons(false);
      logLine("The Goblin King is defeated. You win!");
      return;
    }

    logLine("Room cleared. Choose a direction to continue.");
    setNavButtons(true);
  }
}

// ---------- Room flow ----------
function enterRoom(dirLabel) {
  state.room = generateRoom(state.roomIndex, dirLabel);
  state.awaitingNav = false;
  setNavButtons(false);

  logLine(`\n— Room ${state.roomIndex}: ${state.room.title} —`);
  logLine(state.room.desc);

  if (state.room.type === "COMBAT" || state.room.type === "BOSS") {
    state.enemies = makeEnemiesForRoom(state.roomIndex);
    setActionButtons(true);
    updateUI();
    return;
  }

  setActionButtons(false);
  state.enemies = [];

  const p = state.player;

  if (state.room.type === "TREASURE") {
    awardLoot();
  } else if (state.room.type === "REST") {
    const heal = 4 + d6();
    p.hp = clamp(p.hp + heal, 0, p.hpMax);
    logLine(`You recover ${heal} HP.`);
  } else { // EVENT
    const r = Math.random();
    if (r < 0.33) {
      const dmg = 3 + d6();
      p.hp = clamp(p.hp - dmg, 0, p.hpMax);
      logLine(`⚠️ A trap snaps! You take ${dmg} damage.`);
    } else if (r < 0.66) {
      const gold = 3 + d6();
      p.gold += gold;
      logLine(`✨ You find scattered coins: +${gold}g.`);
    } else {
      p.potions += 1;
      logLine("You find a potion: +1 potion.");
    }
  }

  state.awaitingNav = true;
  setNavButtons(true);
  logLine("Pick a direction to continue.");
  updateUI();
}

function chooseDirection(dirLabel) {
  if (state.levelUpPending) return;
  if (!state.awaitingNav || state.gameOver) return;
  if (state.roomIndex >= state.maxRooms) return;

  state.roomIndex += 1;
  enterRoom(dirLabel);
}

// ---------- Player actions ----------
function doAttack() {
  if (state.levelUpPending) return;
  const p = state.player;
  const t = getTargetEnemy();
  if (!p || !t) return;

  const roll = d20();
  if (roll >= 10) {
    let dmg = d6() + p.stats.STR + p.weaponLevel;
    if (p.klass === "Fighter") dmg += 2;
    t.hp = clamp(t.hp - dmg, 0, t.hpMax);
    logLine(`Attack: d20(${roll}) HIT • ${t.name} takes ${dmg}.`);
    el.barEnemiesHp.classList.add("hit");
    setTimeout(() => el.barEnemiesHp.classList.remove("hit"), 200);
  } else {
    logLine(`Attack: d20(${roll}) MISS.`);
  }

  updateUI();
  if (livingEnemies().length > 0) enemyTurn();
  else checkEndStates();
}

function doSpecial() {
  if (state.levelUpPending) return;
  const p = state.player;
  if (!p) return;

  if (p.klass === "Wizard") {
    if (p.charges <= 0) { logLine("No spells left."); return; }
    p.charges -= 1;

    const t = getTargetEnemy();
    if (!t) return;

    const r = rollCheck("INT", 10);
    logLine(`Spell: d20(${r.roll})+${p.stats.INT}=${r.total} ${r.success ? "SUCCESS" : "FAIL"}`);
    if (r.success) {
      const dmg = 6 + p.stats.INT;
      t.hp = clamp(t.hp - dmg, 0, t.hpMax);
      logLine(`Spell hits ${t.name} for ${dmg}.`);
    } else {
      logLine("The spell fizzles.");
    }

    updateUI();
    if (livingEnemies().length > 0) enemyTurn();
    else checkEndStates();
    return;
  }

  if (p.klass === "Cleric") {
    if (p.charges <= 0) { logLine("No heals left."); return; }
    p.charges -= 1;

    const heal = d6() + 4;
    p.hp = clamp(p.hp + heal, 0, p.hpMax);
    logLine(`Your prayer heals you for ${heal}.`);
    updateUI();
    enemyTurn();
    return;
  }

  if (p.klass === "Rogue") {
    const r = rollCheck("DEX", 10);
    logLine(`Dodge: d20(${r.roll})+${p.stats.DEX}=${r.total} ${r.success ? "SUCCESS" : "FAIL"}`);
    if (r.success) {
      logLine("You dodge cleanly—enemies lose their next attacks.");
      updateUI();
      return; // skip enemy turn
    } else {
      logLine("You mistime the dodge!");
      updateUI();
      enemyTurn();
      return;
    }
  }

  // Power strike
  const t = getTargetEnemy();
  if (!t) return;

  const roll = d20();
  if (roll >= 8) {
    let dmg = d6() + p.stats.STR + p.weaponLevel + 3;
    if (p.klass === "Fighter") dmg += 1;
    t.hp = clamp(t.hp - dmg, 0, t.hpMax);
    logLine(`Power Strike: d20(${roll}) HIT • ${t.name} takes ${dmg}.`);
  } else {
    logLine(`Power Strike: d20(${roll}) FAIL • you overextend.`);
  }

  updateUI();
  if (livingEnemies().length > 0) enemyTurn();
  else checkEndStates();
}

function doPotion() {
  if (state.levelUpPending) return;
  const p = state.player;
  if (!p) return;
  if (p.potions <= 0) { logLine("No potions left."); return; }

  p.potions -= 1;
  const heal = d6() + 6;
  p.hp = clamp(p.hp + heal, 0, p.hpMax);
  logLine(`Potion heals you for ${heal}.`);
  updateUI();
  enemyTurn();
}

function doFlee() {
  if (state.levelUpPending) return;
  const p = state.player;
  if (!p) return;

  const r = rollCheck("DEX", p.klass === "Rogue" ? 10 : 11);
  logLine(`Flee: d20(${r.roll})+${p.stats.DEX}=${r.total} ${r.success ? "SUCCESS" : "FAIL"}`);

  if (r.success) {
    logLine("You escape the room (no XP/loot). Choose a new direction.");
    state.enemies.forEach(e => e.hp = 0);
    setActionButtons(false);
    state.awaitingNav = true;
    setNavButtons(true);
    updateUI();
    return;
  }

  logLine("You fail to escape!");
  updateUI();
  enemyTurn();
}

// ---------- Save / Load / Reset ----------
function resetGameUI() {
  el.log.innerHTML = "";
  setActionButtons(false);
  setNavButtons(false);
  updateUI();
}

function startRun() {
  resetGameUI();

  state.started = true;
  state.gameOver = false;
  state.awaitingNav = false;
  state.levelUpPending = false;
  state.queuedLevelUps = 0;

  state.runId += 1;
  state.player = makePlayer(el.name.value.trim(), el.klass.value, el.boost.value);

  state.roomIndex = 1;
  logLine(`Welcome, ${state.player.name} the ${state.player.klass}!`);
  logLine("You enter the dungeon…");

  enterRoom("START");
  updateUI();
}

function saveGame() {
  if (!state.started || !state.player) {
    logLine("Nothing to save yet.");
    return;
  }

  const payload = {
    ...state,
    logHtml: el.log.innerHTML,
  };

  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  logLine("Saved.");
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) { logLine("No save found."); return; }

  const payload = JSON.parse(raw);

  // restore state
  state.started = payload.started;
  state.runId = payload.runId;
  state.roomIndex = payload.roomIndex;
  state.maxRooms = payload.maxRooms;
  state.room = payload.room;

  state.player = payload.player;
  state.enemies = payload.enemies || [];
  state.awaitingNav = payload.awaitingNav;
  state.gameOver = payload.gameOver;

  // close modal on load (safe)
  state.levelUpPending = false;
  state.queuedLevelUps = payload.queuedLevelUps || 0;
  el.lvlOverlay.classList.add("hidden");
  el.lvlOverlay.setAttribute("aria-hidden", "true");

  // fix xpToNext if missing
  if (state.player && typeof state.player.xpToNext !== "number") {
    state.player.xpToNext = xpNeededForLevel(state.player.level || 1);
  }

  el.log.innerHTML = payload.logHtml || "";
  logLine("Loaded.");

  const inCombat = (state.room?.type === "COMBAT" || state.room?.type === "BOSS") && livingEnemies().length > 0;
  setActionButtons(inCombat && !state.gameOver);
  setNavButtons(state.awaitingNav && !state.gameOver);

  updateUI();
}

function resetAll() {
  state.started = false;
  state.roomIndex = 0;
  state.room = null;
  state.player = null;
  state.enemies = [];
  state.awaitingNav = false;
  state.gameOver = false;
  state.levelUpPending = false;
  state.queuedLevelUps = 0;

  el.lvlOverlay.classList.add("hidden");
  el.lvlOverlay.setAttribute("aria-hidden", "true");

  resetGameUI();
  logLine("Reset.");
}

// ---------- Events ----------
el.btnStart.addEventListener("click", startRun);
el.btnSave.addEventListener("click", saveGame);
el.btnLoad.addEventListener("click", loadGame);
el.btnReset.addEventListener("click", resetAll);

el.btnAttack.addEventListener("click", doAttack);
el.btnSpecial.addEventListener("click", doSpecial);
el.btnPotion.addEventListener("click", doPotion);
el.btnFlee.addEventListener("click", doFlee);

el.btnLeft.addEventListener("click", () => chooseDirection("LEFT"));
el.btnForward.addEventListener("click", () => chooseDirection("FORWARD"));
el.btnRight.addEventListener("click", () => chooseDirection("RIGHT"));
el.btnNextRoom.addEventListener("click", () => chooseDirection("CONTINUE"));

el.btnLvlStr.addEventListener("click", () => applyLevelChoice("STR"));
el.btnLvlDex.addEventListener("click", () => applyLevelChoice("DEX"));
el.btnLvlInt.addEventListener("click", () => applyLevelChoice("INT"));
el.btnLvlCha.addEventListener("click", () => applyLevelChoice("CHA"));

// Init
resetAll();
