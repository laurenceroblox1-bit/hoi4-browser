// Procedurally drawn unit models: tanks, infantry, ships and planes in side/top profile.
// All models are drawn in a 100x60 design box and scaled.
const Models = (() => {
  const CAMO = { GER: '#5d625c', SOV: '#4d5a36', USA: '#5a5f39', ENG: '#6f6847', JAP: '#857650', ITA: '#a89463', FRA: '#6b7259', CHI: '#5f6a4a', POL: '#5a6040' };
  function camo(tag) { return CAMO[tag] || '#5e6145'; }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function poly(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
  function fillStroke(c, fill, stroke = 'rgba(0,0,0,0.75)', lw = 1.6) { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }

  function tracks(c, x, y, w, h, base) {
    rr(c, x, y, w, h, h / 2); fillStroke(c, '#2b2b28');
    const n = Math.max(4, Math.round(w / 11));
    for (let i = 0; i < n; i++) {
      const wx = x + h / 2 + i * (w - h) / (n - 1);
      c.beginPath(); c.arc(wx, y + h / 2, h * 0.36, 0, Math.PI * 2); fillStroke(c, shade(base, -0.25), '#111', 1);
      c.beginPath(); c.arc(wx, y + h / 2, h * 0.12, 0, Math.PI * 2); c.fillStyle = '#222'; c.fill();
    }
  }
  function cross(c, x, y, s, tag) {
    if (tag === 'GER') { c.fillStyle = '#fff'; c.fillRect(x - s, y - s * 0.35, s * 2, s * 0.7); c.fillRect(x - s * 0.35, y - s, s * 0.7, s * 2); c.fillStyle = '#111'; c.fillRect(x - s * 0.8, y - s * 0.18, s * 1.6, s * 0.36); c.fillRect(x - s * 0.18, y - s * 0.8, s * 0.36, s * 1.6); }
    else if (tag === 'SOV') { star(c, x, y, s, '#c22'); }
    else if (tag === 'USA') { c.beginPath(); c.arc(x, y, s, 0, 7); c.fillStyle = '#fff'; c.fill(); star(c, x, y, s * 0.9, '#1a3a8a'); }
    else if (tag === 'JAP') { c.beginPath(); c.arc(x, y, s * 0.8, 0, 7); c.fillStyle = '#c11'; c.fill(); }
    else if (tag === 'ENG' || tag === 'FRA') { c.beginPath(); c.arc(x, y, s, 0, 7); c.fillStyle = tag === 'ENG' ? '#1a3a8a' : '#c22'; c.fill(); c.beginPath(); c.arc(x, y, s * 0.66, 0, 7); c.fillStyle = '#fff'; c.fill(); c.beginPath(); c.arc(x, y, s * 0.33, 0, 7); c.fillStyle = tag === 'ENG' ? '#c22' : '#1a3a8a'; c.fill(); }
  }
  function star(c, x, y, r, col) {
    c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rad = i % 2 ? r * 0.42 : r; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } c.closePath(); c.fillStyle = col; c.fill();
  }

  const draw = {
    light_tank(c, tag) {
      const b = camo(tag);
      tracks(c, 18, 38, 64, 14, b);
      poly(c, [14, 40, 22, 28, 78, 28, 86, 40]); fillStroke(c, b);
      poly(c, [36, 28, 40, 18, 62, 18, 66, 28]); fillStroke(c, shade(b, 0.12));
      c.fillStyle = '#222'; c.fillRect(64, 21, 22, 3);
      cross(c, 50, 34, 4, tag);
    },
    medium_tank(c, tag) {
      const b = camo(tag);
      tracks(c, 10, 38, 78, 15, b);
      poly(c, [6, 41, 16, 27, 84, 27, 94, 41]); fillStroke(c, b);
      poly(c, [30, 27, 35, 15, 62, 14, 68, 27]); fillStroke(c, shade(b, 0.12));
      rr(c, 40, 10, 12, 6, 2); fillStroke(c, shade(b, 0.05));
      c.fillStyle = '#1f1f1f'; c.fillRect(66, 18, 32, 3.5); c.fillRect(95, 17, 4, 5.5);
      cross(c, 25, 34, 4.5, tag);
    },
    heavy_tank(c, tag) {
      const b = camo(tag);
      tracks(c, 6, 37, 86, 17, b);
      poly(c, [3, 40, 10, 24, 88, 24, 96, 40]); fillStroke(c, b);
      poly(c, [26, 24, 28, 9, 66, 9, 70, 24]); fillStroke(c, shade(b, 0.1));
      c.fillStyle = '#1b1b1b'; c.fillRect(68, 14, 34, 4.5); rr(c, 96, 12.5, 6, 7.5, 1.5); c.fill();
      cross(c, 46, 17, 4.5, tag);
    },
    halftrack(c, tag) {
      const b = camo(tag);
      tracks(c, 44, 40, 44, 13, b);
      c.beginPath(); c.arc(20, 46, 7, 0, 7); fillStroke(c, '#222');
      poly(c, [8, 42, 10, 30, 30, 26, 92, 26, 94, 42]); fillStroke(c, b);
      c.fillStyle = shade(b, -0.3); c.fillRect(40, 22, 48, 5);
      cross(c, 62, 34, 4, tag);
    },
    truck(c, tag) {
      const b = camo(tag);
      rr(c, 34, 14, 60, 26, 2); fillStroke(c, shade(b, 0.18));
      poly(c, [6, 40, 8, 26, 16, 20, 32, 20, 34, 40]); fillStroke(c, b);
      c.fillStyle = '#9fb7c4'; poly(c, [17, 22, 30, 22, 30, 30, 13, 30]); c.fill();
      for (const x of [20, 64, 82]) { c.beginPath(); c.arc(x, 44, 7, 0, 7); fillStroke(c, '#202020'); c.beginPath(); c.arc(x, 44, 2.5, 0, 7); c.fillStyle = '#666'; c.fill(); }
    },
    infantry(c, tag) {
      const b = camo(tag);
      for (const [ox, sc] of [[24, 0.85], [50, 1], [76, 0.85]]) {
        c.save(); c.translate(ox, 56); c.scale(sc, sc);
        // legs
        c.strokeStyle = shade(b, -0.35); c.lineWidth = 5; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-2, -18); c.lineTo(-7, -2); c.moveTo(2, -18); c.lineTo(7, -2); c.stroke();
        // body
        rr(c, -7, -36, 14, 20, 4); fillStroke(c, b);
        // head + helmet
        c.beginPath(); c.arc(0, -41, 5, 0, 7); fillStroke(c, '#d8b48a');
        c.beginPath(); c.ellipse(0, -44, 7.5, 4.5, 0, Math.PI, 0); fillStroke(c, shade(b, -0.2));
        // rifle
        c.strokeStyle = '#3a2a1a'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-10, -18); c.lineTo(12, -48); c.stroke();
        c.restore();
      }
    },
    cavalry(c, tag) {
      const b = camo(tag);
      c.fillStyle = '#6a4a2a';
      c.beginPath(); c.ellipse(48, 34, 24, 10, 0, 0, 7); fillStroke(c, '#6b4a2c');
      poly(c, [68, 30, 82, 14, 90, 16, 80, 34]); fillStroke(c, '#6b4a2c');
      c.strokeStyle = '#4a321e'; c.lineWidth = 4; c.beginPath(); for (const x of [32, 40, 58, 66]) { c.moveTo(x, 40); c.lineTo(x + (x % 3) - 1, 56); } c.stroke();
      rr(c, 40, 12, 12, 16, 3); fillStroke(c, b); c.beginPath(); c.arc(46, 8, 4.5, 0, 7); fillStroke(c, shade(b, -0.2));
    },
    artillery(c, tag) {
      const b = camo(tag);
      c.strokeStyle = '#2a2a24'; c.lineWidth = 5; c.beginPath(); c.moveTo(18, 30); c.lineTo(90, 8); c.stroke();
      poly(c, [26, 30, 50, 22, 56, 36, 30, 40]); fillStroke(c, b);
      c.strokeStyle = shade(b, -0.3); c.lineWidth = 4; c.beginPath(); c.moveTo(40, 38); c.lineTo(8, 52); c.stroke();
      c.beginPath(); c.arc(44, 44, 11, 0, 7); fillStroke(c, '#2a2a24'); c.beginPath(); c.arc(44, 44, 3, 0, 7); c.fillStyle = '#777'; c.fill();
    },
    at(c, tag) {
      const b = camo(tag);
      c.strokeStyle = '#222'; c.lineWidth = 4; c.beginPath(); c.moveTo(30, 34); c.lineTo(96, 30); c.stroke();
      poly(c, [36, 20, 56, 18, 58, 40, 38, 40]); fillStroke(c, b);
      c.strokeStyle = shade(b, -0.3); c.lineWidth = 4; c.beginPath(); c.moveTo(40, 40); c.lineTo(6, 52); c.stroke();
      c.beginPath(); c.arc(48, 46, 9, 0, 7); fillStroke(c, '#222');
    },
    aa(c, tag) {
      const b = camo(tag);
      c.strokeStyle = '#222'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(50, 32); c.lineTo(80, 4); c.moveTo(56, 34); c.lineTo(86, 8); c.stroke();
      rr(c, 34, 30, 32, 12, 3); fillStroke(c, b);
      c.strokeStyle = shade(b, -0.3); c.lineWidth = 4; c.beginPath(); c.moveTo(20, 54); c.lineTo(50, 40); c.lineTo(80, 54); c.stroke();
    },
    support(c, tag) {
      const b = camo(tag);
      rr(c, 18, 18, 64, 30, 4); fillStroke(c, shade(b, 0.1));
      c.fillStyle = '#fff'; c.fillRect(42, 24, 16, 18); c.fillStyle = '#c22'; c.fillRect(47, 26, 6, 14); c.fillRect(43, 30, 14, 6);
    },
    // ---------- ships (side view, facing right) ----------
    battleship(c, tag) { ship(c, tag, { len: 96, hull: 12, deck: 6, turrets: [[18, 1], [32, 1], [70, 1], [82, 1]], superstructure: [[42, 58, 16], [46, 54, 26]], funnels: [[60, 10]], big: true }); },
    heavy_cruiser(c, tag) { ship(c, tag, { len: 90, hull: 10, deck: 5, turrets: [[22, 0.8], [34, 0.8], [74, 0.8]], superstructure: [[44, 60, 12], [48, 56, 22]], funnels: [[62, 10], [67, 8]] }); },
    light_cruiser(c, tag) { ship(c, tag, { len: 82, hull: 9, deck: 4, turrets: [[22, 0.6], [32, 0.6], [74, 0.6]], superstructure: [[42, 58, 10], [46, 54, 18]], funnels: [[60, 9], [66, 9]] }); },
    destroyer(c, tag) { ship(c, tag, { len: 72, hull: 8, deck: 3, turrets: [[22, 0.45], [78, 0.45]], superstructure: [[30, 44, 10], [33, 40, 16]], funnels: [[50, 9], [58, 9]] }); },
    submarine(c, tag) {
      c.fillStyle = 'rgba(40,80,110,0.35)'; c.fillRect(0, 36, 100, 24);
      c.beginPath(); c.ellipse(50, 38, 44, 6.5, 0, 0, 7); fillStroke(c, '#3b4347');
      poly(c, [42, 32, 46, 20, 58, 20, 60, 32]); fillStroke(c, '#454e52');
      c.strokeStyle = '#222'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(52, 20); c.lineTo(52, 10); c.stroke();
    },
    carrier(c, tag) {
      c.fillStyle = 'rgba(40,80,110,0.35)'; c.fillRect(0, 40, 100, 20);
      poly(c, [2, 34, 98, 34, 92, 48, 10, 48]); fillStroke(c, '#5a6268');
      c.fillStyle = '#6e6656'; c.fillRect(0, 30, 100, 5); c.strokeStyle = '#111'; c.lineWidth = 1; c.strokeRect(0, 30, 100, 5);
      c.strokeStyle = '#ddd'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(4, 32.5); c.lineTo(96, 32.5); c.stroke(); c.setLineDash([]);
      rr(c, 66, 16, 12, 14, 1.5); fillStroke(c, '#5a6268'); c.fillStyle = '#333'; c.fillRect(70, 10, 5, 7);
      for (const x of [20, 34, 48]) planeTop(c, x, 27, 5);
    },
    // ---------- planes (top-down silhouettes) ----------
    fighter(c, tag) { plane(c, tag, { span: 70, len: 56, eng: 1, tail: 22 }); },
    cas(c, tag) { plane(c, tag, { span: 74, len: 54, eng: 1, tail: 24, gull: true }); },
    tac_bomber(c, tag) { plane(c, tag, { span: 92, len: 64, eng: 2, tail: 28 }); },
    nav_bomber(c, tag) { plane(c, tag, { span: 86, len: 60, eng: 2, tail: 26, torpedo: true }); },
    // ---------- misc icons ----------
    factory(c) {
      poly(c, [8, 52, 8, 28, 28, 38, 28, 28, 48, 38, 48, 28, 68, 38, 68, 12, 80, 12, 80, 52]); fillStroke(c, '#8a8274');
      c.fillStyle = '#d8c070'; for (const x of [16, 36, 56]) c.fillRect(x, 42, 6, 5);
      c.fillStyle = 'rgba(180,180,180,0.7)'; c.beginPath(); c.arc(76, 6, 5, 0, 7); c.arc(84, 2, 4, 0, 7); c.fill();
    },
    doctrine(c) { rr(c, 22, 8, 56, 44, 3); fillStroke(c, '#c9b98a'); c.strokeStyle = '#6a5a3a'; c.lineWidth = 2; for (let y = 18; y < 48; y += 7) { c.beginPath(); c.moveTo(30, y); c.lineTo(70, y); c.stroke(); } star(c, 50, 30, 9, '#a33'); },
    radio(c) { rr(c, 24, 22, 52, 32, 4); fillStroke(c, '#5d625c'); c.strokeStyle = '#222'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(66, 22); c.lineTo(80, 2); c.stroke(); c.fillStyle = '#d8c070'; c.beginPath(); c.arc(38, 38, 6, 0, 7); c.fill(); c.fillStyle = '#222'; c.fillRect(52, 32, 16, 3); c.fillRect(52, 40, 16, 3); },
    rifle(c) { c.strokeStyle = '#3a2a1a'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(10, 42); c.lineTo(60, 26); c.stroke(); c.strokeStyle = '#333'; c.lineWidth = 3; c.beginPath(); c.moveTo(56, 27); c.lineTo(94, 16); c.stroke(); },
  };
  function ship(c, tag, o) {
    const x0 = (100 - o.len) / 2, x1 = x0 + o.len, wl = 40;
    c.fillStyle = 'rgba(40,80,110,0.35)'; c.fillRect(0, wl, 100, 20);
    poly(c, [x0, wl - o.hull + 2, x1 + 3, wl - o.hull, x1 - 4, wl + 4, x0 + 5, wl + 4]); fillStroke(c, '#5f676c');
    c.fillStyle = '#7a3a32'; c.fillRect(x0 + 6, wl + 1, o.len - 10, 3);
    for (const [x, y0, h] of o.superstructure.map(([a, b, h]) => [x0 + (a - 10) * o.len / 90, 0, h])) {
      const w = o.len * 0.14; rr(c, x - w / 2 + 6, wl - o.hull - h + 4, w, h, 1.5); fillStroke(c, '#6c7479');
    }
    for (const [fx, fh] of o.funnels) { const x = x0 + (fx - 10) * o.len / 90; rr(c, x, wl - o.hull - fh - 2, 5, fh, 1); fillStroke(c, '#4a4f52'); }
    for (const [tx, sz] of o.turrets) {
      const x = x0 + (tx - 10) * o.len / 90, y = wl - o.hull;
      rr(c, x - 5 * sz, y - 5 * sz, 10 * sz, 5 * sz + 1, 2); fillStroke(c, '#555c60', '#111', 1);
      c.strokeStyle = '#222'; c.lineWidth = 1.8 * sz + 0.5; c.beginPath();
      const dir = tx < 50 ? -1 : 1; c.moveTo(x, y - 3 * sz); c.lineTo(x + dir * 10 * sz, y - 4 * sz); c.stroke();
    }
    c.strokeStyle = '#222'; c.lineWidth = 1.2; const mx = x0 + o.len * 0.42; c.beginPath(); c.moveTo(mx, wl - o.hull - 20); c.lineTo(mx, wl - o.hull - 34); c.stroke();
    if (tag) { c.fillStyle = colorOf(tag); c.fillRect(x1 - 6, wl - o.hull - 10, 7, 5); }
  }
  function planeTop(c, x, y, s) {
    c.fillStyle = '#3c4144'; c.fillRect(x - s, y - s * 0.2, s * 2, s * 0.4); c.fillRect(x - s * 0.18, y - s * 0.6, s * 0.36, s * 1.4);
  }
  function plane(c, tag, o) {
    const b = tag === 'JAP' ? '#7f8a6a' : tag === 'SOV' ? '#4f5e3a' : tag === 'USA' ? '#6b6f4a' : tag === 'ENG' ? '#6a6447' : '#5f6862';
    c.save(); c.translate(50, 30); c.rotate(-Math.PI / 2); c.translate(-30, -50);
    // fuselage along x (nose right after rotation -> nose up)
    const L = o.len, cx = 30;
    c.beginPath(); c.ellipse(cx, 50, 6, L / 2, 0, 0, 7); fillStroke(c, b);
    // wings
    const wy = 50 + (o.gull ? -2 : -4);
    poly(c, [cx - o.span / 2, wy + 4, cx - o.span / 2 + 4, wy - 6, cx + o.span / 2 - 4, wy - 6, cx + o.span / 2, wy + 4]); fillStroke(c, shade(b, 0.08));
    // tail
    const ty = 50 + L / 2 - 6;
    poly(c, [cx - o.tail / 2, ty + 4, cx - o.tail / 2 + 3, ty - 3, cx + o.tail / 2 - 3, ty - 3, cx + o.tail / 2, ty + 4]); fillStroke(c, shade(b, 0.08));
    // engines
    if (o.eng === 2) for (const ex of [cx - o.span * 0.22, cx + o.span * 0.22]) { c.beginPath(); c.ellipse(ex, wy - 6, 4, 9, 0, 0, 7); fillStroke(c, shade(b, -0.2)); }
    if (o.torpedo) { c.fillStyle = '#333'; c.fillRect(cx - 2, 44, 4, 18); }
    // canopy
    c.beginPath(); c.ellipse(cx, 50 - L * 0.18, 2.8, 5, 0, 0, 7); c.fillStyle = '#9fc4d8'; c.fill();
    cross(c, cx - o.span * 0.34, wy - 1, 4, tag); cross(c, cx + o.span * 0.34, wy - 1, 4, tag);
    // propeller
    c.fillStyle = 'rgba(30,30,30,0.6)'; c.fillRect(cx - 9, 50 - L / 2 - 2, 18, 2);
    c.restore();
  }
  function colorOf(tag) { return (window.COUNTRIES && COUNTRIES[tag] && COUNTRIES[tag].color) || '#888'; }

  const cache = new Map();
  // Draws model `kind` into ctx at (x, y) with width w (height = w*0.6).
  function render(ctx, kind, x, y, w, tag, flip) {
    const f = draw[kind]; if (!f) return;
    ctx.save(); ctx.translate(x, y);
    if (flip) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.scale(w / 100, w / 100); f(ctx, tag); ctx.restore();
  }
  // Cached image (canvas) of a model, used for map counters and UI icons.
  function image(kind, tag, w = 100) {
    const key = kind + '|' + tag + '|' + w;
    if (cache.has(key)) return cache.get(key);
    const cv = document.createElement('canvas'); const dpr = 2;
    cv.width = w * dpr; cv.height = Math.round(w * 0.6) * dpr;
    const c = cv.getContext('2d'); c.scale(dpr, dpr); render(c, kind, 0, 0, w, tag);
    cache.set(key, cv); return cv;
  }
  function url(kind, tag, w = 100) {
    const key = 'url|' + kind + '|' + tag + '|' + w;
    if (cache.has(key)) return cache.get(key);
    const u = image(kind, tag, w).toDataURL(); cache.set(key, u); return u;
  }
  return { render, image, url, kinds: Object.keys(draw), camo, shade };
})();
