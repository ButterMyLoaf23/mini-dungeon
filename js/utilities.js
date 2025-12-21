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
