// Utilities //
const $ = (id) => document.getElementById(id);

function randInt(min, max) {return Math.floor(Math.random() * (max - min + 1)) + min;}
function d20() {return randInt(1, 20);}
function d6() {return randInt(1, 6);}
function clamp(n, a, b) {return Math.max(a, Math.min(b, n));}

const Storage_Key = "Save v1"

// Game State//
const state = {
    runId: 0,
    roomIndex: 0,
    maxRooms: 10,
    room: null,
    started: false,
    player: null,
    enemies: [],
    merchantHere: false,
    gameOver: false,
};

function logLine(text, tone = "line") {
    const log = $("log");
    const div = document.createElement("div");
    div.className = `line ${tone}`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

function shake(el) {
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
}

function makePlayer(name, klass, boostStat) {
    const stats = { STR: 2, DEX: 2, INT: 2, CHA: 2 };
    stats[boostStat] += 2;

    const hpMax = 10 + stats.STR;
    const charges = (klass === "Wizard") ? 3 : (klass === "Cleric" ? 2:0);

    return {
        name: name || "Hero",
        klass,
        stats,
        hp: hpMax,
        hpMax,
        charges,
        gold: 0,
        potions: 1,
        weaponLevel: 0,
    };
}

function makeEnemyPack(roomIndex) {
    const bossRoom = roomIndex >= state.maxRooms;
    if (bossRoom) {
        const hp = 28;
        return [{
            name: "Goblin Chief",
            hp,
            hpMax: hp,
            atkBonus: 2,
            isBoss: true
        }];
    }

    const count = randInt(1, 3);
    const baseHp = 6 + Math.floor(roomIndex / 2);
    const atkBonus = Math.floor(roomIndex / 3);

    const enemies = [];
    for (let i = 0; i < count; i++) {
        const hp = baseHp + randInt(0, 3);
        enemies.push ({
            name: count === 1 ? "Goblin" : `Goblin ${i + 1}`,
            hp,
            hpMax: hp,
            atkBonus,
            isBoss: false
        });
    }    
    return enemies;
}

    function totalEnemyHp() {
        return state.enemies.reduce((sum, e) => sum + Math.max(0, e.hp), 0);
    }

    function totalEnemyHpMax() {
        return state.enemies.reduce((sum, e) => sum + e.hpMax, 0)
    }

    function livingEnemies() {
        return state.enemies.filter(e => e.hp > 0);
    }

    function currentRoomLabel (type) {
        const map = {
            start: "Start",
            combat: "Combat",
            treasure: "Treasure",
            trap: "Trap",
            merchant: "Merchant",
            rest: "Rest",
            boss: "Boss"
        };
        return map [type] || type;
    }

    function setSpecialLabel() {
        const p = state.player;
        if (!p) return;

        const btn = $(specialBtn);
        if (p.klass === "Wizard") btn.textContent = "Cast Spell";
        else if (p.klass === "Clerick") btn.textContent = "Heal";
        else if (p.klass === "Rogue") btn.textContent = "Dodge";
        else btn.textContent = "Power Strike";
    }

    function setControls({ roomChoices, combat, nextRoom, merchant }) {
        $("leftBtn").disabled = !roomChoices;
        $("forwardBtn").disabled = !roomChoices;
        $("rightBtn").disabled = !roomChoices;

        $("attackBtn").disabled = !combat;
        $("specialBtn").disabled = !combat;
        $("potionBtn").disabled = !combat;
        $("runBtn").disabled = !combat;

        $("nextRoomBtn").disabled = !nextRoom;

        $("buyPotionBtn").disabled = !merchant;
        $("buyUpgradeBtn").disabled = !merchant;
    }

    function updateUI() {
        const p = state.player;

        $("uiRunMeta").textContent = state.started ? `Run #${state.runId} Room ${state.roomIndex} / $state.maxRooms}` : "Run : -";

        if (!p) {
            $("uiPlayerName").textContent = "-";
            $("uiPlayerHp").textContent = "-";
            $("uiEnemiesHp").textContent = "-";
            $("uiEnemyCount").textContent = "-";
            $("uiClass").textContent = "-";
            $("uiRoomType").textContent = "-";
            $("uiRoomTitle").textContent = "-";
            $("uiRoomDesc").textContent = "-";

            $("uiGold").textContent = "-";
            $("uiPotions").textContent = "-";
            $("uiWeapons").textContent = "-";
            $("uiStats").textContent = "-";

            $("barPlayerHp").textContent = "-";
            $("barEnemiesHp").textContent = "-";
            $("uiEnemiesList").innerHTML = "";
        // Will come back to this when I figure out inventory$
        // ("uiInventory").textContent = "-";
        return;
    }

    $("uiPlayerName").textContent = p.name;
    $("uiPlayerHp").textContent = `${p.hp} / ${p.hpMax}`;
    $("uiClass").textContent = p.klass;

    $("uiGold").textContent = `${p.gold}g`;
    $("uiPotions").textContent = `{p.potions}`;
    $("uiWeapon").textContent = p.weaponLevel > 0 ? `+${p.weaponLevel} blade` : "Rusty";
    $("uiStats").textContent = `STR ${p.stats.STR}, DEX ${p.stats.DEX}, INT ${p.stats.INT}, CHA ${p.stats.CHA}`;

    const phpPct = (p.hpMax ? (p.hp / p.hpMax) : 0) * 100;
    $("barPlayerHp").style.width = `${clamp(phpPct, 0, 100)}%`;
    $("barPlayerHp").style.background = phpPct <= 25 ? "var(--bad)" : "var(--good)";

    if (state.room) {
        $("uiRoomType").textContent = currentRoomLabel(state.room.type);
        $("uiRoomtitle").textContent = state.room.title;
        $("uiRoomDesc").textContent = state.room.desc;
    } else {
        $("uiRoomType").textContent = "-";
        $("uiRoomTitle").textContent = "-";
        $("uiRoomDesc").textContent = "-";
    }

    const alive = livingEnemies();
    $("uiEnemyCount").textContent = alive.length ? `${alive.length} alive` : "0 alive";

    const ehp = totalEnemyHp();
    const ehpMax = totalEnemyHp();
    $("uiEnemiesHp").textContent = ehpMax ? `${ehp} / ${ehpMax}` : "-";

    const ehpPct = (ehpMax ? (ehp / ehpMax) : 0) * 100;
    $("barEnemiesHp").style.width = `${clamp(ehpPct, 0, 100)}%`;
    $("barEnemiesHp").style.background = state.room?.type === "boss" ? "var(--warn)" : "var(--accent)";


    const list = $("uiEnemiesList");
    list.innerHTML = "";
    for (const e of state.enemies) {
        const row = document.createElement("div");
        row.className = "enemy";
        row.innerHTML = `
        <div>
            <div class="enemy-name">
                ${e.name} ${e.isBoss ? "" : ""}
            </div>
            <div class="enemy-hp">
                HP: $${Math.max(0, e.hp)} / ${e.hpMax}
            </div>
            <div class="pill">
                ${e.hp > 0 ? "Alive" : "Down"}
            </div>
            `;
        list.appendChild(row);
    }

    const merchant = !!state.merchantHere;
    setControls({
        roomChoices: state.started && !state.gameOver && !merchant && !isInCombat() && !$(nextRoomBtn).disabled,
        combat: state.started && !state.gameOver && isInCombat(),
        nextRoom: state.started && !state.gameOver && !isInCombat(),
        merchant,
    });

    setSpecialLabel();
}

function isInCombat() {
    return state.room?.type === "combat" || state.room?.type === "boss";
}

function startRun() {
    const name = $("name").value.trim();
    const klass = $("klass").value;
    const boost = $("boost").value;

    state.runId += 1;
    state.started = true;
    state.gameOver = false;
    state.roomIndex = 0;
    state.room = null;
    state.enemies = [];
    state.merchantHere = false;
    state.player = makePlayer(name, klass, boost);

    $("log").innerHTML = "";
    logLine(`Welcome, ${state.player.name} the ${state.player.klass}!`, "info");
    logLine(`You step into a dark dungeon...`, "info");

    nextRoom("start");
}

function nextRoom(forcedType = null) {
    if (!state.started || state.gameOver) return;

    state.roomIndex += 1;
    state.merchantHere = false;
    state.enemies = [];

    if (state.roomIndex > state.maxRooms) {
        return;
    }

    let type;
    if (state.roomIndex === state.maxRooms) type = "boss";
    else type = forcedType || rollRoomType();

    state.room = makeRoom(type);
    logLine(`- Room ${state.roomIndex} / ${state.maxRooms}: ${state.room.title} -`, "info");
    logLine(state.room.desc);

    if (type === "combat" || type === "boss") {
        state.enemies = makeEnemyPack(state.roomIndex);
        logLine(type === "boss" ? "A boss blocks your path!" : "Enemies appear!", type === "boss" ? "warn" : "bad");
        setControls({ roomChoices: false, combat: true, nextRooms: false, merchant: false });
    } else if (type === "treasure") {
        resolveTresureRoom();
        setControls ({ roomChoices: true, combat: false, nextRoom: true, mechant: false });
    } else if (type === "trap") {
        resolveTrapRoom();
        setControls ({ roomChoices: true, combat: false, nextRoom: true, merchant: false });
    } else if (type === "merchant") {
        state.merchantHere = true;
        logLine("A merchant offers supplies.", "info");
        setControls ({ roomChoices: false, combat: false, nextRoom: true, merchant: true });
    } else if (type === "rest") {
        resolveRestRoom();
        setControls ({ roomChoices: true, combat: false, nextRoom: true, merchant: false });
    } else {
        setControls ({ roomChoices: true, comabt: false, nextRoom: true, merchant: false });
    }

    $("nextRoomBtn").disabled = false;
    updateUI();
}

function rollRoomType() {
    const roll = randInt(1, 100);
    if (roll <= 40) return "combat";
    if (roll <= 60) return "treasure";
    if (roll <= 75) return "trap";
    if (roll <= 88) return "merchant";
    return "rest";
}

function makeRoom(type) {
    const rooms = {
        start: { title: "Dungeon Entrance", desc: "Cold air pours from the stone hallway. Three paths branch ahead." },
        combat: { title: "Goblin Ambush", desc: "you hear chittering... shadows dart behind broken pillars." },
        treasure: { title: "Abandoned Cache", desc: "A cracked chest sits in the dust. Something glints inside." },
        trap: { title: "Trap Corridor", desc: "The floor tiles look... suspicious." },
        merchant: { title: "Hidden Merchant", desc: "A cloaked figure waves you closer. 'Gold for goods.'" },
        rest: { title: "Quiet Alcove", desc: "A rare calm. You can catch your breath here." },
        boss: { title: "Throne of Scraps", desc: "A hulking goblin chief rises from a pile of human remains." }
    };
    return { type, ...rooms[type] };
}

function resolveTreasureRoom() {
    const p = state.player;
    const gold = randInt(6, 18);
    p.gold += gold;

    const potionChance = randInt(1, 100);
    const weaponChance = randInt(1, 100);

    logLine(`You find ${gold} gold.`, "good");

    if (potionChance <= 25) {
        p.potions + 1;
        logLine(" You also found a potion (+1).", "good");
    }

    if (weaponChance <= 25) {
        p.weaponLevel += 1;
        logLine(`You found an upgrade for your sword! (Weapon +${p.weaponLevel})`, "good");
    }
}

function resolveTrapRoom() {
    const p = state.player;
    const roll = d20() + p.stats.DEX;
    if (roll >= 12) {
        logLine(`Trap check: You dodged it! (d20 + DEX = ${roll})`, "good");
    } else {
        const dmg = d6() + 1;
        p.hp = clamp(p.hp - dmg, 0, p.hpMax);
        logLine(`You fell for the trap! You take ${dmg} damage. (d20 + DEX = ${roll})`, "bad");
        shake($("barPlayerHp"));
        checkGameOver();
    }
}

function resolveRestRoom() {
    const p = state.player;
    const heal = randInt(2, 6) + Math.floor(p.stats.CHA / 2);
    p.hp = clamp(p.hp + heal, 0, p.hpMax);
    logLine(`You rest and recover ${heal} HP.`, "good");
}

function pickTarget() {
    return livingEnemies() [0] || null;
}

function attackDamageBase() {
    const p =state.player;
    return d6() + p.stats.STR + p.weaponLevel + (p.klass === "Fighter" ? 2 : 0);
}

function doAttack() {
    if (!isInCombat() || state.gameOver) return;

    const p = state.player;
    const target = pickTarget();
    if (!target) return;

    const roll = d20();
    const hit = roll >= 10;

    if (hit) {
        const dmg = attackDamageBase();
        target.hp = clamp(target.hp - dmg, 0, target.hpMax);
        logLine(`Attack: d20(${roll}) HIT ${target.name} takes ${dmg}.`, "good");
        shake($(barEnemiesHp));
    } else {
        logLine(`Attack: d20(${roll}) MISS.`, "warn");
    }

    endPlayerAction();
}

function doSpecial() {
    if (!isInCombat() || state.gameOver) return;
    const p = state.player;

    if (p.klass === "Wizard") {
        if (p.charges <= 0) {  
            logLine("No spells left.", "warn");
            return;
        }
        p.charges -= 1;

        const roll = d20() + p.stats.INT;
        if (roll >= 10) {
            const target = pickTarget();
            const dmg = 7 + p.stats.INT + p.weaponLevel;
            target.hp = clamp(target.hp - dmg, 0, target.hpMax);
            logLine(`Spell: (d20 + INT = ${roll}) FAIL it fizzles.`, "bad");
        }
        endPlayerAction();
        return;
    }

    if (p.klass === "Cleric") {
        if (p.charges <= 0) {
            logLine("No heals left.", "warn");
            return;
        }
        p.charges -= 1;

        const heal = d6() + 4;
        p.hp = clamp(p.hp + heal, 0, p.hpMax);
        logLine(`Heal restores ${heal} HP.`, "good");
        endPlayerAction();
        return;
    }

    if (p.klass === "Rogue") {
        const roll = d20() + p.stats.DEX + 2;
        if (roll >= 12) {
            logLine(`Dodge: (d20 + DEX = ${roll}) SUCCESS! You avoid the counterattack.`, "good");
            finishCombatIfDone();
            updateUI();
            return;
        } else {
            logLine(`Dodge: (d20 + DEX = ${roll}) FAIL! You can't dodge for shit.`, "bad");
            enemyTurn();
            finishCombatIfDone();
            updateUI();
            return;
        }
    }

    const roll = d20();
    if (roll >= 8) {
        const target = pickTarget();
        const dmg = attackDamageBase() + 3;
        target.hp = clamp(target.hp - dmg, 0, target.hpMax);
        logLine(`Power Strike: d20(${roll}) HIT! ${target.name} takes ${dmg}.`, "good");
        shake($(barEnemiesHp));
    } else {
        logLine(`Power Strike: d20(${roll}) FAIL! You didn't have your daily white monster all your energy is drained.`, "bad")
    }

    endPlayerAction();
}

function doPotion() {
    if (!isInCombat() || state.gameOver) return;
    const p = state.player;
    if (p.potions <= 0) {
        logLine("No potions left.", "warn");
        return;
    }

    p.potions -= 1;
    const heal = d6() = 6;
    p.hp = clamp(p.hp + heal, 0, p.hpMax);
    logLine(`You drink a potion and heal ${heal} HP.`, "good");
    endPlayerAction();
}

function doRunFromCombat() {
    if (!isInCombat() || state.gameOver) return;
    const p = state.player;
    const roll = d20() + p.stats.DEX;
    if (roll >= 12) {
        logLine(`Run: (d20 + DEX = ${roll}) SUCCESS! You escape the room!`, "good");
        state.enemies.forEach(e => e.hp = 0);
        finishCombatIfDone(true);
    } else{
        logLine(`Run: (d20 + DEX = ${roll}) FAIL! You slip on a comidically placed banana peel!`, "bad");
        enemyTurn();
        finishCombatIfDone();
    }
    updateUI();
}

function endPlayerAction() {
    enemyTurn();
    finishCombatIfDone();
    updateUI();
}

function enemyTurn() {
    const p = state.player;
    const alive = livingEnemies();
    if (!alive.length) return;

    for (const e of alive) {
        const roll = d20() + e.atkBonus;
        if (roll >= 10) {
            const dmg = d6() + (e.isBoss ? 2 : 0);
            p.hp = clamp(p.hp -dmg, 0, p.hpMax);
            logLine(`${e.name} attacks! (d20 + ${e.atkBonus} = ${roll}) HIT! You take ${dmg}.`, "bad");
            shake($(barPlayerHp));
            if (checkGameOver()) return;
        } else {
            logLine(`${e.name} attacks! (d20 + ${e.atkBonus} = ${roll}) MISS!`, "warn");
        }
    }
}

function finishCombatIfDone(ranAwayn= false) {
    const alive = livingEnemies();
    if(alive.length) return;

    if (state.room.type === "boss") {
        logLine("You defeated the Goblin Chief and cleared the dungeon!", "good");
        state.gameOver = true;
        setControls({ roomChoices: false, combat: false, nextRoom: false, merchant: false});
        $("nextRoomBtn").disabled = true;
        updateUI();
        return;
    }

    if (!ranAway) {
        const p = state.player;
        const gold = randInt (4, 12);
        p.gold += gold;
        if (randInt(1, 100) <= 35) p.potions += 1;

        logLine(`Combat loot: +${gold}g ${p.potions ? "" : ""}`, "good");
        if (randInt (1, 100) <= 35) {
            p.weaponLevel += 1;
            logLine(`you find a better blade! (weapon + ${p.weaponLevel})`, "good");
        }
    }

    logLine("Room cleared. Choose a path to continue.", "info");
    setControls({ roomChoices: true, combat: false, nextRoom: true, merchant: false});
    $(nextRoomBtn).disabled = false;
}

function checkGameOver() {
    const p = state.player;
    if (p.hp <= 0) {
        logLine("You fall to your knees huzzless losing all your aura. Game Over!", "bad");
        state.gameOver = true;
        setControls({ roomChoices: false, combat: false, nextRoom: false, merchant: false});
        $("nextRoomBtn").disabled = true;
        return true;
    }
    return false;
}

function buyPotion () {
    const p = state.player;
    if (!state.merchantHere) return;
    if (p,gold < 10) {logLine("Not enough gold for a potion (10g).", "warn"); return;}
    p.gold -= 10;
    p.potions += 1;
    logLine("You buy a potion (+1).", "good");
    updateUI();
}

function buyUpgrade() {
    const p = state.player;
    if (!state.merchantHere) return;
    if (p.gold < 25) {logLine("Not enough gold to upgrade weapon (25g).", "warn"); return;}
    p.gold -= 25;
    p.weaponLevel += 1;
    logLine(`Weapon upgrade! (Weapon + ${p.weaponLevel})`, "good");
    updateUI();
}

// Save/Load function
function serializedState() {
    return {
        runId: state.runId,
        started: state.started,
        gameOver: state.gameOver,
        roomIndex: state.roomIndex,
        maxRooms: state.maxRooms,
        room: state.room,
        maerchantHere: state.merchantHere,
        player: state.player,
        enemies: state.enemies,
        log: $("log").innerHTML
    };
}

function restoreState(snapshot) {
    state.runId = snapshot.runId ?? 0;
    state.started = !!snapshot.started;
    state.gameOver = !!snapshot.gameOver;
    state.roomIndex = snapshot.roomIndex ?? 0;
    state.maxRooms = snapshot.maxRooms ?? 10;
    state.room = snapshot.room ?? null;
    state.merchantHere = !!snapshot.merchantHere;
    state.player = snapshot.player ?? null;
    state.enemies = snapshot.enemies ?? [];
    $("log").innerHTML = snapshot.log ?? "";

    const inCombat = isInCombat();
    setControls({
        roomChoices: state.started && !state.gameOver && !state.merchantHere && !inCombat,
        combat: state.started && !state.gameOver && inCombat,
        nextRoom: state.started && !state.gameOver && !inCombat,
        merchant: state.started && !state.gameOver && state.merchantHere,
    });

    $("nextRoomBtn").disabled = !(state.started && !state.gameOver && !inCombat);
    setSpecialLabel();
    updateUI;
}

function saveGame() {
     try {
        localStorage.setItem(Storage_Key, JSON.stringify(serializeState()));
        logLine("Saved game to localStorage.", "info");
    } catch {
        logLine("Save failed (localStorage blocked?).", "bad");
    }
}

function loadGame() {
    try {
        const raw = localStorage.getItem(Storage_Key);
        if (!raw) { logLine("No save found.", "warn"); return; }
        restoreState(JSON.parse(raw));
        logLine("Loaded game from localStorage.", "info");
    } catch {
        logLine("Load failed (corrupt save).", "bad");
    }
}

function choosePath(dir) {
    if (!state.started || state.gameOver) return;
    if (isInCombat() || state.merchantHere) return;

    const p = state.player;

    let roll = d20();
    let mod = 0;

    if (dir === "left") mod = p.stats.INT;
    if (dir === "forward") mod = p.stats.STR;
    if (dir === "right") mod = p.stats.DEX;

    const total = roll + mod;
    logLine(`You go ${dir.toUpperCase()} (d20 + mod = ${total})`, "info");

    let forced = null;
    if (total >= 16) {
        forced = randInt(1, 100) <= 55 ? "treasure" : "rest";
        logLine("You find a safer route.", "good");
    } else if (total <= 8) {
        forced = randInt(1, 100) <= 55 ? "trap" : "combat";
        logLine("You stumble into danger.", "bad");
    }

    nextRoom(forced);
}

// init / events
function resetAll() {
    state.started = false;
    state.gameOver = false;
    state.roomIndex = 0;
    state.maxRooms = 10;
    state.room = null;
    state.enemies = [];
    state.merchantHere = false;
    state.player = null;

    $("log").innerHTML = "";
    setControls ({ roomChoices: false, combat: false, nextRoom: false, merchant: false});
    $("nextRoomBtn").disabled = true;
    updateUI();
}

document.addEventListener("DOMContentLoaded", () => {
    $("StartBtn").addEventListener("click", startRun);
    $("ResetBtn").addEventListener("click", resetAll);
    $("saveBtn").addEventListener("click", saveGame);
    $("loadBtn").addEventListener("click", loadGame);
    $("clearLogBtn").addEventListener("click", () => ($("log").innerHTML = ""));

    $("leftBtn").addEventListener("click", () => choosePath("left"));
    $("forwardBtn").addEventListener("click", () => choosePath("forward"));
    $("rightBtn").addEventListener("click", () => choosePath("right"));

    $("attackBtn").addEventListener("click", doAttack);
    $("specialBtn").addEventListener("click", doSpecial);
    $("potionBtn").addEventListener("click", doPotion);
    $("runBtn").addEventListener("click", doRunFromCombat);

    $("nextRoomBtn").addEventListener("click", () => {
        if (!state.started || state.gameOver) return;
        if (isInCombat()) return;
        if (state.merchatHere) return;
        nextRoom(null);
    });

    $("buyPotionBtn").addEventListener("click", buyPotion);
    $("buyUpgradeBtn").addEventListener("click", buyUpgrade);

    resetAll();
    logLine("Create a character and press Start Run.", "info");
});