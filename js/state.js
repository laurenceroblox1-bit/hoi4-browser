// Game state, setup and shared helpers.
const G = { started: false };
const HOURS_PER_DAY = 24;
const START_DATE = Date.UTC(1936, 0, 1);
const FACTORY_OUTPUT = 4.5;
const CONSCRIPTION = [
  { name: 'Volunteer Only', pct: 0.015, cost: 0 },
  { name: 'Limited Conscription', pct: 0.025, cost: 0 },
  { name: 'Extensive Conscription', pct: 0.05, cost: 0, factory: -0.05 },
  { name: 'Service by Requirement', pct: 0.1, cost: 0, factory: -0.1, needWar: true },
  { name: 'All Adults Serve', pct: 0.2, cost: 0, factory: -0.3, needWar: true },
];
const ECONOMY = [
  { name: 'Civilian Economy', cg: 0.35, factory: -0.1 },
  { name: 'Early Mobilization', cg: 0.3, factory: 0 },
  { name: 'Partial Mobilization', cg: 0.25, factory: 0.05 },
  { name: 'War Economy', cg: 0.2, factory: 0.1, needYear: 1938 },
  { name: 'Total Mobilization', cg: 0.1, factory: 0.15, needWar: true },
];
const BUILD = {
  civ: { name: 'Civilian Factory', cost: 10800 },
  mil: { name: 'Military Factory', cost: 7200 },
  dock: { name: 'Naval Dockyard', cost: 6400 },
};

const rnd = Math.random;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (n, d = 0) => { if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(0) + 'k'; if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return n.toFixed(d); };
function nextId() { return ++G.idc; }
function dateStr(h = G.hour) { const d = new Date(START_DATE + h * 3600e3); return d.toISOString().slice(0, 10); }
function niceDate(h = G.hour) {
  const d = new Date(START_DATE + h * 3600e3);
  const M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${String(d.getUTCHours()).padStart(2, '0')}:00, ${d.getUTCDate()} ${M[d.getUTCMonth()]}, ${d.getUTCFullYear()}`;
}
function year() { return new Date(START_DATE + G.hour * 3600e3).getUTCFullYear(); }

// ---------- relationships ----------
const warKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
function atWar(a, b) { return a !== b && G.wars.has(warKey(a, b)); }
function factionOf(tag) { const c = G.countries[tag]; return c && c.faction ? G.factions[c.faction] : null; }
function allied(a, b) { if (a === b) return true; const fa = G.countries[a]?.faction; return !!fa && fa === G.countries[b]?.faction; }
function enemiesOf(tag) { const out = []; for (const k of G.wars) { const [a, b] = k.split('|'); if (a === tag) out.push(b); else if (b === tag) out.push(a); } return out; }
function isAtWar(tag) { for (const k of G.wars) { const [a, b] = k.split('|'); if (a === tag || b === tag) return true; } return false; }
// May units of `tag` enter province p?
function canEnter(tag, p) { const c = p.ctrl; return c === tag || allied(tag, c) || atWar(tag, c) || (G.access && G.access.has(tag + '>' + c)); }

// ---------- template stats ----------
function eqMult(country, eqs) {
  let m = 0, n = 0;
  for (const e in eqs) { m += 1 + 0.15 * (country.eqLevel[e] || 0); n++; }
  return n ? m / n : 1;
}
function computeTemplate(tpl, country) {
  const s = { soft: 0, hard: 0, def: 0, brk: 0, hp: 0, org: 0, speed: 99, armor: 0, pierce: 0, hardness: 0, width: 0, mp: 0, eq: {}, aa: 0, cost: 0, model: 'infantry', amphibious: true, terrain: {} };
  const line = tpl.line.filter(Boolean), sup = tpl.support.filter(Boolean);
  if (!line.length) return s;
  let orgSum = 0, maxArmor = 0, armorSum = 0, maxPierce = 0, pierceSum = 0, hardSum = 0;
  const groupCount = {};
  for (const id of line) {
    const b = BATTALIONS[id]; const m = eqMult(country, b.eq);
    s.soft += b.soft * m; s.hard += b.hard * m; s.def += b.def * (1 + (m - 1) * 0.5); s.brk += b.brk * (1 + (m - 1) * 0.5);
    s.hp += b.hp; orgSum += b.org; s.speed = Math.min(s.speed, b.speed); s.width += b.width; s.mp += b.mp; s.aa += (b.aa || 0) * m;
    const ar = b.armor * (b.group === 'armor' || id === 'mechanized' ? m : 1); maxArmor = Math.max(maxArmor, ar); armorSum += ar;
    const pi = b.pierce * m; maxPierce = Math.max(maxPierce, pi); pierceSum += pi; hardSum += b.hardness;
    for (const e in b.eq) s.eq[e] = (s.eq[e] || 0) + b.eq[e];
    if (!b.amphibious) s.amphibious = false;
    if (b.terrain) for (const t in b.terrain) s.terrain[t] = (s.terrain[t] || 0) + b.terrain[t] / line.length;
    groupCount[b.model] = (groupCount[b.model] || 0) + b.width;
  }
  s.org = orgSum / line.length;
  s.armor = 0.3 * maxArmor + 0.7 * armorSum / line.length;
  s.pierce = 0.4 * maxPierce + 0.6 * pierceSum / line.length;
  s.hardness = hardSum / line.length;
  let speedMul = 1, losses = 1, recovery = 1;
  for (const id of sup) {
    const b = SUPPORT[id]; const m = eqMult(country, b.eq);
    s.soft += (b.soft || 0) * m; s.hard += (b.hard || 0) * m; s.def += (b.def || 0); s.brk += (b.brk || 0); s.hp += b.hp || 0; s.org += (b.org || 0) / 5; s.mp += b.mp; s.aa += (b.aa || 0) * m;
    if (b.pierce) s.pierce = Math.max(s.pierce, b.pierce * m * 0.8);
    for (const e in b.eq) s.eq[e] = (s.eq[e] || 0) + b.eq[e];
    if (b.speedBonus) speedMul *= b.speedBonus; if (b.losses) losses *= b.losses; if (b.recovery) recovery *= b.recovery;
    if (id === 'engineer') s.def *= 1.05;
  }
  const md = country.mods;
  s.soft *= 1 + (md.soft || 0); s.hard *= 1 + (md.soft || 0) * 0.5; s.def *= 1 + (md.def || 0); s.brk *= 1 + (md.brk || 0);
  s.org += md.org || 0; s.speed *= speedMul * (1 + (md.speed || 0)); s.losses = losses; s.recovery = recovery;
  for (const e in s.eq) s.cost += s.eq[e] * EQUIPMENT[e].cost;
  // main model: most width
  let best = 0; for (const k in groupCount) if (groupCount[k] > best) { best = groupCount[k]; s.model = k; }
  if (s.model === 'artillery' || s.model === 'at' || s.model === 'aa') s.model = line.some(id => id === 'infantry') ? 'infantry' : s.model;
  return s;
}
function refreshTemplates(c) { for (const t of c.templates) t.stats = computeTemplate(t, c); }

// ---------- country helpers ----------
function countryMods(c) {
  const mods = {};
  for (const id of c.techs) { const t = TECH_BY_ID[id]; if (t && t.mods) for (const k in t.mods) mods[k] = (mods[k] || 0) + t.mods[k]; }
  const law = CONSCRIPTION[c.laws.conscription], eco = ECONOMY[c.laws.economy];
  mods.factory = (mods.factory || 0) + (law.factory || 0) + eco.factory;
  if (c.cheats && c.cheats.factory) mods.factory += c.cheats.factory;
  return mods;
}
function recalcCountry(c) {
  c.mods = countryMods(c);
  c.slots = c.baseSlots + [...c.techs].reduce((a, id) => a + (TECH_BY_ID[id]?.slot || 0), 0);
  while (c.research.length < c.slots) c.research.push(null);
  refreshTemplates(c);
}
function industry(c) {
  let civ = 0, mil = 0, dock = 0;
  for (const p of c.provList) { if (p.owner !== c.tag) continue; const f = p.ctrl === c.tag ? 1 : 0; civ += p.civ * f; mil += p.mil * f; dock += p.dock * f; }
  for (const p of c.occupied) { civ += p.civ * 0.5; mil += p.mil * 0.5; dock += p.dock * 0.5; }
  civ = Math.floor(civ); mil = Math.floor(mil); dock = Math.floor(dock);
  const cg = Math.ceil(civ * ECONOMY[c.laws.economy].cg);
  return { civ, mil, dock, cg, freeCiv: Math.max(0, civ - cg) };
}
function rebuildProvLists() {
  for (const t in G.countries) { G.countries[t].provList = []; G.countries[t].occupied = []; }
  for (const p of G.provs) {
    const o = G.countries[p.owner]; if (o) o.provList.push(p);
    if (p.ctrl !== p.owner && G.countries[p.ctrl]) G.countries[p.ctrl].occupied.push(p);
  }
  G.dirtyLists = false;
}
function manpowerInfo(c) {
  const cap = c.pop * CONSCRIPTION[c.laws.conscription].pct * (1 + (c.mods.manpower || 0)) + (c.bonusMP || 0);
  let field = 0;
  for (const d of G.divisions.values()) if (d.tag === c.tag) field += d.stats.mp * d.str;
  for (const t of c.training) field += t.mp;
  return { cap, field, avail: Math.max(0, cap - field - c.dead) };
}

// ---------- setup ----------
function provinceDistanceKm(a, b) {
  const lat = (a.lat + b.lat) / 2;
  const dx = (a.c[0] - b.c[0]) * Math.cos(lat * Math.PI / 180), dy = (a.c[1] - b.c[1]) * Math.cos(lat * Math.PI / 180);
  return Math.hypot(dx, dy) * 10;
}
function latOf(y) {
  const { latMax } = WORLD.proj; const D2R = Math.PI / 180; const SCALE = WORLD.W / (2 * Math.PI);
  const Y0 = 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * latMax * D2R));
  return (Math.atan(Math.exp((Y0 - y / SCALE) / 1.25)) - Math.PI / 4) / 0.4 / D2R;
}

// Provinces without a city are named after the nearest city plus a compass direction, e.g. "Warsaw (E)".
function nameProvinces() {
  const DIRS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  for (const p of G.provs) {
    if (p.name) continue;
    const seen = new Set([p.id]); let frontier = [p.id]; let city = null;
    for (let hop = 0; hop < 4 && !city; hop++) {
      const next = [];
      for (const id of frontier) for (const n of G.provs[id].adj) if (!seen.has(n)) { seen.add(n); next.push(n); }
      const named = next.map(id => G.provs[id]).filter(q => q.vp > 0 && q.modern === p.modern).sort((a, b) => b.vp - a.vp);
      if (named.length) city = named[0];
      frontier = next;
    }
    if (city) {
      const a = Math.atan2(p.c[1] - city.c[1], p.c[0] - city.c[0]);
      p.name = `${city.name} (${DIRS[(Math.round(a / (Math.PI / 4)) + 8) % 8]})`;
    } else p.name = p.modern;
  }
}

const TECH_BY_ID = {}; for (const t of TECHS) TECH_BY_ID[t.id] = t;

function newGame(playerTag, opts = {}) {
  Object.assign(G, {
    started: true, hour: 0, speed: 2, paused: true, player: playerTag, idc: 0, tension: 0,
    countries: {}, provs: [], seas: [], divisions: new Map(), fleets: new Map(), wings: new Map(),
    battles: new Map(), navalBattles: new Map(), wars: new Set(), factions: {}, guarantees: [], access: new Set(),
    firedEvents: new Set(), log: [], historical: opts.historical !== false, dirtyLists: true, stats: { battles: 0, casualties: {} },
    flights: [], effects: [],
  });
  // provinces
  G.provs = WORLD.provinces.map(p => ({
    id: p.id, owner: p.o, ctrl: p.o, modern: p.m, terr: p.t, c: p.c, adj: p.a, coastal: !!p.co, sea: p.s, name: p.n || null, vp: p.vp || 0, cp: p.cp || p.c,
    cap: p.cap || null, lat: latOf(p.c[1]), civ: 0, mil: 0, dock: 0, rings: p.r, units: [],
  }));
  G.seas = WORLD.seas.map(s => ({ id: s.id, c: s.c, adj: s.a, rings: s.r, fleets: [] }));
  nameProvinces();
  // countries
  for (const tag in COUNTRIES) {
    const d = COUNTRIES[tag];
    const c = {
      tag, name: d.name, adj: d.adj, color: d.color, ideo: d.ideo, major: !!d.major, alive: true, faction: null,
      pop: d.mp * 1000 / 0.025, dead: 0, pp: 50, stability: 0.7, laws: { conscription: 1, economy: d.major ? 1 : 0 },
      techs: new Set(), eqLevel: {}, research: [], baseSlots: d.major ? 3 : 2, slots: 2, mods: {},
      stockpile: {}, production: [], navalProd: [], construction: [], training: [], templates: [],
      provList: [], occupied: [], capital: null, ai: tag !== playerTag, leaderIdx: 0, surrender: 0, cheats: {}, kills: 0,
    };
    for (const e in EQUIPMENT) { c.stockpile[e] = 0; c.eqLevel[e] = 0; }
    for (const s in SHIPS) c.eqLevel[s] = 0;
    for (const id of (START_TECHS[tag] || (d.major ? START_TECHS._major : []))) c.techs.add(id);
    G.countries[tag] = c;
  }
  rebuildProvLists();
  for (const tag in G.countries) {
    const c = G.countries[tag], d = COUNTRIES[tag];
    if (!c.provList.length) { c.alive = false; continue; }
    let cap = c.provList.find(p => p.cap === tag) || c.provList.slice().sort((a, b) => b.vp - a.vp)[0];
    c.capital = cap.id;
    for (const id of c.techs) applyTechEffects(c, TECH_BY_ID[id], true);
    recalcCountry(c);
    // distribute factories over provinces weighted by VP (home provinces favoured over colonies)
    const homeModern = cap.modern;
    const weighted = c.provList.map(p => ({ p, w: (p.vp + 1) * (p.modern === homeModern ? 3 : 1) }));
    const tw = weighted.reduce((a, b) => a + b.w, 0);
    for (const [kind, n] of [['civ', d.ind[0]], ['mil', d.ind[1]], ['dock', d.ind[2]]]) {
      let left = n;
      const pool = kind === 'dock' ? weighted.filter(x => x.p.coastal) : weighted;
      const pw = pool.reduce((a, b) => a + b.w, 0) || 1;
      for (const x of pool) { const k = Math.floor(n * x.w / pw); x.p[kind] += k; left -= k; }
      const sorted = pool.slice().sort((a, b) => b.w - a.w);
      for (let i = 0; left > 0 && sorted.length; i = (i + 1) % sorted.length) { sorted[i].p[kind]++; left--; }
      if (left > 0) cap[kind] += left;
    }
    // templates
    for (const t of DEFAULT_TEMPLATES) c.templates.push({ id: nextId(), name: t.name, line: [...t.line, ...Array(25 - t.line.length).fill(null)], support: [...t.support, ...Array(5 - t.support.length).fill(null)] });
    if (c.techs.has('medium_tank1') || tag === 'GER') {
      const line = tag === 'GER' ? ['light_tank', 'light_tank', 'light_tank', 'light_tank', 'motorized', 'motorized', 'motorized', 'artillery'] : ['medium_tank', 'medium_tank', 'medium_tank', 'light_tank', 'motorized', 'motorized', 'motorized', 'artillery'];
      c.templates.push({ id: nextId(), name: tag === 'GER' ? 'Panzer-Division' : 'Tank Division', line: [...line, ...Array(25 - line.length).fill(null)], support: ['recon', 'engineer', null, null, null] });
    }
    refreshTemplates(c);
    // starting stockpiles
    const scale = (d.ind[1] + 2);
    c.stockpile.infantry_equipment = 1500 * scale; c.stockpile.artillery = 60 * scale; c.stockpile.support_equipment = 40 * scale;
    c.stockpile.motorized = 30 * scale; c.stockpile.light_tank = d.major ? 120 : 0;
    // starting production lines
    setupDefaultProduction(c);
    // armies
    spawnStartingArmy(c, d);
    spawnStartingNavy(c, d);
    spawnStartingAir(c, d);
  }
  for (const f of START_FACTIONS) createFaction(f.id, f.name, f.leader, f.color, f.members);
  recomputeUnitIndex();
  G.started = true;
}
function applyTechEffects(c, t) {
  if (!t) return;
  if (t.eq) for (const e in t.eq) c.eqLevel[e] = (c.eqLevel[e] || 0) + t.eq[e];
}
function hasUnlock(c, id) {
  const b = BATTALIONS[id] || SUPPORT[id] || SHIPS[id];
  return !b.req || c.techs.has(b.req) || (c.cheats && c.cheats.allUnits);
}
function setupDefaultProduction(c) {
  const ind = industry(c);
  const lines = [];
  const plan = c.major ? [['infantry_equipment', 0.3], ['artillery', 0.12], ['support_equipment', 0.06], ['fighter', 0.18], ['light_tank', 0.12], ['cas', 0.08], ['motorized', 0.06], ['anti_tank', 0.04], ['anti_air', 0.04]]
    : [['infantry_equipment', 0.55], ['artillery', 0.2], ['support_equipment', 0.1], ['fighter', 0.15]];
  let left = ind.mil;
  for (const [eq, w] of plan) { let f = Math.min(15, Math.round(ind.mil * w)); if (f <= 0 && left > 0 && eq === 'infantry_equipment') f = Math.min(left, 1); f = Math.min(f, left); if (f > 0) { lines.push({ id: nextId(), eq, fac: f, prog: 0, eff: 0.3 }); left -= f; } }
  if (left > 0 && lines.length) lines[0].fac = Math.min(15, lines[0].fac + left);
  c.production = lines;
  c.navalProd = [];
  if (ind.dock > 0) {
    const ships = c.major ? ['destroyer', 'submarine', 'light_cruiser'] : ['destroyer'];
    let dleft = ind.dock;
    for (const s of ships) { const n = Math.max(1, Math.round(ind.dock / ships.length)); const k = Math.min(n, dleft); if (k > 0) { c.navalProd.push({ id: nextId(), ship: s, docks: k, prog: 0, repeat: true }); dleft -= k; } }
  }
  c.construction = [];
  queueConstruction(c, c.major ? 'civ' : 'civ');
}
function bestBuildProv(c, kind) {
  const cands = c.provList.filter(p => p.ctrl === c.tag && (kind !== 'dock' || p.coastal));
  if (!cands.length) return null;
  cands.sort((a, b) => (b.vp - (b.civ + b.mil + b.dock) * 2) - (a.vp - (a.civ + a.mil + a.dock) * 2));
  return cands[0];
}
function queueConstruction(c, kind, prov) {
  const p = prov || bestBuildProv(c, kind); if (!p) return false;
  c.construction.push({ id: nextId(), kind, prov: p.id, prog: 0 });
  return true;
}

function makeDivision(c, tpl, prov, name, str = 1) {
  const st = tpl.stats || computeTemplate(tpl, c);
  const n = (c.divCount = (c.divCount || 0) + 1);
  const d = {
    id: nextId(), tag: c.tag, tplId: tpl.id, name: name || `${ordinal(n)} ${tpl.name.replace(/ Division$/, '')} Div.`, prov: prov.id, path: [], prog: 0,
    str, org: st.org, stats: st, entrench: 0, state: 'idle', supplied: true, exp: 0,
  };
  G.divisions.set(d.id, d); prov.units.push(d.id);
  return d;
}
function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function spawnStartingArmy(c, d) {
  const [inf, arm] = d.div || [0, 0];
  const own = c.provList.filter(p => p.ctrl === c.tag);
  if (!own.length) return;
  const cap = G.provs[c.capital];
  // prefer home provinces near capital, especially border provinces
  const home = own.filter(p => p.modern === cap.modern || provinceDistanceKm(p, cap) < 1500);
  const pool = home.length ? home : own;
  const border = pool.filter(p => p.adj.some(a => G.provs[a].owner !== c.tag));
  const tplInf = c.templates[0], tplArm = c.templates.find(t => t.name.includes('Panzer') || t.name.includes('Tank')) || c.templates[1];
  for (let i = 0; i < inf; i++) {
    const src = (i % 3 !== 0 && border.length) ? border : pool;
    makeDivision(c, i % 5 === 4 && c.templates[2] ? tplInf : tplInf, src[(i * 7) % src.length], null, 1);
  }
  for (let i = 0; i < arm; i++) makeDivision(c, tplArm, i % 2 ? cap : pool[(i * 3) % pool.length], null, 1);
}
function homeSea(c) {
  const cap = G.provs[c.capital];
  if (cap.coastal) return cap.sea;
  const coastal = c.provList.filter(p => p.coastal && p.ctrl === c.tag).sort((a, b) => (b.vp + b.dock * 5) - (a.vp + a.dock * 5));
  return coastal.length ? coastal[0].sea : null;
}
function makeShip(c, type) {
  const S = SHIPS[type]; const lvl = c.eqLevel[type] || 0; const mult = 1 + 0.12 * lvl;
  const names = SHIP_NAMES[c.tag] || [];
  c.shipNo = (c.shipNo || 0) + 1;
  const nm = names.length && (type === 'battleship' || type === 'carrier' || type.includes('cruiser')) ? names[c.shipNo % names.length] : `${S.short}-${c.shipNo}`;
  return { type, name: nm, hp: S.hp * mult, maxhp: S.hp * mult, mult };
}
function makeFleet(c, sea, ships, name) {
  const f = { id: nextId(), tag: c.tag, name: name || `${c.adj} Fleet`, sea, ships, path: [], prog: 0, mission: 'idle', home: sea };
  G.fleets.set(f.id, f); return f;
}
function spawnStartingNavy(c, d) {
  if (!d.navy) return;
  const sea = homeSea(c); if (sea == null) return;
  const types = ['battleship', 'carrier', 'heavy_cruiser', 'light_cruiser', 'destroyer', 'submarine'];
  const main = [], subs = [];
  d.navy.forEach((n, i) => { for (let k = 0; k < n; k++) (types[i] === 'submarine' ? subs : main).push(makeShip(c, types[i])); });
  // big navies get split into several fleets
  const chunks = Math.max(1, Math.ceil(main.length / 40));
  const seas = [sea];
  const coastal = c.provList.filter(p => p.coastal).map(p => p.sea);
  for (let i = 1; i < chunks; i++) seas.push(coastal[Math.floor(coastal.length * i / chunks)] ?? sea);
  for (let i = 0; i < chunks; i++) { const part = main.filter((_, k) => k % chunks === i); if (part.length) makeFleet(c, seas[i], part, i === 0 ? `${c.adj} Home Fleet` : `${c.adj} ${ordinal(i + 1)} Fleet`); }
  if (subs.length) { const f = makeFleet(c, sea, subs, `${c.adj} U-Boat Flotilla`.replace('U-Boat', c.tag === 'GER' ? 'U-Boot' : 'Submarine')); f.mission = 'raid'; }
}
function spawnStartingAir(c, d) {
  if (!d.air) return;
  const types = ['fighter', 'cas', 'tac_bomber', 'nav_bomber'];
  d.air.forEach((n, i) => { while (n > 0) { const k = Math.min(100, n); makeWing(c, types[i], k, c.capital); n -= k; } });
}
function makeWing(c, type, count, base) {
  c.wingNo = (c.wingNo || 0) + 1;
  const w = { id: nextId(), tag: c.tag, type, planes: count, max: 100, base, mission: type === 'fighter' ? 'superiority' : type === 'cas' ? 'cas' : type === 'nav_bomber' ? 'naval_strike' : 'bombing', name: `${ordinal(c.wingNo)} ${PLANES[type].name.replace(/s$/, '')} Wing`, active: false };
  G.wings.set(w.id, w); return w;
}
function recomputeUnitIndex() {
  for (const p of G.provs) p.units = [];
  for (const s of G.seas) s.fleets = [];
  for (const d of G.divisions.values()) if (d.state !== 'naval') G.provs[d.prov].units.push(d.id);
  for (const f of G.fleets.values()) G.seas[f.sea].fleets.push(f.id);
}
function moveDivTo(d, provId) {
  const old = G.provs[d.prov]; const i = old.units.indexOf(d.id); if (i >= 0) old.units.splice(i, 1);
  d.prov = provId; G.provs[provId].units.push(d.id); d.entrench = 0;
}
function removeDivision(d) {
  const p = G.provs[d.prov]; const i = p.units.indexOf(d.id); if (i >= 0) p.units.splice(i, 1);
  G.divisions.delete(d.id);
  if (UI.selected) UI.selected.delete(d.id);
}

// ---------- factions & war ----------
function createFaction(id, name, leader, color, members = [leader]) {
  G.factions[id] = { id, name, leader, color, members: new Set() };
  for (const m of members) joinFaction(m, id);
}
function joinFaction(tag, fid, inheritWars = false) {
  const c = G.countries[tag], f = G.factions[fid]; if (!c || !c.alive || !f) return;
  if (c.faction && G.factions[c.faction]) G.factions[c.faction].members.delete(tag);
  c.faction = fid; f.members.add(tag);
  if (inheritWars) for (const e of enemiesOf(f.leader)) makeWar(tag, e);
}
function leaveFaction(tag) { const c = G.countries[tag]; if (c.faction) { G.factions[c.faction].members.delete(tag); c.faction = null; } }
function makeWar(a, b) {
  if (a === b || !G.countries[a]?.alive || !G.countries[b]?.alive || atWar(a, b)) return false;
  if (allied(a, b)) return false;
  G.wars.add(warKey(a, b));
  const ca = G.countries[a], cb = G.countries[b];
  ca.warStart = ca.warStart ?? G.hour; cb.warStart = cb.warStart ?? G.hour;
  return true;
}
function declareWar(a, b, silent) {
  if (!makeWar(a, b)) return;
  const ca = G.countries[a], cb = G.countries[b];
  const joined = [];
  // defenders: faction of b + guarantors
  const fb = factionOf(b);
  if (fb) for (const m of fb.members) if (m !== b && !allied(m, a) && makeWar(m, a)) joined.push(m);
  for (const [g, t] of G.guarantees) if (t === b && !allied(g, a) && G.countries[g].alive && makeWar(g, a)) {
    joined.push(g); const fg = factionOf(g); if (fg) for (const m of fg.members) if (!allied(m, a) && makeWar(m, a)) joined.push(m);
  }
  // attacker faction leader calls its members (AI members accept)
  const fa = factionOf(a);
  if (fa && fa.leader === a) for (const m of fa.members) if (m !== a) { makeWar(m, b); if (fb) for (const x of fb.members) makeWar(m, x); }
  G.tension = Math.min(100, G.tension + (ca.major || cb.major ? 10 : 3));
  if (!silent) {
    log(`${ca.name} declared war on ${cb.name}${joined.length ? ' (' + joined.map(t => G.countries[t].name).join(', ') + ' joined)' : ''}.`, 'war', a);
    if (a === G.player || b === G.player || joined.includes(G.player)) UI.popup({ title: `${ca.name} declares war on ${cb.name}`, text: joined.length ? `Joining the war: ${joined.map(t => G.countries[t].name).join(', ')}.` : '', tags: [a, b], kind: 'war' });
  }
  G.dirtyBorders = true;
}
function makePeace(a, b) {
  if (!atWar(a, b)) return;
  G.wars.delete(warKey(a, b));
  // each side annexes what it occupies of the other
  for (const p of G.provs) {
    if (p.owner === b && p.ctrl === a) p.owner = a; else if (p.owner === a && p.ctrl === b) p.owner = b;
  }
  for (const [x, y] of [[a, b], [b, a]]) {
    for (const p of G.provs) if (p.owner === x && p.ctrl === y) p.ctrl = x;
  }
  // units standing in former enemy territory go home
  for (const d of G.divisions.values()) { const p = G.provs[d.prov]; if ((d.tag === a && p.ctrl === b) || (d.tag === b && p.ctrl === a)) { const c = G.countries[d.tag]; moveDivTo(d, c.capital); d.path = []; d.state = 'idle'; } }
  G.dirtyLists = true; G.dirtyBorders = true;
  log(`Peace between ${G.countries[a].name} and ${G.countries[b].name}.`, 'peace', a);
}
function annex(winner, loser, reason) {
  const W = G.countries[winner], L = G.countries[loser]; if (!W || !L || !L.alive || !W.alive) return;
  for (const p of G.provs) { if (p.owner === loser) { p.owner = winner; if (p.ctrl === loser) p.ctrl = winner; } if (p.ctrl === loser) p.ctrl = p.owner; }
  for (const d of [...G.divisions.values()]) if (d.tag === loser) removeDivision(d);
  for (const f of [...G.fleets.values()]) if (f.tag === loser) { f.tag = winner; f.name = f.name.replace(L.adj, W.adj); }
  for (const w of [...G.wings.values()]) if (w.tag === loser) G.wings.delete(w.id);
  W.pop += L.pop * 0.6;
  for (const e in L.stockpile) W.stockpile[e] += Math.floor(L.stockpile[e] * 0.5);
  killCountry(loser);
  G.dirtyLists = true; G.dirtyBorders = true;
  log(`${W.name} annexed ${L.name}${reason ? ' (' + reason + ')' : ''}.`, 'annex', winner);
}
function killCountry(tag) {
  const c = G.countries[tag]; c.alive = false;
  for (const k of [...G.wars]) { const [a, b] = k.split('|'); if (a === tag || b === tag) G.wars.delete(k); }
  leaveFaction(tag);
  G.guarantees = G.guarantees.filter(([g, t]) => g !== tag && t !== tag);
  if (tag === G.player) UI.gameOver(tag);
}
function capitulate(tag) {
  const c = G.countries[tag]; if (!c.alive) return;
  const enemies = enemiesOf(tag);
  if (!enemies.length) return;
  // count how many of the loser's provinces each enemy (or its faction) controls
  const score = {};
  for (const p of c.provList) if (p.ctrl !== tag && enemies.some(e => e === p.ctrl || allied(e, p.ctrl))) score[p.ctrl] = (score[p.ctrl] || 0) + 1 + p.vp;
  // the leading enemy great power takes what nobody occupies
  const rank = t => (score[t] ? 1e7 : 0) + (G.countries[t].major ? 1e6 : 0) + (score[t] || 0) * 10 + (G.countries[t].ind?.mil || 0);
  let main = enemies.slice().sort((a, b) => rank(b) - rank(a))[0];
  for (const p of G.provs) {
    if (p.owner === tag) {
      if (p.ctrl !== tag && G.countries[p.ctrl]?.alive) p.owner = p.ctrl;
      else { // give unoccupied land to the nearest enemy holding nearby ground, else main enemy
        p.owner = main; p.ctrl = main;
      }
    } else if (p.ctrl === tag) p.ctrl = p.owner;
  }
  for (const d of [...G.divisions.values()]) if (d.tag === tag) removeDivision(d);
  for (const f of [...G.fleets.values()]) if (f.tag === tag) { G.fleets.delete(f.id); }
  for (const w of [...G.wings.values()]) if (w.tag === tag) G.wings.delete(w.id);
  G.countries[main].pop += c.pop * 0.4;
  const name = c.name;
  killCountry(tag);
  recomputeUnitIndex();
  G.dirtyLists = true; G.dirtyBorders = true;
  log(`${name} has capitulated to ${G.countries[main].name}!`, 'capitulate', tag);
  UI.popup({ title: `${name} Capitulates`, text: `After a crushing defeat, ${name} has surrendered. Its territory has been occupied by its enemies, chiefly ${G.countries[main].name}.`, tags: [tag, main], kind: 'capitulate' });
}

function log(text, kind = 'info', tag) {
  G.log.unshift({ t: G.hour, text, kind, tag });
  if (G.log.length > 200) G.log.pop();
  UI.onLog && UI.onLog();
}
