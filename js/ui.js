// All HTML interface: top bar, menus (politics, research, production, construction, recruitment,
// division designer, navy, air, diplomacy, test menu), selection bar, popups and the start screen.
const UI = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const img = (kind, tag, w = 60, cls = '') => `<img class="${cls}" src="${Models.url(kind, tag || G.player, w)}" width="${w}" height="${Math.round(w * 0.6)}" alt="">`;
  const bar = (v, cls = '') => `<div class="bar ${cls}"><i style="width:${clamp(v, 0, 1) * 100}%"></i></div>`;
  const P = () => G.countries[G.player];
  const UIState = {
    selected: new Set(), selectedFleet: null, selectedProv: null, invasionMode: false,
    current: null, researchTab: 'infantry', designerTpl: null, diploTarget: null, startPick: 'GER', popupQueue: 0, testLog: [],
  };

  const MENU = [
    ['politics', 'Politics', 'L', () => `<span class="ic">⚖</span>`],
    ['research', 'Research', 'R', () => img('radio', G.player, 40)],
    ['diplomacy', 'Diplomacy', 'G', () => `<span class="ic">🤝</span>`],
    ['production', 'Production', 'P', () => img('factory', G.player, 40)],
    ['construction', 'Construct', 'B', () => `<span class="ic">🏗</span>`],
    ['recruit', 'Recruit', 'A', () => img('infantry', G.player, 40)],
    ['designer', 'Designer', 'D', () => img('medium_tank', G.player, 40)],
    ['army', 'Army', 'O', () => img('artillery', G.player, 40)],
    ['navy', 'Navy', 'N', () => img('battleship', G.player, 40)],
    ['air', 'Air Force', 'F', () => img('fighter', G.player, 40)],
    ['test', 'Test Menu', '`', () => `<span class="ic">🧪</span>`],
    ['system', 'Save/Load', 'Esc', () => `<span class="ic">💾</span>`],
  ];

  // ---------- init & start screen ----------
  function init() {
    // start screen
    const majors = ['GER', 'ENG', 'FRA', 'USA', 'SOV', 'ITA', 'JAP', 'CHI'];
    $('start-majors').innerHTML = majors.map(t => `<div class="major ${t === UIState.startPick ? 'sel' : ''}" data-tag="${t}">${Portraits.html(t, 'portrait')}<div class="nm">${COUNTRIES[t].name}</div><div class="small muted">${Portraits.leaderOf(t, 0)[0]}</div></div>`).join('');
    $('start-majors').onclick = e => { const m = e.target.closest('.major'); if (m) pickStart(m.dataset.tag); };
    const minors = Object.keys(COUNTRIES).filter(t => G.countries[t]?.alive).sort((a, b) => COUNTRIES[a].name.localeCompare(COUNTRIES[b].name));
    $('start-minor').innerHTML = minors.map(t => `<option value="${t}">${COUNTRIES[t].name}</option>`).join('');
    $('start-minor').onchange = e => pickStart(e.target.value);
    $('btn-start').onclick = () => { $('start').classList.add('hidden'); Game.start(UIState.startPick, { historical: $('opt-hist').checked }); };
    $('btn-load').disabled = !Game.hasSave();
    $('btn-load').onclick = () => { if (Game.load()) { $('start').classList.add('hidden'); startGame(); } };
    Portraits.onLoad(() => { if (!G.started) { init(); pickStart(UIState.startPick); } else refreshTop(); });
    pickStart(UIState.startPick);
    document.addEventListener('keydown', onKey);
    $('menubar').onclick = e => { const b = e.target.closest('button'); if (b) toggle(b.dataset.p); };
    $('mapmodes').innerHTML = [['political', 'Political'], ['factions', 'Factions'], ['ideology', 'Ideology'], ['terrain', 'Terrain'], ['industry', 'Industry']].map(([m, n]) => `<button data-m="${m}" class="${m === 'political' ? 'sel' : ''}">${n}</button>`).join('');
    $('mapmodes').onclick = e => { const b = e.target.closest('button'); if (!b) return; MapView.setMode(b.dataset.m); [...$('mapmodes').children].forEach(x => x.classList.toggle('sel', x === b)); };
    $('tb-leader').onclick = () => toggle('politics');
    setInterval(liveRefresh, 600);
  }
  function pickStart(tag) {
    UIState.startPick = tag;
    document.querySelectorAll('.major').forEach(m => m.classList.toggle('sel', m.dataset.tag === tag));
    $('start-minor').value = tag;
    const d = COUNTRIES[tag], c = G.countries[tag];
    const L = d.leaders;
    $('start-selected').innerHTML = `<div class="row">${Portraits.html(tag, 'portrait')}<div><h3 style="margin:0">${d.name}</h3>
      <div><span class="swatch" style="background:${d.color}"></span>${IDEOLOGIES[d.ideo].name} &middot; ${L.map(l => esc(l[0])).join(' → ')}</div>
      <div class="muted">Factories: ${d.ind[0]} civilian, ${d.ind[1]} military, ${d.ind[2]} dockyards &middot; Divisions: ${(d.div || [0, 0])[0] + (d.div || [0, 0])[1]} &middot; Ships: ${(d.navy || []).reduce((a, b) => a + b, 0)} &middot; Aircraft: ${(d.air || []).reduce((a, b) => a + b, 0)}</div></div></div>`;
    if (c && G.provs.length) { const cap = G.provs[c.capital]; MapView.centerOn(cap.c[0], cap.c[1], 0.9); }
  }
  function startGame() {
    for (const id of ['topbar', 'menubar', 'log', 'mapmodes']) $(id).classList.remove('hidden');
    $('menubar').innerHTML = MENU.map(([id, name, key, ic]) => `<button data-p="${id}" title="${name} (${key})">${ic()}<span>${name}</span></button>`).join('');
    UIState.selected.clear(); UIState.selectedFleet = null;
    refreshTop(); renderLog();
    const c = P();
    popup({ title: `${c.name}, ${niceDate()}`, text: `You lead ${c.name}. ${Portraits.leaderOf(G.player)[3]} ${Portraits.leaderOf(G.player)[0]} awaits your orders.\n\nThe game is paused. Set up research and production, then press Space (or ▶) to begin. Right-click a province with units selected to move or attack.`, tags: [G.player], kind: 'news' });
  }

  // ---------- top bar ----------
  function refreshTop() {
    if (!G.started) return;
    const c = P(); if (!c) return;
    const lb = $('tb-leader'); lb.innerHTML = ''; lb.appendChild(Portraits.img(G.player, ''));
    const ind = c.ind || industry(c); const mp = manpowerInfo(c);
    let divs = 0; for (const d of G.divisions.values()) if (d.tag === c.tag) divs++;
    const ships = [...G.fleets.values()].filter(f => f.tag === c.tag).reduce((s, f) => s + f.ships.length, 0);
    const planes = [...G.wings.values()].filter(w => w.tag === c.tag).reduce((s, w) => s + w.planes, 0);
    $('tb-country').innerHTML = `${esc(c.name)}<small>${IDEOLOGIES[c.ideo].name}${c.faction ? ' · ' + G.factions[c.faction].name : ''}${isAtWar(c.tag) ? ' · <span class="bad">AT WAR</span>' : ''}</small>`;
    $('tb-stats').innerHTML = [
      ['⚖', fmt(c.pp), 'Political Power (spend on laws and diplomacy)'],
      ['👥', fmt(mp.avail), `Available manpower. Pool ${fmt(mp.cap)}, in field ${fmt(mp.field)}, casualties ${fmt(c.dead)}`],
      [img('factory', c.tag, 26), `${ind.freeCiv}/${ind.civ}`, `Civilian factories: ${ind.civ} (${ind.cg} for consumer goods)`],
      [img('artillery', c.tag, 26), ind.mil, 'Military factories'],
      [img('destroyer', c.tag, 26), ind.dock, 'Naval dockyards'],
      [img('infantry', c.tag, 26), divs, 'Divisions'],
      [img('battleship', c.tag, 26), ships, 'Ships'],
      [img('fighter', c.tag, 26), planes, 'Aircraft'],
      ['🌍', Math.round(G.tension) + '%', 'World tension'],
    ].map(([i, v, t]) => `<div class="stat" title="${esc(t)}">${i}<b>${v}</b></div>`).join('');
    refreshTime();
  }
  function refreshTime() {
    $('tb-date').textContent = niceDate();
    $('tb-speed').innerHTML = `<button data-s="p" class="${G.paused ? 'sel' : ''}">${G.paused ? '▶' : '❚❚'}</button>` + [1, 2, 3, 4, 5].map(s => `<button data-s="${s}" class="${G.speed === s ? 'sel' : ''}">${'›'.repeat(s)}</button>`).join('');
    $('tb-speed').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.s === 'p') G.paused = !G.paused; else { G.speed = +b.dataset.s; G.paused = false; } refreshTime(); };
  }
  let tickCount = 0;
  function tick() { if (++tickCount % 4 === 0) refreshTime(); }
  function dayUpdate() { refreshTop(); if (UIState.selected.size) renderUnitBar(); }
  function liveRefresh() {
    if (!G.started || G.paused) return;
    const live = ['production', 'research', 'construction', 'recruit', 'navy', 'air', 'army', 'politics'];
    if (UIState.current && live.includes(UIState.current) && !document.activeElement?.matches('select,input')) render(UIState.current, true);
    if (UIState.selectedProv != null && !$('side').classList.contains('hidden')) showProvince(UIState.selectedProv, true);
    if (UIState.battleOpen != null) showBattle(UIState.battleOpen, true);
  }

  // ---------- keyboard ----------
  function onKey(e) {
    if (!G.started || e.target.matches('input,select,textarea')) return;
    const k = e.key;
    if (k === ' ') { G.paused = !G.paused; refreshTime(); e.preventDefault(); }
    else if (k === '+' || k === '=') { G.speed = Math.min(5, G.speed + 1); refreshTime(); }
    else if (k === '-') { G.speed = Math.max(1, G.speed - 1); refreshTime(); }
    else if (k === 'Escape') { if (!$('modal').classList.contains('hidden')) closeModal(); else if (UIState.invasionMode) setInvasion(false); else if (UIState.selected.size || UIState.selectedFleet) clearSelection(); else if (UIState.current) close(); else toggle('system'); }
    else if (k === 'F5') { e.preventDefault(); if (Game.save()) log('Game saved.', 'good'); }
    else if (k === 'F9') { e.preventDefault(); if (Game.load()) { startGame(); } }
    else { const m = MENU.find(x => x[2].toLowerCase() === k.toLowerCase()); if (m) toggle(m[0]); }
  }

  // ---------- side panels ----------
  function toggle(id) { if (UIState.current === id && !$('panel').classList.contains('hidden')) close(); else { if (id === 'designer') return openDesigner(); render(id); } }
  function close() { $('panel').classList.add('hidden'); UIState.current = null; document.querySelectorAll('#menubar button').forEach(b => b.classList.remove('sel')); }
  function render(id, live) {
    const f = PANELS[id]; if (!f) return;
    UIState.current = id;
    const el = $('panel'); el.classList.remove('hidden');
    const scroll = el.querySelector('.panel-body')?.scrollTop || 0;
    const name = MENU.find(m => m[0] === id)?.[1] || id;
    el.innerHTML = `<header><h3>${name}</h3><button class="x" data-act="close">✕</button></header><div class="panel-body">${f()}</div>`;
    if (live) el.querySelector('.panel-body').scrollTop = scroll;
    el.onclick = onPanelClick; el.onchange = onPanelChange;
    document.querySelectorAll('#menubar button').forEach(b => b.classList.toggle('sel', b.dataset.p === id));
    if (id === 'test') { const con = el.querySelector('.console'); if (con) con.scrollTop = 1e9; }
  }
  function rerender() { if (UIState.current) render(UIState.current, true); refreshTop(); }

  const PANELS = {
    politics() {
      const c = P(); const L = Portraits.leaderOf(G.player);
      const lawRow = (arr, key) => arr.map((l, i) => {
        const cur = c.laws[key] === i; const blocked = (l.needWar && !isAtWar(c.tag)) || (l.needYear && year() < l.needYear);
        const eff = key === 'conscription' ? `${(l.pct * 100).toFixed(1)}% recruitable${l.factory ? `, ${l.factory * 100}% factory output` : ''}` : `${l.cg * 100}% consumer goods, ${l.factory >= 0 ? '+' : ''}${l.factory * 100}% factory output`;
        return `<div class="card row"><div class="grow"><b>${l.name}</b><div class="small muted">${eff}${l.needWar ? ' · requires war' : ''}${l.needYear ? ' · from ' + l.needYear : ''}</div></div>${cur ? '<span class="good">Active</span>' : `<button data-act="law" data-k="${key}" data-i="${i}" ${blocked || c.pp < 100 ? 'disabled' : ''}>Adopt (100 ⚖)</button>`}</div>`;
      }).join('');
      return `<div class="row">${Portraits.html(G.player, 'portrait lg')}<div><h2>${esc(L[0])}</h2><div>${L[3]} of ${c.name}</div>
        <div class="muted">${IDEOLOGIES[c.ideo].name}</div><div>Political power: <b>${fmt(c.pp, 1)}</b> (+${(c.major ? 2 : 1.2).toFixed(1)}/day)</div>
        <div>Faction: ${c.faction ? `<span class="swatch" style="background:${G.factions[c.faction].color}"></span>${G.factions[c.faction].name}` : 'none'}</div>
        <div>Surrender progress: ${bar(c.surrender, 'r')}</div></div></div>
        <h4 style="margin-top:10px">Leaders of ${c.name}</h4><div class="row wrap">${COUNTRIES[c.tag].leaders.map((l, i) => `<div class="card" style="text-align:center;width:96px">${Portraits.html(c.tag, 'portrait', i)}<div class="small">${esc(l[0])}</div><div class="small muted">${l[2] || '1936'}</div></div>`).join('')}</div>
        <h4>Conscription Law</h4>${lawRow(CONSCRIPTION, 'conscription')}
        <h4>Economy Law</h4>${lawRow(ECONOMY, 'economy')}
        <h4>World Leaders</h4><div class="row wrap">${Object.keys(G.countries).filter(t => G.countries[t].alive && G.countries[t].major).map(t => `<div class="card" style="text-align:center;width:96px;cursor:pointer" data-act="diplo" data-t="${t}">${Portraits.html(t, 'portrait')}<div class="small">${esc(Portraits.leaderOf(t)[0])}</div><div class="small muted">${G.countries[t].name}</div></div>`).join('')}</div>`;
    },
    research() {
      const c = P();
      const slots = c.research.map((r, i) => {
        if (!r) return `<div class="card muted">Slot ${i + 1}: <i>idle — pick a technology below</i></div>`;
        const t = TECH_BY_ID[r.id]; const cost = Sim.techCost(c, t);
        return `<div class="card"><div class="grow"><b>${t.name}</b> <span class="muted small">${Math.max(0, Math.ceil((cost - r.prog) / (1 + (c.mods.research || 0))))} days left</span>${bar(r.prog / cost, 'b')}</div><button data-act="cancelres" data-i="${i}">✕</button></div>`;
      }).join('');
      const tabs = TECH_CATEGORIES.map(cat => `<button data-act="restab" data-c="${cat.id}" class="${UIState.researchTab === cat.id ? 'sel' : ''}">${cat.name}</button>`).join('');
      const cat = TECH_CATEGORIES.find(x => x.id === UIState.researchTab);
      const list = TECHS.filter(t => t.cat === UIState.researchTab).sort((a, b) => a.year - b.year).map(t => {
        const done = c.techs.has(t.id), active = c.research.some(r => r && r.id === t.id), avail = Sim.techAvailable(c, t);
        const ahead = t.year > year();
        const unl = t.unlock ? 'Unlocks: ' + t.unlock.map(u => (BATTALIONS[u] || SUPPORT[u] || SHIPS[u])?.name).join(', ') : '';
        const model = t.unlock && (BATTALIONS[t.unlock[0]]?.model || SUPPORT[t.unlock[0]]?.model || SHIPS[t.unlock[0]]?.model) || (t.eq && Object.keys(t.eq)[0] && (EQUIPMENT[Object.keys(t.eq)[0]]?.icon || SHIPS[Object.keys(t.eq)[0]]?.model)) || cat.icon;
        return `<div class="card tech ${done ? 'done' : avail ? '' : 'locked'} ${active ? 'active' : ''}" ${avail ? `data-act="research" data-t="${t.id}"` : ''}>
          <span class="year">${t.year}</span>${Models.kinds.includes(model) ? img(model, c.tag, 52) : ''}<div class="grow"><b>${t.name}</b>${done ? ' <span class="good">✔</span>' : ''}${active ? ' <span style="color:var(--blue)">researching</span>' : ''}
          <div class="small muted">${t.desc || ''} ${unl}${t.eq ? ' Improves equipment.' : ''}${t.excl ? ' (mutually exclusive)' : ''}</div>
          <div class="small">${done ? '' : `${Math.round(Sim.techCost(c, t))} days${ahead ? ` <span class="bad">(ahead of time: +${(t.year - year()) * 100}%)</span>` : ''}`}${t.req ? ' · needs ' + t.req.map(r => TECH_BY_ID[r].name).join(', ') : ''}</div></div></div>`;
      }).join('');
      return `<h4>Research slots (${c.research.length})</h4><div class="slots">${slots}</div><h4 style="margin-top:8px">Technology</h4><div class="tabs">${tabs}</div>${list}`;
    },
    production() {
      const c = P(); const ind = c.ind || industry(c);
      const used = c.production.reduce((s, l) => s + l.fac, 0);
      const lines = c.production.map(l => {
        const e = EQUIPMENT[l.eq]; const cost = e.cost * (1 + 0.08 * (c.eqLevel[l.eq] || 0));
        const perDay = l.fac * FACTORY_OUTPUT * l.eff * (1 + (c.mods.factory || 0)) / cost;
        return `<div class="card row">${img(e.icon, c.tag, 60)}<div class="grow"><b>${e.name}</b> <span class="small muted">mk ${1 + (c.eqLevel[l.eq] || 0)}</span>
          <div class="small">${perDay.toFixed(perDay < 10 ? 1 : 0)}/day · efficiency ${(l.eff * 100).toFixed(0)}% · made ${fmt(l.made || 0)}</div>${bar(l.prog / cost, 'y')}</div>
          <div class="row"><button data-act="fac" data-id="${l.id}" data-d="-1">−</button><b style="min-width:22px;text-align:center">${l.fac}</b><button data-act="fac" data-id="${l.id}" data-d="1" ${l.fac >= 15 ? 'disabled' : ''}>+</button><button data-act="delline" data-id="${l.id}">✕</button></div></div>`;
      }).join('');
      const eqOpts = Object.entries(EQUIPMENT).filter(([k]) => !(k === 'medium_tank' && !c.techs.has('medium_tank1')) && !(k === 'heavy_tank' && !c.techs.has('heavy_tank1')) && !(k === 'mechanized' && !c.techs.has('mechanised_infantry'))).map(([k, e]) => `<option value="${k}">${e.name}</option>`).join('');
      const naval = c.navalProd.map(l => {
        const S = SHIPS[l.ship];
        return `<div class="card row">${img(S.model, c.tag, 70)}<div class="grow"><b>${S.name}</b> <span class="small muted">${l.repeat ? '(repeat)' : ''}</span><div class="small">${Math.ceil((S.cost - l.prog) / Math.max(1, l.docks * FACTORY_OUTPUT * (1 + (c.mods.factory || 0))))} days</div>${bar(l.prog / S.cost, 'b')}</div>
          <div class="row"><button data-act="dock" data-id="${l.id}" data-d="-1">−</button><b>${l.docks}</b><button data-act="dock" data-id="${l.id}" data-d="1">+</button><button data-act="repeat" data-id="${l.id}" class="${l.repeat ? 'sel' : ''}" title="Repeat">⟳</button><button data-act="delship" data-id="${l.id}">✕</button></div></div>`;
      }).join('');
      const shipOpts = Object.entries(SHIPS).filter(([k]) => hasUnlock(c, k)).map(([k, s]) => `<option value="${k}">${s.name}</option>`).join('');
      const stock = Object.entries(EQUIPMENT).map(([k, e]) => `<tr><td>${img(e.icon, c.tag, 34)}</td><td>${e.name}</td><td style="text-align:right">${fmt(c.stockpile[k])}</td></tr>`).join('');
      return `<div class="row"><b>Military factories:</b> ${used}/${ind.mil} assigned ${ind.mil - used > 0 ? `<span class="bad">(${ind.mil - used} idle)</span>` : ''}</div>
        ${lines}<div class="row" style="margin:6px 0"><select id="new-eq">${eqOpts}</select><button data-act="addline">Add production line</button></div>
        <h4>Naval dockyards (${ind.dock})</h4>${naval || '<div class="muted">No ships in production.</div>'}
        ${ind.dock ? `<div class="row" style="margin:6px 0"><select id="new-ship">${shipOpts}</select><button data-act="addship">Build ship</button></div>` : ''}
        <h4>Stockpile</h4><table>${stock}</table>`;
    },
    construction() {
      const c = P(); const ind = c.ind || industry(c); const cmod = 1 + (c.mods.construction || 0);
      let free = ind.freeCiv;
      const q = c.construction.map((j, i) => {
        const use = Math.min(15, free); free -= use; const B = BUILD[j.kind]; const p = G.provs[j.prov];
        return `<div class="card row">${img(j.kind === 'dock' ? 'destroyer' : 'factory', c.tag, 50)}<div class="grow"><b>${B.name}</b> in ${esc(p.name || p.modern)}<div class="small muted">${use ? `${use} factories · ${Math.ceil((B.cost - j.prog) / (use * 5 * cmod))} days` : 'waiting for free factories'}</div>${bar(j.prog / B.cost, 'y')}</div><button data-act="up" data-i="${i}" ${i === 0 ? 'disabled' : ''}>▲</button><button data-act="delbuild" data-i="${i}">✕</button></div>`;
      }).join('');
      const top = c.provList.filter(p => p.ctrl === c.tag && (p.civ + p.mil + p.dock) > 0).sort((a, b) => (b.civ + b.mil + b.dock) - (a.civ + a.mil + a.dock)).slice(0, 15)
        .map(p => `<tr><td>${esc(p.name || p.modern)}</td><td>${p.civ}</td><td>${p.mil}</td><td>${p.dock}</td></tr>`).join('');
      return `<div>Civilian factories: <b>${ind.civ}</b> (${ind.cg} on consumer goods, <b>${ind.freeCiv}</b> available). Each project uses up to 15 factories.</div>
        <div class="row wrap" style="margin:8px 0"><button data-act="build" data-k="civ">+ Civilian Factory</button><button data-act="build" data-k="mil">+ Military Factory</button><button data-act="build" data-k="dock">+ Dockyard</button></div>
        <div class="small muted">Projects go to your best province, or to the province selected on the map.</div>
        <h4>Queue</h4>${q || '<div class="muted">Nothing queued.</div>'}
        <h4>Industrial centres</h4><table><tr><th>Province</th><th>Civ</th><th>Mil</th><th>Dock</th></tr>${top}</table>`;
    },
    recruit() {
      const c = P(); const mp = manpowerInfo(c);
      const tpls = c.templates.map(t => {
        const s = t.stats; let ok = true; for (const e in s.eq) if (c.stockpile[e] < s.eq[e] * 0.5) ok = false;
        return `<div class="card"><div class="row">${img(s.model, c.tag, 60)}<div class="grow"><b>${esc(t.name)}</b><div class="small muted">Atk ${s.soft.toFixed(0)}/${s.hard.toFixed(0)} · Def ${s.def.toFixed(0)} · Brk ${s.brk.toFixed(0)} · Org ${s.org.toFixed(0)} · Width ${s.width} · ${fmt(s.mp)} men</div>
          <div class="small">${Object.entries(s.eq).map(([e, n]) => `<span class="${c.stockpile[e] >= n ? '' : 'bad'}">${n} ${EQUIPMENT[e].short}</span>`).join(', ')}</div></div></div>
          <div class="row" style="justify-content:flex-end">${ok ? '' : '<span class="small bad grow">Not enough equipment (will train slowly / deploy understrength)</span>'}<button data-act="train" data-id="${t.id}" data-n="1">Train 1</button><button data-act="train" data-id="${t.id}" data-n="5">Train 5</button></div></div>`;
      }).join('');
      const tr = c.training.map((t, i) => { const tpl = c.templates.find(x => x.id === t.tpl); let fill = 1; for (const e in t.need) fill = Math.min(fill, (t.have[e] || 0) / t.need[e]); return `<div class="card row">${img(tpl?.stats.model || 'infantry', c.tag, 44)}<div class="grow">${esc(tpl?.name || '?')} <span class="small muted">${Math.max(0, t.days)} days · equipment ${(fill * 100).toFixed(0)}%</span>${bar(1 - Math.max(0, t.days) / t.total, 'b')}</div><button data-act="untrain" data-i="${i}">✕</button></div>`; }).join('');
      return `<div class="row"><b>Manpower:</b> ${fmt(mp.avail)} available · ${fmt(mp.field)} in service · law: ${CONSCRIPTION[c.laws.conscription].name}</div>
        <div class="row" style="margin:6px 0"><span class="muted small grow">New divisions deploy at the capital (or the province selected on the map).</span><button data-act="designer">Open Division Designer</button></div>
        ${tpls}<h4>In training (${c.training.length})</h4>${tr || '<div class="muted">None.</div>'}`;
    },
    army() {
      const c = P();
      const divs = [...G.divisions.values()].filter(d => d.tag === c.tag);
      const groups = new Map(); for (const d of divs) { const k = d.state === 'naval' ? 'At sea' : (G.provs[d.prov].name || G.provs[d.prov].modern); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(d); }
      const rows = [...groups.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, ds]) => `<div class="card row" data-act="selgroup" data-ids="${ds.map(d => d.id).join(',')}" style="cursor:pointer">${img(ds[0].stats.model, c.tag, 50)}<div class="grow"><b>${esc(k)}</b> <span class="muted">${ds.length} div.</span><div class="small">${[...new Set(ds.map(d => d.state))].join(', ')}${ds.some(d => !d.supplied) ? ' · <span class="bad">out of supply</span>' : ''}</div>${bar(ds.reduce((s, d) => s + d.str, 0) / ds.length, 'y')}</div></div>`).join('');
      const kills = c.kills || 0, cas = G.stats.casualties[c.tag] || 0;
      return `<div>Total divisions: <b>${divs.length}</b> · Enemy divisions destroyed: <b>${kills}</b> · Casualties: <b>${fmt(cas)}</b></div>
        <div class="row" style="margin:6px 0"><button data-act="selall">Select all</button><button data-act="selidle">Select idle</button></div>${rows}`;
    },
    navy() {
      const c = P();
      const fleets = [...G.fleets.values()].filter(f => f.tag === c.tag);
      const rows = fleets.map(f => {
        const counts = {}; for (const s of f.ships) counts[s.type] = (counts[s.type] || 0) + 1;
        const hp = f.ships.reduce((s, x) => s + x.hp, 0) / Math.max(1, f.ships.reduce((s, x) => s + x.maxhp, 0));
        return `<div class="card ${UIState.selectedFleet === f.id ? 'sel' : ''}" style="${UIState.selectedFleet === f.id ? 'border-color:var(--gold)' : ''}"><div class="row"><b class="grow">${esc(f.name)}</b><span class="small muted">${f.inBattle ? '<span class="bad">IN BATTLE</span>' : f.path.length ? 'moving' : f.mission}</span></div>
          <div class="row wrap">${Object.entries(counts).map(([t, n]) => `<span title="${SHIPS[t].name}">${img(SHIPS[t].model, c.tag, 54)}×${n}</span>`).join(' ')}</div>${bar(hp)}
          <div class="row wrap" style="margin-top:4px"><button data-act="selfleet" data-id="${f.id}">Select & move</button><button data-act="fleethome" data-id="${f.id}">Return to port</button>
          <button data-act="fleetmission" data-id="${f.id}" data-m="${f.mission === 'raid' ? 'idle' : 'raid'}">${f.mission === 'raid' ? 'Stop raiding' : 'Raid convoys'}</button>
          ${fleets.length > 1 ? `<button data-act="mergefleet" data-id="${f.id}">Merge fleets here</button>` : ''}<button data-act="splitfleet" data-id="${f.id}" ${f.ships.length < 2 ? 'disabled' : ''}>Split</button></div>
          <details><summary class="small muted">Ships (${f.ships.length})</summary>${f.ships.map(s => `<div class="row small">${img(SHIPS[s.type].model, c.tag, 40)}<span class="grow">${esc(s.name)} <span class="muted">${SHIPS[s.type].name}</span></span><span style="width:70px">${bar(s.hp / s.maxhp)}</span></div>`).join('')}</details></div>`;
      }).join('');
      return `<div class="muted small">Select a fleet, then right-click a sea zone to move it. Fleets at war engage enemy fleets in the same sea zone. Fleets in their home port repair. Naval invasions need at least one fleet.</div>${rows || '<div class="muted">No navy.</div>'}`;
    },
    air() {
      const c = P();
      const wings = [...G.wings.values()].filter(w => w.tag === c.tag);
      const sel = UIState.selectedProv != null ? G.provs[UIState.selectedProv] : null;
      const canBase = sel && (sel.ctrl === c.tag || allied(sel.ctrl, c.tag));
      const rows = wings.map(w => `<div class="card"><div class="row">${img(w.type, c.tag, 54)}<div class="grow"><b>${esc(w.name)}</b> <span class="small muted">${w.planes}/${w.max} planes ${w.active ? '· <span class="good">active</span>' : ''}</span><div class="small">Base: ${esc(G.provs[w.base].name || G.provs[w.base].modern)} · range ${Math.round(PLANES[w.type].range * 10)} km</div>${bar(w.planes / w.max, 'b')}</div></div>
        <div class="row wrap"><select data-act="mission" data-id="${w.id}">${Object.entries(AIR_MISSIONS).map(([k, n]) => `<option value="${k}" ${w.mission === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <button data-act="rebase" data-id="${w.id}" ${canBase ? '' : 'disabled'} title="Select a friendly province on the map first">Rebase to selected</button></div></div>`).join('');
      const deploy = Object.keys(PLANES).map(t => `<button data-act="newwing" data-t="${t}" ${c.stockpile[t] < 20 ? 'disabled' : ''}>${img(t, c.tag, 36)} ${PLANES[t].name} (${fmt(c.stockpile[t])})</button>`).join('');
      return `<div class="muted small">Wings fight over battles within range of their base. Fighters win air superiority (+/- 25% combat), CAS strikes enemy divisions, bombers destroy factories, naval bombers attack fleets.</div>
        <h4>Deploy new wing ${sel ? 'at ' + esc(sel.name || sel.modern) : 'at capital'}</h4><div class="row wrap">${deploy}</div><h4>Air wings (${wings.length})</h4>${rows || '<div class="muted">None.</div>'}`;
    },
    diplomacy() {
      const c = P(); const t = UIState.diploTarget && G.countries[UIState.diploTarget]?.alive ? UIState.diploTarget : null;
      const all = Object.values(G.countries).filter(x => x.alive && x.tag !== c.tag).sort((a, b) => (b.major - a.major) || a.name.localeCompare(b.name));
      let detail = '<div class="muted">Select a country from the list, or click it on the map.</div>';
      if (t) {
        const o = G.countries[t]; const ind = o.ind || industry(o); const war = atWar(c.tag, t); const al = allied(c.tag, t);
        let divs = 0; for (const d of G.divisions.values()) if (d.tag === t) divs++;
        const myF = c.faction && G.factions[c.faction]; const theirF = o.faction && G.factions[o.faction];
        detail = `<div class="row">${Portraits.html(t, 'portrait lg')}<div><h2 style="margin:0">${o.name}</h2><div>${esc(Portraits.leaderOf(t)[3])} ${esc(Portraits.leaderOf(t)[0])}</div>
          <div class="muted">${IDEOLOGIES[o.ideo].name}${theirF ? ' · ' + theirF.name : ''}</div><div class="small">Factories ${ind.civ}/${ind.mil}/${ind.dock} · ${divs} divisions</div>
          <div>${war ? '<b class="bad">AT WAR</b>' : al ? '<b class="good">ALLIED</b>' : 'At peace'}</div>${war ? `<div class="small">Their surrender: ${bar(o.surrender, 'r')}</div>` : ''}</div></div>
          <div class="row wrap" style="margin-top:8px">
          ${!war && !al ? `<button class="danger" data-act="declare" data-t="${t}" ${c.pp < 25 ? 'disabled' : ''}>Declare war (25 ⚖)</button>` : ''}
          ${war ? `<button data-act="peace" data-t="${t}">Offer peace</button>` : ''}
          ${!war && !al && myF && myF.leader === c.tag ? `<button data-act="invite" data-t="${t}" ${c.pp < 25 ? 'disabled' : ''}>Invite to ${myF.name} (25 ⚖)</button>` : ''}
          ${!war && theirF && theirF.leader === t && c.faction !== o.faction ? `<button data-act="joinf" data-t="${t}">Ask to join ${theirF.name}</button>` : ''}
          ${!war && !al ? `<button data-act="guarantee" data-t="${t}" ${c.pp < 15 ? 'disabled' : ''}>Guarantee independence (15 ⚖)</button>` : ''}
          ${!war && !al && !G.access.has(c.tag + '>' + t) ? `<button data-act="access" data-t="${t}">Request military access</button>` : ''}
          <button data-act="center" data-t="${t}">Show on map</button></div>`;
      }
      const myF = c.faction ? G.factions[c.faction] : null;
      const wars = [...G.wars].map(k => k.split('|')).map(([a, b]) => `<div class="small">${G.countries[a].name} ⚔ ${G.countries[b].name}</div>`).join('');
      return `${detail}
        ${!myF && c.major ? `<div class="row" style="margin-top:8px"><input type="text" id="fname" value="${c.adj} Pact"><button data-act="mkfaction">Create faction</button></div>` : ''}
        ${myF ? `<div class="row" style="margin-top:6px"><span class="grow">Member of <b>${myF.name}</b></span><button data-act="leavef">Leave faction</button></div>` : ''}
        <h4 style="margin-top:10px">Factions</h4>${Object.values(G.factions).filter(f => f.members.size).map(f => `<div class="card"><span class="swatch" style="background:${f.color}"></span><b>${f.name}</b> <span class="small muted">led by ${G.countries[f.leader]?.name}</span><div class="row wrap">${[...f.members].map(m => `<span title="${G.countries[m].name}" data-act="diplo" data-t="${m}" style="cursor:pointer">${Portraits.html(m, 'portrait xs')}</span>`).join('')}</div></div>`).join('')}
        <h4>Wars</h4>${wars || '<div class="muted small">The world is at peace.</div>'}
        <h4>Nations</h4>${all.map(o => `<div class="row card" data-act="diplo" data-t="${o.tag}" style="cursor:pointer;${t === o.tag ? 'border-color:var(--gold)' : ''}">${Portraits.html(o.tag, 'portrait sm')}<span class="swatch" style="background:${o.color}"></span><span class="grow">${o.name}${o.major ? ' <span class="tag">Major</span>' : ''}</span>${atWar(c.tag, o.tag) ? '<span class="bad">WAR</span>' : allied(c.tag, o.tag) ? '<span class="good">ALLY</span>' : ''}</div>`).join('')}`;
    },
    test() {
      const c = P(); const ch = c.cheats;
      const opt = (k, n) => `<label class="card row" style="cursor:pointer"><input type="checkbox" data-act="cheat" data-k="${k}" ${ch[k] ? 'checked' : ''}> ${n}</label>`;
      const tags = Object.values(G.countries).filter(x => x.alive).sort((a, b) => a.name.localeCompare(b.name)).map(x => `<option value="${x.tag}">${x.name}</option>`).join('');
      return `<div class="muted small">Debug / sandbox tools for testing the game. Also try the console below (type <code>help</code>).</div>
        <h4>Resources</h4><div class="row wrap">
          <button data-act="t" data-c="pp">+500 Political Power</button><button data-act="t" data-c="mp">+500k Manpower</button>
          <button data-act="t" data-c="civ">+10 Civilian Factories</button><button data-act="t" data-c="mil">+10 Military Factories</button><button data-act="t" data-c="dock">+5 Dockyards</button>
          <button data-act="t" data-c="eq">+Equipment (all types)</button></div>
        <h4>Research</h4><div class="row wrap"><button data-act="t" data-c="finishres">Finish current research</button><button data-act="t" data-c="alltech">Unlock all technology</button></div>
        <h4>Toggles</h4>${opt('instantBuild', 'Instant construction, training & shipbuilding')}${opt('fastResearch', 'Super-fast research')}${opt('freeEquipment', 'Free equipment & manpower (units always reinforce)')}${opt('noCapitulate', 'My nation cannot capitulate')}${opt('allUnits', 'All battalions & ships unlocked')}
        <label class="card row"><input type="checkbox" data-act="observe" ${G.observe ? 'checked' : ''}> Observe mode: AI also controls my nation</label>
        <label class="card row"><input type="checkbox" data-act="hyper" ${G.hyper ? 'checked' : ''}> Hyper speed (×4)</label>
        <h4>Spawn units ${UIState.selectedProv != null ? 'in ' + esc(G.provs[UIState.selectedProv].name || G.provs[UIState.selectedProv].modern) : '(select a province first; defaults to capital)'}</h4>
        <div class="row wrap"><select id="t-tpl">${c.templates.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select><button data-act="t" data-c="spawn1">Spawn 1</button><button data-act="t" data-c="spawn10">Spawn 10</button></div>
        <div class="row wrap" style="margin-top:4px"><button data-act="t" data-c="fleet">Spawn battle fleet</button><button data-act="t" data-c="wing">Spawn fighter + CAS wings</button><button data-act="t" data-c="give">Give selected province to me</button></div>
        <h4>Countries & wars</h4><div class="row wrap"><select id="t-a">${tags}</select><select id="t-b">${tags}</select></div>
        <div class="row wrap" style="margin-top:4px"><button data-act="t" data-c="war">A declares war on B</button><button data-act="t" data-c="peaceab">Peace A–B</button><button data-act="t" data-c="annex">A annexes B</button><button data-act="t" data-c="switch">Play as A</button></div>
        <div class="row wrap" style="margin-top:4px"><button data-act="t" data-c="whitepeace">White peace everyone</button><button data-act="t" data-c="battle">Test battle near my capital</button><button data-act="t" data-c="date">Skip to 1 Sep 1939</button></div>
        <h4>Console</h4><div class="console">${UIState.testLog.map(esc).join('\n')}</div><input type="text" id="t-cmd" placeholder="command, e.g. war GER POL" style="width:100%;margin-top:4px">`;
    },
    system() {
      return `<div class="row wrap"><button data-act="save">Save game (F5)</button><button data-act="load" ${Game.hasSave() ? '' : 'disabled'}>Load game (F9)</button><button data-act="menu">Main menu</button></div>
        <h4 style="margin-top:10px">How to play</h4>
        <ul class="small">
          <li><b>Map:</b> drag to pan, wheel to zoom. Map modes at bottom-right.</li>
          <li><b>Armies:</b> click a unit counter to select it (Shift-click to add, Shift/Ctrl-drag to box select). Right-click any province to move; moving into enemy units starts a battle. Click the ⚔ icon to watch a battle.</li>
          <li><b>Naval invasion:</b> select divisions in a coastal province, press "Naval invasion" in the unit bar, then click an enemy coastal province.</li>
          <li><b>Navy:</b> click a fleet, right-click a sea zone to move. Fleets fight enemy fleets in the same zone.</li>
          <li><b>Air:</b> the Air Force menu sets missions and bases. Planes fly to battles in range.</li>
          <li><b>Economy:</b> civilian factories build new factories (Construct); military factories make equipment (Production); dockyards build ships.</li>
          <li><b>Divisions:</b> design templates in the Designer, train them in Recruit. Units need equipment and manpower.</li>
          <li><b>Victory:</b> capture enemy victory points (cities) to make them capitulate.</li>
          <li>Hotkeys: Space pause · +/- speed · L politics · R research · G diplomacy · P production · B construction · A recruit · D designer · O army · N navy · F air · \` test menu.</li>
        </ul>`;
    },
  };

  // ---------- panel actions ----------
  function onPanelChange(e) {
    const el = e.target; const act = el.dataset.act; const c = P();
    if (act === 'cheat') { c.cheats[el.dataset.k] = el.checked; recalcCountry(c); }
    else if (act === 'observe') { G.observe = el.checked; }
    else if (act === 'hyper') { G.hyper = el.checked; }
    else if (act === 'mission') { const w = G.wings.get(+el.dataset.id); if (w) w.mission = el.value; }
  }
  function onPanelClick(e) {
    const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'SELECT' || (b.tagName === 'INPUT' && b.type === 'checkbox')) return;
    const a = b.dataset.act, c = P();
    const A = {
      close, designer: () => openDesigner(),
      law: () => { const k = b.dataset.k; if (c.pp < 100) return; c.laws[k] = +b.dataset.i; c.pp -= 100; recalcCountry(c); },
      diplo: () => { UIState.diploTarget = b.dataset.t; render('diplomacy'); },
      restab: () => { UIState.researchTab = b.dataset.c; },
      research: () => { let i = c.research.findIndex(r => !r); if (i < 0) i = c.research.length - 1; c.research[i] = { id: b.dataset.t, prog: 0 }; },
      cancelres: () => { c.research[+b.dataset.i] = null; },
      fac: () => { const l = c.production.find(x => x.id === +b.dataset.id); const ind = c.ind || industry(c); const used = c.production.reduce((s, x) => s + x.fac, 0); const d = +b.dataset.d; if (d > 0 && used >= ind.mil) return; l.fac = clamp(l.fac + d, 0, 15); },
      delline: () => { c.production = c.production.filter(x => x.id !== +b.dataset.id); },
      addline: () => { const eq = $('new-eq').value; const ind = c.ind || industry(c); const used = c.production.reduce((s, x) => s + x.fac, 0); c.production.push({ id: nextId(), eq, fac: Math.min(15, Math.max(0, ind.mil - used)), prog: 0, eff: 0.1 }); },
      dock: () => { const l = c.navalProd.find(x => x.id === +b.dataset.id); l.docks = clamp(l.docks + +b.dataset.d, 1, 15); },
      repeat: () => { const l = c.navalProd.find(x => x.id === +b.dataset.id); l.repeat = !l.repeat; },
      delship: () => { c.navalProd = c.navalProd.filter(x => x.id !== +b.dataset.id); },
      addship: () => { c.navalProd.push({ id: nextId(), ship: $('new-ship').value, docks: Math.max(1, Math.min(5, (c.ind || industry(c)).dock)), prog: 0, repeat: false }); },
      build: () => { const p = UIState.selectedProv != null ? G.provs[UIState.selectedProv] : null; const ok = p && p.owner === c.tag && p.ctrl === c.tag && (b.dataset.k !== 'dock' || p.coastal); if (!queueConstruction(c, b.dataset.k, ok ? p : null)) log('No valid province for that building.', 'bad'); },
      delbuild: () => { c.construction.splice(+b.dataset.i, 1); },
      up: () => { const i = +b.dataset.i; [c.construction[i - 1], c.construction[i]] = [c.construction[i], c.construction[i - 1]]; },
      train: () => { const tpl = c.templates.find(t => t.id === +b.dataset.id); const n = Sim.startTraining(c, tpl, +b.dataset.n, UIState.selectedProv != null && G.provs[UIState.selectedProv].ctrl === c.tag ? UIState.selectedProv : undefined); if (!n) log('Not enough manpower!', 'bad'); },
      untrain: () => { c.training.splice(+b.dataset.i, 1); },
      selgroup: () => { selectDivisions(b.dataset.ids.split(',').map(Number)); const d = G.divisions.get(+b.dataset.ids.split(',')[0]); if (d && d.state !== 'naval') { const p = G.provs[d.prov]; MapView.centerOn(p.c[0], p.c[1]); } },
      selall: () => selectDivisions([...G.divisions.values()].filter(d => d.tag === c.tag).map(d => d.id)),
      selidle: () => selectDivisions([...G.divisions.values()].filter(d => d.tag === c.tag && d.state === 'idle').map(d => d.id)),
      selfleet: () => { selectFleet(+b.dataset.id); const f = G.fleets.get(+b.dataset.id); MapView.centerOn(...G.seas[f.sea].c); },
      fleethome: () => { const f = G.fleets.get(+b.dataset.id); Sim.orderFleet(f, f.home); },
      fleetmission: () => { const f = G.fleets.get(+b.dataset.id); f.mission = b.dataset.m; },
      mergefleet: () => { const f = G.fleets.get(+b.dataset.id); for (const o of [...G.fleets.values()]) if (o !== f && o.tag === f.tag && o.sea === f.sea && !o.inBattle) { f.ships.push(...o.ships); G.fleets.delete(o.id); } recomputeUnitIndex(); },
      splitfleet: () => { const f = G.fleets.get(+b.dataset.id); const half = f.ships.splice(Math.ceil(f.ships.length / 2)); const n = makeFleet(c, f.sea, half, `${c.adj} Task Force ${nextId() % 100}`); n.home = f.home; recomputeUnitIndex(); },
      newwing: () => { const t = b.dataset.t; const n = Math.min(100, c.stockpile[t]); c.stockpile[t] -= n; const base = UIState.selectedProv != null && (G.provs[UIState.selectedProv].ctrl === c.tag || allied(G.provs[UIState.selectedProv].ctrl, c.tag)) ? UIState.selectedProv : c.capital; makeWing(c, t, n, base); },
      rebase: () => { const w = G.wings.get(+b.dataset.id); w.base = UIState.selectedProv; },
      declare: () => { const t = b.dataset.t; if (c.pp < 25) return; c.pp -= 25; declareWar(c.tag, t); },
      peace: () => offerPeace(b.dataset.t),
      invite: () => { const t = b.dataset.t; const o = G.countries[t]; c.pp -= 25; if (o.ai && (o.ideo !== c.ideo && rnd() < 0.7 || o.faction)) popup({ title: 'Invitation declined', text: `${o.name} has declined to join.`, tags: [t] }); else { joinFaction(t, c.faction, true); popup({ title: 'New ally', text: `${o.name} has joined the ${G.factions[c.faction].name}!`, tags: [t, c.tag] }); } },
      joinf: () => { const o = G.countries[b.dataset.t]; if (o.ideo === c.ideo || rnd() < 0.3 || !o.ai) { joinFaction(c.tag, o.faction, true); popup({ title: 'Accepted', text: `We have joined the ${G.factions[o.faction].name}.`, tags: [o.tag, c.tag] }); } else popup({ title: 'Rejected', text: `${o.name} does not want us in their alliance.`, tags: [o.tag] }); },
      guarantee: () => { c.pp -= 15; G.guarantees.push([c.tag, b.dataset.t]); log(`We guaranteed ${G.countries[b.dataset.t].name}.`, 'politics'); },
      access: () => { const o = G.countries[b.dataset.t]; if (!o.ai || o.ideo === c.ideo || rnd() < 0.35) { G.access.add(c.tag + '>' + o.tag); log(`${o.name} granted military access.`, 'good'); } else log(`${o.name} refused military access.`, 'bad'); },
      center: () => { const o = G.countries[b.dataset.t]; const p = G.provs[o.capital]; MapView.centerOn(p.c[0], p.c[1], 1.2); },
      mkfaction: () => { const id = 'f' + nextId(); createFaction(id, $('fname').value || c.adj + ' Pact', c.tag, c.color); },
      leavef: () => leaveFaction(c.tag),
      save: () => { if (Game.save()) log('Game saved.', 'good'); },
      load: () => { if (Game.load()) startGame(); },
      menu: () => location.reload(),
      t: () => testCmd(b.dataset.c),
    };
    if (A[a]) { A[a](); if (a !== 'close' && a !== 'diplo' && a !== 'designer') rerender(); }
  }
  function offerPeace(t) {
    const c = P(), o = G.countries[t];
    if (!o.ai || o.surrender > c.surrender + 0.15 || (G.hour - (o.warStart || 0) > 24 * 365 && rnd() < 0.3)) { makePeace(c.tag, t); popup({ title: 'Peace', text: `${o.name} has accepted peace. Each side keeps the territory it occupies.`, tags: [t, c.tag] }); }
    else popup({ title: 'Peace rejected', text: `${o.name} refuses to negotiate while they are winning.`, tags: [t] });
  }

  // ---------- test menu ----------
  function testCmd(cmd, args = []) {
    const c = P(); const say = s => { UIState.testLog.push(s); if (UIState.testLog.length > 80) UIState.testLog.shift(); };
    const selP = UIState.selectedProv != null ? G.provs[UIState.selectedProv] : G.provs[c.capital];
    const A = $('t-a')?.value, B = $('t-b')?.value;
    switch (cmd) {
      case 'pp': c.pp += 500; say('+500 political power'); break;
      case 'mp': c.bonusMP = (c.bonusMP || 0) + 500000; say('+500k manpower'); break;
      case 'civ': case 'mil': case 'dock': { const p = cmd === 'dock' ? (c.provList.find(p => p.coastal && p.ctrl === c.tag) || G.provs[c.capital]) : G.provs[c.capital]; p[cmd] += cmd === 'dock' ? 5 : 10; c.ind = industry(c); say(`+${cmd === 'dock' ? 5 : 10} ${cmd} in ${p.name}`); break; }
      case 'eq': for (const e in EQUIPMENT) c.stockpile[e] += EQUIPMENT[e].air ? 500 : e === 'infantry_equipment' ? 20000 : 2000; say('Equipment added'); break;
      case 'finishres': for (let i = 0; i < c.research.length; i++) if (c.research[i]) { Sim.completeTech(c, c.research[i].id); c.research[i] = null; } say('Research finished'); break;
      case 'alltech': for (const t of TECHS) if (!t.excl || !t.excl.split(' ').some(x => c.techs.has(x))) Sim.completeTech(c, t.id); say('All technology unlocked'); break;
      case 'spawn1': case 'spawn10': { const tpl = c.templates.find(t => t.id === +$('t-tpl').value) || c.templates[0]; const n = cmd === 'spawn1' ? 1 : 10; for (let i = 0; i < n; i++) makeDivision(c, tpl, selP); say(`Spawned ${n} × ${tpl.name} in ${selP.name || selP.modern}`); break; }
      case 'fleet': { const sea = selP.coastal ? selP.sea : homeSea(c); if (sea == null) { say('No coast'); break; } const ships = []; for (const [t, n] of [['battleship', 2], ['heavy_cruiser', 2], ['light_cruiser', 3], ['destroyer', 8], ['carrier', 1]]) for (let i = 0; i < n; i++) ships.push(makeShip(c, t)); makeFleet(c, sea, ships, `${c.adj} Test Fleet`); recomputeUnitIndex(); say('Fleet spawned'); break; }
      case 'wing': makeWing(c, 'fighter', 100, selP.id); makeWing(c, 'cas', 100, selP.id); say('Wings spawned'); break;
      case 'give': { if (UIState.selectedProv == null) { say('Select a province first'); break; } selP.owner = c.tag; selP.ctrl = c.tag; G.dirtyLists = true; MapView.invalidate(); say('Province transferred'); break; }
      case 'war': if (A && B) { declareWar(A, B); say(`${A} declares war on ${B}`); } break;
      case 'peaceab': if (A && B) { makePeace(A, B); say(`Peace ${A}-${B}`); } break;
      case 'annex': if (A && B) { annex(A, B); recomputeUnitIndex(); say(`${A} annexed ${B}`); } break;
      case 'switch': if (A) { switchTo(A); say('Now playing ' + A); } break;
      case 'whitepeace': for (const k of [...G.wars]) { const [a, b] = k.split('|'); G.wars.delete(k); } G.dirtyBorders = true; say('All wars ended'); break;
      case 'battle': testBattle(); say('Test battle created near the capital. Unpause to watch.'); break;
      case 'date': { const target = (Date.UTC(1939, 8, 1) - START_DATE) / 3600e3; while (G.hour < target) Sim.hourTick(); say('Skipped to ' + dateStr()); break; }
    }
    MapView.invalidate(); refreshTop();
  }
  function consoleCommand(line) {
    const [cmd, ...a] = line.trim().split(/\s+/); const c = P(); const say = s => UIState.testLog.push(s);
    UIState.testLog.push('> ' + line);
    const T = s => (s || '').toUpperCase();
    switch ((cmd || '').toLowerCase()) {
      case 'help': say('commands: pp N | mp N | war A B | peace A B | annex A B | tag X | research_all | eq | spawn N | instant | observe | date YYYY-MM-DD | capitulate X | money'); break;
      case 'pp': c.pp += +a[0] || 100; break;
      case 'mp': c.bonusMP = (c.bonusMP || 0) + (+a[0] || 100000); break;
      case 'war': declareWar(T(a[0]), T(a[1])); break;
      case 'peace': makePeace(T(a[0]), T(a[1])); break;
      case 'annex': annex(T(a[0]), T(a[1])); recomputeUnitIndex(); break;
      case 'tag': switchTo(T(a[0])); break;
      case 'research_all': testCmd('alltech'); break;
      case 'eq': testCmd('eq'); break;
      case 'spawn': { const tpl = c.templates[0]; for (let i = 0; i < (+a[0] || 1); i++) makeDivision(c, tpl, UIState.selectedProv != null ? G.provs[UIState.selectedProv] : G.provs[c.capital]); break; }
      case 'instant': c.cheats.instantBuild = !c.cheats.instantBuild; say('instant: ' + c.cheats.instantBuild); break;
      case 'observe': G.observe = !G.observe; say('observe: ' + G.observe); break;
      case 'capitulate': capitulate(T(a[0])); break;
      case 'date': { const t = (Date.parse(a[0]) - START_DATE) / 3600e3; if (t > G.hour) { while (G.hour < t) Sim.hourTick(); } break; }
      default: say('unknown command, type help');
    }
    MapView.invalidate(); refreshTop(); render('test', true);
  }
  function testBattle() {
    const c = P(); const cap = G.provs[c.capital];
    const nb = cap.adj.map(id => G.provs[id]).find(p => p.ctrl !== c.tag) || cap.adj.map(id => G.provs[id])[0];
    let enemy = nb && nb.ctrl !== c.tag ? nb.ctrl : Object.keys(G.countries).find(t => t !== c.tag && G.countries[t].alive && !allied(t, c.tag));
    if (!atWar(c.tag, enemy)) declareWar(enemy, c.tag, true);
    const ec = G.countries[enemy];
    const front = nb && nb.ctrl === enemy ? nb : null;
    const target = front || cap.adj.map(id => G.provs[id])[0];
    if (!front) { target.ctrl = enemy; MapView.invalidate(); }
    for (let i = 0; i < 4; i++) makeDivision(ec, ec.templates[0], target);
    for (let i = 0; i < 6; i++) { const d = makeDivision(c, c.templates[i % 2 ? 0 : Math.min(1, c.templates.length - 1)], cap); d.path = [target.id]; d.state = 'move'; }
    makeWing(c, 'cas', 100, cap.id); makeWing(c, 'fighter', 100, cap.id); makeWing(ec, 'fighter', 60, ec.capital);
    MapView.centerOn(cap.c[0], cap.c[1], 3);
  }
  function switchTo(tag) {
    if (!G.countries[tag]?.alive) return;
    P().ai = true; G.player = tag; G.countries[tag].ai = false; clearSelection(); startGame(); MapView.invalidate();
  }

  // ---------- division designer ----------
  function openDesigner(tplId) {
    const c = P(); const tpl = c.templates.find(t => t.id === (tplId ?? UIState.designerTpl)) || c.templates[0];
    UIState.designerTpl = tpl.id;
    UIState.draft = UIState.draft && UIState.draft.id === tpl.id ? UIState.draft : { id: tpl.id, name: tpl.name, line: tpl.line.slice(), support: tpl.support.slice() };
    renderDesigner();
  }
  function renderDesigner() {
    const c = P(); const dr = UIState.draft; const st = computeTemplate(dr, c);
    const cols = [0, 1, 2, 3, 4].map(col => [0, 1, 2, 3, 4].map(row => dr.line[col * 5 + row]));
    let grid = `<div class="colhead">Support</div>${[1, 2, 3, 4, 5].map(i => `<div class="colhead">Column ${i}</div>`).join('')}`;
    for (let row = 0; row < 5; row++) {
      const s = dr.support[row];
      grid += `<div class="slot ${s ? 'filled' : ''}" data-dz="s" data-i="${row}">${s ? img(SUPPORT[s].model, c.tag, 64) + SUPPORT[s].name : '+'}</div>`;
      for (let col = 0; col < 5; col++) { const b = cols[col][row]; grid += `<div class="slot ${b ? 'filled' : ''}" data-dz="l" data-i="${col * 5 + row}">${b ? img(BATTALIONS[b].model, c.tag, 64) + BATTALIONS[b].name : '+'}</div>`; }
    }
    const stat = (n, v, d = 1) => `<span>${n}</span><span>${typeof v === 'number' ? v.toFixed(d) : v}</span>`;
    box(`Division Designer`, `<div class="designer">
      <div class="tpl-list"><h4>Templates</h4>${c.templates.map(t => `<div class="card row ${t.id === dr.id ? 'sel' : ''}" data-dz="tpl" data-id="${t.id}">${img(t.stats.model, c.tag, 44)}<span class="small">${esc(t.name)}</span></div>`).join('')}
        <button data-dz="new" style="width:100%">+ New template</button><button data-dz="copy" style="width:100%;margin-top:4px">Duplicate</button></div>
      <div><div class="row" style="margin-bottom:6px"><input type="text" id="dz-name" value="${esc(dr.name)}" style="flex:1"><button class="good" data-dz="save">Save template</button><button class="danger" data-dz="del" ${c.templates.length < 2 ? 'disabled' : ''}>Delete</button></div>
        <div class="grid">${grid}</div>
        <div id="dz-picker" style="margin-top:10px"></div></div>
      <div><div style="text-align:center">${img(st.model, c.tag, 180)}</div><h4>Division statistics</h4><div class="statgrid">
        ${stat('Soft attack', st.soft)}${stat('Hard attack', st.hard)}${stat('Defense', st.def)}${stat('Breakthrough', st.brk)}${stat('HP', st.hp)}${stat('Organization', st.org)}
        ${stat('Speed (km/h)', st.speed === 99 ? 0 : st.speed)}${stat('Armor', st.armor)}${stat('Piercing', st.pierce)}${stat('Hardness', (st.hardness * 100).toFixed(0) + '%')}${stat('Air attack', st.aa)}
        ${stat('Combat width', st.width, 0)}${stat('Manpower', fmt(st.mp))}${stat('Production cost', st.cost, 0)}</div>
        <h4 style="margin-top:8px">Equipment needed</h4><div class="small">${Object.entries(st.eq).map(([e, n]) => `${img(EQUIPMENT[e].icon, c.tag, 30)} ${n} ${EQUIPMENT[e].name}`).join('<br>') || '—'}</div>
        ${st.width > 40 ? '<div class="bad small">Very wide divisions suffer in narrow terrain.</div>' : ''}</div></div>`);
    $('modal-box').onclick = designerClick;
  }
  function designerClick(e) {
    const b = e.target.closest('[data-dz],[data-act]'); if (!b) return;
    if (b.dataset.act === 'close') return closeModal();
    const c = P(); const dr = UIState.draft; const z = b.dataset.dz;
    if (z === 'tpl') { UIState.draft = null; openDesigner(+b.dataset.id); }
    else if (z === 'new') { const t = { id: nextId(), name: 'New Division', line: Array(25).fill(null), support: Array(5).fill(null) }; t.line[0] = 'infantry'; t.stats = computeTemplate(t, c); c.templates.push(t); UIState.draft = null; openDesigner(t.id); }
    else if (z === 'copy') { const src = c.templates.find(t => t.id === dr.id); const t = { id: nextId(), name: src.name + ' (copy)', line: dr.line.slice(), support: dr.support.slice() }; t.stats = computeTemplate(t, c); c.templates.push(t); UIState.draft = null; openDesigner(t.id); }
    else if (z === 'save') {
      if (!dr.line.some(Boolean)) return;
      const t = c.templates.find(t => t.id === dr.id); t.name = $('dz-name').value || 'Division'; t.line = dr.line.slice(); t.support = dr.support.slice(); t.stats = computeTemplate(t, c);
      for (const d of G.divisions.values()) if (d.tplId === t.id) { d.stats = t.stats; d.org = Math.min(d.org, t.stats.org); }
      log(`Template "${t.name}" saved. Existing divisions were updated.`, 'good'); UIState.draft = null; openDesigner(t.id);
    }
    else if (z === 'del') { const i = c.templates.findIndex(t => t.id === dr.id); const fallback = c.templates[i === 0 ? 1 : 0]; for (const d of G.divisions.values()) if (d.tplId === dr.id) { d.tplId = fallback.id; d.stats = fallback.stats; } c.templates.splice(i, 1); UIState.draft = null; openDesigner(fallback.id); }
    else if (z === 'l' || z === 's') {
      dr.name = $('dz-name').value;
      const slot = +b.dataset.i;
      const pool = z === 'l' ? BATTALIONS : SUPPORT;
      const opts = Object.entries(pool).filter(([k]) => hasUnlock(c, k));
      $('dz-picker').innerHTML = `<h4>Choose ${z === 'l' ? 'battalion' : 'support company'}</h4><div class="picker">
        <div class="card" data-dz="pick" data-k="" data-z="${z}" data-i="${slot}">✕<div class="small">Empty</div></div>
        ${opts.map(([k, v]) => `<div class="card" data-dz="pick" data-k="${k}" data-z="${z}" data-i="${slot}">${img(v.model, c.tag, 80)}<div><b>${v.name}</b></div><div class="small muted">${z === 'l' ? `S ${v.soft} H ${v.hard} D ${v.def} B ${v.brk} W ${v.width}` : (v.desc || `S ${v.soft || 0} D ${v.def || 0}`)}</div></div>`).join('')}
        ${Object.keys(pool).filter(k => !hasUnlock(c, k)).map(k => `<div class="card" style="opacity:.4" title="Requires ${TECH_BY_ID[pool[k].req]?.name}">${img(pool[k].model, c.tag, 80)}<div>${pool[k].name}</div><div class="small bad">🔒 ${TECH_BY_ID[pool[k].req]?.name}</div></div>`).join('')}</div>`;
      $('dz-picker').scrollIntoView({ block: 'nearest' });
    }
    else if (z === 'pick') { const k = b.dataset.k || null; if (b.dataset.z === 'l') dr.line[+b.dataset.i] = k; else dr.support[+b.dataset.i] = k; dr.name = $('dz-name').value; renderDesigner(); }
  }

  // ---------- modal ----------
  function box(title, body) { $('modal').classList.remove('hidden'); $('modal-box').innerHTML = `<header><h3>${title}</h3><button data-act="close" class="x">✕</button></header><div class="modal-body">${body}</div>`; $('modal-box').onclick = e => { if (e.target.closest('[data-act="close"]')) closeModal(); }; }
  function closeModal() { $('modal').classList.add('hidden'); UIState.battleOpen = null; }
  $('modal')?.addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

  // ---------- battles ----------
  function showBattle(provId, live) {
    const b = G.battles.get(provId); if (!b) { if (live) closeModal(); return; }
    UIState.battleOpen = provId;
    const p = G.provs[provId];
    const att = [...b.att].map(id => G.divisions.get(id)).filter(Boolean);
    const def = p.units.map(id => G.divisions.get(id)).filter(d => d && atWar(d.tag, b.attTag));
    const side = (arr, tag, label) => `<div class="side"><div class="row">${Portraits.html(tag, 'portrait')}<div><h4 style="margin:0">${label}: ${G.countries[tag].name}</h4><div class="small muted">${esc(Portraits.leaderOf(tag)[0])}</div></div></div>
      ${arr.map(d => `<div class="row small" style="margin-top:3px">${img(d.stats.model, d.tag, 48)}<div class="grow">${esc(d.name)}<div class="row"><span style="width:50%">${bar(d.org / Math.max(1, d.stats.org))}</span><span style="width:50%">${bar(d.str, 'y')}</span></div></div></div>`).join('')}</div>`;
    const air = b.air || { attSup: 0.5 };
    const body = `<div class="battle">${side(att, b.attTag, 'Attacker')}<div class="vs">⚔<div class="small muted" style="font:12px 'Trebuchet MS'">${TERRAIN[p.terr].name}<br>Width ${TERRAIN[p.terr].width}<br>Terrain ${Math.round(TERRAIN[p.terr].atk * 100)}%<br>Air sup. ${Math.round(air.attSup * 100)}%${b.amphib ? '<br><span class="bad">Amphibious −50%</span>' : ''}<br>Day ${Math.floor((G.hour - b.start) / 24) + 1}</div>
      <div style="margin-top:8px">${bar(b.attOrg / ((b.attOrg || 0) + (b.defOrg || 0) + 1e-6) || 0.5)}</div></div>${side(def, b.defTag, 'Defender')}</div>`;
    if (live) { const mb = $('modal-box').querySelector('.modal-body'); if (mb) mb.innerHTML = body; return; }
    box(`Battle of ${esc(p.name || p.modern)}`, body);
  }

  // ---------- province panel ----------
  function showProvince(id, live) {
    UIState.selectedProv = id; const p = G.provs[id]; const o = G.countries[p.owner], c = G.countries[p.ctrl];
    const divs = p.units.map(i => G.divisions.get(i)).filter(Boolean);
    const isMine = p.owner === G.player && p.ctrl === G.player;
    const el = $('side'); el.classList.remove('hidden');
    el.innerHTML = `<header><h3>${esc(p.name || p.modern)}</h3><button class="x" data-act="x">✕</button></header><div class="panel-body">
      <div class="row">${Portraits.html(p.ctrl, 'portrait')}<div><div><span class="swatch" style="background:${c.color}"></span><b>${c.name}</b>${p.owner !== p.ctrl ? ` <span class="bad">(occupied, owner ${o.name})</span>` : ''}</div>
      <div class="small muted">${esc(Portraits.leaderOf(p.ctrl)[0])}</div><div class="small">${TERRAIN[p.terr].name}${p.coastal ? ' · coastal' : ''}${p.vp ? ` · ★ ${p.vp} VP` : ''} · ${esc(p.modern)}</div></div></div>
      <div class="row" style="margin:6px 0">${img('factory', p.ctrl, 30)} ${p.civ} civ · ${p.mil} mil · ${p.dock} dock</div>
      ${isMine ? `<div class="row wrap"><button data-act="pb" data-k="civ">Build civ</button><button data-act="pb" data-k="mil">Build mil</button>${p.coastal ? '<button data-act="pb" data-k="dock">Build dock</button>' : ''}</div>` : ''}
      ${p.ctrl !== G.player ? `<div class="row" style="margin-top:4px"><button data-act="pdiplo">Diplomacy: ${c.name}</button></div>` : ''}
      <h4 style="margin-top:8px">Units (${divs.length})</h4>${divs.map(d => `<div class="row small">${img(d.stats.model, d.tag, 44)}<div class="grow">${esc(d.name)} <span class="muted">${G.countries[d.tag].adj}</span><div class="row"><span style="width:50%">${bar(d.org / Math.max(1, d.stats.org))}</span><span style="width:50%">${bar(d.str, 'y')}</span></div></div></div>`).join('') || '<div class="muted small">None</div>'}
      ${G.battles.has(id) ? `<button data-act="pbattle" style="margin-top:6px">View battle</button>` : ''}</div>`;
    el.onclick = e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'x') { el.classList.add('hidden'); UIState.selectedProv = null; }
      else if (b.dataset.act === 'pb') { queueConstruction(P(), b.dataset.k, p); log(`Queued ${BUILD[b.dataset.k].name} in ${p.name || p.modern}.`, 'good'); if (UIState.current === 'construction') rerender(); }
      else if (b.dataset.act === 'pdiplo') { UIState.diploTarget = p.ctrl; render('diplomacy'); }
      else if (b.dataset.act === 'pbattle') showBattle(id);
    };
    if (!live && UIState.current === 'diplomacy' && p.ctrl !== G.player) { UIState.diploTarget = p.ctrl; render('diplomacy'); }
    if (!live && (UIState.current === 'test' || UIState.current === 'air')) render(UIState.current, true);
  }

  // ---------- selection ----------
  function selectDivisions(ids, add) {
    if (!add) UIState.selected.clear();
    for (const id of ids) { const d = G.divisions.get(id); if (d && d.tag === G.player) UIState.selected.add(id); }
    UIState.selectedFleet = null; renderUnitBar();
  }
  function selectFleet(id) { UIState.selected.clear(); UIState.selectedFleet = id; renderUnitBar(); }
  function clearSelection() { UIState.selected.clear(); UIState.selectedFleet = null; setInvasion(false); renderUnitBar(); }
  function renderUnitBar() {
    const el = $('unitbar');
    for (const id of [...UIState.selected]) if (!G.divisions.has(id)) UIState.selected.delete(id);
    if (UIState.selectedFleet && !G.fleets.has(UIState.selectedFleet)) UIState.selectedFleet = null;
    if (UIState.selectedFleet) {
      const f = G.fleets.get(UIState.selectedFleet); const c = G.countries[f.tag];
      el.classList.remove('hidden');
      el.innerHTML = `<div class="row"><b class="grow">${esc(f.name)}</b><span class="muted small">Right-click a sea zone to move</span><button data-a="home">Return to port</button><button data-a="x">✕</button></div>
        <div class="units">${f.ships.map(s => `<div class="ucard">${img(SHIPS[s.type].model, c.tag, 60)}<div class="nm">${esc(s.name)}</div><div class="muted">${SHIPS[s.type].name}</div>${bar(s.hp / s.maxhp)}</div>`).join('')}</div>`;
      el.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'x') clearSelection(); else Sim.orderFleet(f, f.home); };
      return;
    }
    if (!UIState.selected.size) { el.classList.add('hidden'); return; }
    const divs = [...UIState.selected].map(id => G.divisions.get(id));
    const c = P();
    const coastal = divs.every(d => d.state !== 'naval' && G.provs[d.prov].coastal);
    el.classList.remove('hidden');
    el.innerHTML = `<div class="row"><b class="grow">${divs.length} division${divs.length > 1 ? 's' : ''} selected</b>
      <select data-a="tpl"><option value="">Change template…</option>${c.templates.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>
      <button data-a="halt">Halt</button><button data-a="inv" ${coastal ? '' : 'disabled title="Units must be in a coastal province"'} class="${UIState.invasionMode ? 'sel' : ''}">⚓ Naval invasion</button><button data-a="disband" class="danger">Disband</button><button data-a="x">✕</button></div>
      <div class="units">${divs.slice(0, 60).map(d => `<div class="ucard" data-id="${d.id}">${img(d.stats.model, d.tag, 60)}<div class="nm">${esc(d.name)}</div><div class="muted">${d.state === 'naval' ? 'at sea' : d.inBattle != null ? '<span class="bad">in combat</span>' : d.state}${d.supplied ? '' : ' · <span class="bad">no supply</span>'}</div>${bar(d.org / Math.max(1, d.stats.org))}${bar(d.str, 'y')}</div>`).join('')}</div>`;
    el.onclick = e => {
      const card = e.target.closest('.ucard'); if (card) { const d = G.divisions.get(+card.dataset.id); if (e.shiftKey) { UIState.selected.delete(d.id); renderUnitBar(); } else { if (d.state !== 'naval') { const p = G.provs[d.prov]; MapView.centerOn(p.c[0], p.c[1]); } selectDivisions([d.id]); } return; }
      const b = e.target.closest('[data-a]'); if (!b || b.tagName === 'SELECT') return;
      if (b.dataset.a === 'x') clearSelection();
      else if (b.dataset.a === 'halt') { for (const d of divs) if (d.state === 'move') { d.path = []; d.state = 'idle'; } renderUnitBar(); }
      else if (b.dataset.a === 'inv') setInvasion(!UIState.invasionMode);
      else if (b.dataset.a === 'disband') { if (confirm(`Disband ${divs.length} division(s)? Equipment returns to the stockpile.`)) { for (const d of divs) { for (const e2 in d.stats.eq) c.stockpile[e2] += Math.floor(d.stats.eq[e2] * d.str * 0.8); removeDivision(d); } clearSelection(); } }
    };
    el.onchange = e => { if (e.target.dataset.a === 'tpl' && e.target.value) { const t = c.templates.find(x => x.id === +e.target.value); for (const d of divs) { d.tplId = t.id; d.stats = t.stats; d.str *= 0.7; d.org = Math.min(d.org, t.stats.org) * 0.5; } log(`${divs.length} division(s) reorganized as ${t.name}.`, 'good'); renderUnitBar(); } };
  }
  function setInvasion(on) {
    UIState.invasionMode = on; $('hint').classList.toggle('hidden', !on);
    $('hint').textContent = 'NAVAL INVASION: click an enemy coastal province (highlighted). Esc to cancel.';
    if (UIState.selected.size) renderUnitBar();
  }
  function invadeAt(provId) {
    setInvasion(false); if (provId == null) return;
    let err = null, n = 0;
    for (const id of UIState.selected) { const d = G.divisions.get(id); if (!d) continue; err = Sim.orderInvasion(d, provId); if (!err) n++; }
    if (n) log(`${n} division(s) embarked for ${G.provs[provId].name || G.provs[provId].modern}.`, 'good'); else if (err) log(err, 'bad');
    renderUnitBar();
  }
  function moveSelected(provId, add) {
    if (!UIState.selected.size) return;
    let fail = 0, ok = 0;
    for (const id of UIState.selected) {
      const d = G.divisions.get(id); if (!d || d.state === 'naval') continue;
      if (add && d.path.length) { const ext = Sim.findPath(d.tag, d.path[d.path.length - 1], provId); if (ext) { d.path.push(...ext); ok++; } else fail++; continue; }
      if (d.state === 'amphib') continue;
      if (Sim.orderMove(d, provId)) ok++; else fail++;
    }
    if (fail && !ok) { const p = G.provs[provId]; log(canEnter(G.player, p) ? 'No route to that province (try a naval invasion).' : `Cannot enter ${G.countries[p.ctrl].name}: we are not at war and have no military access.`, 'bad'); }
    renderUnitBar();
  }
  function moveFleet(seaId) { const f = G.fleets.get(UIState.selectedFleet); if (f && f.tag === G.player) { if (!Sim.orderFleet(f, seaId)) log('No sea route.', 'bad'); } }

  // ---------- tooltip ----------
  function hover(provId, x, y, seaId) {
    const t = $('tooltip');
    if (provId == null || !G.provs.length) {
      if (seaId != null && G.started) { const s = G.seas[seaId]; const fl = s.fleets.map(id => G.fleets.get(id)).filter(Boolean); t.innerHTML = `<h4>Sea zone ${seaId}</h4>${fl.map(f => `<div>${G.countries[f.tag].adj}: ${f.ships.length} ships</div>`).join('') || '<div class="muted">No fleets</div>'}`; t.classList.remove('hidden'); t.style.left = Math.min(x + 16, innerWidth - 290) + 'px'; t.style.top = (y + 16) + 'px'; return; }
      t.classList.add('hidden'); return;
    }
    const p = G.provs[provId]; const c = G.countries[p.ctrl]; if (!c) return;
    const divs = p.units.map(i => G.divisions.get(i)).filter(Boolean);
    t.innerHTML = `<h4>${esc(p.name || p.modern)}</h4><div><span class="swatch" style="background:${c.color}"></span>${c.name}${p.owner !== p.ctrl ? ` (occupied from ${G.countries[p.owner].name})` : ''}</div>
      <div class="muted small">${TERRAIN[p.terr].name}${p.vp ? ' · ★' + p.vp : ''}${p.civ + p.mil + p.dock ? ` · 🏭 ${p.civ}/${p.mil}/${p.dock}` : ''}</div>
      ${divs.length ? `<div class="small">${divs.length} division(s): ${[...new Set(divs.map(d => G.countries[d.tag].adj))].join(', ')}</div>` : ''}
      ${!G.started ? '<div class="small" style="color:var(--gold)">Click to play as ' + c.name + '</div>' : ''}
      ${UIState.selected.size ? '<div class="small" style="color:#9cff7a">Right-click: move here</div>' : ''}`;
    t.classList.remove('hidden');
    t.style.left = Math.min(x + 16, innerWidth - 290) + 'px'; t.style.top = Math.min(y + 16, innerHeight - 120) + 'px';
  }

  // ---------- popups ----------
  function popup({ title, text = '', tags = [], kind = 'info', options }) {
    const wrap = $('popups');
    while (wrap.children.length >= 4) wrap.removeChild(wrap.firstChild);
    const el = document.createElement('div'); el.className = 'popup';
    const imgs = tags.filter(t => COUNTRIES[t]).slice(0, 2).map(t => Portraits.html(t, 'portrait lg')).join('');
    el.innerHTML = `<h3>${esc(title)}</h3><div class="pimgs">${imgs}</div><p>${esc(text)}</p><div class="opts"></div>`;
    const opts = options || [{ label: 'OK', fn: () => {} }];
    if (options) { G.paused = true; refreshTime(); }
    for (const o of opts) { const b = document.createElement('button'); b.textContent = o.label; b.onclick = () => { el.remove(); o.fn(); refreshTop(); MapView.invalidate(); }; el.querySelector('.opts').appendChild(b); }
    wrap.appendChild(el);
    if (!options) setTimeout(() => el.remove(), 14000);
  }
  function gameOver(tag) {
    if (!G.started || tag !== G.player) return;
    G.paused = true;
    popup({ title: 'Defeat', text: `${G.countries[tag].name} has fallen. You may continue by choosing another nation, or watch the war unfold.`, tags: [tag], options: [
      { label: 'Observe', fn: () => { G.observe = true; } },
      { label: 'Play another nation', fn: () => { const alive = Object.values(G.countries).filter(c => c.alive).sort((a, b) => b.major - a.major); toggle('test'); log('Use "Play as A" in the test menu to choose a new nation.', 'info'); if (alive[0]) {} } },
    ] });
  }

  // ---------- log ----------
  function renderLog() {
    const el = $('log');
    el.innerHTML = G.log.slice(0, 7).map(l => `<div class="${l.kind}">${dateStr(l.t).slice(0)} ${esc(l.text)}</div>`).join('');
  }
  function onLog() { if (G.started) renderLog(); }

  // console input
  document.addEventListener('keydown', e => { if (e.target.id === 't-cmd' && e.key === 'Enter') { consoleCommand(e.target.value); setTimeout(() => $('t-cmd')?.focus(), 0); } });
  // clicking the map on the start screen picks a country
  document.addEventListener('click', e => { if (!G.started && e.target.id === 'map') { /* handled through showProvince */ } });

  const api = {
    init, startGame, tick, dayUpdate, popup, gameOver, onLog, hover, showProvince: (id, live) => { if (!G.started) { pickStart(G.provs[id].ctrl); return; } showProvince(id, live); },
    showBattle, selectDivisions, selectFleet, clearSelection, moveSelected, moveFleet, invadeAt,
  };
  for (const k of ['selected', 'selectedFleet', 'selectedProv', 'invasionMode']) Object.defineProperty(api, k, { get: () => UIState[k] });
  return api;
})();
