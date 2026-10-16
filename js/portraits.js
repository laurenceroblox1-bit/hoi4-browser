// Leader portraits. Photos are fetched from Wikipedia (public-domain era photographs) at runtime and
// cached in localStorage. When offline, a drawn placeholder portrait is used instead.
const Portraits = (() => {
  const KEY = 'ww2-portraits-v1';
  let urls = {};
  try { urls = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { urls = {}; }
  const listeners = [];
  let loading = false;

  function allTitles() {
    const s = new Set();
    for (const t in COUNTRIES) for (const l of COUNTRIES[t].leaders) s.add(l[1]);
    return [...s];
  }
  async function load() {
    if (loading) return; loading = true;
    const titles = allTitles().filter(t => !urls[t]);
    for (let i = 0; i < titles.length; i += 45) {
      const batch = titles.slice(i, i + 45);
      const api = 'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=240&redirects=1&titles=' + encodeURIComponent(batch.join('|'));
      try {
        const res = await fetch(api); const js = await res.json();
        const map = {}; for (const t of batch) map[t] = t;
        for (const n of (js.query.normalized || [])) for (const t in map) if (map[t] === n.from) map[t] = n.to;
        for (const r of (js.query.redirects || [])) for (const t in map) if (map[t] === r.from) map[t] = r.to;
        const byTitle = {}; for (const id in js.query.pages) { const p = js.query.pages[id]; if (p.thumbnail) byTitle[p.title] = p.thumbnail.source; }
        for (const t of batch) if (byTitle[map[t]]) urls[t] = byTitle[map[t]];
      } catch (e) { console.warn('Portrait fetch failed (offline?)', e); break; }
    }
    try { localStorage.setItem(KEY, JSON.stringify(urls)); } catch (e) { }
    listeners.forEach(f => f());
  }
  function leaderOf(tag, idx) {
    const L = COUNTRIES[tag].leaders; const c = G.countries && G.countries[tag];
    return L[idx ?? (c ? c.leaderIdx : 0)] || L[0];
  }
  function placeholder(name, color) {
    const cv = document.createElement('canvas'); cv.width = 120; cv.height = 150; const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, '#6b6152'); g.addColorStop(1, '#2b2620'); c.fillStyle = g; c.fillRect(0, 0, 120, 150);
    c.fillStyle = '#1b1814'; c.beginPath(); c.ellipse(60, 160, 52, 52, 0, Math.PI, 0); c.fill();
    c.beginPath(); c.ellipse(60, 62, 26, 32, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = color || '#888'; c.fillRect(0, 140, 120, 10);
    c.fillStyle = '#e8dcc0'; c.font = 'bold 22px Georgia'; c.textAlign = 'center';
    c.fillText(name.split(' ').filter(w => /^[A-ZÁÉÍÓÚÖÜŁŚ]/.test(w)).map(w => w[0]).slice(0, 2).join(''), 60, 128);
    return cv.toDataURL();
  }
  const phCache = {};
  // Returns an <img> element for the leader of `tag`.
  function img(tag, cls = 'portrait', idx) {
    const L = leaderOf(tag, idx);
    const el = document.createElement('img'); el.className = cls; el.alt = L[0]; el.title = `${L[3]} ${L[0]}`;
    el.referrerPolicy = 'no-referrer';
    const ph = phCache[L[0]] || (phCache[L[0]] = placeholder(L[0], COUNTRIES[tag].color));
    el.src = urls[L[1]] || ph;
    el.onerror = () => { el.onerror = null; el.src = ph; };
    if (!urls[L[1]]) listeners.push(() => { if (urls[L[1]]) el.src = urls[L[1]]; });
    return el;
  }
  function html(tag, cls = 'portrait', idx) { return img(tag, cls, idx).outerHTML; }
  function src(tag, idx) { const L = leaderOf(tag, idx); return urls[L[1]] || phCache[L[0]] || (phCache[L[0]] = placeholder(L[0], COUNTRIES[tag].color)); }
  function onLoad(f) { listeners.push(f); }
  return { load, img, html, src, onLoad, leaderOf };
})();
