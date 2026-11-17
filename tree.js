/* 책나무 — 나무 생성/렌더링
 * 나무 전체 구조는 고정된 시드로 한 번만 만들고,
 * 기록 수(n)에 따라 어느 가지까지 보이고 얼마나 뻗었는지만 바뀐다.
 * 그래서 기록이 늘어도 기존 잎의 자리는 그대로 유지된다.
 */
(function () {
  'use strict';

  // 가지 깊이별로 처음 나타나는 기록 수
  const UNLOCK = [1, 2, 4, 8, 15, 25, 40, 60];
  const MAX_DEPTH = UNLOCK.length - 1;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildBranches() {
    const r = rng(1117);
    const out = [];
    (function grow(x, y, ang, len, w, d) {
      const x2 = x + Math.cos(ang) * len;
      const y2 = y + Math.sin(ang) * len;
      const bend = (r() - 0.5) * len * 0.3;
      const cx = (x + x2) / 2 + Math.cos(ang + Math.PI / 2) * bend;
      const cy = (y + y2) / 2 + Math.sin(ang + Math.PI / 2) * bend;
      out.push({ x1: x, y1: y, cx, cy, x2, y2, w, d });
      if (d >= MAX_DEPTH) return;
      const kids = d === 0 ? 3 : r() < 0.3 ? 3 : 2;
      for (let i = 0; i < kids; i++) {
        const t = (i / (kids - 1)) * 2 - 1;
        const spread = d === 0 ? 0.62 : 0.38 + r() * 0.22;
        let a = ang + t * spread + (r() - 0.5) * 0.22;
        a += (-Math.PI / 2 - a) * 0.12; // 위로 뻗으려는 성질
        grow(x2, y2, a, len * (0.7 + r() * 0.12), w * 0.64, d + 1);
      }
    })(0, 0, -Math.PI / 2, 120, 24, 0);
    return out;
  }

  function buildSlots(branches) {
    const r = rng(42);
    const slots = [];
    branches.forEach((b, i) => {
      const ts = b.d === 0 ? [1, 0.9] : b.d === 1 ? [1, 0.85] : [0.45, 0.72, 1];
      ts.forEach((t, k) =>
        slots.push({ b: i, t, side: k % 2 ? 1 : -1, jit: r(), key: r(), u: UNLOCK[b.d] })
      );
    });
    slots.sort((a, b) => a.u - b.u || a.key - b.key);
    return slots;
  }

  const BRANCHES = buildBranches();
  const SLOTS = buildSlots(BRANCHES);

  function growFrac(d, n) {
    if (n < UNLOCK[d]) return 0;
    const span = d < MAX_DEPTH ? UNLOCK[d + 1] - UNLOCK[d] : 20;
    return Math.min(1, 0.35 + (0.65 * (n - UNLOCK[d])) / span);
  }

  // 가지를 frac 지점에서 자른 2차 베지어 (de Casteljau)
  function cut(b, f) {
    const q1x = b.x1 + (b.cx - b.x1) * f;
    const q1y = b.y1 + (b.cy - b.y1) * f;
    const p = bez(b, f);
    return { x1: b.x1, y1: b.y1, cx: q1x, cy: q1y, x2: p.x, y2: p.y };
  }
  function bez(b, t) {
    const u = 1 - t;
    return {
      x: u * u * b.x1 + 2 * u * t * b.cx + t * t * b.x2,
      y: u * u * b.y1 + 2 * u * t * b.cy + t * t * b.y2,
    };
  }
  function tangent(b, t) {
    const dx = 2 * (1 - t) * (b.cx - b.x1) + 2 * t * (b.x2 - b.cx);
    const dy = 2 * (1 - t) * (b.cy - b.y1) + 2 * t * (b.y2 - b.cy);
    return Math.atan2(dy, dx);
  }

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f1 = (v) => Math.round(v * 10) / 10;

  const LEAF_PATH = 'M0 0C4 -6 12 -7 18 0C12 7 4 6 0 0Z';
  const PETALS = [0, 72, 144, 216, 288]
    .map((a) => `<ellipse cx="4.6" cy="0" rx="4.4" ry="3" transform="rotate(${a})"/>`)
    .join('');

  /**
   * leaves: [{ id, title, color, bloom }] — 기록한 순서대로
   * opts: { newId }
   */
  function render(svg, leaves, opts = {}) {
    const n = leaves.length;
    const wf = 0.3 + 0.7 * Math.min(1, n / 50);
    let minX = -60, maxX = 60, minY = -150;
    const parts = [];

    const drawn = BRANCHES.map((b) => {
      const f = growFrac(b.d, n);
      return f > 0 ? cut(b, f) : null;
    });

    // 가지
    BRANCHES.forEach((b, i) => {
      const c = drawn[i];
      if (!c) return;
      minX = Math.min(minX, c.x2); maxX = Math.max(maxX, c.x2); minY = Math.min(minY, c.y2);
      parts.push(
        `<path class="branch d${b.d}" stroke-width="${f1(Math.max(1, b.w * wf))}" d="M${f1(c.x1)} ${f1(c.y1)}Q${f1(c.cx)} ${f1(c.cy)} ${f1(c.x2)} ${f1(c.y2)}"/>`
      );
    });

    // 잎 / 꽃
    const visible = SLOTS.filter((s) => n >= s.u);
    leaves.forEach((leaf, i) => {
      if (!visible.length) return;
      const s = visible[i % visible.length];
      const lap = Math.floor(i / visible.length);
      const c = drawn[s.b];
      const p = bez(c, s.t);
      const ang = tangent(c, s.t);
      const off = lap * 7 * s.side;
      const x = p.x + Math.cos(ang + Math.PI / 2) * off;
      const y = p.y + Math.sin(ang + Math.PI / 2) * off;
      minX = Math.min(minX, x - 20); maxX = Math.max(maxX, x + 20); minY = Math.min(minY, y - 20);
      const cls = 'leaf' + (leaf.bloom ? ' bloom' : '') + (leaf.id === opts.newId ? ' pop' : '');
      const title = `<title>${esc(leaf.title)}</title>`;
      if (leaf.bloom) {
        parts.push(
          `<g class="${cls}" data-id="${esc(leaf.id)}" transform="translate(${f1(x)} ${f1(y)})">${title}<g class="shape"><g class="petals">${PETALS}</g><circle r="2.8" fill="${esc(leaf.color)}"/></g></g>`
        );
      } else {
        const deg = ((ang + s.side * (0.7 + s.jit * 0.6)) * 180) / Math.PI;
        parts.push(
          `<g class="${cls}" data-id="${esc(leaf.id)}" transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(deg)})">${title}<g class="shape"><path d="${LEAF_PATH}" fill="${esc(leaf.color)}"/><path class="rib" d="M1.5 0L14 0"/></g></g>`
        );
      }
    });

    const seed = n === 0
      ? `<g class="seed"><ellipse cx="0" cy="-2" rx="8" ry="5.5"/><path class="seed-line" d="M-4 -3Q0 -6 4 -3"/></g>`
      : '';

    svg.innerHTML =
      `<rect class="ground" x="-6000" y="0" width="12000" height="6000"/>` +
      `<ellipse class="mound" cx="0" cy="3" rx="${f1(24 + 70 * wf)}" ry="${f1(5 + 7 * wf)}"/>` +
      seed +
      `<g class="sway">${parts.join('')}</g>`;

    fitView(svg, minX, maxX, minY, !!opts.animate);
  }

  function fitView(svg, minX, maxX, minY, animate) {
    const pad = 36;
    const bottom = 34;
    let w = 2 * (Math.max(Math.abs(minX), Math.abs(maxX)) + pad);
    let h = Math.max(260, bottom - (minY - pad));
    const rect = svg.getBoundingClientRect();
    const ratio = rect.width && rect.height ? rect.width / rect.height : 1;
    if (w / h < ratio) w = h * ratio;
    else h = w / ratio;
    const target = [-w / 2, bottom - h, w, h];
    const from = svg._vb;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    cancelAnimationFrame(svg._raf);
    if (!from || !animate || reduce) {
      setVB(svg, target);
      return;
    }
    const t0 = performance.now();
    const dur = 1100;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setVB(svg, from.map((v, i) => v + (target[i] - v) * e));
      if (k < 1) svg._raf = requestAnimationFrame(step);
    };
    svg._raf = requestAnimationFrame(step);
  }

  function setVB(svg, vb) {
    svg._vb = vb;
    svg.setAttribute('viewBox', vb.map(f1).join(' '));
  }

  window.ReadingTree = { render };
})();
