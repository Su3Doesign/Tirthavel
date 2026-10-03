// The book: hand-drawn annotations, sketches and the little things that make it feel made by hand.
import rough from '../vendor/rough/rough.esm.js';

const PEN = '#233457', RED = '#a63a2b', PENCIL = '#6f665c', INK = '#2b241e', GOLD = '#b88a3e', MOSS = '#5f7a2e';
const NS = 'http://www.w3.org/2000/svg';
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// seeded randomness so the sketches look the same every visit
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const opt = (o = {}) => ({ roughness: 1.4, bowing: 1.2, stroke: INK, strokeWidth: 1.6, seed: Math.floor(rnd() * 1e6), ...o });

function text(svg, x, y, str, { size = 16, color = PEN, anchor = 'middle', rot = 0, font = 'Kalam', weight = 400 } = {}) {
  const t = document.createElementNS(NS, 'text');
  t.setAttribute('x', x); t.setAttribute('y', y);
  t.setAttribute('text-anchor', anchor);
  t.setAttribute('font-family', `${font}, cursive`);
  t.setAttribute('font-size', size);
  t.setAttribute('font-weight', weight);
  t.setAttribute('fill', color);
  if (rot) t.setAttribute('transform', `rotate(${rot} ${x} ${y})`);
  t.textContent = str;
  svg.appendChild(t);
  return t;
}
function add(svg, node) { svg.appendChild(node); return node; }

// draw-on animation for every rough path inside an element. it replays every time you scroll back.
function prepDraw(root) {
  for (const p of root.querySelectorAll('path')) {
    if (p.dataset.len) continue;
    let len = 0;
    try { len = p.getTotalLength(); } catch { len = 0; }
    if (!len || p.getAttribute('fill') && p.getAttribute('fill') !== 'none' && !p.getAttribute('stroke')) continue;
    p.dataset.len = len.toFixed(1);
    p.dataset.tr = `stroke-dashoffset ${Math.min(2.2, 0.5 + len / 600).toFixed(2)}s cubic-bezier(.5,.1,.3,1) ${(Math.random() * 0.35).toFixed(2)}s`;
    p.style.strokeDasharray = `${p.dataset.len} ${p.dataset.len}`;
    p.style.strokeDashoffset = p.dataset.len;
  }
}
function playDraw(root) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const p of root.querySelectorAll('path[data-len]')) { p.style.transition = p.dataset.tr; p.style.strokeDashoffset = 0; }
  }));
}
function resetDraw(root) {
  for (const p of root.querySelectorAll('path[data-len]')) { p.style.transition = 'none'; p.style.strokeDashoffset = p.dataset.len; }
}

// ------------------------------------------------------------------ reveal on scroll: in = play, out = rewind, so it plays again
const onShow = new WeakMap(), onHide = new WeakMap();
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const el = e.target;
    if (e.isIntersecting) {
      if (el.classList.contains('seen')) continue;
      el.classList.add('seen');
      playDraw(el);
      onShow.get(el)?.();
    } else if (el.classList.contains('seen')) {
      el.classList.remove('seen');
      resetDraw(el);
      onHide.get(el)?.();
    }
  }
}, { threshold: 0.12 });
function observe(el, show, hide) {
  if (show) onShow.set(el, show);
  if (hide) onHide.set(el, hide);
  io.observe(el);
}
// drawings are built just before they scroll into view, not all at page load
const builders = new Map();
const lazyIO = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const build = builders.get(e.target);
    builders.delete(e.target);
    lazyIO.unobserve(e.target);
    build?.();
  }
}, { rootMargin: '900px 0px' });
const queue = [];
function lazy(el, build) { builders.set(el, build); queue.push(el); lazyIO.observe(el); }
// and in quiet moments (never mid-scroll) the rest get built ahead of time, one small piece at a time
let lastScrollT = 0;
addEventListener('scroll', () => { lastScrollT = performance.now(); }, { passive: true });
const whenIdle = window.requestIdleCallback ? (cb) => requestIdleCallback(cb) : (cb) => setTimeout(() => cb({ timeRemaining: () => 10 }), 150);
function pump(deadline) {
  if (performance.now() - lastScrollT > 400) {
    while (queue.length && deadline.timeRemaining() > 6) {
      const el = queue.shift(), build = builders.get(el);
      if (!build) continue;
      builders.delete(el);
      lazyIO.unobserve(el);
      build();
    }
  }
  if (queue.length) whenIdle(pump);
}
const startPump = () => setTimeout(() => whenIdle(pump), 1200);
if (document.readyState === 'complete') startPump(); else addEventListener('load', startPump, { once: true });
// after building: prepare the strokes, and play at once if the thing is already on screen
function ready(svg, target = svg) {
  prepDraw(svg);
  if (target.classList.contains('seen')) playDraw(svg);
  observe(target);
}
const hash = (str) => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 99991, 7);

// ------------------------------------------------------------------ shapes I tried (chapter II)
function skyline(svg, rc, { towers = true } = {}) {
  add(svg, rc.line(4, 150, 216, 150, opt({ stroke: PENCIL, strokeWidth: 1.2 })));
  if (!towers) return;
  for (const [x, h] of [[14, 30], [26, 44], [38, 26], [176, 36], [188, 52], [200, 28], [208, 40]]) {
    add(svg, rc.line(x, 150, x, 150 - h, opt({ stroke: PENCIL, strokeWidth: 1.4, roughness: 0.8 })));
    add(svg, rc.line(x + 5, 150, x + 5, 150 - h, opt({ stroke: PENCIL, strokeWidth: 1.4, roughness: 0.8 })));
    add(svg, rc.polygon([[x - 2, 150 - h], [x + 2.5, 150 - h - 12], [x + 7, 150 - h]], opt({ stroke: PENCIL, strokeWidth: 1.1 })));
  }
}
const SHAPES = {
  arch(svg, rc) {
    add(svg, rc.path('M 76 150 L 76 80 A 34 34 0 0 1 144 80 L 144 150', opt({ strokeWidth: 2.4 })));
    add(svg, rc.path('M 92 150 L 92 84 A 18 18 0 0 1 128 84 L 128 150', opt({ strokeWidth: 1.6 })));
  },
  portal(svg, rc) {
    add(svg, rc.rectangle(72, 40, 76, 110, opt({ strokeWidth: 2.4, fill: 'rgba(43,36,30,.08)', fillStyle: 'hachure', hachureGap: 7 })));
    add(svg, rc.rectangle(94, 78, 32, 72, opt({ fill: '#ece3d2', fillStyle: 'solid', strokeWidth: 1.6 })));
  },
  obelisk(svg, rc) {
    add(svg, rc.polygon([[100, 150], [120, 150], [116, 40], [104, 40]], opt({ strokeWidth: 2.2, fill: 'rgba(43,36,30,.1)', fillStyle: 'hachure', hachureGap: 6 })));
    add(svg, rc.polygon([[104, 40], [110, 24], [116, 40]], opt({ strokeWidth: 1.8 })));
  },
  pyramid(svg, rc) {
    add(svg, rc.polygon([[56, 150], [110, 50], [164, 150]], opt({ strokeWidth: 2.2, fill: 'rgba(43,36,30,.08)', fillStyle: 'hachure', hachureGap: 8 })));
    add(svg, rc.rectangle(102, 118, 16, 32, opt({ fill: '#ece3d2', fillStyle: 'solid' })));
  },
  crescent(svg, rc) {
    add(svg, rc.path('M 128 32 A 52 52 0 1 0 128 138 A 40 40 0 1 1 128 32 Z', opt({ strokeWidth: 2.2, fill: 'rgba(43,36,30,.1)', fillStyle: 'hachure', hachureGap: 6 })));
  },
  twin(svg, rc) {
    add(svg, rc.circle(80, 96, 70, opt({ strokeWidth: 2.4 })));
    add(svg, rc.circle(140, 96, 70, opt({ strokeWidth: 2.4 })));
    add(svg, rc.circle(80, 96, 44, opt({ strokeWidth: 1.2 })));
    add(svg, rc.circle(140, 96, 44, opt({ strokeWidth: 1.2 })));
  },
  broken(svg, rc) {
    add(svg, rc.arc(110, 92, 110, 110, Math.PI * 0.62, Math.PI * 2.18, false, opt({ strokeWidth: 3.2 })));
    add(svg, rc.polygon([[150, 50], [160, 42], [164, 52]], opt({ strokeWidth: 1.4 })));
    add(svg, rc.polygon([[140, 146], [148, 140], [152, 148]], opt({ strokeWidth: 1.4 })));
  },
  ring(svg, rc) {
    add(svg, rc.arc(110, 90, 116, 116, Math.PI * 0.58, Math.PI * 2.42, false, opt({ strokeWidth: 3.4 })));
    add(svg, rc.arc(110, 90, 84, 84, Math.PI * 0.6, Math.PI * 2.4, false, opt({ strokeWidth: 1.4 })));
    for (let i = 0; i < 12; i++) {
      const a = Math.PI * (1.0 + i / 11);
      add(svg, rc.line(110 + Math.cos(a) * 14, 90 + Math.sin(a) * 14, 110 + Math.cos(a) * 40, 90 + Math.sin(a) * 40, opt({ strokeWidth: 0.9, roughness: 0.6 })));
    }
    add(svg, rc.circle(110, 90, 22, opt({ strokeWidth: 1.4 })));
    add(svg, rc.line(101, 100, 101, 150, opt({ strokeWidth: 1.6 })));
    add(svg, rc.line(119, 100, 119, 150, opt({ strokeWidth: 1.6 })));
    add(svg, rc.ellipse(110, 92, 200, 160, opt({ stroke: RED, strokeWidth: 2, roughness: 2.2 })));
  },
};
for (const svg of $$('svg[data-shape]')) lazy(svg, () => {
  seed = hash(svg.dataset.shape);
  const rc = rough.svg(svg);
  skyline(svg, rc);
  SHAPES[svg.dataset.shape]?.(svg, rc);
  ready(svg, svg.closest('.shape-card') || svg);
});

// ------------------------------------------------------------------ the mood board, sketched (the originals aren't mine to reprint)
const REF = {
  ring(svg, rc) {
    const cx = 150, cy = 168, T = Math.PI * 2;
    add(svg, rc.line(10, 330, 290, 330, opt({ stroke: PENCIL })));
    for (let i = 0; i < 14; i++) {                 // thorns around the upper rim
      const a = Math.PI + 0.25 + (i / 13) * (Math.PI - 0.5);
      add(svg, rc.line(cx + Math.cos(a) * 120, cy + Math.sin(a) * 120, cx + Math.cos(a) * 140, cy + Math.sin(a) * 140, opt({ strokeWidth: 1.4 })));
    }
    add(svg, rc.circle(cx, cy, 240, opt({ strokeWidth: 2.6, fill: 'rgba(234,220,191,.6)', fillStyle: 'solid' })));
    add(svg, rc.circle(cx, cy, 184, opt({ strokeWidth: 1.2 })));
    for (let i = 0; i < 24; i++) { const a = (i / 24) * T; add(svg, rc.circle(cx + Math.cos(a) * 106, cy + Math.sin(a) * 106, 13, opt({ strokeWidth: 0.8, roughness: 0.6 }))); }
    for (let i = 0; i < 24; i++) { const a = (i / 24) * T; if (a > 1.2 && a < 1.95) continue; add(svg, rc.line(cx + Math.cos(a) * 28, cy + Math.sin(a) * 28, cx + Math.cos(a) * 86, cy + Math.sin(a) * 86, opt({ strokeWidth: 0.8, roughness: 0.4 }))); }
    add(svg, rc.circle(cx, cy, 52, opt({ stroke: RED, strokeWidth: 1.4 })));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * T, e = rc.ellipse(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13, 18, 7, opt({ stroke: RED, strokeWidth: 0.9 }));
      e.setAttribute('transform', `rotate(${(a * 180) / Math.PI} ${cx + Math.cos(a) * 13} ${cy + Math.sin(a) * 13})`); add(svg, e); }
    add(svg, rc.rectangle(136, 198, 28, 132, opt({ strokeWidth: 1.8, fill: '#f3ecdd', fillStyle: 'solid' })));
    add(svg, rc.rectangle(58, 252, 52, 78, opt({ strokeWidth: 1.4, fill: 'rgba(111,102,92,.12)', fillStyle: 'hachure', hachureGap: 6, hachureAngle: 90 })));
    add(svg, rc.rectangle(190, 252, 52, 78, opt({ strokeWidth: 1.4, fill: 'rgba(111,102,92,.12)', fillStyle: 'hachure', hachureGap: 6, hachureAngle: 90 })));
  },
  city(svg, rc) {
    for (let i = 0; i < 5; i++) add(svg, rc.curve([[10, 312 + i * 14], [80, 306 + i * 14], [150, 316 + i * 14], [220, 306 + i * 14], [290, 312 + i * 14]], opt({ stroke: PEN, strokeWidth: 1, roughness: 0.8 })));
    for (const x of [60, 110, 190, 240]) add(svg, rc.line(x, 316, x, 360, opt({ stroke: PENCIL, strokeWidth: 0.8, strokeLineDash: [4, 6] })));
    [[16, 268, 268, 34], [40, 236, 220, 32], [66, 204, 168, 32], [94, 174, 112, 30]].forEach(([x, y, w, h]) =>
      add(svg, rc.rectangle(x, y, w, h, opt({ strokeWidth: 1.5, fill: 'rgba(111,102,92,.1)', fillStyle: 'hachure', hachureGap: 8, hachureAngle: 70 }))));
    const tower = (x, base, h, w = 12) => {
      add(svg, rc.rectangle(x - w / 2, base - h, w, h, opt({ strokeWidth: 1.3, fill: '#f3ecdd', fillStyle: 'solid' })));
      add(svg, rc.polygon([[x - w / 2 - 3, base - h], [x, base - h - w * 1.6], [x + w / 2 + 3, base - h]], opt({ stroke: RED, strokeWidth: 1.3, fill: 'rgba(166,58,43,.55)', fillStyle: 'hachure', hachureGap: 3 })));
    };
    for (const [x, b, h] of [[32, 268, 30], [262, 268, 26], [58, 236, 34], [244, 236, 30], [84, 204, 30], [218, 204, 34], [110, 174, 26], [192, 174, 28]]) tower(x, b, h);
    tower(150, 174, 82, 22);
    add(svg, rc.arc(118, 236, 34, 30, Math.PI, Math.PI * 2, false, opt({ strokeWidth: 1.3, fill: 'rgba(166,58,43,.3)', fillStyle: 'hachure', hachureGap: 4 })));
    add(svg, rc.arc(186, 268, 30, 26, Math.PI, Math.PI * 2, false, opt({ strokeWidth: 1.3, fill: 'rgba(166,58,43,.3)', fillStyle: 'hachure', hachureGap: 4 })));
  },
  mood(svg, rc) {
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; add(svg, rc.line(232 + Math.cos(a) * 30, 64 + Math.sin(a) * 30, 232 + Math.cos(a) * (40 + (i % 2) * 8), 64 + Math.sin(a) * (40 + (i % 2) * 8), opt({ stroke: GOLD, strokeWidth: 1.2 }))); }
    add(svg, rc.circle(232, 64, 52, opt({ stroke: INK, fill: INK, fillStyle: 'solid' })));
    add(svg, rc.polygon([[0, 380], [26, 290], [64, 252], [104, 236], [204, 236], [244, 258], [272, 300], [300, 380]], opt({ strokeWidth: 1.8, fill: 'rgba(43,36,30,.45)', fillStyle: 'hachure', hachureGap: 4, hachureAngle: 60 })));
    add(svg, rc.circle(150, 162, 150, opt({ strokeWidth: 2.6, fill: 'rgba(234,220,191,.75)', fillStyle: 'solid' })));
    add(svg, rc.circle(150, 162, 112, opt({ strokeWidth: 1.1 })));
    for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; if (a > 1.2 && a < 1.95) continue; add(svg, rc.line(150 + Math.cos(a) * 14, 162 + Math.sin(a) * 14, 150 + Math.cos(a) * 52, 162 + Math.sin(a) * 52, opt({ strokeWidth: 0.7, roughness: 0.4 }))); }
    add(svg, rc.rectangle(140, 180, 20, 56, opt({ strokeWidth: 1.6, fill: 'rgba(255,214,140,.7)', fillStyle: 'solid' })));
    add(svg, rc.rectangle(40, 214, 30, 24, opt({ strokeWidth: 1.4 })));
    add(svg, rc.curve([[46, 214], [50, 196], [60, 190], [66, 178]], opt({ strokeWidth: 1.6 })));
    text(svg, 32, 168, 'horse', { size: 15, color: RED, anchor: 'start', rot: -6 });
  },
  climb(svg, rc) {
    add(svg, rc.circle(150, 92, 128, opt({ strokeWidth: 2.6, fill: 'rgba(234,220,191,.7)', fillStyle: 'solid' })));
    add(svg, rc.circle(150, 92, 96, opt({ strokeWidth: 1 })));
    add(svg, rc.rectangle(141, 104, 18, 52, opt({ strokeWidth: 1.5, fill: '#f3ecdd', fillStyle: 'solid' })));
    add(svg, rc.curve([[0, 300], [60, 220], [110, 170], [150, 158], [190, 170], [240, 220], [300, 300]], opt({ stroke: PENCIL, strokeWidth: 1.2 })));
    add(svg, rc.line(128, 372, 144, 158, opt({ strokeWidth: 1.4 })));
    add(svg, rc.line(172, 372, 156, 158, opt({ strokeWidth: 1.4 })));
    for (let i = 0; i < 22; i++) { const t = i / 21, y = 372 - t * 214, hw = 22 - t * 16; add(svg, rc.line(150 - hw, y, 150 + hw, y, opt({ strokeWidth: 0.7, roughness: 0.3 }))); }
    const stupa = (x, y, s) => {
      add(svg, rc.rectangle(x - 9 * s, y - 6 * s, 18 * s, 6 * s, opt({ strokeWidth: 1.1 })));
      add(svg, rc.arc(x, y - 6 * s, 16 * s, 18 * s, Math.PI, Math.PI * 2, false, opt({ strokeWidth: 1.2, fill: 'rgba(184,138,62,.35)', fillStyle: 'hachure', hachureGap: 3 })));
      add(svg, rc.line(x, y - 15 * s, x, y - 27 * s, opt({ stroke: GOLD, strokeWidth: 1.3 })));
    };
    for (const [x, y, sc] of [[70, 350, 1.5], [230, 352, 1.5], [96, 300, 1.25], [204, 298, 1.25], [112, 250, 1], [188, 252, 1], [124, 206, 0.8], [176, 206, 0.8], [40, 300, 1.1], [262, 296, 1.1]]) stupa(x, y, sc);
  },
  moss(svg, rc) {
    add(svg, rc.line(0, 214, 400, 214, opt({ stroke: PENCIL })));
    const rocks = [[[20, 214], [40, 150], [110, 120], [170, 140], [190, 214]], [[150, 214], [180, 160], [250, 138], [320, 160], [340, 214]], [[300, 214], [320, 186], [370, 176], [396, 214]]];
    rocks.forEach((r) => add(svg, rc.polygon(r, opt({ strokeWidth: 1.8, fill: 'rgba(111,102,92,.22)', fillStyle: 'hachure', hachureGap: 5, hachureAngle: -40 }))));
    for (const [x, y, w, h] of [[95, 130, 110, 24], [250, 146, 120, 22], [360, 182, 50, 12], [56, 160, 30, 30]])
      add(svg, rc.ellipse(x, y, w, h, opt({ stroke: MOSS, fill: 'rgba(95,122,46,.75)', fillStyle: 'solid', roughness: 1.6 })));
    for (const x of [14, 30, 200, 214, 228, 350]) add(svg, rc.curve([[x, 214], [x - 4, 196], [x + 6, 184]], opt({ stroke: MOSS, strokeWidth: 1.6 })));
  },
};
for (const svg of $$('svg[data-ref]')) lazy(svg, () => {
  seed = 300 + hash(svg.dataset.ref);
  REF[svg.dataset.ref]?.(svg, rough.svg(svg));
  ready(svg, svg.closest('figure') || svg);
});

// ------------------------------------------------------------------ diagrams
const DIAGRAMS = {
  spikes(svg, rc) {
    add(svg, rc.line(10, 176, 510, 176, opt({ stroke: PENCIL })));
    seed = 42;
    for (let x = 20; x < 500; x += 13 + rnd() * 6) {
      if (x > 205 && x < 315) continue;
      const h = 40 + rnd() * 70;
      add(svg, rc.line(x, 176, x, 176 - h, opt({ stroke: PENCIL, strokeWidth: 1.2, roughness: 0.9 })));
      add(svg, rc.line(x + 6, 176, x + 6, 176 - h, opt({ stroke: PENCIL, strokeWidth: 1.2, roughness: 0.9 })));
      add(svg, rc.polygon([[x - 2, 176 - h], [x + 3, 176 - h - 16], [x + 8, 176 - h]], opt({ stroke: PENCIL, strokeWidth: 1 })));
    }
    add(svg, rc.circle(260, 98, 128, opt({ stroke: INK, strokeWidth: 3 })));
    add(svg, rc.line(254, 176, 254, 120, opt({ strokeWidth: 1.4 })));
    add(svg, rc.line(266, 176, 266, 120, opt({ strokeWidth: 1.4 })));
    add(svg, rc.curve([[420, 40], [380, 30], [338, 60], [322, 76]], opt({ stroke: RED, strokeWidth: 1.8 })));
    add(svg, rc.line(322, 76, 334, 72, opt({ stroke: RED, strokeWidth: 1.8 })));
    add(svg, rc.line(322, 76, 326, 64, opt({ stroke: RED, strokeWidth: 1.8 })));
    text(svg, 512, 30, 'your eye goes here', { color: RED, anchor: 'end', size: 17, rot: -3 });
  },
  time(svg, rc) {
    const cx = [52, 156, 260, 364, 468], cy = 82, r = 42;
    // Konark wheel
    add(svg, rc.circle(cx[0], cy, r * 2, opt({ strokeWidth: 2.2 })));
    add(svg, rc.circle(cx[0], cy, r * 1.7, opt({ strokeWidth: 1 })));
    add(svg, rc.circle(cx[0], cy, 14, opt({ strokeWidth: 1.6 })));
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      add(svg, rc.line(cx[0] + Math.cos(a) * 7, cy + Math.sin(a) * 7, cx[0] + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85, opt({ strokeWidth: i % 2 ? 0.8 : 2.2, roughness: 0.6 })));
    }
    // chakra, 24 spokes
    add(svg, rc.circle(cx[1], cy, r * 2, opt({ stroke: PEN, strokeWidth: 2 })));
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      add(svg, rc.line(cx[1], cy, cx[1] + Math.cos(a) * r, cy + Math.sin(a) * r, opt({ stroke: PEN, strokeWidth: 0.8, roughness: 0.5 })));
    }
    // sun cross
    add(svg, rc.circle(cx[2], cy, r * 1.3, opt({ strokeWidth: 2.2 })));
    add(svg, rc.line(cx[2], cy - r, cx[2], cy + r + 6, opt({ strokeWidth: 3 })));
    add(svg, rc.line(cx[2] - r * 0.8, cy, cx[2] + r * 0.8, cy, opt({ strokeWidth: 3 })));
    // rose window
    add(svg, rc.circle(cx[3], cy, r * 2, opt({ stroke: RED, strokeWidth: 2 })));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const g = rc.ellipse(cx[3] + Math.cos(a) * 20, cy + Math.sin(a) * 20, 30, 13, opt({ stroke: RED, strokeWidth: 1.1 }));
      g.setAttribute('transform', `rotate(${(a * 180) / Math.PI} ${cx[3] + Math.cos(a) * 20} ${cy + Math.sin(a) * 20})`);
      add(svg, g);
    }
    // zero
    add(svg, rc.ellipse(cx[4], cy, r * 1.3, r * 1.9, opt({ strokeWidth: 3 })));
    ['Konark wheel', 'chakra · 24', 'sun cross', 'rose window', 'zero'].forEach((s, i) => text(svg, cx[i], 168, s, { size: 15, color: i === 3 ? RED : PEN }));
  },
  frame(svg, rc) {
    add(svg, rc.circle(400, 52, 40, opt({ stroke: GOLD, strokeWidth: 2, fill: 'rgba(184,138,62,.25)', fillStyle: 'hachure', hachureGap: 5 })));
    for (const [x, y, w] of [[110, 50, 120], [300, 90, 150], [190, 120, 90]])
      add(svg, rc.ellipse(x, y, w, w * 0.32, opt({ stroke: PENCIL, strokeWidth: 1, fill: 'rgba(111,102,92,.12)', fillStyle: 'zigzag', hachureGap: 6 })));
    add(svg, rc.circle(260, 100, 150, opt({ strokeWidth: 3.2 })));
    add(svg, rc.circle(260, 100, 110, opt({ strokeWidth: 1.2 })));
    add(svg, rc.line(10, 182, 510, 182, opt({ stroke: PENCIL })));
    text(svg, 120, 176, 'sky inside the stone', { color: PEN, size: 16, rot: -2 });
    text(svg, 400, 110, 'whatever is behind it', { color: PEN, size: 15 });
    text(svg, 400, 128, 'becomes part of it', { color: PEN, size: 15 });
  },
  door(svg, rc) {
    add(svg, rc.arc(150, 92, 150, 150, Math.PI * 0.6, Math.PI * 2.4, false, opt({ strokeWidth: 3 })));
    add(svg, rc.rectangle(138, 104, 24, 64, opt({ strokeWidth: 1.6 })));
    text(svg, 150, 30, 'a door…', { size: 18 });
    arrow(svg, rc, 260, 92, 380, 92);
    add(svg, rc.circle(480, 92, 140, opt({ strokeWidth: 2.6 })));
    add(svg, rc.line(480, 92, 480, 44, opt({ strokeWidth: 2.4 })));
    add(svg, rc.line(480, 92, 520, 108, opt({ strokeWidth: 2.4 })));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      add(svg, rc.line(480 + Math.cos(a) * 60, 92 + Math.sin(a) * 60, 480 + Math.cos(a) * 66, 92 + Math.sin(a) * 66, opt({ strokeWidth: 1.2 })));
    }
    text(svg, 480, 22, '…inside a clock', { size: 18 });
    arrow(svg, rc, 590, 92, 710, 92);
    text(svg, 860, 104, 'somewhen.', { size: 46, color: RED, font: 'Caveat', weight: 600, rot: -3 });
    add(svg, rc.line(760, 120, 960, 114, opt({ stroke: RED, strokeWidth: 2 })));
  },
  section(svg, rc) {
    const sea = 322, tops = [16, 44, 72, 100, 130], half = [312, 250, 194, 150, 122];
    seed = 9;
    for (let x = 0; x < 700; x += 26) add(svg, rc.arc(x + 13, sea + 6, 26, 10, Math.PI, Math.PI * 2, false, opt({ stroke: PEN, strokeWidth: 1, roughness: 0.8 })));
    tops.forEach((z, i) => {
      add(svg, rc.rectangle(350 - half[i], sea - z, half[i] * 2, z, opt({ stroke: INK, strokeWidth: 1.6, fill: 'rgba(111,102,92,.10)', fillStyle: 'hachure', hachureGap: 9, hachureAngle: 60 })));
      text(svg, 350 + half[i] + 8, sea - z + 14, `${z} m`, { anchor: 'start', size: 14, color: PENCIL });
    });
    // the stair, flight by flight, up the front (left)
    let zPrev = 0;
    tops.forEach((z, i) => {
      const x1 = 350 - half[i], x0 = x1 - (z - zPrev) * 1.3;
      add(svg, rc.line(x0, sea - zPrev, x1, sea - z, opt({ stroke: RED, strokeWidth: 2 })));
      zPrev = z;
    });
    add(svg, rc.circle(350, sea - 130 - 62, 156, opt({ strokeWidth: 3 })));
    add(svg, rc.line(343, sea - 130, 343, sea - 180, opt({ strokeWidth: 1.4 })));
    add(svg, rc.line(357, sea - 130, 357, sea - 180, opt({ strokeWidth: 1.4 })));
    text(svg, 60, sea - 8, 'the Lantern Sea', { size: 15, color: PEN, anchor: 'start' });
    text(svg, 120, 70, 'the Grand Stair', { size: 16, color: RED, rot: -6 });
    add(svg, rc.curve([[150, 80], [170, 120], [176, 170], [182, 232]], opt({ stroke: RED, strokeWidth: 1.2 })));
  },
  sightline(svg, rc) {
    const sea = 250;
    add(svg, rc.line(0, sea, 700, sea, opt({ stroke: PEN, strokeWidth: 1 })));
    add(svg, rc.path('M 0 252 L 0 214 C 30 205 70 205 110 224 L 140 250', opt({ strokeWidth: 1.8, fill: 'rgba(95,122,46,.15)', fillStyle: 'hachure', hachureGap: 6 })));
    add(svg, rc.circle(48, 200, 12, opt({ stroke: RED, strokeWidth: 2 })));
    text(svg, 48, 184, 'me, on the bluff', { size: 14, color: RED });
    const steps = [[400, 690, 236], [450, 690, 214], [500, 690, 190], [540, 690, 166], [570, 690, 140]];
    for (const [x0, x1, y] of steps) add(svg, rc.rectangle(x0, y, x1 - x0, sea - y, opt({ strokeWidth: 1.4, fill: 'rgba(111,102,92,.1)', fillStyle: 'hachure', hachureGap: 9 })));
    add(svg, rc.circle(625, 88, 104, opt({ strokeWidth: 3 })));
    add(svg, rc.line(48, 200, 600, 128, opt({ stroke: PEN, strokeWidth: 1.4, strokeLineDash: [8, 6] })));
    text(svg, 300, 150, 'line of sight', { size: 15, color: PEN, rot: -7.5 });
    // the 95 m tower that broke it
    add(svg, rc.rectangle(470, 70, 16, 144, opt({ stroke: RED, strokeWidth: 1.8 })));
    add(svg, rc.polygon([[466, 70], [478, 40], [490, 70]], opt({ stroke: RED, strokeWidth: 1.8 })));
    add(svg, rc.line(452, 50, 506, 130, opt({ stroke: RED, strokeWidth: 3 })));
    add(svg, rc.line(506, 50, 452, 130, opt({ stroke: RED, strokeWidth: 3 })));
    text(svg, 430, 32, '95 m tower', { size: 15, color: RED, anchor: 'end' });
    for (const x of [415, 432, 455, 515]) {
      add(svg, rc.rectangle(x, 196, 9, 40, opt({ strokeWidth: 1.2 })));
      add(svg, rc.polygon([[x - 2, 196], [x + 4.5, 182], [x + 11, 196]], opt({ strokeWidth: 1.2 })));
    }
    text(svg, 300, 236, '≤ 24 m, under the line ✓', { size: 15, color: PEN });
  },
  moss(svg, rc) {
    const top = [[60, 150], [250, 90], [420, 150], [230, 210]];
    add(svg, rc.polygon(top, opt({ strokeWidth: 2, fill: 'rgba(95,122,46,.55)', fillStyle: 'hachure', hachureGap: 4, fillWeight: 1.4 })));
    add(svg, rc.polygon([[60, 150], [230, 210], [230, 380], [60, 320]], opt({ strokeWidth: 2, fill: 'rgba(111,102,92,.15)', fillStyle: 'hachure', hachureGap: 8 })));
    add(svg, rc.polygon([[230, 210], [420, 150], [420, 320], [230, 380]], opt({ strokeWidth: 2, fill: 'rgba(111,102,92,.08)', fillStyle: 'cross-hatch', hachureGap: 12 })));
    add(svg, rc.line(140, 180, 140, 350, opt({ strokeWidth: 1.4 })));
    add(svg, rc.line(326, 180, 326, 350, opt({ strokeWidth: 1.4 })));
    for (const [x, y] of [[140, 200], [140, 260], [326, 230], [326, 300]])
      add(svg, rc.ellipse(x, y, 12, 30, opt({ stroke: MOSS, strokeWidth: 1, fill: 'rgba(95,122,46,.6)', fillStyle: 'solid' })));
    add(svg, rc.ellipse(300, 352, 70, 18, opt({ stroke: MOSS, fill: 'rgba(95,122,46,.5)', fillStyle: 'solid' })));
    text(svg, 250, 70, '1 · it faces the sky', { size: 17, color: PEN });
    text(svg, 30, 244, '2 · it sits', { size: 16, anchor: 'start', color: PEN });
    text(svg, 30, 262, 'in cracks', { size: 16, anchor: 'start', color: PEN });
    text(svg, 300, 402, '3 · low spots hold water', { size: 16, color: PEN });
    text(svg, 440, 238, '4 · patches,', { size: 16, anchor: 'end', color: RED, rot: -4 });
    text(svg, 440, 256, 'never a coat', { size: 16, anchor: 'end', color: RED, rot: -4 });
  },
};
function arrow(svg, rc, x1, y1, x2, y2, color = INK) {
  add(svg, rc.line(x1, y1, x2, y2, opt({ stroke: color, strokeWidth: 1.8 })));
  const a = Math.atan2(y2 - y1, x2 - x1);
  for (const s of [-1, 1]) add(svg, rc.line(x2, y2, x2 - Math.cos(a + s * 0.45) * 13, y2 - Math.sin(a + s * 0.45) * 13, opt({ stroke: color, strokeWidth: 1.8 })));
}
for (const svg of $$('svg[data-diagram]')) lazy(svg, () => {        // DIAGRAMS gets more entries further down; looked up at build time
  seed = hash(svg.dataset.diagram);
  DIAGRAMS[svg.dataset.diagram]?.(svg, rough.svg(svg));
  ready(svg);
});

// ------------------------------------------------------------------ annotated images
function annotate(fig) {
  const img = fig.querySelector('img');
  const items = JSON.parse(fig.dataset.annot);
  let layer = fig.querySelector('.annot-layer');
  if (!layer) { layer = document.createElement('div'); layer.className = 'annot-layer'; fig.appendChild(layer); }
  const draw = () => {
    layer.innerHTML = '';
    const w = img.clientWidth, h = img.clientHeight, ox = img.offsetLeft, oy = img.offsetTop;
    if (!w) return;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${fig.clientWidth} ${fig.clientHeight}`);
    layer.appendChild(svg);
    const rc = rough.svg(svg);
    seed = 11;
    items.forEach((it, i) => {
      const color = (it.cls || '').includes('red') ? RED : PEN;
      const tx = ox + (it.x / 100) * w, ty = oy + (it.y / 100) * h;
      const lab = document.createElement('div');
      lab.className = 'annot-label ' + (it.cls || '');
      lab.style.left = `${ox + (it.lx / 100) * w}px`;
      lab.style.top = `${oy + (it.ly / 100) * h}px`;
      lab.style.setProperty('--r', `${(rnd() - 0.5) * 4}deg`);
      lab.style.transitionDelay = `${0.2 + i * 0.12}s`;
      lab.innerHTML = it.t;
      layer.appendChild(lab);
      const lw = lab.offsetWidth, lh = lab.offsetHeight;
      const lx = ox + (it.lx / 100) * w + (it.lx < it.x ? lw : 0), ly = oy + (it.ly / 100) * h + lh / 2;
      const mx = (lx + tx) / 2 + (rnd() - 0.5) * 40, my = (ly + ty) / 2 - 20 - rnd() * 20;
      svg.appendChild(rc.curve([[lx, ly], [mx, my], [tx, ty]], opt({ stroke: color, strokeWidth: 1.5, roughness: 0.9 })));
      const a = Math.atan2(ty - my, tx - mx);
      for (const s of [-1, 1]) svg.appendChild(rc.line(tx, ty, tx - Math.cos(a + s * 0.5) * 10, ty - Math.sin(a + s * 0.5) * 10, opt({ stroke: color, strokeWidth: 1.5, roughness: 0.6 })));
      if (it.fig) {                       // a tiny me, to scale
        const fh = w * 0.0072, fx = tx + 3, fy = ty + 1, o = { stroke: RED, strokeWidth: 1.2, roughness: 0.2 };
        svg.appendChild(rc.circle(fx, fy - fh * 0.88, fh * 0.24, opt(o)));
        svg.appendChild(rc.line(fx, fy - fh * 0.76, fx, fy - fh * 0.38, opt(o)));
        svg.appendChild(rc.line(fx, fy - fh * 0.38, fx - fh * 0.14, fy, opt(o)));
        svg.appendChild(rc.line(fx, fy - fh * 0.38, fx + fh * 0.14, fy, opt(o)));
      }
    });
    prepDraw(svg);
    if (fig.classList.contains('seen')) playDraw(svg);
  };
  const go = () => { draw(); observe(fig); };
  img.complete ? go() : img.addEventListener('load', go, { once: true });
  addEventListener('resize', debounce(draw, 200));
}
$$('[data-annot]').forEach(annotate);

// kit sheets: a label under each building and tree
async function kitLabels(fig) {
  const names = JSON.parse(fig.dataset.kitNames || '{}');
  let rows = [];
  try { rows = (await (await fetch(fig.dataset.kit)).text()).trim().split('\n').map((l) => l.split(' ')); } catch { return; }
  const layer = document.createElement('div');
  layer.className = 'annot-layer';
  fig.appendChild(layer);
  rows.forEach(([key, fx], i) => {
    const lab = document.createElement('div');
    lab.className = 'annot-label';
    lab.style.left = `${parseFloat(fx) * 100}%`;
    lab.style.top = i % 2 ? '88%' : '93%';
    lab.style.setProperty('--r', `${(i % 3 - 1) * 2}deg`);
    lab.style.transitionDelay = `${0.1 + i * 0.08}s`;
    lab.textContent = names[key] || key;
    layer.appendChild(lab);
  });
  observe(fig);
}
$$('[data-kit]').forEach(kitLabels);

// red pencil circle around a phrase
for (const el of $$('[data-circle]')) {
  const svg = document.createElementNS(NS, 'svg');
  Object.assign(svg.style, { position: 'absolute', left: '-12%', top: '-30%', width: '124%', height: '160%', overflow: 'visible', pointerEvents: 'none' });
  svg.setAttribute('viewBox', '0 0 100 40');
  svg.setAttribute('preserveAspectRatio', 'none');
  el.appendChild(svg);
  svg.appendChild(rough.svg(svg).ellipse(50, 20, 96, 34, opt({ stroke: RED, strokeWidth: 1.4, roughness: 1.8 })));
  prepDraw(svg);
  observe(el);
}

// ------------------------------------------------------------------ interlude: echoes of the Mahabharata
const TAU = Math.PI * 2;
const { cos, sin } = Math;
const SK = 'Tiro Sanskrit';

// a moon at phase f (0 new → .5 full → 1 new), dark side shaded
function moonPhase(svg, rc, x, y, r, f) {
  const k = (1 - cos(TAU * f)) / 2, rx = r * Math.abs(1 - 2 * k);
  add(svg, rc.circle(x, y, r * 2, opt({ strokeWidth: 0.9, roughness: 0.4 })));
  if (k > 0.97) return;
  const wax = f < 0.5;
  const d = wax
    ? `M ${x} ${y - r} A ${r} ${r} 0 0 0 ${x} ${y + r} A ${rx} ${r} 0 0 ${k < 0.5 ? 0 : 1} ${x} ${y - r} Z`
    : `M ${x} ${y - r} A ${r} ${r} 0 0 1 ${x} ${y + r} A ${rx} ${r} 0 0 ${k < 0.5 ? 1 : 0} ${x} ${y - r} Z`;
  add(svg, rc.path(d, opt({ stroke: 'none', fill: INK, fillStyle: 'solid', roughness: 0.3 })));
}

// the chakravyuha: walls with alternating gaps, and the one way in
function drawVyuha(svg, rc, cx, cy, k = 1, labels = true) {
  const R = [200, 168, 136, 104, 72, 40].map((r) => r * k);
  const gap = (j) => (j % 2 ? -Math.PI / 2 : Math.PI / 2);
  R.forEach((r, j) => {
    const c = gap(j), hw = (20 * k) / r;
    add(svg, rc.arc(cx, cy, r * 2, r * 2, c + hw, c + TAU - hw, false, opt({ strokeWidth: (j ? 1.9 : 2.6) * Math.max(k, 0.7), roughness: 1.1 })));
    if (k > 0.6) for (let a = c + hw + 0.12; a < c + TAU - hw - 0.08; a += 0.19 + j * 0.03) {
      add(svg, rc.line(cx + cos(a) * (r - 4 * k), cy + sin(a) * (r - 4 * k), cx + cos(a) * (r + 5 * k), cy + sin(a) * (r + 5 * k), opt({ stroke: PENCIL, strokeWidth: 0.8, roughness: 0.5 })));
    }
  });
  // Abhimanyu's way in: bottom → left → top → right → bottom … → the centre
  const pts = [[cx, cy + R[0] + 40 * k]];
  for (let j = 0; j < R.length - 1; j++) {
    const m = (R[j] + R[j + 1]) / 2, a0 = gap(j), a1 = gap(j + 1);
    const from = j % 2 ? -Math.PI / 2 : Math.PI / 2, to = j % 2 ? Math.PI / 2 : Math.PI * 1.5;
    for (let s = 0; s <= 12; s++) { const a = from + (to - from) * (s / 12); pts.push([cx + cos(a) * m, cy + sin(a) * m]); }
    void a0; void a1;
  }
  pts.push([cx, cy]);
  add(svg, rc.curve(pts, opt({ stroke: RED, strokeWidth: 2.2 * Math.max(k, 0.6), roughness: 0.7 })));
  add(svg, rc.line(cx - 12 * k, cy - 12 * k, cx + 12 * k, cy + 12 * k, opt({ stroke: RED, strokeWidth: 3 * Math.max(k, 0.6) })));
  add(svg, rc.line(cx + 12 * k, cy - 12 * k, cx - 12 * k, cy + 12 * k, opt({ stroke: RED, strokeWidth: 3 * Math.max(k, 0.6) })));
  if (!labels) return;
  add(svg, rc.line(cx - 22, cy + R[0] - 2, cx + 22, cy + R[0] + 6, opt({ stroke: INK, strokeWidth: 4 })));
  text(svg, cx + 40, cy + R[0] + 34, 'Jayadratha shuts the gap', { anchor: 'start', size: 16, color: INK, rot: -3 });
  text(svg, cx - 30, cy + R[0] + 40, 'in →', { anchor: 'end', size: 18, color: RED });
  text(svg, cx, cy + 34, 'out?', { size: 17, color: RED });
  text(svg, 18, 30, "Drona's wheel", { anchor: 'start', size: 19, color: PEN, rot: -4 });
  text(svg, 18, 52, 'it turns. the walls are men.', { anchor: 'start', size: 15, color: PENCIL, rot: -4 });
}

const ECHO = {
  year(svg, rc) {
    const cx = 112, cy = 108, r = 74;
    add(svg, rc.circle(cx, cy, r * 2, opt({ strokeWidth: 2.4 })));
    add(svg, rc.circle(cx, cy, r * 1.72, opt({ strokeWidth: 1 })));
    add(svg, rc.circle(cx, cy, 20, opt({ strokeWidth: 1.6 })));
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; add(svg, rc.line(cx + cos(a) * 10, cy + sin(a) * 10, cx + cos(a) * r * 0.86, cy + sin(a) * r * 0.86, opt({ strokeWidth: 1.3, roughness: 0.7 }))); }
    for (let i = 0; i < 6; i++) {           // six boys turning it
      const a = (i / 6) * TAU, x = cx + cos(a) * (r + 15), y = cy + sin(a) * (r + 15);
      add(svg, rc.circle(x, y, 9, opt({ stroke: PEN, strokeWidth: 1.3, fill: 'rgba(35,52,87,.25)', fillStyle: 'solid' })));
      add(svg, rc.line(x, y, x - sin(a) * 14, y + cos(a) * 14, opt({ stroke: PEN, strokeWidth: 1.2 })));
    }
    // the loom: black and white threads
    add(svg, rc.rectangle(262, 34, 128, 128, opt({ strokeWidth: 1.8 })));
    for (let i = 0; i < 14; i++) {
      const x = 270 + i * 8.6;
      add(svg, rc.line(x, 38, x, 158, opt(i % 2 ? { stroke: PENCIL, strokeWidth: 0.7, roughness: 0.3 } : { stroke: INK, strokeWidth: 2.6, roughness: 0.3 })));
    }
    add(svg, rc.line(256, 112, 396, 112, opt({ stroke: GOLD, strokeWidth: 2.4 })));
    text(svg, cx, 212, '12 spokes · 6 boys = a year', { size: 15, color: PEN });
    text(svg, 326, 188, 'black & white thread', { size: 15, color: PEN });
    text(svg, 326, 206, '= nights & days', { size: 15, color: PEN });
  },
  ila(svg, rc) {
    const cx = 210, cy = 102, R = 80;
    for (let i = 0; i < 30; i++) { const a = (i / 30) * TAU - Math.PI / 2; moonPhase(svg, rc, cx + cos(a) * R, cy + sin(a) * R, 7.5, i / 30); }
    text(svg, cx, cy + 14, 'इला', { size: 44, color: RED, font: SK });
    text(svg, cx, cy + 40, 'Ilā', { size: 15, color: PEN });
    text(svg, 330, 40, '30 tithis', { size: 17, color: PEN, anchor: 'start', rot: -4 });
    text(svg, 330, 60, '= 30 spokes', { size: 17, color: RED, anchor: 'start', rot: -4 });
    text(svg, 14, 214, 'new moon at the top, full at the bottom.', { size: 14, color: PENCIL, anchor: 'start' });
  },
  yugas(svg, rc) {
    // four bands, numbered on the ring itself, with a key on the right: no leader lines to tangle
    const cx = 112, cy = 112, bands = [[26, 'कृत', 'Krita'], [48, 'त्रेता', 'Treta'], [70, 'द्वापर', 'Dvapara'], [92, 'कलि', 'Kali']];
    bands.forEach(([r, d, en], i) => {
      add(svg, rc.circle(cx, cy, (r + 10) * 2, opt({ strokeWidth: 1.4 })));
      const n = 6 + i * 4;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU;
        if (Math.abs(a - Math.PI * 1.5) < 0.42) continue;        // leave room for the number
        add(svg, rc.ellipse(cx + cos(a) * r, cy + sin(a) * r, 10, 10, opt({ strokeWidth: 0.9, roughness: 0.6 })));
      }
      text(svg, cx, cy - r + 5, String(i + 1), { size: 13, color: i === 3 ? RED : INK, font: 'Cinzel', weight: 600 });
      const y = 44 + i * 40;
      text(svg, 250, y, String(i + 1), { size: 15, color: GOLD, font: 'Cinzel', weight: 600, anchor: 'start' });
      text(svg, 272, y + 2, d, { size: 24, color: i === 3 ? RED : INK, font: SK, anchor: 'start' });
      text(svg, 344, y, en, { size: 15, color: PEN, anchor: 'start' });
    });
    for (let a = 2.35; a < 4.05; a += 0.2) add(svg, rc.ellipse(cx + cos(a) * 103, cy + sin(a) * 103, 9, 6, opt({ stroke: MOSS, fill: 'rgba(95,122,46,.7)', fillStyle: 'solid', roughness: 0.5 })));
    text(svg, 250, 212, 'ivy: already on Kali', { size: 14, color: MOSS, anchor: 'start' });
  },
  maya(svg, rc) {
    add(svg, rc.line(10, 150, 410, 150, opt({ stroke: PENCIL })));
    // 1 · the crystal floor
    add(svg, rc.rectangle(20, 118, 110, 32, opt({ strokeWidth: 1.4, fill: 'rgba(120,160,190,.25)', fillStyle: 'hachure', hachureGap: 5, hachureAngle: 20 })));
    // 2 · the water
    for (let i = 0; i < 4; i++) add(svg, rc.curve([[150, 124 + i * 8], [175, 118 + i * 8], [200, 128 + i * 8], [225, 118 + i * 8], [250, 126 + i * 8]], opt({ stroke: PEN, strokeWidth: 1.2 })));
    // 3 · the door that is a wall
    add(svg, rc.rectangle(290, 40, 90, 110, opt({ strokeWidth: 2, fill: 'rgba(43,36,30,.12)', fillStyle: 'cross-hatch', hachureGap: 9 })));
    add(svg, rc.rectangle(306, 62, 58, 88, opt({ strokeWidth: 1.4 })));
    [['water?', 75, 'floor'], ['floor?', 200, 'water'], ['open?', 335, 'shut']].forEach(([q, x, a]) => {
      text(svg, x, 96, q, { size: 19, color: PEN, rot: -4 });
      const t = text(svg, x, 182, a, { size: 18, color: RED, rot: 2 });
      void t;
    });
    text(svg, 210, 210, '— Duryodhana, three times', { size: 14, color: PENCIL });
  },
  vyuha(svg, rc) { drawVyuha(svg, rc, 210, 108, 0.5, false); text(svg, 330, 60, 'in ✓', { size: 20, color: RED, anchor: 'start' }); text(svg, 330, 88, 'out ✗', { size: 20, color: RED, anchor: 'start' }); text(svg, 20, 206, 'sixteen years old.', { size: 15, color: PENCIL, anchor: 'start' }); },
  sun(svg, rc) {
    add(svg, rc.line(10, 176, 410, 176, opt({ stroke: PENCIL })));
    for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; add(svg, rc.line(210 + cos(a) * 60, 92 + sin(a) * 60, 210 + cos(a) * 84, 92 + sin(a) * 84, opt({ stroke: GOLD, strokeWidth: 1.6 }))); }
    add(svg, rc.circle(210, 92, 100, opt({ stroke: GOLD, strokeWidth: 2, fill: 'rgba(184,138,62,.3)', fillStyle: 'hachure', hachureGap: 5 })));
    add(svg, rc.circle(218, 88, 94, opt({ stroke: INK, strokeWidth: 2, fill: INK, fillStyle: 'solid' })));
    add(svg, rc.curve([[330, 40], [300, 34], [272, 52], [262, 66]], opt({ stroke: RED, strokeWidth: 1.6 })));
    text(svg, 336, 40, 'the disc', { size: 17, color: RED, anchor: 'start' });
    text(svg, 74, 200, 'dusk, an hour early', { size: 17, color: PEN, rot: -3 });
    for (const x of [40, 52, 64, 330, 345, 360, 372]) add(svg, rc.line(x, 176, x, 164 - (x % 3) * 3, opt({ stroke: PENCIL, strokeWidth: 1 })));
  },
  wheel(svg, rc) {
    const cx = 140, cy = 110, r = 66;
    add(svg, rc.circle(cx, cy, r * 2, opt({ strokeWidth: 2.6 })));
    add(svg, rc.circle(cx, cy, 18, opt({ strokeWidth: 1.6 })));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2; add(svg, rc.line(cx + cos(a) * 9, cy + sin(a) * 9, cx + cos(a) * r, cy + sin(a) * r, opt({ strokeWidth: 1.6 }))); }
    for (const [y, l] of [[70, 60], [100, 80], [130, 70], [158, 50]]) add(svg, rc.line(cx - r - 14 - l, y, cx - r - 14, y, opt({ stroke: PENCIL, strokeWidth: 1.2 })));
    // the bow, lowered
    add(svg, rc.arc(330, 120, 70, 170, -Math.PI * 0.5, Math.PI * 0.5, false, opt({ strokeWidth: 2.4 })));
    add(svg, rc.line(330, 35, 330, 205, opt({ stroke: PENCIL, strokeWidth: 0.8 })));
    text(svg, 286, 28, 'Bhishma: welcome.', { size: 16, color: PEN, rot: -3 });
    text(svg, cx, 206, 'a promise, broken out of love', { size: 15, color: RED });
  },
  karna(svg, rc) {
    const cx = 210, cy = 132, r = 74, g = 140;
    add(svg, rc.rectangle(10, g, 400, 74, opt({ stroke: 'none', fill: 'rgba(111,102,92,.28)', fillStyle: 'hachure', hachureGap: 6, hachureAngle: -30 })));
    add(svg, rc.line(10, g, 410, g, opt({ strokeWidth: 1.8 })));
    add(svg, rc.arc(cx, cy, r * 2, r * 2, Math.PI + 0.12, TAU - 0.12, false, opt({ strokeWidth: 2.6 })));
    add(svg, rc.arc(cx, cy, r * 2, r * 2, 0.15, Math.PI - 0.15, false, opt({ strokeWidth: 1.2, strokeLineDash: [5, 6] })));
    for (let i = 0; i < 6; i++) { const a = Math.PI + (i / 5) * Math.PI; add(svg, rc.line(cx, cy, cx + cos(a) * r, cy + sin(a) * r, opt({ strokeWidth: 1.5 }))); }
    for (const [x, y] of [[120, 128], [134, 118], [292, 124], [306, 130]]) add(svg, rc.ellipse(x, y, 7, 5, opt({ stroke: INK, fill: INK, fillStyle: 'solid' })));
    text(svg, 330, 40, 'the earth', { size: 17, color: RED, anchor: 'start' });
    text(svg, 330, 60, 'keeps it', { size: 17, color: RED, anchor: 'start' });
    text(svg, 20, 196, 'day seventeen', { size: 15, color: '#3a3216', anchor: 'start' });
  },
  sudarshana(svg, rc) {
    const cx = 210, cy = 110, pts = [];
    for (let i = 0; i < 48; i++) { const a = (i / 48) * TAU, r = i % 2 ? 78 : 92; pts.push([cx + cos(a) * r, cy + sin(a) * r]); }
    add(svg, rc.polygon(pts, opt({ stroke: GOLD, strokeWidth: 1.8, fill: 'rgba(184,138,62,.18)', fillStyle: 'hachure', hachureGap: 6 })));
    add(svg, rc.circle(cx, cy, 128, opt({ strokeWidth: 1.6 })));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU, g = rc.ellipse(cx + cos(a) * 30, cy + sin(a) * 30, 40, 16, opt({ stroke: RED, strokeWidth: 1.3 }));
      g.setAttribute('transform', `rotate(${(a * 180) / Math.PI} ${cx + cos(a) * 30} ${cy + sin(a) * 30})`);
      add(svg, g);
    }
    add(svg, rc.circle(cx, cy, 14, opt({ stroke: RED, fill: RED, fillStyle: 'solid' })));
    text(svg, 330, 40, 'good to', { size: 17, color: PEN, anchor: 'start', rot: -3 });
    text(svg, 330, 60, 'behold', { size: 17, color: PEN, anchor: 'start', rot: -3 });
  },
};
const echoCards = document.getElementById('echo-cards');
const cards = $$('.echo');
let cur = 0;
const cardSvg = (k) => cards[k]?.querySelector('svg');
function show(i, focus = false) {
  const prev = cardSvg(cur);
  cur = (i + 9) % 9;
  if (prev && prev !== cardSvg(cur)) resetDraw(prev);
  cards.forEach((c, k) => c.classList.toggle('on', k === cur));
  for (const p of $$('#lotus .petal')) { const on = +p.dataset.i === cur; p.classList.toggle('on', on); p.setAttribute('aria-selected', on); }
  if (echoCards?.classList.contains('seen') && cardSvg(cur)) { resetDraw(cardSvg(cur)); playDraw(cardSvg(cur)); }
  if (focus) $$('#lotus .petal').find((p) => +p.dataset.i === cur)?.focus();
}
if (echoCards) {
  lazy(echoCards, () => {
    for (const svg of $$('svg[data-echo]', echoCards)) {
      seed = 100 + hash(svg.dataset.echo);
      ECHO[svg.dataset.echo]?.(svg, rough.svg(svg));
      prepDraw(svg);
    }
    observe(echoCards, () => cardSvg(cur) && playDraw(cardSvg(cur)), () => cards.forEach((c) => c.querySelector('svg') && resetDraw(c.querySelector('svg'))));
  });
  $$('.echo-nav button').forEach((b) => b.addEventListener('click', () => show(cur + +b.dataset.step)));
}

// the lotus: eight petals and a hub, each one opens an echo
const lotus = document.getElementById('lotus');
if (lotus) lazy(lotus, () => {
  const rc = rough.svg(lotus);
  seed = 808;
  add(lotus, rc.circle(0, 0, 410, opt({ strokeWidth: 2.8 })));
  add(lotus, rc.circle(0, 0, 384, opt({ strokeWidth: 1 })));
  for (let i = 0; i < 30; i++) { const a = (i / 30) * TAU; add(lotus, rc.line(cos(a) * 178, sin(a) * 178, cos(a) * 190, sin(a) * 190, opt({ strokeWidth: 1, roughness: 0.4 }))); }
  const PET = 'M 0 -48 C 50 -82, 54 -140, 0 -176 C -54 -140, -50 -82, 0 -48 Z';
  const mk = (i, d, rot, label, draw = true) => {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'petal');
    g.setAttribute('role', 'tab');
    g.setAttribute('tabindex', '0');
    g.setAttribute('aria-label', label);
    g.dataset.i = i;
    const hit = document.createElementNS(NS, 'path');
    hit.setAttribute('d', d);
    hit.setAttribute('class', 'hit');
    if (rot) hit.setAttribute('transform', `rotate(${rot})`);
    g.appendChild(hit);
    if (draw) {
      const p = rc.path(d, opt({ strokeWidth: 1.8 }));
      if (rot) p.setAttribute('transform', `rotate(${rot})`);
      g.appendChild(p);
    }
    lotus.appendChild(g);
    return g;
  };
  for (let i = 0; i < 8; i++) {
    const rot = i * 45;
    const g = mk(i, PET, rot, cards[i]?.querySelector('h3')?.textContent || `echo ${i + 1}`);
    const inner = rc.path('M 0 -70 C 26 -92, 28 -130, 0 -156 C -28 -130, -26 -92, 0 -70 Z', opt({ stroke: PENCIL, strokeWidth: 0.8, roughness: 0.8 }));
    inner.setAttribute('transform', `rotate(${rot})`);
    g.appendChild(inner);
    const a = (rot - 90) * Math.PI / 180;
    g.appendChild(text(lotus, cos(a) * 112, sin(a) * 112 + 8, String(i + 1), { size: 24, color: INK, font: 'Cinzel', weight: 600 }));
  }
  const hub = mk(8, 'M -44 0 A 44 44 0 1 0 44 0 A 44 44 0 1 0 -44 0 Z', 0, 'Sudarshana', false);
  hub.appendChild(rc.circle(0, 0, 88, opt({ stroke: RED, strokeWidth: 2 })));
  hub.appendChild(text(lotus, 0, 7, 'सुदर्शन', { size: 19, color: RED, font: SK }));
  ready(lotus);
  const reveal = () => { if (innerWidth <= 860) cards[cur].scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  for (const p of $$('.petal', lotus)) {
    p.addEventListener('click', () => { show(+p.dataset.i); reveal(); });
    p.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(+p.dataset.i); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); show(cur + 1, true); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); show(cur - 1, true); }
    });
  }
  show(cur);
});

// ------------------------------------------------------------------ more diagrams: the two traps, and scale
Object.assign(DIAGRAMS, {
  vyuha(svg, rc) { seed = 13; drawVyuha(svg, rc, 250, 236, 1); },
  valaya(svg, rc) {
    seed = 31;
    const cx = 250, cy = 206, R = 158, g = 333, k = R / 78;          // 78 m radius, door foot at y = g
    add(svg, rc.rectangle(0, g, 500, 140, opt({ stroke: 'none', fill: 'rgba(111,102,92,.22)', fillStyle: 'hachure', hachureGap: 7, hachureAngle: -35 })));
    add(svg, rc.circle(cx, cy, R * 2, opt({ strokeWidth: 3 })));
    add(svg, rc.circle(cx, cy, R * 1.7, opt({ strokeWidth: 1.2 })));
    for (let i = 0; i < 30; i++) { const a = (i / 30) * TAU; if (a > 1.2 && a < 1.95) continue; add(svg, rc.line(cx + cos(a) * 26, cy + sin(a) * 26, cx + cos(a) * R * 0.8, cy + sin(a) * R * 0.8, opt({ strokeWidth: 0.7, roughness: 0.4 }))); }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU, e = rc.ellipse(cx + cos(a) * 14, cy + sin(a) * 14, 22, 9, opt({ stroke: RED, strokeWidth: 1.1 }));
      e.setAttribute('transform', `rotate(${(a * 180) / Math.PI} ${cx + cos(a) * 14} ${cy + sin(a) * 14})`);
      add(svg, e);
    }
    const dw = 23 * k / 2, dh = 51 * k;
    add(svg, rc.rectangle(cx - dw, g - dh, dw * 2, dh, opt({ strokeWidth: 2, fill: 'rgba(255,214,140,.55)', fillStyle: 'solid' })));
    add(svg, rc.line(0, g, 500, g, opt({ strokeWidth: 1.6 })));
    add(svg, rc.line(cx + dw + 4, g - dh + 18, 418, 282, opt({ stroke: RED, strokeWidth: 1 })));
    text(svg, 422, 290, 'मृगतृष्णा', { size: 20, color: RED, font: SK, anchor: 'start' });
    // what it shows you: home
    const hx = cx, hy = g - dh * 0.32;
    add(svg, rc.polygon([[hx - 13, hy], [hx - 13, hy - 16], [hx, hy - 28], [hx + 13, hy - 16], [hx + 13, hy]], opt({ stroke: GOLD, strokeWidth: 1.4, fill: 'rgba(184,138,62,.35)', fillStyle: 'hachure', hachureGap: 3 })));
    // the walker: in through the door, round the back, out a step from the start
    const fig = (x, y, s = 1, dashed = false) => {
      const o = { stroke: dashed ? PENCIL : INK, strokeWidth: 1.6, ...(dashed ? { strokeLineDash: [3, 3] } : {}) };
      add(svg, rc.circle(x, y - 34 * s, 10 * s, opt(o)));
      add(svg, rc.line(x, y - 29 * s, x, y - 12 * s, opt(o)));
      add(svg, rc.line(x, y - 12 * s, x - 6 * s, y, opt(o)));
      add(svg, rc.line(x, y - 12 * s, x + 6 * s, y, opt(o)));
      add(svg, rc.line(x - 7 * s, y - 24 * s, x + 7 * s, y - 24 * s, opt(o)));
    };
    fig(56, g);
    add(svg, rc.ellipse(70, g + 4, 30, 6, opt({ stroke: 'none', fill: 'rgba(43,36,30,.55)', fillStyle: 'solid' })));
    arrow(svg, rc, 80, g - 18, cx - dw - 8, g - 18, RED);
    // round the back of the Ring (dashed: you can't see this part from the front)
    add(svg, rc.curve([[cx + 6, g - dh * 0.75], [cx + R * 0.72, cy + R * 0.5], [cx + R + 26, cy - 6], [cx + R * 0.72, cy - R - 16],
      [cx, cy - R - 30], [cx - R * 0.72, cy - R - 16], [cx - R - 26, cy - 6], [cx - R - 18, g - 80], [100, g - 46]],
      opt({ stroke: RED, strokeWidth: 1.6, strokeLineDash: [7, 7], roughness: 0.6 })));
    fig(100, g, 1, true);
    add(svg, rc.ellipse(cx + 2, g + 4, 34, 7, opt({ stroke: 'none', fill: 'rgba(43,36,30,.75)', fillStyle: 'solid' })));
    text(svg, cx + 4, g + 60, '↑ your shadow. it stays.', { size: 16, color: INK, rot: -2 });
    text(svg, 22, g + 98, 'you walk back out,', { anchor: 'start', size: 15, color: RED, rot: -2 });
    text(svg, 22, g + 118, 'a little lighter than you went in.', { anchor: 'start', size: 15, color: RED, rot: -2 });
    text(svg, 488, 30, 'out: yes', { anchor: 'end', size: 18, color: PEN, rot: 3 });
    text(svg, 488, 52, 'shadow: no', { anchor: 'end', size: 18, color: RED, rot: 3 });
  },
  scale(svg, rc) {
    seed = 77;
    const g = 372, k = 1.55;
    add(svg, rc.line(0, g, 1040, g, opt({ strokeWidth: 1.6 })));
    const lens = (x, y, tx, ty, draw, label, sub) => {
      add(svg, rc.circle(x, y, 74, opt({ stroke: PEN, strokeWidth: 1.6, fill: 'rgba(255,255,255,.5)', fillStyle: 'solid' })));
      add(svg, rc.line(x + 26 * Math.sign(tx - x || 1), y + 26, tx, ty, opt({ stroke: PEN, strokeWidth: 1 })));
      draw(x, y);
      text(svg, x, y - 60, label, { size: 15, color: PEN });
      text(svg, x, y - 44, sub, { size: 13, color: PENCIL });
    };
    // me
    add(svg, rc.line(40, g, 40, g - 1.8 * k, opt({ strokeWidth: 1.4, roughness: 0 })));
    lens(60, 280, 40, g - 3, (x, y) => {
      add(svg, rc.circle(x, y - 14, 10, opt({ strokeWidth: 1.4 })));
      add(svg, rc.line(x, y - 9, x, y + 8, opt({ strokeWidth: 1.4 })));
      add(svg, rc.line(x, y + 8, x - 6, y + 22, opt({ strokeWidth: 1.4 })));
      add(svg, rc.line(x, y + 8, x + 6, y + 22, opt({ strokeWidth: 1.4 })));
      add(svg, rc.line(x - 8, y, x + 8, y - 2, opt({ strokeWidth: 1.4 })));
    }, 'me', '1.8 m');
    // Konark wheel
    add(svg, rc.circle(140, g - 1.5 * k, 3 * k, opt({ strokeWidth: 1, roughness: 0 })));
    lens(150, 280, 140, g - 4, (x, y) => {
      add(svg, rc.circle(x, y + 2, 44, opt({ strokeWidth: 1.6 })));
      for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; add(svg, rc.line(x, y + 2, x + cos(a) * 20, y + 2 + sin(a) * 20, opt({ strokeWidth: i % 2 ? 0.6 : 1.2, roughness: 0.3 }))); }
    }, 'Konark wheel', '~3 m');
    // Qutub Minar 72.5 m
    const qx = 300, qh = 72.5 * k, qb = 14.3 * k / 2, qt = 2.7 * k / 2 + 2;
    add(svg, rc.polygon([[qx - qb, g], [qx - qt, g - qh], [qx + qt, g - qh], [qx + qb, g]], opt({ strokeWidth: 1.6, fill: 'rgba(166,58,43,.18)', fillStyle: 'hachure', hachureGap: 4 })));
    for (const f of [0.3, 0.52, 0.7, 0.86]) { const w = qb + (qt - qb) * f + 3; add(svg, rc.line(qx - w, g - qh * f, qx + w, g - qh * f, opt({ strokeWidth: 1.4 }))); }
    text(svg, qx, g - qh - 30, 'Qutub Minar', { size: 15, color: PEN });
    text(svg, qx, g - qh - 13, '72.5 m', { size: 13, color: PENCIL });
    // London Eye: 120 m wheel, 135 m tall
    const ex = 500, er = 60 * k, ecy = g - 135 * k + er;
    add(svg, rc.circle(ex, ecy, er * 2, opt({ strokeWidth: 1.8 })));
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; add(svg, rc.line(ex, ecy, ex + cos(a) * er, ecy + sin(a) * er, opt({ strokeWidth: 0.6, roughness: 0.3, stroke: PENCIL }))); }
    for (let i = 0; i < 32; i++) { const a = (i / 32) * TAU; add(svg, rc.ellipse(ex + cos(a) * er, ecy + sin(a) * er, 5, 4, opt({ strokeWidth: 0.8, roughness: 0.2 }))); }
    add(svg, rc.line(ex, ecy, ex - 38, g, opt({ strokeWidth: 2 })));
    add(svg, rc.line(ex, ecy, ex + 10, g, opt({ strokeWidth: 2 })));
    text(svg, ex, g - 135 * k - 30, 'London Eye', { size: 15, color: PEN });
    text(svg, ex, g - 135 * k - 13, '135 m', { size: 13, color: PENCIL });
    // Kaalavalaya
    const rx = 740, R = 78 * k, rcy = g - 62 * k;
    add(svg, rc.arc(rx, rcy, R * 2, R * 2, Math.PI * 0.67, Math.PI * 2.33, false, opt({ strokeWidth: 3.4 })));
    add(svg, rc.arc(rx, rcy, R * 2, R * 2, Math.PI * 0.33, Math.PI * 0.67, false, opt({ strokeWidth: 1.4, strokeLineDash: [5, 6] })));
    add(svg, rc.arc(rx, rcy, R * 1.66, R * 1.66, Math.PI * 0.62, Math.PI * 2.38, false, opt({ strokeWidth: 1.2 })));
    for (let i = 0; i < 30; i++) { const a = (i / 30) * TAU; if (a > 1.25 && a < 1.9) continue; add(svg, rc.line(rx + cos(a) * R * 0.2, rcy + sin(a) * R * 0.2, rx + cos(a) * R * 0.8, rcy + sin(a) * R * 0.8, opt({ strokeWidth: 0.6, roughness: 0.3 }))); }
    add(svg, rc.circle(rx, rcy, R * 0.34, opt({ stroke: RED, strokeWidth: 1.6 })));
    add(svg, rc.rectangle(rx - 11.5 * k, g - 51 * k, 23 * k, 51 * k, opt({ strokeWidth: 1.6, fill: 'rgba(255,214,140,.5)', fillStyle: 'solid' })));
    const top = rcy - R, tip = g - 187 * k;
    add(svg, rc.rectangle(rx - 9, top - 26, 18, 26, opt({ strokeWidth: 1.4 })));
    add(svg, rc.polygon([[rx - 7, top - 26], [rx, tip], [rx + 7, top - 26]], opt({ strokeWidth: 1.4 })));
    // dimensions
    const dx = rx + R + 46;
    add(svg, rc.line(dx, rcy - R, dx, rcy + R, opt({ stroke: RED, strokeWidth: 1.3 })));
    for (const y of [rcy - R, rcy + R]) add(svg, rc.line(dx - 8, y, dx + 8, y, opt({ stroke: RED, strokeWidth: 1.3 })));
    text(svg, dx + 12, rcy + 6, '156 m', { size: 24, color: RED, anchor: 'start', font: 'Caveat', weight: 600 });
    add(svg, rc.line(rx + 12, tip, dx + 4, tip, opt({ stroke: PENCIL, strokeWidth: 1, strokeLineDash: [4, 5] })));
    text(svg, dx + 12, tip + 5, '187 m to the tip', { size: 14, color: PENCIL, anchor: 'start' });
    text(svg, dx + 12, rcy + R - 4, '16 m underground', { size: 14, color: PENCIL, anchor: 'start' });
    text(svg, rx - R - 16, tip + 4, 'Kaalavalaya', { size: 21, color: INK, anchor: 'end', font: 'Caveat', weight: 600 });
  },
});
// ------------------------------------------------------------------ the legend, in six pictures
const stick = (svg, rc, x, y, o = {}) => {                // a little person, feet at (x, y)
  add(svg, rc.circle(x, y - 34, 10, opt(o)));
  add(svg, rc.line(x, y - 29, x, y - 12, opt(o)));
  add(svg, rc.line(x, y - 12, x - 6, y, opt(o)));
  add(svg, rc.line(x, y - 12, x + 6, y, opt(o)));
  add(svg, rc.line(x - 7, y - 24, x + 7, y - 24, opt(o)));
};
const ICON = {
  wave(svg, rc) {
    add(svg, rc.polygon([[110, 96], [150, 30], [186, 96]], opt({ strokeWidth: 1.4, fill: 'rgba(111,102,92,.15)', fillStyle: 'hachure', hachureGap: 5 })));
    add(svg, rc.path('M 4 96 C 20 60, 50 20, 92 22 C 120 24, 126 50, 106 58 C 92 64, 82 50, 92 44', opt({ stroke: PEN, strokeWidth: 2.2 })));
    add(svg, rc.line(4, 96, 186, 96, opt({ stroke: PEN, strokeWidth: 1 })));
  },
  walls(svg, rc) {
    [[20, 170, 82], [40, 150, 66], [58, 132, 50], [74, 116, 34], [88, 102, 18]].forEach(([a, b, y]) => add(svg, rc.rectangle(a, y, b - a, 98 - y, opt({ strokeWidth: 1.3, fill: 'rgba(111,102,92,.12)', fillStyle: 'hachure', hachureGap: 7 }))));
    add(svg, rc.line(95, 98, 95, 18, opt({ stroke: RED, strokeWidth: 1.6 })));
  },
  ring(svg, rc) {
    add(svg, rc.circle(95, 52, 92, opt({ strokeWidth: 2.6 })));
    add(svg, rc.circle(95, 52, 74, opt({ strokeWidth: 1 })));
    for (let i = 0; i < 30; i++) { const a = (i / 30) * TAU; add(svg, rc.line(95 + cos(a) * 9, 52 + sin(a) * 9, 95 + cos(a) * 34, 52 + sin(a) * 34, opt({ strokeWidth: 0.6, roughness: 0.3 }))); }
    add(svg, rc.circle(95, 52, 14, opt({ stroke: RED, strokeWidth: 1.4 })));
  },
  lure(svg, rc) {                                          // the door glows with the thing you want: home
    for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; add(svg, rc.line(118 + cos(a) * 46, 66 + sin(a) * 46, 118 + cos(a) * 56, 66 + sin(a) * 56, opt({ stroke: GOLD, strokeWidth: 1.2 }))); }
    add(svg, rc.rectangle(96, 26, 44, 74, opt({ strokeWidth: 1.8, fill: 'rgba(255,214,140,.6)', fillStyle: 'solid' })));
    add(svg, rc.polygon([[106, 84], [106, 66], [118, 54], [130, 66], [130, 84]], opt({ stroke: GOLD, strokeWidth: 1.4, fill: 'rgba(184,138,62,.4)', fillStyle: 'hachure', hachureGap: 3 })));
    add(svg, rc.line(4, 100, 186, 100, opt({ stroke: PENCIL, strokeWidth: 1 })));
    stick(svg, rc, 44, 100, { strokeWidth: 1.5 });
    add(svg, rc.curve([[58, 70], [72, 62], [88, 64]], opt({ stroke: RED, strokeWidth: 1.2 })));
  },
  shadow(svg, rc) {                                        // you walk out; your shadow stays by the door
    add(svg, rc.rectangle(130, 26, 40, 74, opt({ strokeWidth: 1.8, fill: 'rgba(255,214,140,.35)', fillStyle: 'solid' })));
    add(svg, rc.line(4, 100, 186, 100, opt({ stroke: PENCIL, strokeWidth: 1 })));
    add(svg, rc.ellipse(150, 103, 40, 7, opt({ stroke: 'none', fill: 'rgba(43,36,30,.8)', fillStyle: 'solid' })));
    stick(svg, rc, 52, 100, { strokeWidth: 1.5 });
    add(svg, rc.ellipse(66, 104, 34, 7, opt({ stroke: PENCIL, strokeWidth: 0.9, roughness: 0.6, strokeLineDash: [3, 4] })));
    text(svg, 66, 120, 'no shadow', { size: 12, color: RED });
  },
  eclipse(svg, rc) {
    for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU; add(svg, rc.line(95 + cos(a) * 34, 52 + sin(a) * 34, 95 + cos(a) * (46 + (i % 2) * 8), 52 + sin(a) * (46 + (i % 2) * 8), opt({ stroke: GOLD, strokeWidth: 1.3 }))); }
    add(svg, rc.circle(95, 52, 62, opt({ stroke: INK, strokeWidth: 1.6, fill: INK, fillStyle: 'solid' })));
    add(svg, rc.circle(95, 52, 92, opt({ stroke: INK, strokeWidth: 2.2 })));
  },
};
for (const svg of $$('svg[data-icon]')) lazy(svg, () => {
  seed = 500 + hash(svg.dataset.icon);
  ICON[svg.dataset.icon]?.(svg, rough.svg(svg));
  ready(svg, svg.parentElement);
});

// ------------------------------------------------------------------ lens: the stone under the pencil (moves only when you do)
const lensEl = document.getElementById('lens');
if (lensEl) {
  const size = () => lensEl.style.setProperty('--lr', `${Math.round(lensEl.clientWidth * 0.17)}px`);
  let raf = 0, px = 0, py = 0;
  const move = (e) => {
    const r = lensEl.getBoundingClientRect();
    px = e.clientX - r.left; py = e.clientY - r.top;
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; lensEl.style.setProperty('--lx', `${px}px`); lensEl.style.setProperty('--ly', `${py}px`); });
  };
  lensEl.addEventListener('pointermove', move, { passive: true });
  lensEl.addEventListener('pointerdown', move, { passive: true });
  size();
  addEventListener('resize', debounce(size, 150));
}

// ------------------------------------------------------------------ the ledger counts up, every time
const ledger = document.querySelector('.ledger');
if (ledger) {
  const nums = $$('[data-count]', ledger).map((el) => ({ el, n: +el.dataset.count, pre: el.dataset.pre || '', unit: el.querySelector('small')?.outerHTML || '' }));
  let run = 0;
  const paint = (q) => { for (const { el, n, pre, unit } of nums) el.innerHTML = pre + Math.round(n * q).toLocaleString('en-US') + unit; };
  observe(ledger, () => {
    const id = ++run, t0 = performance.now();
    const step = () => {
      if (id !== run) return;
      const f = Math.min(1, (performance.now() - t0) / 1800);
      paint(1 - Math.pow(1 - f, 3));
      if (f < 1) requestAnimationFrame(step);
    };
    step();
  }, () => { run++; paint(0); });
}

// ------------------------------------------------------------------ the shloka arrives word by word; signatures write themselves (every time)
$$('.shloka').forEach((sh) => { $$('.w', sh).forEach((w, i) => { w.style.transitionDelay = `${0.2 + i * 0.22}s`; }); observe(sh); });
const unwrite = (sig) => () => sig.classList.remove('written');
for (const sig of $$('.sig')) {
  sig.addEventListener('animationend', () => sig.classList.add('written'));
  if (sig.id !== 'title-sig') observe(sig, null, unwrite(sig));
}
const titleSig = document.getElementById('title-sig');
const loaderEl2 = document.getElementById('loader');
if (titleSig) {
  const go = () => observe(titleSig, null, unwrite(titleSig));
  if (!loaderEl2 || loaderEl2.classList.contains('done')) setTimeout(go, 600);
  else new MutationObserver((_, o) => { if (loaderEl2.classList.contains('done')) { o.disconnect(); setTimeout(go, 700); } }).observe(loaderEl2, { attributes: true });
}

// ------------------------------------------------------------------ the sea, quietly (synthesised; nothing to download)
const soundBtn = document.getElementById('sound');
if (soundBtn) {
  let ac = null, master = null, on = false;
  const build = () => {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
    const len = ac.sampleRate * 8, buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; } }
    const layer = (freq, type, gain, lfoHz, depth) => {
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = 0.9 + Math.random() * 0.2;
      const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 0.6;
      const g = ac.createGain(); g.gain.value = gain;
      const lfo = ac.createOscillator(); lfo.frequency.value = lfoHz;
      const lg = ac.createGain(); lg.gain.value = depth; lfo.connect(lg); lg.connect(g.gain);
      const lf = ac.createGain(); lf.gain.value = freq * 0.8; lfo.connect(lf); lf.connect(f.frequency);
      src.connect(f); f.connect(g); g.connect(master); src.start(); lfo.start();
    };
    layer(420, 'lowpass', 0.55, 0.085, 0.4);       // the swell
    layer(1600, 'bandpass', 0.05, 0.085, 0.045);   // the wash on the stones
    layer(5200, 'highpass', 0.012, 0.06, 0.01);    // spray
  };
  soundBtn.addEventListener('click', () => {
    if (!ac) build();
    on = !on;
    if (on) ac.resume();
    master.gain.setTargetAtTime(on ? 0.5 : 0, ac.currentTime, 0.9);
    soundBtn.classList.toggle('on', on);
    soundBtn.setAttribute('aria-pressed', on);
    soundBtn.setAttribute('aria-label', on ? 'Sea sound: on' : 'Sea sound: off');
  });
}

// ------------------------------------------------------------------ swatches
const SW = [['carved_sandstone', 'carved sandstone'], ['ashlar', 'limestone blocks'], ['cliff_rock', 'cliff rock'], ['moss', 'moss'],
  ['forest_ground', 'forest floor'], ['roof_tiles', 'roof tiles'], ['bark', 'bark'], ['water', 'sea foam']];
const swHost = document.getElementById('swatches');
if (swHost) {
  SW.forEach(([k, label], i) => {
    const f = document.createElement('figure');
    f.className = 'c3 photo reveal swatch';
    f.style.setProperty('--r', `${((i * 37) % 5) - 2}deg`);
    f.innerHTML = `<img src="assets/art/swatch_${k}.jpg" alt="${label} texture" loading="lazy" decoding="async" width="420" height="420"><span class="caption">${label}</span>`;
    const n = new Image();
    n.src = `assets/art/swatch_${k}_normal.jpg`;
    const flip = (bumps) => { f.querySelector('img').src = bumps ? n.src : `assets/art/swatch_${k}.jpg`; f.classList.toggle('bumps', bumps); };
    f.addEventListener('mouseenter', () => flip(true));
    f.addEventListener('mouseleave', () => flip(false));
    f.addEventListener('click', () => flip(!f.classList.contains('bumps')));
    swHost.appendChild(f);
  });
  const hint = document.createElement('p');
  hint.className = 'c12 note pencil';
  hint.textContent = 'hover (or tap) one to see its bumps. the purple is where the light bends.';
  swHost.appendChild(hint);
}

// ------------------------------------------------------------------ before / after
for (const c of $$('.compare')) {
  const set = (clientX) => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--cut', `${Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100))}%`);
  };
  let drag = false;
  c.addEventListener('pointerdown', (e) => { drag = true; c.setPointerCapture(e.pointerId); set(e.clientX); });
  c.addEventListener('pointermove', (e) => drag && set(e.clientX));
  c.addEventListener('pointerup', () => { drag = false; });
}

// ------------------------------------------------------------------ lightbox
const lb = document.getElementById('lightbox');
document.addEventListener('click', (e) => {
  const fig = e.target.closest('.zoom');
  if (fig && !e.target.closest('.compare')) {
    const img = fig.querySelector('img');
    if (!img) return;
    lb.querySelector('img').src = img.dataset.full || img.src;
    lb.querySelector('p').textContent = img.alt;
    lb.classList.add('open');
  } else if (e.target.closest('.lightbox')) lb.classList.remove('open');
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') lb.classList.remove('open'); });

// ------------------------------------------------------------------ reveals, dividers
$$('.reveal, .divider, .sticky, .endcard').forEach((el) => observe(el));

// ------------------------------------------------------------------ ring nav: chapter + light/dark from what's under it, no per-frame layout reads
const nav = document.getElementById('ringnav');
const toc = document.getElementById('toc');
const prog = nav.querySelector('.prog');
const label = document.getElementById('ringnav-label');
const C = 2 * Math.PI * 19;
prog.style.strokeDasharray = C;
nav.addEventListener('click', () => toc.classList.toggle('open'));
toc.addEventListener('click', (e) => { if (e.target.closest('a')) toc.classList.remove('open'); });
const DARK = '#story, .cover, .divider, .shloka, .fullbleed, .endcard, .gallery';
const sections = $$('[data-chapter]');
const topBand = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const el = e.target;
    if (label.textContent !== el.dataset.chapter) label.textContent = el.dataset.chapter;
    document.body.classList.toggle('on-dark', el.matches(DARK));
  }
}, { rootMargin: '-30px 0px -94% 0px' });
const bottomBand = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) document.body.classList.toggle('bottom-dark', e.target.matches(DARK));
}, { rootMargin: '-94% 0px -20px 0px' });
for (const sec of sections) { topBand.observe(sec); bottomBand.observe(sec); }
let maxScroll = 1, progRaf = 0;
const measure = () => { maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight); };
new ResizeObserver(debounce(measure, 100)).observe(document.body);
measure();
addEventListener('scroll', () => {
  if (progRaf) return;
  progRaf = requestAnimationFrame(() => { progRaf = 0; prog.style.strokeDashoffset = C * (1 - Math.min(1, scrollY / maxScroll)); });
}, { passive: true });
document.body.classList.add('on-dark', 'bottom-dark');

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
