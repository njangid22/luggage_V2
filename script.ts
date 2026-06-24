interface Bag {
    tag: string;
    dest: string;
    kg: string;
    color: string;
    x?: number;
    el?: HTMLElement;
    visible?: boolean;
}

const DESTS = ['DXB', 'JFK', 'LHR', 'SIN', 'NRT', 'CDG', 'LAX', 'ICN'];
const TINTS = ['#c45e2c', '#2e5fa1', '#5a6e3a', '#b8a472', '#5c3a7e'];
let seq = 100;

function makeBag(): Bag {
    seq++;
    return {
        tag: 'BC-' + seq,
        dest: DESTS[seq % DESTS.length],
        kg: (8 + (Math.random() * 24 | 0)) + 'kg',
        color: TINTS[seq % TINTS.length]
    };
}

const track = document.getElementById('track') as HTMLElement;
const bags: Bag[] = [];
let lastSpawn = 0;

// Virtual scrolling: only render bags within viewport + buffer
const RENDER_BUFFER = 100; // pixels

function createBagElement(bag: Bag): HTMLElement {
    const el = document.createElement('div');
    el.className = 'bag';
    el.style.background = bag.color;
    el.style.left = (bag.x || 0) + 'px';
    el.innerHTML = bag.tag + '<br>' + bag.dest + '<br>' + bag.kg;
    el.addEventListener('mousedown', function (e) { grab(e as MouseEvent, bag, el); });
    el.addEventListener('touchstart', function (e) { grab(e as TouchEvent, bag, el); }, { passive: false } as AddEventListenerOptions);
    return el;
}

function spawn(now: number) {
    if (now - lastSpawn < 2200) return;
    lastSpawn = now;

    const bag = makeBag();
    bag.x = (track.parentElement as HTMLElement).clientWidth + 10;
    bag.visible = false;

    bags.push(bag);
}

function updateVisibility() {
    const viewportWidth = (track.parentElement as HTMLElement).clientWidth;

    for (let i = 0; i < bags.length; i++) {
        const bag = bags[i];
        const isVisible = (bag.x || 0) < viewportWidth + RENDER_BUFFER && (bag.x || 0) > -100;

        if (isVisible && !bag.visible) {
            // Bag entered viewport - create element
            bag.el = createBagElement(bag);
            track.appendChild(bag.el);
            bag.visible = true;
        } else if (!isVisible && bag.visible) {
            // Bag left viewport - remove element
            bag.el?.remove();
            bag.el = undefined;
            bag.visible = false;
        }
    }
}

function move() {
    for (let i = 0; i < bags.length; i++) {
        bags[i].x = (bags[i].x || 0) - 1.2;
        if (bags[i].el) bags[i].el.style.left = bags[i].x + 'px';
    }
}

function despawn() {
    for (let i = bags.length - 1; i >= 0; i--) {
        if ((bags[i].x || 0) < -100) {
            bags[i].el?.remove();
            bags.splice(i, 1);
        }
    }
}

function tick(now: number) {
    spawn(now);
    move();
    updateVisibility();
    despawn();
    requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

const grid: (Bag | null)[][] = [
    [null, null, null],
    [null, null, null],
    [null, null, null]
];
const stack: { r: number; c: number; bag: Bag; ts: number }[] = [];

function buildGrid() {
    for (let r = 0; r < 3; r++) {
        const row = document.getElementById('r' + r) as HTMLElement;
        for (let c = 0; c < 3; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.r = String(r);
            cell.dataset.c = String(c);
            row.appendChild(cell);
        }
    }
}

function getCell(r: number, c: number) {
    return document.querySelector('.cell[data-r="' + r + '"][data-c="' + c + '"]') as HTMLElement | null;
}

function fillCell(r: number, c: number, bag: Bag) {
    grid[r][c] = bag;
    stack.push({ r, c, bag, ts: Date.now() });

    const el = getCell(r, c);
    if (el) {
        el.innerHTML = bag.tag + '<br>' + bag.dest + ' ' + bag.kg;
        el.className = 'cell filled';
        el.style.background = bag.color;
    }
}

function clearCell(r: number, c: number) {
    grid[r][c] = null;
    const el = getCell(r, c);
    if (el) {
        el.innerHTML = '';
        el.className = 'cell';
        el.style.background = '';
    }
}

buildGrid();

const logEl = document.getElementById('log') as HTMLElement;

document.getElementById('unload')!.addEventListener('click', function () {
    const live = stack.filter(e => grid[e.r][e.c]);
    if (!live.length) { logEl.textContent = 'Storage empty.'; return; }

    const pri = live.filter(e => e.r === 0).sort((a, b) => b.ts - a.ts);
    const norm = live.filter(e => e.r !== 0).sort((a, b) => b.ts - a.ts);
    const order = pri.concat(norm);

    logEl.textContent = 'UNLOADING ' + order.map(e => e.bag.tag).join(' > ');

    order.forEach((entry, i) => {
        setTimeout(() => {
            const idx = stack.indexOf(entry);
            if (idx !== -1) stack.splice(idx, 1);
            clearCell(entry.r, entry.c);
        }, i * 250);
    });
});

const ghost = document.getElementById('ghost') as HTMLElement;
let drag: { bag: Bag; el: HTMLElement; startX: number; startY: number; startTime: number } | null = null;

// Haptic feedback helper
function vibrate(pattern: number | number[]) {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
}

function grab(e: MouseEvent | TouchEvent, bag: Bag, el: HTMLElement) {
    e.preventDefault();
    vibrate(20); // Short haptic pulse on grab

    const pt = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : (e as MouseEvent);
    ghost.style.background = bag.color;
    ghost.textContent = bag.tag;
    ghost.style.display = 'flex';
    ghost.style.left = (pt.clientX - 28) + 'px';
    ghost.style.top = (pt.clientY - 26) + 'px';
    ghost.style.transform = 'scale(1.1)'; // Scale up on grab
    el.style.opacity = '0.25';
    el.style.transform = 'scale(0.9)'; // Scale down source

    drag = {
        bag,
        el,
        startX: pt.clientX,
        startY: pt.clientY,
        startTime: Date.now()
    };

    document.addEventListener('mousemove', onMove as EventListener);
    document.addEventListener('mouseup', onDrop as EventListener);
    document.addEventListener('touchmove', onMove as EventListener, { passive: false } as AddEventListenerOptions);
    document.addEventListener('touchend', onDrop as EventListener);
}

function onMove(e: Event) {
    if (!drag) return;
    const ev = e as MouseEvent | TouchEvent;
    if ((ev as any).preventDefault) (ev as any).preventDefault();
    const pt = (ev as TouchEvent).touches ? (ev as TouchEvent).touches[0] : (ev as MouseEvent);
    ghost.style.left = (pt.clientX - 28) + 'px';
    ghost.style.top = (pt.clientY - 26) + 'px';

    const cells = document.querySelectorAll<HTMLElement>('.cell');
    for (let i = 0; i < cells.length; i++) {
        const r = +cells[i].dataset.r!;
        const c = +cells[i].dataset.c!;
        if (grid[r][c]) continue;
        const b = cells[i].getBoundingClientRect();
        const hit = pt.clientX > b.left && pt.clientX < b.right && pt.clientY > b.top && pt.clientY < b.bottom;

        if (hit && !cells[i].classList.contains('over')) {
            vibrate(10); // Subtle pulse when hovering over valid cell
            cells[i].classList.add('over');
        } else if (!hit && cells[i].classList.contains('over')) {
            cells[i].classList.remove('over');
        }
    }
}

function onDrop(e: Event) {
    if (!drag) return;
    const ev = e as MouseEvent | TouchEvent;
    const pt = (ev as TouchEvent).changedTouches ? (ev as TouchEvent).changedTouches[0] : (ev as MouseEvent);

    // Calculate drag velocity for swipe detection
    const deltaX = pt.clientX - drag.startX;
    const deltaY = pt.clientY - drag.startY;
    const deltaTime = Date.now() - drag.startTime;
    const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / deltaTime;

    ghost.style.display = 'none';
    ghost.style.transform = 'scale(1)';
    drag.el.style.opacity = '1';
    drag.el.style.transform = 'scale(1)';

    let placed = false;
    const cells = document.querySelectorAll<HTMLElement>('.cell');
    for (let i = 0; i < cells.length; i++) {
        cells[i].classList.remove('over');
        const r = +cells[i].dataset.r!;
        const c = +cells[i].dataset.c!;
        if (grid[r][c]) continue;
        const b = cells[i].getBoundingClientRect();
        if (pt.clientX > b.left && pt.clientX < b.right && pt.clientY > b.top && pt.clientY < b.bottom) {
            fillCell(r, c, drag!.bag);
            const idx = bags.indexOf(drag!.bag);
            if (idx !== -1) { bags[idx].el?.remove(); bags.splice(idx, 1); }
            logEl.textContent = drag!.bag.tag + ' > ' + (r === 0 ? 'priority' : 'storage');
            placed = true;
            vibrate([15, 10, 15]); // Success haptic pattern

            // Animate cell fill
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
        vibrate(50); // Error haptic - longer pulse
    }

    document.removeEventListener('mousemove', onMove as EventListener);
    document.removeEventListener('mouseup', onDrop as EventListener);
    document.removeEventListener('touchmove', onMove as EventListener);
    document.removeEventListener('touchend', onDrop as EventListener);
    drag = null;
}
