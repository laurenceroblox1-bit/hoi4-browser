// Simulation: hourly movement and combat, daily economy, research, supply, air and AI.
const Sim = (() => {
  // ---------- pathfinding ----------
  function findPath(tag, from, to, opts = {}) {
    if (from === to) return [];
    const target = G.provs[to];
    if (!canEnter(tag, target) && !opts.ignoreAccess) return null;
    // A* on province graph
    const open = new Map([[from, 0]]), g = new Map([[from, 0]]), prev = new Map();
    const h = id => Math.hypot(G.provs[id].c[0] - target.c[0], G.provs[id].c[1] - target.c[1]) * 8;
    const heap = [[h(from), from]];
    let iter = 0;
    while (heap.length && iter++ < 20000) {
      let bi = 0; for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[bi][0]) bi = i;
      const [, cur] = heap[bi]; heap[bi] = heap[heap.length - 1]; heap.pop();
      if (cur === to) break;
      if (!open.has(cur)) continue; open.delete(cur);
      for (const n of G.provs[cur].adj) {
        const p = G.provs[n];
        if (!canEnter(tag, p) && !opts.ignoreAccess) continue;
        const cost = g.get(cur) + provinceDistanceKm(G.provs[cur], p) / TERRAIN[p.terr].move;
        if (!g.has(n) || cost < g.get(n)) { g.set(n, cost); prev.set(n, cur); open.set(n, 1); heap.push([cost + h(n), n]); }
      }
    }
    if (!prev.has(to)) return null;
    const path = []; let cur = to; while (cur !== from) { path.unshift(cur); cur = prev.get(cur); }
    return path;
  }
  function seaPath(from, to) {
    if (from === to) return [];
    const prev = new Map([[from, -1]]); const q = [from];
    while (q.length) { const cur = q.shift(); if (cur === to) break; for (const n of G.seas[cur].adj) if (!prev.has(n)) { prev.set(n, cur); q.push(n); } }
    if (!prev.has(to)) return null;
    const path = []; let cur = to; while (cur !== from) { path.unshift(cur); cur = prev.get(cur); } return path;
  }

  // ---------- weather ----------
  // Northern winters and the autumn/spring mud (rasputitsa) slow movement and attacks.
  function weather(p) {
    const m = new Date(START_DATE + G.hour * 3600e3).getUTCMonth();
    const lon = p.c[0] / WORLD.W * 360 - 180;
    if (p.lat > 47 && (m === 11 || m === 0 || m === 1)) return lon > 24 ? 'blizzard' : 'snow';
    if (p.lat > 45 && p.lat < 63 && lon > 22 && (m === 9 || m === 10 || m === 2 || m === 3)) return 'mud';
    return null;
  }
  const WEATHER = { snow: { move: 0.7, atk: 0.85 }, blizzard: { move: 0.5, atk: 0.7 }, mud: { move: 0.5, atk: 0.85 } };

  // ---------- orders ----------
  function orderMove(d, to) {
    if (d.state === 'naval' || d.state === 'training') return false;
    const path = findPath(d.tag, d.prov, to);
    if (!path) return false;
    d.path = path; d.prog = 0; d.state = path.length ? 'move' : 'idle';
    return true;
  }
  function orderInvasion(d, to) {
    const from = G.provs[d.prov], target = G.provs[to], c = G.countries[d.tag];
    if (!from.coastal || !target.coastal) return 'Both provinces must be coastal.';
    if (![...G.fleets.values()].some(f => f.tag === d.tag || allied(f.tag, d.tag))) return 'You need a navy to perform naval invasions.';
    const sp = seaPath(from.sea, target.sea); if (!sp) return 'No sea route.';
    if (!canEnter(d.tag, target)) return 'You are not at war with the owner of that province.';
    const prep = 72 * (1 - (c.mods.invasion || 0) * 0.5);
    d.state = 'naval'; d.inv = { target: to, from: d.prov, hours: prep + sp.length * 10, total: prep + sp.length * 10, seas: sp };
    const p = G.provs[d.prov]; const i = p.units.indexOf(d.id); if (i >= 0) p.units.splice(i, 1);
    d.path = [];
    return null;
  }

  // ---------- hourly ----------
  function hourTick() {
    G.hour++;
    moveDivisions();
    tickInvasions();
    for (const b of [...G.battles.values()]) battleHour(b);
    moveFleets();
    for (const nb of [...G.navalBattles.values()]) navalBattleHour(nb);
    // org regen
    for (const d of G.divisions.values()) {
      if (d.inBattle) continue;
      const rate = (d.state === 'idle' ? 0.35 : 0.12) * (d.stats.recovery || 1) * (d.supplied ? 1 : 0.25);
      d.org = Math.min(d.stats.org, d.org + rate);
    }
    if (G.hour % 24 === 0) dayTick();
  }

  function moveDivisions() {
    for (const d of G.divisions.values()) {
      if (d.state === 'amphib') continue;
      if (d.state !== 'move' && d.state !== 'retreat') { d.attacking = null; continue; }
      if (!d.path.length) { d.state = 'idle'; d.attacking = null; continue; }
      const next = G.provs[d.path[0]];
      if (!canEnter(d.tag, next)) { d.path = []; d.state = 'idle'; continue; }
      const hostiles = next.units.some(id => { const e = G.divisions.get(id); return e && atWar(e.tag, d.tag); });
      if (hostiles && d.state !== 'retreat') {
        // attack: join or start battle at next
        d.attacking = next.id;
        let b = G.battles.get(next.id);
        if (!b) b = startBattle(next, d.tag);
        b.att.add(d.id); d.inBattle = b.prov;
        continue;
      }
      d.attacking = null; if (d.inBattle != null && !G.battles.has(d.inBattle)) d.inBattle = null;
      if (d.inBattle != null) { const bb = G.battles.get(d.inBattle); if (bb && bb.att.has(d.id)) { bb.att.delete(d.id); } d.inBattle = null; }
      const here = G.provs[d.prov];
      const dist = provinceDistanceKm(here, next);
      const wx = weather(next);
      const speed = d.stats.speed * TERRAIN[next.terr].move * (d.supplied ? 1 : 0.6) * (d.state === 'retreat' ? 0.8 : 1) * (wx ? WEATHER[wx].move : 1);
      d.prog += speed;
      if (d.prog >= dist) {
        d.prog = 0; d.path.shift();
        moveDivTo(d, next.id);
        if (next.ctrl !== d.tag && atWar(d.tag, next.ctrl)) captureProvince(next, d.tag);
        if (!d.path.length) d.state = 'idle';
      }
    }
  }
  function captureProvince(p, tag) {
    // control goes to the original owner if they are an ally (liberation), otherwise the capturer
    const prev = p.ctrl;
    p.ctrl = (p.owner !== tag && allied(p.owner, tag) && G.countries[p.owner].alive) ? p.owner : tag;
    G.dirtyLists = true; G.dirtyBorders = true;
    if (p.vp >= 10 && (tag === G.player || prev === G.player)) log(`${G.countries[tag].name} captured ${p.name}.`, tag === G.player ? 'good' : 'bad', tag);
    // enemy fleets/units cannot remain; also capture adjacent isolated units? (handled by retreat)
  }

  function tickInvasions() {
    for (const d of G.divisions.values()) {
      if (d.state !== 'naval') continue;
      d.inv.hours -= 1;
      if (d.inv.hours > 0) continue;
      const target = G.provs[d.inv.target];
      // enemy fleets on the route without friendly escort sink part of the transports
      for (const s of d.inv.seas) {
        const sea = G.seas[s]; const enemy = sea.fleets.some(fid => atWar(G.fleets.get(fid)?.tag, d.tag)); const friend = sea.fleets.some(fid => allied(G.fleets.get(fid)?.tag, d.tag));
        if (enemy && !friend) { d.str *= 0.65; if (d.tag === G.player) log(`${d.name} lost transports to enemy fleets.`, 'bad', d.tag); break; }
      }
      const hostiles = target.units.some(id => atWar(G.divisions.get(id)?.tag, d.tag));
      if (!canEnter(d.tag, target)) { // peace happened; return
        d.state = 'idle'; G.provs[d.inv.from].units.push(d.id); d.prov = d.inv.from; d.inv = null; continue;
      }
      if (!hostiles) {
        d.prov = target.id; target.units.push(d.id); d.state = 'idle'; d.inv = null;
        if (target.ctrl !== d.tag && atWar(d.tag, target.ctrl)) captureProvince(target, d.tag);
        if (d.tag === G.player) log(`${d.name} landed at ${target.name || 'the beachhead'}.`, 'good', d.tag);
      } else {
        // amphibious assault from the sea
        d.state = 'amphib'; d.prov = d.inv.from; G.provs[d.prov].units.push(d.id);
        let b = G.battles.get(target.id) || startBattle(target, d.tag);
        b.att.add(d.id); b.amphib = true; d.inBattle = target.id; d.attacking = target.id; d.path = [target.id];
        d.inv = null;
      }
    }
  }

  // ---------- land combat ----------
  function startBattle(p, attTag) {
    const b = { prov: p.id, att: new Set(), start: G.hour, attTag, defTag: p.ctrl, log: [], amphib: false, lastAttHits: 0, lastDefHits: 0 };
    G.battles.set(p.id, b); G.stats.battles++;
    return b;
  }
  function sideStats(units, enemyUnits, attacking, p, mods) {
    let A = 0;
    let eh = 0, ea = 0, ew = 0;
    for (const e of enemyUnits) { eh += e.stats.hardness * e.stats.width; ea += e.stats.armor * e.stats.width; ew += e.stats.width; }
    eh = ew ? eh / ew : 0; ea = ew ? ea / ew : 0;
    for (const u of units) {
      const s = u.stats;
      let atk = s.soft * (1 - eh) + s.hard * eh;
      if (s.pierce < ea) atk *= 0.5;
      const terrBonus = s.terrain[p.terr] || 0;
      atk *= u.str * (0.3 + 0.7 * u.org / Math.max(1, s.org)) * (1 + terrBonus) * (u.supplied ? (u.lowSupply ? 0.8 : 1) : 0.6);
      A += atk;
    }
    return A * mods;
  }
  function battleHour(b) {
    const p = G.provs[b.prov];
    const att = [...b.att].map(id => G.divisions.get(id)).filter(d => d && d.attacking === p.id && d.org > 0.5);
    for (const id of [...b.att]) { const d = G.divisions.get(id); if (!d || d.attacking !== p.id || d.org <= 0.5) { b.att.delete(id); if (d) { d.inBattle = null; if (d.org <= 0.5) { d.path = []; d.state = 'idle'; d.attacking = null; } } } }
    const attTags = new Set(att.map(d => d.tag));
    const def = p.units.map(id => G.divisions.get(id)).filter(d => d && [...attTags].some(t => atWar(t, d.tag)) && d.state !== 'retreat');
    if (!att.length || !def.length) return endBattle(b, att.length > 0);
    b.attTag = att[0].tag; b.defTag = def[0].tag;
    for (const d of def) d.inBattle = p.id;
    // frontage
    const T = TERRAIN[p.terr];
    const width = T.width + Math.max(0, new Set(att.map(d => d.prov)).size - 1) * 30;
    const pick = (arr) => { arr.sort((a, b) => b.org - a.org); const out = []; let w = 0; for (const u of arr) { if (w + u.stats.width <= width || !out.length) { out.push(u); w += u.stats.width; } } return out; };
    const A = pick(att.slice()), D = pick(def.slice());
    // modifiers
    let attMod = 1 + T.atk;
    const wx = weather(p); if (wx) attMod *= WEATHER[wx].atk;
    b.weather = wx;
    if (b.amphib) attMod *= A.every(u => u.stats.amphibious) ? 0.85 : 0.5;
    const air = b.air || { attSup: 0.5, casAtt: 0, casDef: 0 };
    attMod *= 1 + (air.attSup - 0.5) * 0.5;
    const defMod = 1 + (1 - air.attSup - 0.5) * 0.5;
    const attAtk = sideStats(A, D, true, p, attMod) + air.casAtt;
    const defAtk = sideStats(D, A, false, p, defMod) + air.casDef;
    const defDefense = D.reduce((s, u) => s + u.stats.def * u.str * (1 + u.entrench), 0);
    const attBreak = A.reduce((s, u) => s + u.stats.brk * u.str, 0);
    const hits = (atk, dfn) => (Math.min(atk, dfn) * 0.1 + Math.max(0, atk - dfn) * 0.4) * (0.75 + rnd() * 0.5);
    const hitsOnDef = hits(attAtk, defDefense), hitsOnAtt = hits(defAtk, attBreak);
    b.lastAttHits = hitsOnDef; b.lastDefHits = hitsOnAtt;
    applyDamage(D, hitsOnDef, A, p);
    applyDamage(A, hitsOnAtt, D, p);
    // retreat / destruction
    for (const u of def) if (u.org <= 0.5 || u.str <= 0.05) retreat(u, p, att[0].tag);
    b.attOrg = att.reduce((s, u) => s + u.org / Math.max(1, u.stats.org), 0) / att.length;
    b.defOrg = def.reduce((s, u) => s + u.org / Math.max(1, u.stats.org), 0) / def.length;
  }
  function applyDamage(targets, hits, attackers, p) {
    if (!targets.length) return;
    const pierce = attackers.reduce((s, u) => s + u.stats.pierce, 0) / Math.max(1, attackers.length);
    const per = hits / targets.length;
    for (const u of targets) {
      const armored = u.stats.armor > pierce;
      u.org = Math.max(0, u.org - per * 0.035 * (armored ? 0.6 : 1));
      const dmg = per * 0.012 * (armored ? 0.5 : 1) * (u.stats.losses || 1) / Math.max(5, u.stats.hp);
      u.str = Math.max(0, u.str - dmg);
      const c = G.countries[u.tag]; c.dead += dmg * u.stats.mp;
      G.stats.casualties[u.tag] = (G.stats.casualties[u.tag] || 0) + dmg * u.stats.mp;
    }
  }
  function retreat(u, p, enemyTag) {
    // find adjacent province controlled by u's side without enemy units
    const opts = p.adj.map(id => G.provs[id]).filter(q => (q.ctrl === u.tag || allied(q.ctrl, u.tag)) && !q.units.some(id => atWar(G.divisions.get(id)?.tag, u.tag)) && !G.battles.has(q.id));
    u.inBattle = null;
    if (!opts.length || u.str <= 0.05) {
      log(`${u.name} (${G.countries[u.tag].name}) was destroyed at ${p.name || 'the front'}.`, u.tag === G.player ? 'bad' : 'info', u.tag);
      G.countries[enemyTag] && (G.countries[enemyTag].kills++);
      removeDivision(u); return;
    }
    opts.sort((a, b) => (b.ctrl === u.tag) - (a.ctrl === u.tag) || b.units.length - a.units.length);
    u.path = [opts[0].id]; u.state = 'retreat'; u.prog = 0; u.org = Math.max(u.org, 0.5);
  }
  function endBattle(b, attackersWon) {
    G.battles.delete(b.prov);
    for (const d of G.divisions.values()) if (d.inBattle === b.prov) {
      d.inBattle = null;
      if (d.state === 'amphib') {
        if (attackersWon && d.attacking === b.prov) { // land on the beach
          moveDivTo(d, b.prov); d.state = 'idle'; d.path = [];
          const p = G.provs[b.prov]; if (atWar(d.tag, p.ctrl)) captureProvince(p, d.tag);
        } else { d.state = 'idle'; d.path = []; }
        d.attacking = null;
      }
    }
  }

  // ---------- navy ----------
  function fleetSpeed(f) { return Math.min(...f.ships.map(s => SHIPS[s.type].speed)) * 1.852; }
  function orderFleet(f, sea) { const p = seaPath(f.sea, sea); if (!p) return false; f.path = p; f.prog = 0; return true; }
  function moveFleets() {
    for (const f of G.fleets.values()) {
      if (!f.path.length || f.inBattle) continue;
      const here = G.seas[f.sea], next = G.seas[f.path[0]];
      const dx = Math.abs(here.c[0] - next.c[0]); const wrap = dx > WORLD.W / 2;
      const dist = Math.hypot(wrap ? WORLD.W - dx : dx, here.c[1] - next.c[1]) * 8;
      f.prog += fleetSpeed(f);
      if (f.prog >= dist) {
        f.prog = 0; f.path.shift();
        const i = here.fleets.indexOf(f.id); if (i >= 0) here.fleets.splice(i, 1);
        f.sea = next.id; next.fleets.push(f.id);
      }
    }
    // detect naval contacts
    for (const s of G.seas) {
      if (s.fleets.length < 2 || G.navalBattles.has(s.id)) continue;
      const fl = s.fleets.map(id => G.fleets.get(id)).filter(Boolean);
      for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) if (atWar(fl[i].tag, fl[j].tag)) {
        // submarines may slip by
        const stealthy = fl[i].ships.every(x => x.type === 'submarine') || fl[j].ships.every(x => x.type === 'submarine');
        if (stealthy && rnd() < 0.7) continue;
        G.navalBattles.set(s.id, { sea: s.id, a: fl[i].tag, b: fl[j].tag, start: G.hour, sunk: { a: [], b: [] } });
        if (fl[i].tag === G.player || fl[j].tag === G.player || allied(fl[i].tag, G.player) || allied(fl[j].tag, G.player)) log(`Naval battle! ${G.countries[fl[i].tag].adj} and ${G.countries[fl[j].tag].adj} fleets engage.`, 'war', fl[i].tag);
        i = fl.length; break;
      }
    }
  }
  function navalBattleHour(nb) {
    const sea = G.seas[nb.sea];
    const fl = sea.fleets.map(id => G.fleets.get(id)).filter(Boolean);
    const sideA = fl.filter(f => f.tag === nb.a || allied(f.tag, nb.a)), sideB = fl.filter(f => atWar(f.tag, nb.a));
    if (!sideA.length || !sideB.length || G.hour - nb.start > 36) return endNaval(nb, sideA, sideB);
    for (const f of [...sideA, ...sideB]) f.inBattle = true;
    const shipsA = sideA.flatMap(f => f.ships.map(s => [s, f])), shipsB = sideB.flatMap(f => f.ships.map(s => [s, f]));
    const fire = (from, to, mod) => {
      if (!to.length) return;
      for (const [s, f] of from) {
        const S = SHIPS[s.type]; const c = G.countries[f.tag];
        const tgt = to[Math.floor(rnd() * to.length)][0]; const T = SHIPS[tgt.type];
        let dmg = 0;
        if (tgt.type === 'submarine') { dmg = (S.subDetect || 0) * 0.12 * (rnd() < 0.4 ? 1 : 0); }
        else {
          dmg += S.atk * (T.armor > 40 ? 0.25 : 1) * 0.08;
          dmg += S.heavy * 0.1 * (rnd() < 0.35 ? 1 : 0);
          dmg += S.torp * (rnd() < 0.07 ? 1 : 0) * 1.2;
          if (S.planes && G.hour - nb.start < 10) dmg += S.planes * 0.12 * (rnd() < 0.5 ? 1 : 0);
        }
        tgt.hp -= dmg * s.mult * (1 + (c.mods.naval || 0)) * mod * (0.6 + rnd() * 0.8);
      }
    };
    fire(shipsA, shipsB, 1); fire(shipsB, shipsA, 1);
    for (const f of [...sideA, ...sideB]) {
      const before = f.ships.length;
      const sunk = f.ships.filter(s => s.hp <= 0);
      f.ships = f.ships.filter(s => s.hp > 0);
      if (sunk.length) {
        const side = sideA.includes(f) ? 'a' : 'b'; nb.sunk[side].push(...sunk.map(s => s.name));
        if (sunk.some(s => s.type === 'battleship' || s.type === 'carrier') && (f.tag === G.player || allied(f.tag, G.player) || atWar(f.tag, G.player))) log(`${sunk.filter(s => s.type === 'battleship' || s.type === 'carrier').map(s => s.name).join(', ')} (${G.countries[f.tag].adj}) sunk!`, f.tag === G.player ? 'bad' : 'good', f.tag);
      }
      if (!f.ships.length) { G.fleets.delete(f.id); const i = sea.fleets.indexOf(f.id); if (i >= 0) sea.fleets.splice(i, 1); }
    }
  }
  function endNaval(nb, A, B) {
    G.navalBattles.delete(nb.sea);
    const hp = side => side.reduce((s, f) => s + f.ships.reduce((a, x) => a + x.hp, 0), 0);
    const loser = hp(A) < hp(B) ? A : B;
    for (const f of [...A, ...B]) f.inBattle = false;
    if (A.length && B.length) for (const f of loser) { const s = G.seas[f.sea].adj.find(a => !G.navalBattles.has(a)); if (s != null) { f.path = seaPath(f.sea, f.home) || [s]; } }
  }

  // ---------- daily ----------
  function dayTick() {
    if (G.dirtyLists) rebuildProvLists();
    const day = G.hour / 24;
    for (const tag in G.countries) {
      const c = G.countries[tag]; if (!c.alive) continue;
      updateLeader(c);
      c.pp += 2 * (c.major ? 1 : 0.6);
      economyDay(c);
      researchDay(c);
      trainingDay(c);
      if (!c.provList.length || !c.provList.some(p => p.ctrl === tag)) { capitulateNow(c); continue; }
      // relocate a lost capital
      const capP = G.provs[c.capital];
      if (capP.ctrl !== tag && !allied(capP.ctrl, tag)) {
        const alt = c.provList.filter(p => p.ctrl === tag).sort((a, b) => b.vp - a.vp)[0];
        if (alt) { c.lostCapital = (c.lostCapital || 0) + 1; c.capital = alt.id; if (tag === G.player || c.major) log(`${c.name} moved its capital to ${alt.name || alt.modern}.`, 'politics', tag); }
      }
    }
    supplyDay();
    reinforceDay();
    airDay();
    checkCapitulation();
    entrenchDay();
    Events.check();
    AI.day(day);
    if (G.dirtyBorders) { MapView.invalidate(); G.dirtyBorders = false; }
    UI.dayUpdate();
  }
  function capitulateNow(c) { if (isAtWar(c.tag)) capitulate(c.tag); else killCountry(c.tag); }
  function updateLeader(c) {
    const L = COUNTRIES[c.tag].leaders; let idx = 0; const ds = dateStr();
    for (let i = 0; i < L.length; i++) if (!L[i][2] || L[i][2] <= ds) idx = i;
    if (idx !== c.leaderIdx) {
      c.leaderIdx = idx;
      if (c.major || c.tag === G.player) { log(`${L[idx][0]} is the new leader of ${c.name}.`, 'politics', c.tag); if (c.major) UI.popup({ title: `New Leader in ${c.name}`, text: `${L[idx][0]} has become ${L[idx][3]} of ${c.name}.`, tags: [c.tag], kind: 'leader' }); }
    }
  }
  function economyDay(c) {
    const ind = industry(c);
    c.ind = ind;
    // construction
    let civLeft = ind.freeCiv;
    const cmod = 1 + (c.mods.construction || 0);
    for (const job of c.construction) {
      if (civLeft <= 0) break;
      const use = Math.min(15, civLeft); civLeft -= use;
      job.prog += use * 5 * cmod * (c.cheats.instantBuild ? 1000 : 1);
      const p = G.provs[job.prov];
      if (job.prog >= BUILD[job.kind].cost) {
        if (p.owner === c.tag && p.ctrl === c.tag) { p[job.kind] += 1; if (c.tag === G.player) log(`${BUILD[job.kind].name} completed in ${p.name || 'province'}.`, 'good', c.tag); }
        job.done = true;
      }
    }
    c.construction = c.construction.filter(j => !j.done);
    // production
    let milLeft = ind.mil;
    const fmod = 1 + (c.mods.factory || 0); const cap = 0.5 + (c.mods.eff_cap || 0);
    for (const line of c.production) {
      const f = Math.min(line.fac, milLeft); milLeft -= f;
      if (f <= 0) continue;
      line.eff = Math.min(cap, line.eff + 0.004);
      line.prog += f * FACTORY_OUTPUT * line.eff * fmod;
      const cost = EQUIPMENT[line.eq].cost * (1 + 0.08 * (c.eqLevel[line.eq] || 0));
      if (line.prog >= cost) { const n = Math.floor(line.prog / cost); line.prog -= n * cost; c.stockpile[line.eq] += n; line.made = (line.made || 0) + n; }
    }
    c.unusedMil = milLeft;
    // shipyards
    let dockLeft = ind.dock;
    for (const line of c.navalProd) {
      const dk = Math.min(line.docks, dockLeft); dockLeft -= dk; if (dk <= 0) continue;
      line.prog += dk * FACTORY_OUTPUT * fmod * (c.cheats.instantBuild ? 100 : 1);
      if (line.prog >= SHIPS[line.ship].cost) { line.prog -= SHIPS[line.ship].cost; deliverShip(c, line.ship); if (!line.repeat) line.done = true; }
    }
    c.navalProd = c.navalProd.filter(l => !l.done);
    // air wings auto-reinforce from stockpile
    for (const w of G.wings.values()) if (w.tag === c.tag && w.planes < w.max) { const need = Math.min(w.max - w.planes, c.stockpile[w.type], 10); w.planes += need; c.stockpile[w.type] -= need; }
  }
  function deliverShip(c, type) {
    const sea = homeSea(c); if (sea == null) return;
    let f = [...G.fleets.values()].find(f => f.tag === c.tag && f.sea === sea && f.reserve);
    if (!f) { f = makeFleet(c, sea, [], `${c.adj} Reserve Fleet`); f.reserve = true; G.seas[sea].fleets.push(f.id); }
    f.ships.push(makeShip(c, type));
    if (c.tag === G.player) log(`New ${SHIPS[type].name} launched: ${f.ships[f.ships.length - 1].name}.`, 'good', c.tag);
  }
  function researchDay(c) {
    const spd = 1 + (c.mods.research || 0) + (c.cheats.fastResearch ? 50 : 0);
    for (let i = 0; i < c.research.length; i++) {
      const r = c.research[i]; if (!r) continue;
      r.prog += spd;
      if (r.prog >= techCost(c, TECH_BY_ID[r.id])) completeTech(c, r.id), c.research[i] = null;
    }
  }
  function techCost(c, t) { const ahead = Math.max(0, t.year - year()); return t.cost * (1 + ahead * 1.0) * (c.major ? 1 : 1.2); }
  function techAvailable(c, t) {
    if (c.techs.has(t.id)) return false;
    if (t.req && !t.req.every(r => c.techs.has(r))) return false;
    if (t.reqAny && !t.reqAny.some(r => c.techs.has(r))) return false;
    if (t.excl && t.excl.split(' ').some(x => c.techs.has(x))) return false;
    if (c.research.some(r => r && r.id === t.id)) return false;
    return true;
  }
  function completeTech(c, id) {
    const t = TECH_BY_ID[id]; if (c.techs.has(id)) return;
    c.techs.add(id); applyTechEffects(c, t); recalcCountry(c);
    for (const d of G.divisions.values()) if (d.tag === c.tag) { const tpl = c.templates.find(x => x.id === d.tplId); if (tpl) d.stats = tpl.stats; }
    if (c.tag === G.player) log(`Research completed: ${t.name}.`, 'good', c.tag);
  }
  function trainingDay(c) {
    for (const t of c.training) {
      // pull equipment gradually
      for (const e in t.need) {
        const want = t.need[e] - (t.have[e] || 0); if (want <= 0) continue;
        const take = Math.min(want, c.stockpile[e], Math.ceil(t.need[e] / 10));
        c.stockpile[e] -= take; t.have[e] = (t.have[e] || 0) + take;
      }
      t.days -= 1;
      if (t.days <= 0) {
        let fill = 1; for (const e in t.need) fill = Math.min(fill, (t.have[e] || 0) / t.need[e]);
        if (fill >= 0.5 || c.cheats.freeEquipment || t.days < -60) {
          const tpl = c.templates.find(x => x.id === t.tpl) || c.templates[0];
          const prov = G.provs[t.prov ?? c.capital].ctrl === c.tag ? G.provs[t.prov ?? c.capital] : (c.provList.find(p => p.ctrl === c.tag) || G.provs[c.capital]);
          const d = makeDivision(c, tpl, prov, null, c.cheats.freeEquipment ? 1 : Math.max(0.3, fill));
          d.org = d.stats.org * 0.5;
          t.done = true;
          if (c.tag === G.player) log(`${d.name} has finished training.`, 'good', c.tag);
        }
      }
    }
    c.training = c.training.filter(t => !t.done);
  }
  function startTraining(c, tpl, count = 1, prov) {
    const st = tpl.stats || computeTemplate(tpl, c);
    const mp = manpowerInfo(c);
    let made = 0;
    for (let i = 0; i < count; i++) {
      if (mp.avail - made * st.mp < st.mp && !c.cheats.freeEquipment) break;
      c.training.push({ id: nextId(), tpl: tpl.id, days: c.cheats.instantBuild ? 1 : 60, total: 60, need: { ...st.eq }, have: {}, mp: st.mp, prov });
      made++;
    }
    return made;
  }
  function supplyDay() {
    // a division is supplied if it can trace a path through friendly-controlled land to its capital,
    // or to any friendly-controlled port while the nation has a navy.
    const reach = new Map();
    const tags = new Set([...G.divisions.values()].map(d => d.tag));
    for (const tag of tags) {
      const c = G.countries[tag]; if (!c.alive) continue;
      const ok = new Set(); const q = [];
      const friendly = p => p.ctrl === tag || allied(p.ctrl, tag);
      const hasNavy = [...G.fleets.values()].some(f => f.tag === tag) || c.ind?.dock > 0;
      // supply hubs: the capital, large home cities, and ports (if the nation has a navy)
      for (const p of G.provs) if (friendly(p) && (p.id === c.capital || (p.vp >= 10 && p.owner === tag) || (hasNavy && p.coastal && p.vp > 0 && (p.owner === tag || allied(p.owner, tag))))) { ok.add(p.id); q.push(p.id); }
      while (q.length) { const cur = q.pop(); for (const n of G.provs[cur].adj) if (!ok.has(n) && friendly(G.provs[n])) { ok.add(n); q.push(n); } }
      reach.set(tag, ok);
      // distance from home territory (supply lines get stretched deep in enemy land)
      const dist = new Map(); const q2 = [];
      for (const p of G.provs) if (ok.has(p.id) && (p.owner === tag || allied(p.owner, tag))) { dist.set(p.id, 0); q2.push(p.id); }
      for (let i = 0; i < q2.length; i++) { const cur = q2[i]; for (const n of G.provs[cur].adj) if (!dist.has(n) && ok.has(n)) { dist.set(n, dist.get(cur) + 1); q2.push(n); } }
      reach.get(tag).dist = dist;
    }
    for (const d of G.divisions.values()) {
      if (d.state === 'naval') continue;
      const ok = reach.get(d.tag); const p = G.provs[d.prov];
      d.supplied = !!ok && (ok.has(d.prov) || p.adj.some(a => ok.has(a)));
      d.lowSupply = d.supplied && (ok.dist.get(d.prov) ?? 0) > 7;
      if (!d.supplied) { d.str = Math.max(0.05, d.str - 0.01); }
      if (p.terr === 'desert' && d.state === 'move') d.org = Math.max(0, d.org - 0.5);
    }
  }
  function reinforceDay() {
    for (const d of G.divisions.values()) {
      if (d.str >= 1 || !d.supplied || d.state === 'naval') continue;
      const c = G.countries[d.tag];
      const add = Math.min(1 - d.str, d.lowSupply ? 0.025 : 0.06);
      let frac = add;
      for (const e in d.stats.eq) { const need = d.stats.eq[e] * add; if (c.stockpile[e] < need) frac = Math.min(frac, c.stockpile[e] / d.stats.eq[e]); }
      const mp = manpowerInfo(c); if (mp.avail < d.stats.mp * frac) frac = Math.max(0, mp.avail / d.stats.mp);
      if (c.cheats.freeEquipment) frac = add;
      if (frac <= 0) continue;
      if (!c.cheats.freeEquipment) for (const e in d.stats.eq) c.stockpile[e] = Math.max(0, c.stockpile[e] - d.stats.eq[e] * frac);
      d.str += frac;
    }
  }
  function entrenchDay() {
    for (const d of G.divisions.values()) d.entrench = d.state === 'idle' && !d.inBattle ? Math.min(0.2 + (G.countries[d.tag].mods.entrench || 0), d.entrench + 0.02) : 0;
  }
  function checkCapitulation() {
    for (const tag in G.countries) {
      const c = G.countries[tag]; if (!c.alive || !isAtWar(tag)) { c.surrender = 0; continue; }
      let lost = 0, total = 0;
      for (const p of c.provList) { const w = p.vp + 1; total += w; if (p.ctrl !== tag && !allied(p.ctrl, tag)) lost += w; }
      const capP = G.provs[c.capital];
      const capLost = (c.lostCapital || 0) > 0;
      if (capLost) lost += total * 0.05 * Math.min(2, c.lostCapital);
      c.surrender = total ? lost / total : 1;
      const threshold = c.major ? (capLost ? 0.66 : 0.85) : (capLost ? 0.56 : 0.75);
      if (c.surrender >= threshold && !c.cheats.noCapitulate) capitulate(tag);
    }
    // wars whose side is gone are cleaned in killCountry
  }

  // ---------- air ----------
  function airDay() {
    const wings = [...G.wings.values()].filter(w => w.planes > 0);
    const inRange = (w, pt) => { const b = G.provs[w.base]; return Math.hypot(b.c[0] - pt[0], b.c[1] - pt[1]) <= PLANES[w.type].range; };
    const power = (w, stat) => w.planes * PLANES[w.type][stat] * (1 + 0.15 * (G.countries[w.tag].eqLevel[w.type] || 0)) * (1 + (G.countries[w.tag].mods.air || 0));
    for (const w of wings) w.active = false;
    // land battles
    for (const b of G.battles.values()) {
      const p = G.provs[b.prov];
      const attSide = t => t === b.attTag || allied(t, b.attTag), defSide = t => t === b.defTag || allied(t, b.defTag);
      let fa = 0, fd = 0, ca = 0, cd = 0; const ws = [];
      for (const w of wings) {
        if (!inRange(w, p.c) || (w.mission !== 'superiority' && w.mission !== 'cas')) continue;
        const a = attSide(w.tag), d = defSide(w.tag); if (!a && !d) continue;
        ws.push(w); w.active = true;
        if (w.mission === 'superiority') { if (a) fa += power(w, 'air'); else fd += power(w, 'air'); }
        else { if (a) ca += power(w, 'ground'); else cd += power(w, 'ground'); }
      }
      const sup = fa + fd > 0 ? fa / (fa + fd) : 0.5;
      b.air = { attSup: sup, casAtt: ca * 0.012 * (0.5 + sup), casDef: cd * 0.012 * (1.5 - sup) };
      // losses
      for (const w of ws) {
        const mine = attSide(w.tag) ? 1 - sup : sup;
        const loss = Math.floor(w.planes * mine * (w.mission === 'cas' ? 0.03 : 0.015) * rnd() * 2);
        w.planes -= loss;
        if (rnd() < 0.25) G.flights.push({ from: G.provs[w.base].c, to: p.c, t: 0, type: w.type, tag: w.tag });
      }
    }
    // strategic bombing & naval strike
    for (const w of wings) {
      if (w.mission === 'bombing') {
        const targets = G.provs.filter(p => atWar(w.tag, p.ctrl) && (p.civ + p.mil + p.dock) > 0 && inRange(w, p.c));
        if (!targets.length) continue;
        const t = targets[Math.floor(rnd() * targets.length)]; w.active = true;
        const enemyF = wings.filter(x => x.mission === 'superiority' && atWar(x.tag, w.tag) && inRange(x, t.c)).reduce((s, x) => s + power(x, 'air'), 0);
        const own = power(w, 'strat');
        if (rnd() < own / (own + enemyF + 50) * 0.25) { const k = t.mil > 0 ? 'mil' : t.civ > 0 ? 'civ' : 'dock'; t[k] = Math.max(0, t[k] - 1); if (t.ctrl === G.player || w.tag === G.player) log(`Bombers destroyed a factory in ${t.name || 'enemy territory'}.`, w.tag === G.player ? 'good' : 'bad', w.tag); }
        w.planes -= Math.floor(w.planes * Math.min(0.08, enemyF / (own + 1) * 0.02) * rnd());
        if (rnd() < 0.3) G.flights.push({ from: G.provs[w.base].c, to: t.c, t: 0, type: w.type, tag: w.tag });
      } else if (w.mission === 'naval_strike') {
        const fls = [...G.fleets.values()].filter(f => atWar(f.tag, w.tag) && inRange(w, G.seas[f.sea].c));
        if (!fls.length) continue;
        const f = fls[Math.floor(rnd() * fls.length)]; w.active = true;
        const aa = f.ships.reduce((s, x) => s + SHIPS[x.type].aa, 0);
        for (let i = 0; i < Math.ceil(w.planes / 25); i++) { const s = f.ships[Math.floor(rnd() * f.ships.length)]; if (s && rnd() < 0.35) s.hp -= power(w, 'naval') * 0.05 * rnd(); }
        const sunk = f.ships.filter(s => s.hp <= 0); f.ships = f.ships.filter(s => s.hp > 0);
        if (sunk.length && (f.tag === G.player || w.tag === G.player)) log(`Naval bombers sank ${sunk.map(s => s.name).join(', ')}.`, w.tag === G.player ? 'good' : 'bad', w.tag);
        if (!f.ships.length) { G.fleets.delete(f.id); recomputeUnitIndex(); }
        w.planes -= Math.floor(Math.min(w.planes * 0.1, aa * 0.05 * rnd()));
        G.flights.push({ from: G.provs[w.base].c, to: G.seas[f.sea].c, t: 0, type: w.type, tag: w.tag });
      }
    }
    for (const w of [...G.wings.values()]) if (w.planes <= 0) G.wings.delete(w.id);
  }

  return { weather, hourTick, findPath, seaPath, orderMove, orderInvasion, orderFleet, techAvailable, techCost, completeTech, startTraining, captureProvince, startBattle, deliverShip };
})();
