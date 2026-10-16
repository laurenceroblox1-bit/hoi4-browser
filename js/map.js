// Map renderer and input handling (canvas 2D).
const MapView = (() => {
  let cv, ctx, W, H, dpr = 1;
  const cam = { x: 1900, y: 500, z: 0.5 };
  let provPaths = [], provBox = [], seaPaths = [];
  let segs = null; // Float32Array x1,y1,x2,y2 ; segA, segB
  let borderPath = null, coastPath = null, provBorderPath = null, occPath = null;
  let labels = [];
  let dirty = true, needsBorders = true;
  let oceanPattern = null, landPattern = null, hatch = null;
  let mode = 'political';
  let wxHour = -1, snowPath = new Path2D(), mudPath = new Path2D();
  const hit = { counters: [], fleets: [], battles: [] };
  let hover = null, hoverSea = null;
  const hitCtx = document.createElement('canvas').getContext('2d');

  function init(canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    buildGeometry();
    buildPatterns();
    resize(); window.addEventListener('resize', resize);
    bindInput();
    requestAnimationFrame(frame);
  }
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; dirty = true;
    cam.z = Math.max(cam.z, minZoom());
  }
  function minZoom() { return Math.max(W / WORLD.W, H / WORLD.H) * 0.98; }

  function buildGeometry() {
    const segMap = new Map();
    provPaths = WORLD.provinces.map(p => {
      const path = new Path2D(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const r of p.r) {
        path.moveTo(r[0], r[1]);
        for (let i = 2; i < r.length; i += 2) path.lineTo(r[i], r[i + 1]);
        path.closePath();
        for (let i = 0; i < r.length; i += 2) {
          const x = r[i], y = r[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          const j = (i + 2) % r.length; const xb = r[j], yb = r[j + 1];
          const k = (x < xb || (x === xb && y < yb)) ? `${x},${y},${xb},${yb}` : `${xb},${yb},${x},${y}`;
          const e = segMap.get(k); if (e) { if (e[1] === -1 && e[0] !== p.id) e[1] = p.id; } else segMap.set(k, [p.id, -1]);
        }
      }
      provBox[p.id] = [x0, y0, x1, y1];
      return path;
    });
    const n = segMap.size; segs = { c: new Float32Array(n * 4), a: new Int32Array(n), b: new Int32Array(n), n };
    let i = 0;
    for (const [k, v] of segMap) { const [a, b, c, d] = k.split(',').map(Number); segs.c.set([a, b, c, d], i * 4); segs.a[i] = v[0]; segs.b[i] = v[1]; i++; }
    seaPaths = WORLD.seas.map(s => { const p = new Path2D(); const r = s.r; if (r.length) { p.moveTo(r[0], r[1]); for (let i = 2; i < r.length; i += 2) p.lineTo(r[i], r[i + 1]); p.closePath(); } return p; });
  }
  function noiseCanvas(w, h, base, amp, seed = 1) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    const img = x.createImageData(w, h); let s = seed;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < w * h; i++) { const v = (r() - 0.5) * amp; img.data[i * 4] = base[0] + v; img.data[i * 4 + 1] = base[1] + v; img.data[i * 4 + 2] = base[2] + v; img.data[i * 4 + 3] = base[3]; }
    x.putImageData(img, 0, 0);
    // soft blotches
    for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 * r()})`; x.beginPath(); x.arc(r() * w, r() * h, 10 + r() * 60, 0, 7); x.fill(); }
    return c;
  }
  function buildPatterns() {
    const oc = noiseCanvas(256, 256, [30, 52, 74, 255], 18, 7);
    oceanPattern = ctx.createPattern(oc, 'repeat');
    landPattern = ctx.createPattern(noiseCanvas(256, 256, [128, 128, 128, 40], 90, 3), 'repeat');
    const hc = document.createElement('canvas'); hc.width = hc.height = 12; const hx = hc.getContext('2d');
    hx.strokeStyle = 'rgba(0,0,0,0.55)'; hx.lineWidth = 3; hx.beginPath(); hx.moveTo(-2, 14); hx.lineTo(14, -2); hx.stroke();
    hatch = ctx.createPattern(hc, 'repeat');
  }

  function rebuildBorders() {
    const P = G.provs; const bp = new Path2D(), cp = new Path2D(), pp = new Path2D();
    const keyOf = p => mode === 'factions' ? (G.countries[p.ctrl]?.faction || p.ctrl) : p.ctrl;
    for (let i = 0; i < segs.n; i++) {
      const a = segs.a[i], b = segs.b[i]; const o = i * 4;
      const tgt = b === -1 ? cp : (keyOf(P[a]) !== keyOf(P[b]) ? bp : pp);
      tgt.moveTo(segs.c[o], segs.c[o + 1]); tgt.lineTo(segs.c[o + 2], segs.c[o + 3]);
    }
    borderPath = bp; coastPath = cp; provBorderPath = pp;
    occPath = new Path2D(); for (const p of P) if (p.ctrl !== p.owner) occPath.addPath(provPaths[p.id]);
    computeLabels();
    needsBorders = false;
  }
  function computeLabels() {
    labels = [];
    const byTag = {};
    for (const p of G.provs) (byTag[p.ctrl] = byTag[p.ctrl] || []).push(p);
    const areaOf = id => { const b = provBox[id]; return (b[2] - b[0]) * (b[3] - b[1]); };
    for (const tag in byTag) {
      const c = G.countries[tag]; if (!c) continue;
      const set = new Set(byTag[tag].map(p => p.id)); const seen = new Set(); const comps = [];
      for (const p of byTag[tag]) {
        if (seen.has(p.id)) continue;
        const comp = []; const q = [p.id]; seen.add(p.id);
        while (q.length) { const cur = q.pop(); comp.push(cur); for (const n of G.provs[cur].adj) if (set.has(n) && !seen.has(n)) { seen.add(n); q.push(n); } }
        comps.push({ ids: comp, area: comp.reduce((s, id) => s + areaOf(id), 0), cap: comp.includes(c.capital) });
      }
      comps.sort((a, b) => b.area - a.area);
      const big = comps[0].area;
      const chosen = comps.filter((k, i) => (i === 0 || k.cap || k.area >= big * 0.3) && k.area >= 250).slice(0, 3);
      for (const comp of chosen) addLabel(c, comp.ids);
    }
  }
  function addLabel(c, ids) {
    // principal axis of the province centroids (weighted by sqrt of area)
    let sx = 0, sy = 0, sw = 0;
    const W8 = id => { const b = provBox[id]; return Math.sqrt((b[2] - b[0]) * (b[3] - b[1]) + 1); };
    for (const id of ids) { const w = W8(id); sx += G.provs[id].c[0] * w; sy += G.provs[id].c[1] * w; sw += w; }
    const mx = sx / sw, my = sy / sw; let cxx = 0, cyy = 0, cxy = 0;
    for (const id of ids) { const w = W8(id); const dx = G.provs[id].c[0] - mx, dy = G.provs[id].c[1] - my; cxx += dx * dx * w; cyy += dy * dy * w; cxy += dx * dy * w; }
    let ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
    if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
    ang = clamp(ang, -0.55, 0.55);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const us = [], vs = [];
    for (const id of ids) {
      const b = provBox[id], p = G.provs[id];
      for (const [x, y] of [p.c, [b[0], p.c[1]], [b[2], p.c[1]], [p.c[0], b[1]], [p.c[0], b[3]]]) { us.push((x - mx) * ca + (y - my) * sa); vs.push(-(x - mx) * sa + (y - my) * ca); }
    }
    us.sort((a, b) => a - b); vs.sort((a, b) => a - b);
    const q = (arr, f) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(arr.length * f)))];
    const u0 = q(us, 0.04), u1 = q(us, 0.96), v0 = q(vs, 0.1), v1 = q(vs, 0.9);
    const uc = (u0 + u1) / 2, vc = q(vs, 0.5);
    const len = (u1 - u0) * 0.85, thick = (v1 - v0) * 0.6;
    const text = c.name.toUpperCase();
    ctx.font = 'bold 10px "Trebuchet MS", sans-serif';
    const tw = ctx.measureText(text).width + text.length * 1.8;
    const size = Math.max(3, Math.min(len / tw * 10, thick, 150));
    labels.push({ tag: c.tag, text, x: mx + uc * ca - vc * sa, y: my + uc * sa + vc * ca, ang, size });
  }
  function fillColor(p) {
    const c = G.countries[p.ctrl];
    if (mode === 'terrain') return TERRAIN[p.terr].color;
    if (mode === 'factions') { const f = c && c.faction && G.factions[c.faction]; return f ? f.color : (c ? '#8a8a7a' : '#666'); }
    if (mode === 'ideology') return c ? IDEOLOGIES[c.ideo].color : '#666';
    if (mode === 'industry') { const v = p.civ + p.mil * 1.5 + p.dock; return v === 0 ? '#5a5a52' : `hsl(${40 - Math.min(40, v * 4)}, 70%, ${Math.min(60, 30 + v * 3)}%)`; }
    return c ? c.color : '#666';
  }

  // ---------- frame ----------
  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    if (G.started) Game.advance(dt);
    draw(dt);
    requestAnimationFrame(frame);
  }
  function worldToScreen(x, y) { return [(x - cam.x) * cam.z + W / 2, (y - cam.y) * cam.z + H / 2]; }
  function screenToWorld(x, y) { return [(x - W / 2) / cam.z + cam.x, (y - H / 2) / cam.z + cam.y]; }
  function clampCam() {
    cam.z = clamp(cam.z, minZoom(), 12);
    const hw = W / 2 / cam.z, hh = H / 2 / cam.z;
    cam.x = clamp(cam.x, hw, WORLD.W - hw); cam.y = clamp(cam.y, hh, WORLD.H - hh);
  }

  function draw(dt) {
    if (!G.provs || !G.provs.length) return;
    if (needsBorders) rebuildBorders();
    clampCam();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // ocean
    ctx.fillStyle = '#1d3349'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    const [vx0, vy0] = screenToWorld(0, 0), [vx1, vy1] = screenToWorld(W, H);
    ctx.fillStyle = oceanPattern; ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    // vignette-ish depth gradient
    const g = ctx.createRadialGradient(cam.x, cam.y, 50 / cam.z, cam.x, cam.y, Math.max(vx1 - vx0, vy1 - vy0));
    g.addColorStop(0, 'rgba(60,100,140,0.12)'); g.addColorStop(1, 'rgba(0,10,25,0.45)'); ctx.fillStyle = g; ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    // sea zones
    if (cam.z > 0.8 || UI.selectedFleet) {
      ctx.lineWidth = 1 / cam.z; ctx.strokeStyle = 'rgba(160,200,230,0.10)';
      for (const p of seaPaths) ctx.stroke(p);
    }
    if (hoverSea != null && UI.selectedFleet) { ctx.fillStyle = 'rgba(160,210,255,0.15)'; ctx.fill(seaPaths[hoverSea]); }
    // coast glow
    ctx.strokeStyle = 'rgba(150,190,210,0.25)'; ctx.lineWidth = 6 / cam.z; ctx.lineJoin = 'round'; ctx.stroke(coastPath);
    // land
    const P = G.provs;
    for (let i = 0; i < P.length; i++) {
      const b = provBox[i]; if (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1) continue;
      ctx.fillStyle = fillColor(P[i]); ctx.fill(provPaths[i]);
    }
    // texture + shading
    ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = landPattern;
    for (let i = 0; i < P.length; i++) { const b = provBox[i]; if (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1) continue; ctx.fill(provPaths[i]); }
    ctx.globalCompositeOperation = 'source-over';
    if (mode === 'political') { ctx.fillStyle = hatch; ctx.globalAlpha = 0.35; ctx.fill(occPath); ctx.globalAlpha = 1; }
    // winter snow & autumn mud
    if (G.started) {
      if (G.hour - G.hour % 24 !== wxHour) { wxHour = G.hour - G.hour % 24; snowPath = new Path2D(); mudPath = new Path2D(); for (const p of P) { const w = Sim.weather(p); if (w === 'mud') mudPath.addPath(provPaths[p.id]); else if (w) snowPath.addPath(provPaths[p.id]); } }
      ctx.fillStyle = 'rgba(245,250,255,0.32)'; ctx.fill(snowPath);
      ctx.fillStyle = 'rgba(90,60,30,0.22)'; ctx.fill(mudPath);
    }
    // selection highlights
    if (hover != null) { ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill(provPaths[hover]); }
    if (UI.selectedProv != null) { ctx.strokeStyle = 'rgba(255,240,180,0.9)'; ctx.lineWidth = 2 / cam.z; ctx.stroke(provPaths[UI.selectedProv]); }
    if (UI.invasionMode) { for (const p of P) if (p.coastal && atWar(G.player, p.ctrl)) { ctx.fillStyle = 'rgba(80,160,255,0.25)'; ctx.fill(provPaths[p.id]); } }
    // borders
    if (cam.z > 0.9) { ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.7 / cam.z; ctx.stroke(provBorderPath); }
    ctx.strokeStyle = 'rgba(20,16,12,0.85)'; ctx.lineWidth = Math.max(1.4 / cam.z, 0.6); ctx.stroke(borderPath);
    ctx.strokeStyle = 'rgba(15,25,35,0.9)'; ctx.lineWidth = 1 / cam.z; ctx.stroke(coastPath);
    // capitals & cities
    if (cam.z > 0.75) drawCities();
    // labels
    drawLabels();
    // movement arrows
    drawArrows();
    // flights & effects
    drawFlights(dt);
    ctx.restore();
    // screen-space overlays
    drawBattles();
    drawFleets();
    drawUnits();
    drawSelectionBox();
  }
  function drawCities() {
    ctx.font = `${11 / cam.z}px Georgia`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const p of G.provs) {
      if (!p.name || p.vp < (cam.z > 2 ? 1 : cam.z > 1.3 ? 5 : 15)) continue;
      const [x, y] = p.cp; const isCap = G.countries[p.owner]?.capital === p.id;
      const r = (isCap ? 3.2 : 2) / cam.z;
      ctx.fillStyle = isCap ? '#f0d070' : '#e8e0c8'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1 / cam.z;
      if (isCap) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r * 0.45 : r * 1.4; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke(); }
      if (cam.z > 1.1) { ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillText(p.name, x + 5 / cam.z + 0.6 / cam.z, y + 0.6 / cam.z); ctx.fillStyle = '#f2ead6'; ctx.fillText(p.name, x + 5 / cam.z, y); }
    }
  }
  function drawLabels() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const l of labels) {
      const px = l.size * cam.z; if (px < 7 || px > 220) continue;
      ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.ang);
      ctx.font = `bold ${l.size}px "Trebuchet MS", sans-serif`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${l.size * 0.18}px`;
      ctx.globalAlpha = clamp((px - 7) / 6, 0, 1) * (cam.z > 2.2 ? 0.55 : 0.85);
      ctx.lineWidth = l.size * 0.09; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(l.text, 0, 0);
      ctx.fillStyle = 'rgba(235,228,210,0.88)'; ctx.fillText(l.text, 0, 0);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function drawArrows() {
    const sel = UI.selected || new Set();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const d of G.divisions.values()) {
      const mineSel = sel.has(d.id);
      if (d.state === 'naval' && (d.tag === G.player || mineSel)) {
        const a = G.provs[d.inv.from].cp, b = G.provs[d.inv.target].cp; const t = 1 - d.inv.hours / d.inv.total;
        ctx.setLineDash([6 / cam.z, 5 / cam.z]); ctx.strokeStyle = 'rgba(120,190,255,0.9)'; ctx.lineWidth = 2.5 / cam.z;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
        const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t; const s = 26 / cam.z;
        Models.render(ctx, 'destroyer', x - s / 2, y - s * 0.4, s, d.tag, b[0] < a[0]);
        continue;
      }
      if (!d.path.length || (d.tag !== G.player && !mineSel && !(cam.z > 1.5 && atWar(d.tag, G.player)))) continue;
      const pts = [G.provs[d.prov].c, ...d.path.map(id => G.provs[id].c)];
      const own = d.tag === G.player;
      ctx.strokeStyle = d.attacking != null ? 'rgba(230,60,40,0.95)' : own ? (mineSel ? 'rgba(120,255,120,0.95)' : 'rgba(110,220,110,0.7)') : 'rgba(255,90,60,0.6)';
      ctx.lineWidth = (mineSel ? 3.2 : 2.2) / cam.z;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
      const a = pts[pts.length - 2], b = pts[pts.length - 1]; const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); const s = 9 / cam.z;
      ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0] - Math.cos(ang - 0.45) * s, b[1] - Math.sin(ang - 0.45) * s); ctx.lineTo(b[0] - Math.cos(ang + 0.45) * s, b[1] - Math.sin(ang + 0.45) * s); ctx.closePath(); ctx.fill();
    }
    for (const f of G.fleets.values()) {
      if (!f.path.length || (f.tag !== G.player && UI.selectedFleet !== f.id)) continue;
      ctx.strokeStyle = 'rgba(140,200,255,0.85)'; ctx.lineWidth = 2 / cam.z; ctx.setLineDash([8 / cam.z, 6 / cam.z]);
      ctx.beginPath(); ctx.moveTo(...G.seas[f.sea].c); for (const s of f.path) ctx.lineTo(...G.seas[s].c); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  function drawFlights(dt) {
    G.flights = G.flights.filter(f => f.t < 1);
    for (const f of G.flights) {
      f.t += dt * 0.45;
      const k = f.t < 0.5 ? f.t * 2 : 2 - f.t * 2; // there and back
      const x = f.from[0] + (f.to[0] - f.from[0]) * k, y = f.from[1] + (f.to[1] - f.from[1]) * k;
      const ang = Math.atan2(f.to[1] - f.from[1], f.to[0] - f.from[0]) + (f.t < 0.5 ? 0 : Math.PI);
      const s = 22 / cam.z;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang + Math.PI / 2);
      for (const [ox, oy] of [[0, 0], [-s * 0.7, s * 0.5], [s * 0.7, s * 0.5]]) Models.render(ctx, f.type, ox - s / 2, oy - s * 0.3, s, f.tag);
      ctx.restore();
    }
  }

  // ---------- screen-space unit counters ----------
  function drawUnits() {
    hit.counters = [];
    const showAll = cam.z >= 0.65;
    const showOthers = cam.z >= 3;
    const sel = UI.selected || new Set();
    ctx.textBaseline = 'middle';
    const byProv = new Map();
    for (const d of G.divisions.values()) {
      if (d.state === 'naval') continue;
      const relevant = d.tag === G.player || atWar(d.tag, G.player) || allied(d.tag, G.player) || sel.has(d.id);
      if (!relevant && !showOthers) continue;
      if (!showAll && d.tag !== G.player && !atWar(d.tag, G.player)) continue;
      const k = d.prov; if (!byProv.has(k)) byProv.set(k, new Map());
      const m = byProv.get(k); if (!m.has(d.tag)) m.set(d.tag, []); m.get(d.tag).push(d);
    }
    for (const [pid, tags] of byProv) {
      const p = G.provs[pid];
      let [sx, sy] = worldToScreen(p.c[0], p.c[1]);
      if (sx < -60 || sy < -40 || sx > W + 60 || sy > H + 40) continue;
      let row = 0;
      for (const [tag, divs] of tags) {
        const lead = divs[0];
        const moving = divs.filter(d => d.path.length && d.state !== 'idle');
        let ox = 0, oy = 0;
        // interpolate position of a moving single stack
        if (moving.length === divs.length && moving[0].path.length) {
          const n = G.provs[moving[0].path[0]]; const dist = provinceDistanceKm(p, n); const t = Math.min(0.9, moving[0].prog / Math.max(1, dist));
          const [nx, ny] = worldToScreen(n.c[0], n.c[1]); ox = (nx - sx) * t * (moving[0].attacking != null ? 0.3 : 1); oy = (ny - sy) * t * (moving[0].attacking != null ? 0.3 : 1);
        }
        const small = !showAll;
        const w = small ? 30 : 58, h = small ? 16 : 26;
        const x = sx + ox - w / 2, y = sy + oy - h / 2 + row * (h + 3) - (tags.size - 1) * (h + 3) / 2;
        const c = G.countries[tag];
        const isSel = divs.some(d => sel.has(d.id));
        const enemy = atWar(tag, G.player);
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + 2, y + 2, w, h);
        ctx.fillStyle = Models.shade(c.color, -0.25); ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, y, w, h / 2);
        ctx.lineWidth = isSel ? 2.5 : 1; ctx.strokeStyle = isSel ? '#9cff7a' : enemy ? '#ff6050' : tag === G.player ? '#e8d9a8' : '#111'; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        if (!small) {
          ctx.drawImage(Models.image(lead.stats.model, tag, 60), x + 2, y + 2, 34, 20.4);
          ctx.fillStyle = '#fff'; ctx.font = 'bold 12px "Trebuchet MS"'; ctx.textAlign = 'right';
          ctx.fillText(divs.length, x + w - 4, y + h / 2 - 2);
          // strength & org bars
          const str = divs.reduce((s, d) => s + d.str, 0) / divs.length, org = divs.reduce((s, d) => s + d.org / Math.max(1, d.stats.org), 0) / divs.length;
          ctx.fillStyle = '#222'; ctx.fillRect(x, y + h, w, 5);
          ctx.fillStyle = '#4fbf4f'; ctx.fillRect(x, y + h, w * org, 2.5);
          ctx.fillStyle = '#d8c060'; ctx.fillRect(x, y + h + 2.5, w * str, 2.5);
          if (divs.some(d => !d.supplied)) { ctx.fillStyle = '#ff5040'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('!', x + w - 12, y + h - 6); }
        } else {
          ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(divs.length, x + w / 2, y + h / 2 + 1);
        }
        hit.counters.push({ x, y, w, h: h + 5, prov: pid, tag, ids: divs.map(d => d.id) });
        row++;
      }
    }
  }
  function drawFleets() {
    hit.fleets = [];
    for (const s of G.seas) {
      if (!s.fleets.length) continue;
      const fl = s.fleets.map(id => G.fleets.get(id)).filter(f => f && (cam.z > 3 || f.tag === G.player || atWar(f.tag, G.player) || allied(f.tag, G.player) || !G.started));
      fl.forEach((f, i) => {
        let [sx, sy] = worldToScreen(s.c[0], s.c[1]);
        if (f.path.length) { const n = G.seas[f.path[0]]; const [nx, ny] = worldToScreen(n.c[0], n.c[1]); const dist = Math.hypot(s.c[0] - n.c[0], s.c[1] - n.c[1]) * 8; const t = Math.min(0.95, f.prog / Math.max(1, dist)); if (Math.abs(nx - sx) < W / 2) { sx += (nx - sx) * t; sy += (ny - sy) * t; } }
        sy += i * 30 - (fl.length - 1) * 15;
        if (sx < -60 || sy < -40 || sx > W + 60 || sy > H + 40) return;
        const big = f.ships.find(x => x.type === 'carrier') || f.ships.find(x => x.type === 'battleship') || f.ships.find(x => x.type === 'heavy_cruiser') || f.ships[0];
        if (!big) return;
        const w = 64, h = 24, x = sx - w / 2, y = sy - h / 2;
        const c = G.countries[f.tag]; const isSel = UI.selectedFleet === f.id;
        ctx.fillStyle = 'rgba(10,25,40,0.75)'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = c.color; ctx.fillRect(x, y, 4, h);
        ctx.strokeStyle = isSel ? '#9cff7a' : atWar(f.tag, G.player) ? '#ff6050' : 'rgba(200,220,240,0.6)'; ctx.lineWidth = isSel ? 2.5 : 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.drawImage(Models.image(big.type, f.tag, 60), x + 5, y + 1, 38, 22.8);
        ctx.fillStyle = '#e8f0ff'; ctx.font = 'bold 11px "Trebuchet MS"'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(f.ships.length, x + w - 4, y + h / 2);
        if (f.inBattle) { ctx.fillStyle = 'rgba(255,120,40,0.9)'; ctx.beginPath(); ctx.arc(x + w, y, 5 + Math.sin(performance.now() / 120) * 2, 0, 7); ctx.fill(); }
        hit.fleets.push({ x, y, w, h, id: f.id });
      });
    }
  }
  function drawBattles() {
    hit.battles = [];
    const t = performance.now();
    for (const b of G.battles.values()) {
      const p = G.provs[b.prov]; const [sx, sy] = worldToScreen(p.c[0], p.c[1] - 0);
      if (sx < -40 || sy < -40 || sx > W + 40 || sy > H + 40) continue;
      const x = sx, y = sy - 30;
      // explosion flicker
      if (cam.z > 0.7) for (let i = 0; i < 3; i++) { const a = (t / 300 + i * 2.1 + b.prov) % 1; ctx.fillStyle = `rgba(255,${150 + i * 30},60,${0.5 * (1 - a)})`; ctx.beginPath(); ctx.arc(x + Math.sin(b.prov + i * 3 + Math.floor(t / 500)) * 14, y + 30 + Math.cos(b.prov * 2 + i) * 10, 3 + a * 9, 0, 7); ctx.fill(); }
      const playerAtt = b.attTag === G.player || allied(b.attTag, G.player), playerDef = b.defTag === G.player || allied(b.defTag, G.player);
      ctx.fillStyle = 'rgba(30,20,10,0.85)'; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill();
      ctx.strokeStyle = playerAtt || playerDef ? '#ffd060' : '#c0a080'; ctx.lineWidth = 2; ctx.stroke();
      // crossed swords
      ctx.strokeStyle = '#f0e0c0'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke();
      // progress: attacker org vs defender org
      const ao = b.attOrg ?? 1, do_ = b.defOrg ?? 1; const prog = ao / (ao + do_ + 1e-6);
      ctx.fillStyle = '#300'; ctx.fillRect(x - 18, y + 14, 36, 5);
      const goodIsAtt = playerAtt || (!playerDef);
      ctx.fillStyle = goodIsAtt ? '#5c5' : '#c44'; ctx.fillRect(x - 18, y + 14, 36 * prog, 5);
      ctx.fillStyle = goodIsAtt ? '#c44' : '#5c5'; ctx.fillRect(x - 18 + 36 * prog, y + 14, 36 * (1 - prog), 5);
      hit.battles.push({ x: x - 14, y: y - 14, w: 28, h: 36, prov: b.prov });
    }
    for (const nb of G.navalBattles.values()) {
      const s = G.seas[nb.sea]; const [x, y0] = worldToScreen(s.c[0], s.c[1]); const y = y0 - 34;
      for (let i = 0; i < 4; i++) { const a = (t / 250 + i * 0.25) % 1; ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - a)})`; ctx.beginPath(); ctx.arc(x + (i - 1.5) * 12, y + 34, 2 + a * 10, 0, 7); ctx.stroke(); }
      ctx.fillStyle = 'rgba(10,20,40,0.9)'; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill(); ctx.strokeStyle = '#7ab0ff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#cfe0ff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('⚓', x, y + 1);
    }
  }
  let boxSel = null;
  function drawSelectionBox() {
    if (!boxSel) return;
    ctx.strokeStyle = '#9cff7a'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.fillStyle = 'rgba(150,255,120,0.08)';
    const x = Math.min(boxSel.x0, boxSel.x1), y = Math.min(boxSel.y0, boxSel.y1), w = Math.abs(boxSel.x1 - boxSel.x0), h = Math.abs(boxSel.y1 - boxSel.y0);
    ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
  }

  // ---------- picking ----------
  function provAt(sx, sy) {
    const [wx, wy] = screenToWorld(sx, sy);
    for (let i = 0; i < provPaths.length; i++) {
      const b = provBox[i]; if (wx < b[0] || wx > b[2] || wy < b[1] || wy > b[3]) continue;
      if (hitCtx.isPointInPath(provPaths[i], wx, wy)) return i;
    }
    return null;
  }
  function seaAt(sx, sy) {
    const [wx, wy] = screenToWorld(sx, sy);
    for (let i = 0; i < seaPaths.length; i++) if (hitCtx.isPointInPath(seaPaths[i], wx, wy)) return i;
    return null;
  }
  const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

  // ---------- input ----------
  function bindInput() {
    let down = null; const pointers = new Map(); let pinch = null;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const [wx, wy] = screenToWorld(e.offsetX, e.offsetY);
      cam.z *= Math.exp(-e.deltaY * 0.0015); clampCam();
      const [nx, ny] = screenToWorld(e.offsetX, e.offsetY); cam.x += wx - nx; cam.y += wy - ny;
    }, { passive: false });
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: cam.z }; down = null; return; }
      down = { x: e.offsetX, y: e.offsetY, cx: cam.x, cy: cam.y, btn: e.button, moved: false, box: e.button === 0 && (e.shiftKey || e.ctrlKey), shift: e.shiftKey };
      if (down.box) boxSel = { x0: e.offsetX, y0: e.offsetY, x1: e.offsetX, y1: e.offsetY };
    });
    cv.addEventListener('pointermove', e => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
      if (pinch && pointers.size === 2) { const [a, b] = [...pointers.values()]; cam.z = pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d; clampCam(); return; }
      if (down) {
        const dx = e.offsetX - down.x, dy = e.offsetY - down.y;
        if (Math.abs(dx) + Math.abs(dy) > 5) down.moved = true;
        if (down.box) { boxSel.x1 = e.offsetX; boxSel.y1 = e.offsetY; }
        else if (down.moved && (down.btn === 0 || down.btn === 1)) { cam.x = down.cx - dx / cam.z; cam.y = down.cy - dy / cam.z; }
      } else {
        hover = provAt(e.offsetX, e.offsetY);
        hoverSea = hover == null ? seaAt(e.offsetX, e.offsetY) : null;
        UI.hover(hover, e.clientX, e.clientY, hoverSea);
      }
    });
    cv.addEventListener('pointerleave', () => { hover = null; UI.hover(null); });
    cv.addEventListener('pointerup', e => {
      pointers.delete(e.pointerId); if (pinch) { if (pointers.size < 2) pinch = null; return; }
      if (!down) return;
      const d = down; down = null;
      if (d.box) {
        const x0 = Math.min(boxSel.x0, boxSel.x1), x1 = Math.max(boxSel.x0, boxSel.x1), y0 = Math.min(boxSel.y0, boxSel.y1), y1 = Math.max(boxSel.y0, boxSel.y1);
        const ids = hit.counters.filter(c => c.tag === G.player && c.x + c.w > x0 && c.x < x1 && c.y + c.h > y0 && c.y < y1).flatMap(c => c.ids);
        boxSel = null; UI.selectDivisions(ids, d.shift); return;
      }
      if (d.moved) return;
      if (e.button === 2) return rightClick(e.offsetX, e.offsetY, e);
      leftClick(e.offsetX, e.offsetY, e);
    });
  }
  function leftClick(x, y, e) {
    if (UI.invasionMode) { const p = provAt(x, y); UI.invadeAt(p); return; }
    for (const b of hit.battles) if (inRect(b, x, y)) return UI.showBattle(b.prov);
    for (let i = hit.counters.length - 1; i >= 0; i--) { const c = hit.counters[i]; if (inRect(c, x, y)) { if (c.tag === G.player) return UI.selectDivisions(c.ids, e.shiftKey); return UI.showProvince(c.prov); } }
    for (const f of hit.fleets) if (inRect(f, x, y)) return UI.selectFleet(f.id);
    const p = provAt(x, y);
    UI.clearSelection();
    if (p != null) UI.showProvince(p);
  }
  function rightClick(x, y, e) {
    if (UI.selectedFleet) { const s = seaAt(x, y); if (s != null) UI.moveFleet(s); else { const p = provAt(x, y); if (p != null && G.provs[p].coastal) UI.moveFleet(G.provs[p].sea); } return; }
    const p = provAt(x, y); if (p == null) return;
    UI.moveSelected(p, e.shiftKey);
  }
  function setMode(m) { mode = m; needsBorders = true; }
  function invalidate() { needsBorders = true; }
  function centerOn(x, y, z) { cam.x = x; cam.y = y; if (z) cam.z = z; clampCam(); }
  return { init, invalidate, setMode, centerOn, cam, get mode() { return mode; } };
})();
