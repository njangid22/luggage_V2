const DESTS = ['DXB', 'JFK', 'LHR', 'SIN', 'NRT', 'CDG', 'LAX', 'ICN'];
const TINTS = ['#c45e2c', '#2e5fa1', '#5a6e3a', '#b8a472', '#5c3a7e'];
let seq = 100;
function makeBag() {
    seq++;
    return {
        tag: 'BC-' + seq,
        dest: DESTS[seq % DESTS.length],
        kg: (8 + (Math.random() * 24 | 0)) + 'kg',
        color: TINTS[seq % TINTS.length]
    };
}
const track = document.getElementById('track');
const bags = [];
let lastSpawn = 0;
const RENDER_BUFFER = 100;
function createBagElement(bag) {
    const el = document.createElement('div');
    el.className = 'bag';
    el.style.background = bag.color;
    el.style.left = (bag.x || 0) + 'px';
    el.innerHTML = bag.tag + '<br>' + bag.dest + '<br>' + bag.kg;
    el.addEventListener('mousedown', function (e) { grab(e, bag, el); });
    el.addEventListener('touchstart', function (e) { grab(e, bag, el); }, { passive: false });
    return el;
}
function spawn(now) {
    if (now - lastSpawn < 2200)
        return;
    lastSpawn = now;
    const bag = makeBag();
    bag.x = track.parentElement.clientWidth + 10;
    bag.visible = false;
    bags.push(bag);
}
function updateVisibility() {
    var _a;
    const viewportWidth = track.parentElement.clientWidth;
    for (let i = 0; i < bags.length; i++) {
        const bag = bags[i];
        const isVisible = (bag.x || 0) < viewportWidth + RENDER_BUFFER && (bag.x || 0) > -100;
        if (isVisible && !bag.visible) {
            bag.el = createBagElement(bag);
            track.appendChild(bag.el);
            bag.visible = true;
        }
        else if (!isVisible && bag.visible) {
            (_a = bag.el) === null || _a === void 0 ? void 0 : _a.remove();
            bag.el = undefined;
            bag.visible = false;
        }
    }
}
function move() {
    for (let i = 0; i < bags.length; i++) {
        bags[i].x = (bags[i].x || 0) - 1.2;
        if (bags[i].el)
            bags[i].el.style.left = bags[i].x + 'px';
    }
}
function despawn() {
    var _a;
    for (let i = bags.length - 1; i >= 0; i--) {
        if ((bags[i].x || 0) < -100) {
            (_a = bags[i].el) === null || _a === void 0 ? void 0 : _a.remove();
            bags.splice(i, 1);
        }
    }
}
function tick(now) {
    spawn(now);
    move();
    updateVisibility();
    despawn();
    requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
const grid = [
    [null, null, null],
    [null, null, null],
    [null, null, null]
];
const stack = [];
function buildGrid() {
    for (let r = 0; r < 3; r++) {
        const row = document.getElementById('r' + r);
        for (let c = 0; c < 3; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.r = String(r);
            cell.dataset.c = String(c);
            row.appendChild(cell);
        }
    }
}
function getCell(r, c) {
    return document.querySelector('.cell[data-r="' + r + '"][data-c="' + c + '"]');
}
function fillCell(r, c, bag) {
    grid[r][c] = bag;
    stack.push({ r, c, bag, ts: Date.now() });
    const el = getCell(r, c);
    if (el) {
        el.innerHTML = bag.tag + '<br>' + bag.dest + ' ' + bag.kg;
        el.className = 'cell filled';
        el.style.background = bag.color;
    }
}
function clearCell(r, c) {
    grid[r][c] = null;
    const el = getCell(r, c);
    if (el) {
        el.innerHTML = '';
        el.className = 'cell';
        el.style.background = '';
    }
}
buildGrid();
const logEl = document.getElementById('log');
document.getElementById('unload').addEventListener('click', function () {
    const live = stack.filter(e => grid[e.r][e.c]);
    if (!live.length) {
        logEl.textContent = 'Storage empty.';
        return;
    }
    const pri = live.filter(e => e.r === 0).sort((a, b) => b.ts - a.ts);
    const norm = live.filter(e => e.r !== 0).sort((a, b) => b.ts - a.ts);
    const order = pri.concat(norm);
    logEl.textContent = 'UNLOADING ' + order.map(e => e.bag.tag).join(' > ');
    order.forEach((entry, i) => {
        setTimeout(() => {
            const idx = stack.indexOf(entry);
            if (idx !== -1)
                stack.splice(idx, 1);
            clearCell(entry.r, entry.c);
        }, i * 250);
    });
});
const ghost = document.getElementById('ghost');
let drag = null;
function vibrate(pattern) {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
}
function grab(e, bag, el) {
    e.preventDefault();
    vibrate(20);
    const pt = e.touches ? e.touches[0] : e;
    ghost.style.background = bag.color;
    ghost.textContent = bag.tag;
    ghost.style.display = 'flex';
    ghost.style.left = (pt.clientX - 28) + 'px';
    ghost.style.top = (pt.clientY - 26) + 'px';
    ghost.style.transform = 'scale(1.1)';
    el.style.opacity = '0.25';
    el.style.transform = 'scale(0.9)';
    drag = {
        bag,
        el,
        startX: pt.clientX,
        startY: pt.clientY,
        startTime: Date.now()
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onDrop);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onDrop);
}
function onMove(e) {
    if (!drag)
        return;
    const ev = e;
    if (ev.preventDefault)
        ev.preventDefault();
    const pt = ev.touches ? ev.touches[0] : ev;
    ghost.style.left = (pt.clientX - 28) + 'px';
    ghost.style.top = (pt.clientY - 26) + 'px';
    const cells = document.querySelectorAll('.cell');
    for (let i = 0; i < cells.length; i++) {
        const r = +cells[i].dataset.r;
        const c = +cells[i].dataset.c;
        if (grid[r][c])
            continue;
        const b = cells[i].getBoundingClientRect();
        const hit = pt.clientX > b.left && pt.clientX < b.right && pt.clientY > b.top && pt.clientY < b.bottom;
        if (hit && !cells[i].classList.contains('over')) {
            vibrate(10);
            cells[i].classList.add('over');
        }
        else if (!hit && cells[i].classList.contains('over')) {
            cells[i].classList.remove('over');
        }
    }
}
function onDrop(e) {
    var _a;
    if (!drag)
        return;
    const ev = e;
    const pt = ev.changedTouches ? ev.changedTouches[0] : ev;
    const deltaX = pt.clientX - drag.startX;
    const deltaY = pt.clientY - drag.startY;
    const deltaTime = Date.now() - drag.startTime;
    const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / deltaTime;
    ghost.style.display = 'none';
    ghost.style.transform = 'scale(1)';
    drag.el.style.opacity = '1';
    drag.el.style.transform = 'scale(1)';
    let placed = false;
    const cells = document.querySelectorAll('.cell');
    for (let i = 0; i < cells.length; i++) {
        cells[i].classList.remove('over');
        const r = +cells[i].dataset.r;
        const c = +cells[i].dataset.c;
        if (grid[r][c])
            continue;
        const b = cells[i].getBoundingClientRect();
        if (pt.clientX > b.left && pt.clientX < b.right && pt.clientY > b.top && pt.clientY < b.bottom) {
            fillCell(r, c, drag.bag);
            const idx = bags.indexOf(drag.bag);
            if (idx !== -1) {
                (_a = bags[idx].el) === null || _a === void 0 ? void 0 : _a.remove();
                bags.splice(idx, 1);
            }
            logEl.textContent = drag.bag.tag + ' > ' + (r === 0 ? 'priority' : 'storage');
            placed = true;
            vibrate([15, 10, 15]);
            const filledCell = getCell(r, c);
            if (filledCell) {
                filledCell.style.animation = 'none';
                setTimeout(() => {
                    filledCell.style.animation = 'fillPulse 0.3s ease-out';
                }, 10);
            }
        }
    }
    if (!placed) {
        logEl.textContent = 'Drop on an empty cell.';
        vibrate(50);
    }
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onDrop);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onDrop);
    drag = null;
}
