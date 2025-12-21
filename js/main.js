// Utilities //
const $ = (id) => document.getElementById(id);
const logEl = $("log");

function logLine(text) {
    const p = document.createElement("div");
    p.textContent = text;
    logEl.appenedChild(p);
    logEl.scrollTop = logEl.scrollHeight;
}

function d(n) {return Math.floor(Math.random() * n) + 1;}
function d20() {return d(20);}
function d6() {return d(6);}

function clamp(n, min, max) {return Math.max(min, Math.min(max, n));}

// Game State//
const state = {
    started: false,
    player: null,
    enemy: null,
    encounter: 0,
    maxEncounters: 5,
    gameOver: false,
};

function makePlayer(name, klass, boostStat) {
    const stats = { STR: 2, DEX: 2, INT: 2, CHA: 2 };
    stats[boostStat] += 2;

    const hpMax = 10 + stats.STR;
    const charges = klass === "Wizard" ? 3 : (klass === "Cleric" ? 2:0);

    return {
        name: name || "Hero",
        klass,
        stats,
        hp: hpMax,
        hpMax,
        charges,
    };
}

function makeEnemy(encounterNum) {
    //scales with each encounter
    const hp = 8 + encounterNum * 2;
    const atkBonus = Math.floor(encounterNum / 2);
    return {
        name: Goblin,
        hp,
        hpMax: hp,
        atkBonus
    };
}

// UI Sync
function setButtonEnabled(enabled) {
    $("scoutBtn").disabled = !enabled;
    $("talkBtn").disabled = !enabled;
    $("attackBtn").disabled = !enabled;
    $("specialBtn").disabled = !enabled;
    $("inventoryBtn").disabled = !enabled;
    $("runBtn").disabled = !enabled;
}

function updateUI() {
    if (!state.player) {
        $("uiHp").textContent = "-";
        $("uiEnemyHp").textContent = "-";
        $("uiClass").textContent = "-";
        $("uiCharges").textContent = "-";
        $("uiStats").textContent = "-";
        // Will come back to this when I figure out inventory$
        // ("uiInventory").textContent = "-";
        return;
    }

    const p= state.player;
    $("uiHp").textContent = `${p.hp} /${p.hpMax}`;
    $("uiClass").textContent = p.klass;

    if (p.klass === "Wizard") $("uiCharges").textContent = `${p.charges} spells`;
    else if (p.klass === "Cleric") $("uiCharges").textContent = `${p.charges} heals`;
    else  $("uiCHarges").textContent = "-";

    const s = p.stats;
    $("uiStats").textContent = `STR ${s.STR} DEX ${s.DEX} INT ${s.INT} CHA ${s.CHA}`;
    
    if (state.enemy) $("uiEnemyHp").textContent = `${state.enemy.hp}/${state.enemy.hpMax}`;
    else $("uiEnemyHp").textContent = "-";
}

function setSpecialLabel() {
    const p = state.player;
    if (!p) return;
    if (p.klass === "Wizard") $("specialBtn").textContent = "Cast Spell (INT)";
    else if (p.klass === "Clerick") $("specialBtn").textContent = "Heal";
    else if (p.klass === "Rogue") $(specialBtn).textContent = "Dodge (DEX)";
    else $("specialBtn").textContent = "Power Strike";
}

// Core Mechanics
function rollCheck(statKey, difficulty =10) {
    const p = state.player;
    const roll = d20();
    const total = roll + p.stats[statKey];
    const success = total >= difficulty;
    return { roll, total, success, difficulty, statKey };
}

function enemyTurn() {
    if (!state.enemy || state.enemy.hp <= 0) return;
    const p = state.player;
    const e = state.enemy;

    // Enemy attacks player on +10
    const roll = d20()
    const total = roll + e.atkBonus;
    const hit = total >= 10;

    if(hit) {
        const dmg = d6();
        p.hp = clamp(p.hp - dmg, 0, p.hpMax);
        logLine(`Enemy attacks: d20(${roll}) + ${e.atkBonus} = ${total} HIT, You take ${dmg}.`);
    } else {
        logLine(`Enemy attacks: d20(${rolls}) + ${e.atkBonus} = ${total} MISS.`);
    }

    checkEndStates();
    updateUI();
}

function checkEndStates() {
    const p = state.player;
    const e = state.enemy;

    if (p.hp <= 0) {
        state.gameOver = true;
        setButtonEnabled(false);
        $("nextBtn").disabled = true;
        logLine("You have rizzed your last huzz 67 style.")
        return;
    }

    if (e && e.hp <= 0) {
        setButtonsEnabled(false);
        $("nextBtn").disabled = false;
        logLine("You have defeated the enemy!");
        if (state.encounter >= state.maxEncounters) {
            state.gameOver = true;
            $("nextBtn").disabled = true;
            logLine("Congratulations, you have completed the game!");
        } else {
            logLine("Press 'Next' to continue your journey.");
        }
    }    
}

function startEncounter() {
    state.encounter += 1;
    state.enemy = makeEnemy(state.encounter);
    $("nextBtn").disabled = true;
    logLine(`\n- Encounter ${state.encounter}/${state.maxEncounters}: A goblin is scaring the huzz! (${state.enemy.hp} HP) -`);
    updateUI();
}

// Player Actions
function doScout() {
    const r = rollCheck("DEX", 10);
    logLine(`Scout (DEX): d20(${r.roll}) + ${state.player.stats.DEX} = ${r.total} (${r.success ? "SUCCESS" : "FAIL"})`);
    if (r.success) {
        const bonus= 2;
        state.enemy.hp = clamp(state.enemy.hp - bonus, 0, state.enemy,hpMax);
        logLine(`You spot the goblin's weakspot dangling between his legs and strike it for ${bonus} damage.`);
        checkEndStates();
    } else {
        logLine("The ssound of you losing aura is deafining, the goblin smells negative aura type shit and strikes!");
        enemyTurn();
        return;
    }

    if (!state.gameOver && state.enemy.hp > 0) enemyTurn();
    updateUI();
}

function doTalk() {
    const r = rollCheck("CHA", 12);
    logLine(`Talk (CHA): d20(${r.roll}) + ${state.player.stats.CHA} = ${r.total} (${r.success ? "SUCCESS" : "FAIL"})`);
    if (r.success) {
        logLine("The goblin is rizzed by you, and loses aura");
    } else {
        logLine("The goblin shouts 'This nigga is without huzz' and attacks!");
        enemyTurn();
        return;
    }
    updateUI();
}

function doAttack() {
    const p = state.player;
    const roll = d20();
    const hit = roll >= 10;
    if (hit) {
        let dmg = d6();
        if (p.klass === "Fighter") dmg += 2;
        state.enemy.hp = clamp(state.enemy.hp - dmg, 0, state.enemy.hpMax);
        logLine(`Attack: d20(${roll}) HIT Damage ${dmg}.`);
        checkEndStates();
    } else {
        logLine(`Attack: d20(${roll}) MISS`);
    }
    if (!state.gameOver && state.enemy.hp > 0) enemyTurn();
    updateUI();
}

function doSpecial() {
    const p = state.player;
    if (p.klass === "Wizard") {
        if (p.charges <= 0 ) { logLine("No mana left."); return; }
        p.charges -= 1;

        const r = rollcheck("INT", 10);
        logLine(`Cast spell (INT): d20(${r.roll}) + ${p.stats.INT} = ${r.total} ${r.success ? "SUCCESS" : "FAIL"}`);

        if (r.success) {
            const dmg = 6 + p.stats.INT;
            state.enemy.hp = clamp(state.enemy.hp - dmg, 0, state.enemy.hpMax);
            logLine(`Your spell hits for ${dmg} damage!`);
            checkEndStates();
            if (!state.gameOver && state.enemy.hp > 0) enemyTurn();
        } else {
            logLine("The spell fizzles like your aura");
            enemyTurn();
        }
    }

    else if (p.klass === "Cleric") {
        if (p.charges <= 0) {
            logLine("No heals left nerd."); return;
        }
        p.charges -=1;

        const heal = d6() + 2;
        p.hp = clamp(p.hp +heal, 0, p.hpMax);
        logLine(`Heal restores ${heal} HP.`);
        enemyTurn();
    }

    else if (p.klass === "Rogue") {
        const r = rollCheck("DEX", 10);
        logLine(`Dodge (DEX): d20(${r.roll}) + ${p.stats.DEX} = ${r.total} ${r.success ? "SUCCESS" : "FAIL"}`);
        if (r.success) {
            logLine("You see past the goblin's attack");
        } else {
            logLine("You forgot to put in your contacts this morning and can't see his attack");
            enemyTurn();
            return;
        }
    }
    else{
        const roll = d20();
        if (roll >= 8) {
            let dmg = d6() + state.player.stats.STR + 3;
            state.enemy.hp = clamp(state.enemy.hp - dmg, 0, state.enemy.hpMax);
            logLine(`PowerStrike: d20(${roll}) HIT Damage ${dmg}.`);
            checkEndStates();
            if (!state.gameOver && state.enemy.hp > 0) enemyTurn();
        } else {
            logLine(`Power Strike:: d20(${roll}) FAIL You suck balls`);
            enemyTurn();
        }
    }

    updateUI();
}

function doRun() {
    const r = rollCheck("DEX", 11);
    logLine(`Run (DEX): d20(${roll}) + ${state.player.stats.DEX} = ${r.total} ${r.success ? "SUCCESS" : "FAIL" }`);
    if (r.success) {
        logLine("You managed to escape!");
        setButtonEnabled(false);
        $("nextBtn").disabled = false;

        state.enemy.hp = 0;
        checkEndStates();
    } else {
        logLine("You slip and fall on your ass");
        enemyTurn();
    }
    updateUI();
}

// Wiring
function resetGame() {
    state.started = false;
    state.player = null;
    state.enemy = null;
    state.encounter = 0;
    state.gameOver = false;
    logEl.innerHTML = "";
    setButtonEnabled(false);
    $("nextBtn").disabled = true;
    updateUI();
}

$("startBtn").addEventListener("click", () => {
    const name = $("name").value.trim();
    const klass = $("klass").value;
    const boost = $("boost").value;

    resetGame();
    state.player = makePlayer(name, klass, boost);
    state.started = true;

    setSpecialLabel();
    updateUI();

    logLine(`Welcome, ${state.player.name} the ${state.player.klass}!`);
    logLine(`Stats: STR ${state.player.stats.STR}, DEX ${state.player.stats.DEX}, INT ${state.player.stats.INT}, CHA ${state.player.stats.CHA}`);
    logLine(`HP: ${state.player.hp} / ${state.player.hpMax}`);
    if (state.player.charges > 0) logLine(`You have ${state.player.charges} ${klass === "Wizard" ? "spells" : "heals"}.`);
    startEncounter();
});

