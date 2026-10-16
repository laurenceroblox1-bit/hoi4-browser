// Game clock, save/load and boot.
const Game = (() => {
  const SPEEDS = [0, 3, 8, 20, 48, 120]; // game hours per real second
  let acc = 0;
  function advance(dt) {
    if (G.paused || G.over) return;
    acc += dt * SPEEDS[G.speed] * (G.hyper ? 4 : 1);
    let n = 0;
    while (acc >= 1 && n < 200) { acc -= 1; n++; Sim.hourTick(); }
    if (n) UI.tick();
  }
  function save(slot = 'quick') {
    const s = {
      v: 1, hour: G.hour, player: G.player, idc: G.idc, tension: G.tension, historical: G.historical,
      provs: G.provs.map(p => [p.owner, p.ctrl, p.civ, p.mil, p.dock]),
      countries: Object.fromEntries(Object.entries(G.countries).map(([t, c]) => [t, { ...c, techs: [...c.techs], provList: undefined, occupied: undefined, templates: c.templates.map(x => ({ ...x, stats: undefined })) }])),
      divisions: [...G.divisions.values()].map(d => ({ ...d, stats: undefined, inBattle: null, attacking: null })),
      fleets: [...G.fleets.values()].map(f => ({ ...f, inBattle: false })), wings: [...G.wings.values()],
      wars: [...G.wars], factions: Object.values(G.factions).map(f => ({ ...f, members: [...f.members] })), guarantees: G.guarantees,
      fired: [...G.firedEvents], log: G.log.slice(0, 50),
    };
    try { localStorage.setItem('ww2-save-' + slot, JSON.stringify(s)); return true; } catch (e) { alert('Save failed: ' + e.message); return false; }
  }
  function hasSave(slot = 'quick') { try { return !!localStorage.getItem('ww2-save-' + slot); } catch (e) { return false; } }
  function load(slot = 'quick') {
    let s; try { s = JSON.parse(localStorage.getItem('ww2-save-' + slot)); } catch (e) { return false; }
    if (!s) return false;
    newGame(s.player, { historical: s.historical });
    Object.assign(G, { hour: s.hour, idc: s.idc, tension: s.tension, paused: true });
    s.provs.forEach((a, i) => { const p = G.provs[i]; [p.owner, p.ctrl, p.civ, p.mil, p.dock] = a; });
    for (const t in s.countries) { const c = Object.assign(G.countries[t], s.countries[t]); c.techs = new Set(c.techs); }
    rebuildProvLists();
    for (const t in G.countries) recalcCountry(G.countries[t]);
    G.divisions = new Map(); for (const d of s.divisions) { const c = G.countries[d.tag]; const tpl = c.templates.find(x => x.id === d.tplId) || c.templates[0]; d.stats = tpl.stats; G.divisions.set(d.id, d); }
    G.fleets = new Map(s.fleets.map(f => [f.id, f])); G.wings = new Map(s.wings.map(w => [w.id, w]));
    G.wars = new Set(s.wars); G.factions = {}; for (const f of s.factions) G.factions[f.id] = { ...f, members: new Set(f.members) };
    G.guarantees = s.guarantees; G.firedEvents = new Set(s.fired); G.log = s.log; G.battles = new Map(); G.navalBattles = new Map();
    for (const d of G.divisions.values()) if (d.state === 'amphib') d.state = 'idle';
    recomputeUnitIndex(); MapView.invalidate();
    return true;
  }
  function start(tag, opts) {
    newGame(tag, opts);
    MapView.invalidate();
    const cap = G.provs[G.countries[tag].capital];
    MapView.centerOn(cap.c[0], cap.c[1], 1.4);
    UI.startGame();
  }
  return { advance, save, load, hasSave, start, SPEEDS };
})();

window.addEventListener('DOMContentLoaded', () => {
  // Pre-build a world for the menu background
  newGame('GER'); G.started = false; G.paused = true;
  MapView.init(document.getElementById('map'));
  UI.init();
  Portraits.load();
});
