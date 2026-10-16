// Computer-controlled nations and the historical event script.
const AI = (() => {
  const RESEARCH_PRIO = { industry: 3, electronics: 2.5, infantry: 2, land_doctrine: 2, artillery: 1.6, armor: 1.4, support: 1.2, air: 1.3, naval: 1 };
  const NAVAL_POWERS = new Set(['ENG', 'USA', 'JAP', 'ITA', 'FRA']);

  function day(dayNo) {
    for (const tag in G.countries) {
      const c = G.countries[tag]; if (!c.alive || (!c.ai && !G.observe)) continue;
      const h = tag.charCodeAt(0) + tag.charCodeAt(1) * 3 + tag.charCodeAt(2) * 7;
      if ((dayNo + h) % 7 === 0) economy(c);
      const war = isAtWar(tag) || plannedTargets(c).length;
      if (war || (dayNo + h) % 10 === 0) military(c, dayNo);
      if (war && (dayNo + h) % 3 === 0) navy(c);
      if (war && (dayNo + h) % 8 === 0) air(c);
    }
  }

  // ---------- economy ----------
  function economy(c) {
    const ind = c.ind || industry(c);
    const war = isAtWar(c.tag);
    // research
    for (let i = 0; i < c.research.length; i++) if (!c.research[i]) {
      const opts = TECHS.filter(t => Sim.techAvailable(c, t));
      if (!opts.length) break;
      opts.sort((a, b) => Sim.techCost(c, a) / (RESEARCH_PRIO[a.cat] * (NAVAL_POWERS.has(c.tag) && a.cat === 'naval' ? 2 : 1)) - Sim.techCost(c, b) / (RESEARCH_PRIO[b.cat] * (NAVAL_POWERS.has(c.tag) && b.cat === 'naval' ? 2 : 1)) + (rnd() - 0.5) * 30);
      // doctrine choice by nation
      const docPref = { GER: 'doc_mobile', ENG: 'doc_superior_firepower', USA: 'doc_superior_firepower', FRA: 'doc_grand_battleplan', SOV: 'doc_mass_assault', JAP: 'doc_mass_assault', CHI: 'doc_mass_assault' }[c.tag];
      let pick = opts[0];
      if (docPref && opts.some(t => t.id === docPref)) pick = opts.find(t => t.id === docPref);
      else if (pick.excl) { const nonEx = opts.find(t => !t.excl); if (nonEx && rnd() < 0.7) pick = nonEx; }
      c.research[i] = { id: pick.id, prog: 0 };
    }
    // laws
    if (c.pp >= 100) {
      const eco = ECONOMY[c.laws.economy + 1];
      if (eco && (war || (eco.needYear && year() >= eco.needYear && c.ideo !== 'democratic') || (!eco.needYear && !eco.needWar && c.major)) && (!eco.needWar || war)) { c.laws.economy++; c.pp -= 100; recalcCountry(c); }
      else {
        const mp = manpowerInfo(c); const law = CONSCRIPTION[c.laws.conscription + 1];
        if (law && mp.avail < 30000 && (!law.needWar || war)) { c.laws.conscription++; c.pp -= 100; recalcCountry(c); }
      }
    }
    // construction
    if (c.construction.length < 2 && ind.freeCiv > 0) {
      const kind = (war || year() >= 1938 || c.ideo === 'fascism' && year() >= 1937) && rnd() < 0.75 ? 'mil' : (NAVAL_POWERS.has(c.tag) && rnd() < 0.15 ? 'dock' : 'civ');
      queueConstruction(c, kind);
    }
    // templates: tanks when available
    if (c.major && c.techs.has('medium_tank1') && !c.templates.some(t => t.line.includes('medium_tank'))) {
      const line = ['medium_tank', 'medium_tank', 'medium_tank', 'medium_tank', 'motorized', 'motorized', 'motorized', 'artillery', 'artillery'];
      const tpl = { id: nextId(), name: 'Armored Division', line: [...line, ...Array(25 - line.length).fill(null)], support: ['recon', 'engineer', null, null, null] };
      tpl.stats = computeTemplate(tpl, c); c.templates.push(tpl);
    }
    // production: medium tanks replace light tanks
    for (const l of c.production) if (l.eq === 'light_tank' && c.techs.has('medium_tank1')) { l.eq = 'medium_tank'; l.eff *= 0.5; }
    if (c.unusedMil > 0) {
      const needs = ['infantry_equipment', 'artillery', 'fighter', 'support_equipment', 'cas', 'motorized', 'anti_tank', 'anti_air'];
      let left = c.unusedMil;
      for (const eq of needs) {
        if (left <= 0) break;
        let line = c.production.find(l => l.eq === eq);
        if (!line) { line = { id: nextId(), eq, fac: 0, prog: 0, eff: 0.2 }; c.production.push(line); }
        const add = Math.min(15 - line.fac, left, Math.max(1, Math.ceil(c.unusedMil / 3)));
        if (add > 0) { line.fac += add; left -= add; }
      }
    }
    // naval production
    if (ind.dock > 0 && !c.navalProd.length) {
      const pick = NAVAL_POWERS.has(c.tag) ? ['destroyer', 'light_cruiser', 'submarine', c.techs.has('carrier1') ? 'carrier' : 'heavy_cruiser', 'battleship'] : ['destroyer', 'submarine'];
      for (const s of pick) c.navalProd.push({ id: nextId(), ship: s, docks: Math.max(1, Math.round(ind.dock / pick.length)), prog: 0, repeat: true });
    }
    // training
    let divs = 0; for (const d of G.divisions.values()) if (d.tag === c.tag) divs++;
    const target = 6 + ind.mil * (war ? 2.2 : 1.6) + (c.major ? 10 : 0) + manpowerInfo(c).cap / (war ? 50000 : 90000);
    if (divs + c.training.length < target && c.training.length < (c.major ? 8 : 3)) {
      const armorTpl = c.templates.find(t => t.line.includes('medium_tank')) || c.templates.find(t => t.name.includes('Panzer') || t.name.includes('Tank'));
      const useArmor = armorTpl && c.major && rnd() < 0.25 && (c.stockpile.medium_tank + c.stockpile.light_tank) > 100;
      const tpl = useArmor ? armorTpl : c.templates[0];
      const st = tpl.stats; let ok = true; for (const e in st.eq) if (c.stockpile[e] < st.eq[e] * 0.4) ok = false;
      if (ok || war) Sim.startTraining(c, tpl, war ? 3 : 2);
    }
  }

  // ---------- army ----------
  function plannedTargets(c) {
    if (!G.historical) return [];
    const now = G.hour; const out = [];
    for (const e of HIST_EVENTS) {
      if (G.firedEvents.has(e.date + e.title)) continue;
      const t = (Date.parse(e.date) - START_DATE) / 3600e3;
      if (t < now || t - now > 24 * 45) continue;
      for (const a of e.actions) if (a[0] === 'war' && a[1] === c.tag && G.countries[a[2]]?.alive) {
        out.push(a[2]);
        // expect the target's guarantors and allies to join
        for (const [g, t] of G.guarantees) if (t === a[2] && G.countries[g].alive && !allied(g, c.tag)) out.push(g);
        const f = factionOf(a[2]); if (f) for (const m of f.members) if (!allied(m, c.tag)) out.push(m);
      }
    }
    return out;
  }
  function pw(d) { const s = d.stats; return ((s.soft + s.hard) * 0.6 + s.brk * 0.3 + s.def * 0.3) * d.str * (0.2 + d.org / Math.max(1, s.org)); }
  function military(c, dayNo) {
    const tag = c.tag;
    const enemies = new Set([...enemiesOf(tag), ...plannedTargets(c)]);
    const atWarNow = isAtWar(tag);
    const mine = [...G.divisions.values()].filter(d => d.tag === tag && d.state !== 'naval' && d.state !== 'amphib');
    if (!mine.length) return;
    const isEnemyProv = p => enemies.has(p.ctrl) || [...enemies].some(e => allied(e, p.ctrl) && atWar(tag, p.ctrl));
    const friendly = p => p.ctrl === tag || allied(p.ctrl, tag);
    // front provinces
    let front = [];
    if (enemies.size) for (const p of G.provs) if (friendly(p) && p.adj.some(a => isEnemyProv(G.provs[a]))) front.push(p);
    if (!enemies.size) {
      // peace: garrison borders with foreign majors lightly; return units from foreign soil
      for (const d of mine) if (d.state === 'idle' && !friendly(G.provs[d.prov])) Sim.orderMove(d, c.capital);
      if (dayNo % 30 !== 0) return;
      front = c.provList.filter(p => p.ctrl === tag && p.adj.some(a => { const q = G.provs[a]; return q.owner !== tag && !allied(q.owner, tag) && G.countries[q.owner]?.major; }));
      if (!front.length) return;
    }
    // naval invasion when there is no land front
    if (atWarNow && !front.filter(p => p.ctrl === tag).length) { navalInvasion(c, mine, enemies); }
    if (!front.length) return;
    const frontSet = new Set(front.map(p => p.id));
    const count = new Map(front.map(p => [p.id, 0]));
    for (const d of mine) if (frontSet.has(d.prov) || (d.path.length && frontSet.has(d.path[d.path.length - 1]))) { const k = d.path.length ? d.path[d.path.length - 1] : d.prov; if (count.has(k)) count.set(k, count.get(k) + 1); }
    const desired = Math.max(1, Math.min(6, Math.ceil(mine.length / front.length)));
    const weight = p => desired + (p.vp >= 10 ? 1 : 0);
    // attacks (only when at war). Democracies are cautious early in the war (the "Phoney War").
    const aggression = c.ideo === 'fascism' ? 1.15 : c.ideo === 'communism' ? 1.3 : c.ideo === 'democratic' ? (year() < 1942 ? 2.2 : 1.35) : 1.6;
    if (atWarNow) {
      // gather every ready unit adjacent to each enemy province and attack where we have the odds
      const ready = new Set(mine.filter(d => d.state === 'idle' && !d.inBattle && d.org > d.stats.org * 0.6 && d.str > 0.5).map(d => d.id));
      const targets = new Map();
      for (const f of front) {
        if (f.ctrl !== tag) continue;
        for (const a of f.adj) { const q = G.provs[a]; if (isEnemyProv(q) && atWar(tag, q.ctrl)) targets.set(q.id, q); }
      }
      const plans = [];
      for (const q of targets.values()) {
        const ed = q.units.map(id => G.divisions.get(id)).filter(d => d && atWar(tag, d.tag));
        const ep = ed.reduce((s, d) => s + pw(d) * (1 + d.entrench), 0) * (1 - TERRAIN[q.terr].atk);
        const att = []; for (const a of q.adj) { const src = G.provs[a]; if (src.ctrl !== tag) continue; for (const id of src.units) if (ready.has(id)) att.push(G.divisions.get(id)); }
        if (!att.length) continue;
        const mp = att.reduce((s, d) => s + pw(d), 0);
        plans.push({ q, ep, att, score: (ep === 0 ? 10 : mp / ep) + q.vp * 0.02 + rnd() * 0.2 });
      }
      plans.sort((a, b) => b.score - a.score);
      for (const pl of plans) {
        const att = pl.att.filter(d => ready.has(d.id));
        if (!att.length) continue;
        if (pl.ep === 0) { // walk into undefended ground with a single division
          const d = att.sort((a, b) => G.provs[b.prov].units.length - G.provs[a.prov].units.length)[0];
          if (G.provs[d.prov].units.length > 1 || !G.provs[d.prov].adj.some(a => G.provs[a].units.some(id => atWar(tag, G.divisions.get(id)?.tag)))) { d.path = [pl.q.id]; d.state = 'move'; d.prog = 0; ready.delete(d.id); }
          continue;
        }
        const mp = att.reduce((s, d) => s + pw(d), 0);
        if (!(mp / pl.ep > aggression || (mp / pl.ep > aggression * 0.8 && rnd() < 0.15))) continue;
        // leave one division behind in each source province that is itself threatened
        const bySrc = new Map(); for (const d of att) { if (!bySrc.has(d.prov)) bySrc.set(d.prov, []); bySrc.get(d.prov).push(d); }
        for (const [src, ds] of bySrc) {
          const threatened = G.provs[src].adj.some(a => a !== pl.q.id && G.provs[a].units.some(id => atWar(tag, G.divisions.get(id)?.tag)));
          const go = threatened && G.provs[src].units.length <= ds.length ? ds.slice(1) : ds;
          for (const d of go) { d.path = [pl.q.id]; d.state = 'move'; d.prog = 0; ready.delete(d.id); }
        }
      }
    }
    // move idle reserves towards understaffed front provinces (several rounds so every unit finds a slot)
    const need = new Map(front.map(p => [p.id, Math.max(0, weight(p) - count.get(p.id))]));
    const assigned = new Set();
    for (let round = 0; round < 5; round++) {
      const sources = front.filter(p => need.get(p.id) > 0);
      if (!sources.length) break;
      const prev = new Map(); const q = [];
      for (const p of sources) { prev.set(p.id, -1); q.push(p.id); }
      for (let qi = 0; qi < q.length; qi++) {
        const cur = q[qi];
        for (const n of G.provs[cur].adj) { if (prev.has(n)) continue; if (!friendly(G.provs[n])) continue; prev.set(n, cur); q.push(n); }
      }
      let moved = 0;
      for (const d of mine) {
        if (assigned.has(d.id) || d.state !== 'idle' || d.inBattle) continue;
        if (frontSet.has(d.prov) && count.get(d.prov) <= weight(G.provs[d.prov])) continue;
        if (!prev.has(d.prov)) continue;
        const path = []; let cur = d.prov; let guard = 0;
        while (prev.get(cur) !== -1 && guard++ < 400) { cur = prev.get(cur); path.push(cur); }
        if (!path.length) continue;
        const dest = path[path.length - 1];
        if (!(need.get(dest) > 0)) continue;
        need.set(dest, need.get(dest) - 1);
        if (frontSet.has(d.prov)) count.set(d.prov, count.get(d.prov) - 1);
        d.path = path; d.state = 'move'; d.prog = 0; assigned.add(d.id); moved++;
      }
      if (!moved) break;
    }
  }
  function navalInvasion(c, mine, enemies) {
    if (rnd() > 0.15) return;
    if (!c.major && mine.length < 25) return;
    if (G.hour - (c.lastInvasion || -1e9) < 24 * 60) return;
    if (![...G.fleets.values()].some(f => f.tag === c.tag)) return;
    const idle = mine.filter(d => d.state === 'idle' && !d.inBattle && G.provs[d.prov].coastal && d.str > 0.7);
    if (idle.length < 2) {
      // gather units at a port
      const port = c.provList.filter(p => p.coastal && p.ctrl === c.tag).sort((a, b) => b.vp - a.vp)[0];
      if (port) for (const d of mine.filter(d => d.state === 'idle').slice(0, 4)) Sim.orderMove(d, port.id);
      return;
    }
    const from = G.provs[idle[0].prov];
    const targets = G.provs.filter(p => p.coastal && enemies.has(p.ctrl) && atWar(c.tag, p.ctrl));
    if (!targets.length) return;
    targets.sort((a, b) => (a.units.length * 3 + Math.hypot(a.c[0] - from.c[0], a.c[1] - from.c[1]) / 100 - a.vp * 0.1) - (b.units.length * 3 + Math.hypot(b.c[0] - from.c[0], b.c[1] - from.c[1]) / 100 - b.vp * 0.1));
    const t = targets.find(q => { const sp = Sim.seaPath(from.sea, q.sea); return sp && sp.length <= 7 && q.units.length === 0; });
    if (!t) return;
    c.lastInvasion = G.hour;
    for (const d of idle.filter(d => d.prov === from.id).slice(0, 6)) Sim.orderInvasion(d, t.id);
  }

  // ---------- navy ----------
  function navy(c) {
    const fleets = [...G.fleets.values()].filter(f => f.tag === c.tag && !f.inBattle && !f.path.length);
    const str = f => f.ships.reduce((s, x) => s + (SHIPS[x.type].atk + SHIPS[x.type].heavy + SHIPS[x.type].torp * 0.5) * x.hp / x.maxhp, 0);
    for (const f of fleets) {
      if (f.reserve && f.ships.length >= 6) f.reserve = false;
      const near = new Map([[f.sea, 0]]); const q = [f.sea];
      for (let i = 0; i < q.length; i++) { const cur = q[i]; if (near.get(cur) >= 3) continue; for (const n of G.seas[cur].adj) if (!near.has(n)) { near.set(n, near.get(cur) + 1); q.push(n); } }
      let target = null, best = 0;
      for (const s of near.keys()) {
        const enemy = G.seas[s].fleets.map(id => G.fleets.get(id)).filter(e => e && atWar(e.tag, c.tag));
        if (!enemy.length) continue;
        const es = enemy.reduce((a, e) => a + str(e), 0);
        const ratio = str(f) / (es + 1);
        if (ratio > 1.2 && ratio > best) { best = ratio; target = s; }
      }
      if (target != null) Sim.orderFleet(f, target);
      else if (f.mission === 'raid') {
        const enemyCoast = G.provs.filter(p => p.coastal && atWar(c.tag, p.ctrl)).map(p => p.sea);
        if (enemyCoast.length) Sim.orderFleet(f, enemyCoast[Math.floor(rnd() * enemyCoast.length)]);
      } else if (f.sea !== f.home && f.ships.some(s => s.hp < s.maxhp * 0.5)) Sim.orderFleet(f, f.home);
      // repair at home
      if (f.sea === f.home) for (const s of f.ships) s.hp = Math.min(s.maxhp, s.hp + s.maxhp * 0.05);
    }
  }

  // ---------- air ----------
  function air(c) {
    const wings = [...G.wings.values()].filter(w => w.tag === c.tag);
    if (!wings.length) return;
    // base near the busiest battle, or front
    let best = null, bc = -1;
    for (const b of G.battles.values()) {
      const p = G.provs[b.prov];
      if (!(b.attTag === c.tag || b.defTag === c.tag || allied(b.attTag, c.tag) || allied(b.defTag, c.tag))) continue;
      const n = G.provs[b.prov].units.length + 1;
      if (n > bc) { bc = n; best = p; }
    }
    if (!best) return;
    const bases = c.provList.filter(p => p.ctrl === c.tag).sort((a, b) => Math.hypot(a.c[0] - best.c[0], a.c[1] - best.c[1]) - Math.hypot(b.c[0] - best.c[0], b.c[1] - best.c[1]));
    if (!bases.length) return;
    for (const w of wings) {
      if (w.type === 'nav_bomber') continue;
      const range = PLANES[w.type].range;
      const b = bases.find(p => Math.hypot(p.c[0] - best.c[0], p.c[1] - best.c[1]) < range * 0.7) || bases[0];
      w.base = b.id;
    }
  }

  return { day, plannedTargets };
})();

// ---------- historical events ----------
const Events = (() => {
  function check() {
    const today = dateStr();
    for (const e of HIST_EVENTS) {
      const key = e.date + e.title;
      if (G.firedEvents.has(key) || e.date > today) continue;
      G.firedEvents.add(key);
      if (!G.countries[e.who]?.alive) continue;
      fire(e);
    }
  }
  function playerIsActor(e) { return e.who === G.player && e.actions.some(a => a[0] === 'war' || a[0] === 'annex' || a[0] === 'join'); }
  function valid(a) {
    const [k, x, y] = a;
    if (k === 'war') return G.countries[x]?.alive && G.countries[y]?.alive && !atWar(x, y) && !allied(x, y);
    if (k === 'annex') return G.countries[x]?.alive && G.countries[y]?.alive && !isAtWar(y);
    if (k === 'join') return G.countries[x]?.alive && G.factions[y];
    if (k === 'peace') return atWar(x, y);
    if (k === 'guarantee') return G.countries[x]?.alive && G.countries[y]?.alive;
    return true;
  }
  function fire(e) {
    if (!G.historical && e.actions.some(a => a[0] === 'war' || a[0] === 'annex')) return;
    const acts = e.actions.filter(valid);
    if (!acts.length && e.actions.some(a => a[0] !== 'tension')) return;
    const involvesPlayer = acts.some(a => a.slice(1).includes(G.player)) || e.target === G.player;
    if (playerIsActor(e)) {
      UI.popup({ title: e.title, text: e.text + '\n\nThis is what happened historically. Will you follow history?', tags: [e.who], kind: 'event',
        options: [{ label: 'Follow history', fn: () => run(acts) }, { label: 'Not now', fn: () => {} }] });
      return;
    }
    if (e.target === G.player && acts.some(a => a[0] === 'annex')) {
      UI.popup({ title: e.title, text: `${G.countries[e.who].name} demands that we submit. Refusing means war.`, tags: [e.who, G.player], kind: 'event',
        options: [{ label: 'Accept their demands', fn: () => run(acts) }, { label: 'Refuse! (War)', fn: () => declareWar(e.who, G.player) }] });
      return;
    }
    run(acts);
    const pc = G.countries[G.player];
    if (involvesPlayer || G.countries[e.who].major || (pc && G.countries[e.who] && allied(e.who, G.player))) UI.popup({ title: e.title, text: e.text, tags: [e.who], kind: 'news' });
    else log(e.title + ': ' + e.text, 'news', e.who);
  }
  function run(acts) {
    for (const a of acts) {
      const [k, x, y, z, w] = a;
      if (k === 'war') declareWar(x, y, true), log(`${G.countries[x].name} declared war on ${G.countries[y].name}.`, 'war', x);
      else if (k === 'annex') annex(x, y);
      else if (k === 'faction') { if (!G.factions[x]) createFaction(x, y, z, w); }
      else if (k === 'join') joinFaction(x, y, false);
      else if (k === 'peace') makePeace(x, y);
      else if (k === 'guarantee') G.guarantees.push([x, y]);
      else if (k === 'tension') G.tension = Math.min(100, G.tension + x);
    }
    recomputeUnitIndex();
    G.dirtyBorders = true;
  }
  return { check };
})();
