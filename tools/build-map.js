// Generates js/data/world.js: land provinces (Voronoi cells clipped to country borders),
// 1936 ownership, adjacency, terrain and sea zones.
// Usage: npm i world-atlas@2 topojson-client d3-delaunay polygon-clipping && node tools/build-map.js
const fs = require('fs');
const path = require('path');
const topo = require('world-atlas/countries-50m.json');
const tc = require('topojson-client');
const { Delaunay } = require('d3-delaunay');
const pc = require('polygon-clipping');

const W = 4000;
const LAT_MAX = 83, LAT_MIN = -57;
const D2R = Math.PI / 180;
const millerY = lat => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * D2R));
const SCALE = W / (2 * Math.PI);
const Y0 = millerY(LAT_MAX);
const H = Math.round((Y0 - millerY(LAT_MIN)) * SCALE);
const proj = (lon, lat) => {
  lat = Math.max(LAT_MIN, Math.min(LAT_MAX, lat));
  lon = Math.max(-180, Math.min(180, lon));
  return [(lon + 180) / 360 * W, (Y0 - millerY(lat)) * SCALE];
};
const unproj = (x, y) => {
  const lon = x / W * 360 - 180;
  const my = Y0 - y / SCALE;
  const lat = (Math.atan(Math.exp(my / 1.25)) - Math.PI / 4) / 0.4 / D2R;
  return [lon, lat];
};

// ---------- modern country -> 1936 owner ----------
const OWNER = {
  'Germany': 'GER', 'Austria': 'AUS', 'Czechia': 'CZE', 'Slovakia': 'CZE', 'Poland': 'POL', 'Lithuania': 'LIT',
  'Latvia': 'LAT', 'Estonia': 'EST', 'Finland': 'FIN', 'Åland': 'FIN', 'Russia': 'SOV', 'Ukraine': 'SOV', 'Belarus': 'SOV',
  'Georgia': 'SOV', 'Armenia': 'SOV', 'Azerbaijan': 'SOV', 'Kazakhstan': 'SOV', 'Uzbekistan': 'SOV',
  'Turkmenistan': 'SOV', 'Kyrgyzstan': 'SOV', 'Tajikistan': 'SOV', 'Moldova': 'ROM', 'Mongolia': 'MON',
  'United Kingdom': 'ENG', 'Isle of Man': 'ENG', 'Jersey': 'ENG', 'Guernsey': 'ENG', 'Ireland': 'IRE', 'France': 'FRA',
  'Monaco': 'FRA', 'Andorra': 'FRA', 'Belgium': 'BEL', 'Luxembourg': 'LUX', 'Netherlands': 'HOL', 'Switzerland': 'SWI',
  'Liechtenstein': 'SWI', 'Italy': 'ITA', 'San Marino': 'ITA', 'Vatican': 'ITA', 'Malta': 'ENG', 'Spain': 'SPR',
  'Portugal': 'POR', 'Denmark': 'DEN', 'Faeroe Is.': 'DEN', 'Iceland': 'ICE', 'Greenland': 'DEN', 'Norway': 'NOR',
  'Sweden': 'SWE', 'Hungary': 'HUN', 'Romania': 'ROM', 'Bulgaria': 'BUL', 'Greece': 'GRE', 'Albania': 'ALB',
  'Serbia': 'YUG', 'Croatia': 'YUG', 'Slovenia': 'YUG', 'Bosnia and Herz.': 'YUG', 'Montenegro': 'YUG', 'Kosovo': 'YUG',
  'Macedonia': 'YUG', 'Turkey': 'TUR', 'Cyprus': 'ENG', 'N. Cyprus': 'ENG',
  // Middle East
  'Syria': 'FRA', 'Lebanon': 'FRA', 'Israel': 'ENG', 'Palestine': 'ENG', 'Jordan': 'ENG', 'Iraq': 'IRQ',
  'Kuwait': 'ENG', 'Saudi Arabia': 'SAU', 'Yemen': 'YEM', 'Oman': 'OMA', 'United Arab Emirates': 'ENG', 'Qatar': 'ENG',
  'Bahrain': 'ENG', 'Iran': 'PER', 'Afghanistan': 'AFG',
  // South / East Asia
  'India': 'RAJ', 'Pakistan': 'RAJ', 'Bangladesh': 'RAJ', 'Myanmar': 'RAJ', 'Sri Lanka': 'ENG', 'Siachen Glacier': 'RAJ',
  'Nepal': 'NEP', 'Bhutan': 'BHU', 'China': 'CHI', 'Hong Kong': 'ENG', 'Macao': 'POR', 'Taiwan': 'JAP',
  'North Korea': 'JAP', 'South Korea': 'JAP', 'Japan': 'JAP', 'Thailand': 'SIA', 'Vietnam': 'FRA', 'Laos': 'FRA',
  'Cambodia': 'FRA', 'Malaysia': 'ENG', 'Singapore': 'ENG', 'Brunei': 'ENG', 'Indonesia': 'HOL', 'Timor-Leste': 'POR',
  'Philippines': 'PHI', 'Papua New Guinea': 'AST', 'Solomon Is.': 'ENG', 'Vanuatu': 'ENG', 'New Caledonia': 'FRA',
  'Fiji': 'ENG', 'Guam': 'USA', 'N. Mariana Is.': 'JAP', 'Palau': 'JAP', 'Micronesia': 'JAP', 'Marshall Is.': 'JAP',
  'Australia': 'AST', 'New Zealand': 'NZL', 'Samoa': 'NZL', 'American Samoa': 'USA', 'Fr. Polynesia': 'FRA',
  // Americas
  'Canada': 'CAN', 'United States of America': 'USA', 'Puerto Rico': 'USA', 'Mexico': 'MEX', 'Guatemala': 'GUA',
  'Belize': 'ENG', 'Honduras': 'HON', 'El Salvador': 'ELS', 'Nicaragua': 'NIC', 'Costa Rica': 'COS', 'Panama': 'PAN',
  'Cuba': 'CUB', 'Haiti': 'HAI', 'Dominican Rep.': 'DOM', 'Jamaica': 'ENG', 'Bahamas': 'ENG', 'Trinidad and Tobago': 'ENG',
  'Colombia': 'COL', 'Venezuela': 'VEN', 'Guyana': 'ENG', 'Suriname': 'HOL', 'Ecuador': 'ECU', 'Peru': 'PRU',
  'Bolivia': 'BOL', 'Brazil': 'BRA', 'Paraguay': 'PAR', 'Uruguay': 'URG', 'Argentina': 'ARG', 'Chile': 'CHL',
  'Falkland Is.': 'ENG',
  // Africa
  'Morocco': 'FRA', 'W. Sahara': 'SPR', 'Algeria': 'FRA', 'Tunisia': 'FRA', 'Libya': 'ITA', 'Egypt': 'ENG',
  'Sudan': 'ENG', 'S. Sudan': 'ENG', 'Eritrea': 'ITA', 'Ethiopia': 'ETH', 'Djibouti': 'FRA', 'Somalia': 'ITA',
  'Somaliland': 'ENG', 'Kenya': 'ENG', 'Uganda': 'ENG', 'Tanzania': 'ENG', 'Rwanda': 'BEL', 'Burundi': 'BEL',
  'Dem. Rep. Congo': 'BEL', 'Congo': 'FRA', 'Gabon': 'FRA', 'Eq. Guinea': 'SPR', 'Cameroon': 'FRA',
  'Central African Rep.': 'FRA', 'Chad': 'FRA', 'Niger': 'FRA', 'Nigeria': 'ENG', 'Benin': 'FRA', 'Togo': 'FRA',
  'Ghana': 'ENG', "Côte d'Ivoire": 'FRA', 'Burkina Faso': 'FRA', 'Mali': 'FRA', 'Mauritania': 'FRA', 'Senegal': 'FRA',
  'Gambia': 'ENG', 'Guinea-Bissau': 'POR', 'Guinea': 'FRA', 'Sierra Leone': 'ENG', 'Liberia': 'LIB',
  'Angola': 'POR', 'Zambia': 'ENG', 'Malawi': 'ENG', 'Mozambique': 'POR', 'Zimbabwe': 'ENG', 'Botswana': 'ENG',
  'Namibia': 'SAF', 'South Africa': 'SAF', 'Lesotho': 'ENG', 'eSwatini': 'ENG', 'Madagascar': 'FRA',
  'Mauritius': 'ENG', 'Comoros': 'FRA', 'São Tomé and Principe': 'POR', 'Cabo Verde': 'POR',
};

// China in 1936 was split between warlords; split by region of the province centroid.
function chinaOwner(lon, lat) {
  if (lat > 40.3 && lon > 117.5) return 'MAN';
  if (lon < 96 && lat > 35.5) return 'SIK';
  if (lon < 99.5 && lat <= 36) return 'TIB';
  if (lon >= 105.5 && lon <= 110.5 && lat >= 35.2 && lat <= 38.8) return 'PRC';
  if (lon >= 96 && lon < 106.5 && lat > 32 && lat < 41.5) return 'XSM';
  if (lon >= 110.5 && lon <= 114.6 && lat >= 34.6 && lat <= 40.6) return 'SHX';
  if (lon >= 97 && lon < 106 && lat >= 21 && lat < 29) return 'YUN';
  if (lon >= 104.5 && lon < 112 && lat >= 21 && lat < 26.3) return 'GXC';
  return 'CHI';
}
function ownerFor(modern, lon, lat) {
  if (modern === 'China') return chinaOwner(lon, lat);
  if (modern === 'Morocco' && lat > 34.6 && lon > -6.2) return 'SPR';
  if (modern === 'Somalia' && lat > 9.6 && lon < 49) return 'ENG';
  if (modern === 'Russia' && lon > 140 && lat < 48.5 && lat > 45) return 'JAP'; // Karafuto (south Sakhalin)
  if (modern === 'Russia' && lon < 23 && lat < 56) return 'GER'; // Königsberg (East Prussia)
  if (modern === 'Mongolia' && lon < 92 && lat > 49) return 'TAN';
  return OWNER[modern] || null;
}

// ---------- terrain ----------
const boxes = (arr) => arr.map(([lo0, la0, lo1, la1]) => ({ lo0, la0, lo1, la1 }));
const inBoxes = (bs, lon, lat) => bs.some(b => lon >= b.lo0 && lon <= b.lo1 && lat >= b.la0 && lat <= b.la1);
const MOUNTAIN = boxes([[5.5, 45, 15, 47.6], [73, 27, 97, 37], [68, 34, 76, 40], [-124, 36, -104, 50], [-118, 50, -114, 56],
  [-80, -40, -66, -5], [-72, -55, -68, -40], [40, 41.5, 48, 43.8], [22, 47, 26, 49], [-1, 42, 2.5, 43], [6.5, 43.5, 8, 45],
  [43, 37, 48, 40], [20, 40, 21.5, 43], [97, 25, 104, 33], [69, 34, 75, 36.5], [10, 61, 12, 64], [37, 9, 40, 13]]);
const HILLS = boxes([[-10, 36, -1, 43], [9, 40, 16.5, 44.5], [18, 42, 24, 45], [27, 37, 44, 41], [44, 30, 60, 38],
  [-5, 53, -3, 58], [13, 47, 18, 49], [140, 34, 141, 40], [131, 31, 140, 36], [-84, 34, -79, 38], [100, 23, 112, 30],
  [-104, 18, -97, 24], [28, -30, 32, -20], [-48, -22, -40, -14], [60, 55, 60.5, 58]]);
const DESERT = boxes([[-17, 15, 34, 31], [34, 15, 56, 30], [55, 23, 62, 30], [62, 26, 70, 32], [70, 24, 74, 29],
  [90, 37, 113, 45], [75, 37, 90, 41], [52, 37, 65, 45], [118, -32, 140, -20], [123, -28, 136, -17], [17, -28, 25, -18],
  [-118, 25, -110, 37], [-72, -28, -68, -18], [41, 3, 51, 12]]);
const JUNGLE = boxes([[-79, -15, -48, 5], [-62, 2, -55, 8], [8, -6, 30, 5], [-12, 4, 2, 10], [94, -10, 128, 17],
  [128, -10, 151, 0], [-92, 7, -77, 18], [73, 6, 80, 12], [44, -25, 50, -12], [145, -18, 146, -12]]);
function terrainFor(lon, lat) {
  if (inBoxes(MOUNTAIN, lon, lat)) return 'mountain';
  if (inBoxes(DESERT, lon, lat)) return 'desert';
  if (inBoxes(JUNGLE, lon, lat)) return 'jungle';
  if (inBoxes(HILLS, lon, lat)) return 'hills';
  if (lat > 66) return 'tundra';
  if (lat > 55 || (lat > 47 && lon > -95 && lon < -60) || (lat > 50 && lon > 90)) return 'forest';
  if (lat > 44 && lat <= 55 && ((lon > 5 && lon < 30) || (lon > -90 && lon < -65)) && ((lon * 13 + lat * 7) % 5 < 1.2)) return 'forest';
  return 'plains';
}

// ---------- geometry helpers ----------
function ringArea(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return a / 2; }
function mpArea(mp) { let a = 0; for (const poly of mp) { a += Math.abs(ringArea(poly[0])); for (let k = 1; k < poly.length; k++) a -= Math.abs(ringArea(poly[k])); } return a; }
function pip(pt, ring) {
  let inside = false; const [x, y] = pt;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inMP(pt, mp) { for (const poly of mp) { if (pip(pt, poly[0])) { let hole = false; for (let k = 1; k < poly.length; k++) if (pip(pt, poly[k])) { hole = true; break; } if (!hole) return true; } } return false; }
function bboxMP(mp) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of mp) for (const [x, y] of p[0]) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; }
function centroidMP(mp) {
  // area-weighted centroid of the biggest polygon, then nudged inside
  let best = null, ba = -1;
  for (const poly of mp) { const a = Math.abs(ringArea(poly[0])); if (a > ba) { ba = a; best = poly; } }
  const r = best[0]; let cx = 0, cy = 0, A = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const f = r[j][0] * r[i][1] - r[i][0] * r[j][1]; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f; A += f; }
  if (Math.abs(A) < 1e-9) return r[0];
  cx /= 3 * A; cy /= 3 * A;
  if (inMP([cx, cy], [best])) return [cx, cy];
  // fallback: sample grid inside polygon, choose point farthest from edges (approx by closest to centroid)
  const [x0, y0, x1, y1] = bboxMP([best]); let bp = r[0], bd = 1e18;
  for (let i = 1; i < 12; i++) for (let j = 1; j < 12; j++) {
    const p = [x0 + (x1 - x0) * i / 12, y0 + (y1 - y0) * j / 12];
    if (inMP(p, [best])) { const d = (p[0] - cx) ** 2 + (p[1] - cy) ** 2; if (d < bd) { bd = d; bp = p; } }
  }
  return bp;
}

// ---------- load countries ----------
const SKIP = new Set(['Antarctica', 'Fr. S. Antarctic Lands', 'Heard I. and McDonald Is.', 'S. Geo. and the Is.', 'Br. Indian Ocean Ter.', 'Indian Ocean Ter.']);
const feats = tc.feature(topo, topo.objects.countries).features.filter(f => f.geometry && !SKIP.has(f.properties.name));
const countries = [];
for (const f of feats) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const mp = [];
  for (const poly of polys) {
    const rings = [];
    for (const ring0 of poly) {
      const out = [];
      // rings crossing the antimeridian: move the minority side across so the ring stays contiguous
      let ring = ring0;
      if (ring0.some((p, i) => i && Math.abs(p[0] - ring0[i - 1][0]) > 180)) {
        const neg = ring0.filter(p => p[0] < 0).length;
        ring = ring0.map(([lon, lat]) => [neg * 2 < ring0.length ? (lon < 0 ? lon + 360 : lon) : (lon > 0 ? lon - 360 : lon), lat]);
      }
      for (const [lon, lat] of ring) {
        const p = proj(lon, lat); p[0] = Math.round(p[0] * 2) / 2; p[1] = Math.round(p[1] * 2) / 2;
        const l = out[out.length - 1];
        if (!l || l[0] !== p[0] || l[1] !== p[1]) out.push(p);
      }
      if (out.length >= 4) { if (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1]) out.push(out[0].slice()); rings.push(out); }
    }
    if (rings.length && Math.abs(ringArea(rings[0])) > 0.6) mp.push(rings);
  }
  if (!mp.length) continue;
  if (!OWNER[f.properties.name] && f.properties.name !== 'China') { if (mpArea(mp) < 40) continue; }
  countries.push({ name: f.properties.name, mp, bbox: bboxMP(mp), area: mpArea(mp) });
}
console.log('countries', countries.length, 'H', H);

// ---------- seeds ----------
function spacingDeg(lon, lat) {
  if (lon > -11 && lon < 42 && lat > 35 && lat < 61) return 1.55;      // Europe
  if (lon >= 42 && lon < 60 && lat > 40 && lat < 60) return 2.0;       // European Russia east
  if (lon > 100 && lon < 146 && lat > 18 && lat < 46) return 2.0;      // East Asia
  if (lat > 62 || lat < -45) return 5.0;
  if (inBoxes(DESERT, lon, lat)) return 4.5;
  if (lon > 60 && lon < 180 && lat > 50) return 4.0;                    // Siberia
  if (lon < -100 && lat > 50) return 4.5;                              // northern Canada
  return 3.0;
}
const seeds = []; // {x,y,c (country idx)}
function countryAt(p) { for (let i = 0; i < countries.length; i++) { const c = countries[i]; const b = c.bbox; if (p[0] < b[0] || p[0] > b[2] || p[1] < b[1] || p[1] > b[3]) continue; if (inMP(p, c.mp)) return i; } return -1; }
let rnd = 12345; const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
for (let lat = LAT_MAX - 0.3; lat > LAT_MIN; ) {
  let lon = -180 + rand();
  let rowStep = 1e9;
  while (lon < 180) {
    const s = spacingDeg(lon, lat);
    rowStep = Math.min(rowStep, s);
    const jl = lon + (rand() - 0.5) * s * 0.7, ja = lat + (rand() - 0.5) * s * 0.7;
    const p = proj(jl, ja);
    const ci = countryAt(p);
    if (ci >= 0) seeds.push({ x: p[0], y: p[1], c: ci });
    lon += s / Math.max(0.35, Math.cos(lat * D2R)) * 0.85;
  }
  lat -= Math.min(rowStep, 3);
}
// ensure each sizeable polygon piece (islands, small countries) gets a seed
for (let ci = 0; ci < countries.length; ci++) {
  const c = countries[ci];
  for (const poly of c.mp) {
    const a = Math.abs(ringArea(poly[0]));
    if (a < 6 && !(c.mp.length === 1)) continue;
    const has = seeds.some(s => s.c === ci && inMP([s.x, s.y], [poly]));
    if (!has) { const p = centroidMP([poly]); seeds.push({ x: p[0], y: p[1], c: ci }); }
  }
}
console.log('seeds', seeds.length);

// ---------- voronoi cells clipped to countries ----------
const del = Delaunay.from(seeds.map(s => [s.x, s.y]));
const vor = del.voronoi([-1, -1, W + 1, H + 1]);
let pieces = []; // {mp, ci, seed}
for (let i = 0; i < seeds.length; i++) {
  const cell = vor.cellPolygon(i); if (!cell) continue;
  const cb = bboxMP([[cell]]);
  for (let ci = 0; ci < countries.length; ci++) {
    const c = countries[ci]; const b = c.bbox;
    if (b[2] < cb[0] || b[0] > cb[2] || b[3] < cb[1] || b[1] > cb[3]) continue;
    let res;
    try { res = pc.intersection([cell], c.mp); } catch (e) { continue; }
    if (!res.length) continue;
    const a = mpArea(res); if (a < 0.3) continue;
    pieces.push({ mp: res, ci, seed: i, area: a, own: seeds[i].c === ci });
  }
}
console.log('pieces', pieces.length);
// merge small foreign slivers into a neighbouring piece of the same country
const MIN_AREA = 60;
const keyOf = (p) => Math.round(p[0] * 20) + ',' + Math.round(p[1] * 20);
function vertsOf(mp) { const s = new Set(); for (const poly of mp) for (const r of poly) for (const p of r) s.add(keyOf(p)); return s; }
let changed = true, guard = 0;
while (changed && guard++ < 6) {
  changed = false;
  const byCountry = new Map();
  pieces.forEach((p, idx) => { if (!byCountry.has(p.ci)) byCountry.set(p.ci, []); byCountry.get(p.ci).push(idx); });
  const dead = new Set();
  for (const [ci, idxs] of byCountry) {
    if (idxs.length < 2) continue;
    const vs = new Map(idxs.map(i => [i, vertsOf(pieces[i].mp)]));
    for (const i of idxs) {
      const p = pieces[i]; if (dead.has(i)) continue;
      if (p.own && p.area >= 8) continue;
      if (p.area >= MIN_AREA) continue;
      // find neighbour piece of same country sharing vertices, prefer largest
      let best = -1, ba = -1;
      for (const j of idxs) { if (j === i || dead.has(j)) continue; let shared = 0; for (const k of vs.get(i)) if (vs.get(j).has(k)) { shared++; if (shared > 1) break; } if (shared > 1 && pieces[j].area > ba) { ba = pieces[j].area; best = j; } }
      if (best < 0) continue;
      try { pieces[best].mp = pc.union(pieces[best].mp, p.mp); } catch (e) { continue; }
      pieces[best].area = mpArea(pieces[best].mp); vs.set(best, vertsOf(pieces[best].mp));
      dead.add(i); changed = true;
    }
  }
  pieces = pieces.filter((_, i) => !dead.has(i));
}
console.log('provinces after merge', pieces.length);

// ---------- cities / victory points ----------
const CITIES = require('./cities.json');
// ---------- build provinces ----------
const provs = pieces.map((p, id) => {
  const c = centroidMP(p.mp); const [lon, lat] = unproj(c[0], c[1]);
  const modern = countries[p.ci].name;
  return { id, mp: p.mp, c, lon, lat, modern, owner: ownerFor(modern, lon, lat), terr: terrainFor(lon, lat), area: p.area };
});
for (const city of CITIES) {
  const pt = proj(city[1], city[2]);
  let hit = provs.find(pv => { const b = bboxMP(pv.mp); return pt[0] >= b[0] && pt[0] <= b[2] && pt[1] >= b[1] && pt[1] <= b[3] && inMP(pt, pv.mp); });
  if (!hit) { let bd = 1e9; for (const pv of provs) { const d = (pv.c[0] - pt[0]) ** 2 + (pv.c[1] - pt[1]) ** 2; if (d < bd) { bd = d; hit = pv; } } if (bd > 400) hit = null; }
  if (!hit) continue;
  if (!hit.city || (hit.vp || 0) < city[3]) { hit.city = city[0]; hit.vp = city[3]; hit.cityPos = pt; if (city[4]) hit.cap = city[4]; }
  else if (city[4]) hit.cap = city[4];
  if (city[3] >= 15 && hit.terr !== 'mountain') hit.terr = 'urban';
}
// adjacency by shared vertices
const vmap = new Map();
provs.forEach(pv => { for (const k of vertsOf(pv.mp)) { if (!vmap.has(k)) vmap.set(k, []); vmap.get(k).push(pv.id); } });
const adj = provs.map(() => new Set());
const sharedCount = new Map();
for (const ids of vmap.values()) if (ids.length > 1) for (const a of ids) for (const b of ids) if (a < b) { const k = a + '_' + b; sharedCount.set(k, (sharedCount.get(k) || 0) + 1); }
for (const [k, n] of sharedCount) { if (n < 2) continue; const [a, b] = k.split('_').map(Number); adj[a].add(b); adj[b].add(a); }
// coastal: vertices not shared with other provinces
provs.forEach(pv => { let free = 0; for (const k of vertsOf(pv.mp)) if (vmap.get(k).length === 1) free++; pv.coastal = free > 3; });
// straits: connect nearby coastal provinces of separate landmasses
const GRID = 12; const grid = new Map();
provs.forEach(pv => { if (!pv.coastal) return; for (const poly of pv.mp) for (const [x, y] of poly[0]) { const k = Math.floor(x / GRID) + ',' + Math.floor(y / GRID); if (!grid.has(k)) grid.set(k, []); grid.get(k).push([x, y, pv.id]); } });
const STRAIT = 7; let straits = 0;
for (const [k, pts] of grid) {
  const [gx, gy] = k.split(',').map(Number);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const o = grid.get((gx + dx) + ',' + (gy + dy)); if (!o) continue;
    for (const a of pts) for (const b of o) {
      if (a[2] >= b[2] || adj[a[2]].has(b[2])) continue;
      if ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 < STRAIT * STRAIT) { adj[a[2]].add(b[2]); adj[b[2]].add(a[2]); straits++; }
    }
  }
}
console.log('strait links', straits);

// ---------- sea zones ----------
const seaSeeds = [];
for (let lat = 78; lat > -56; lat -= 7) {
  const step = 9 / Math.max(0.4, Math.cos(lat * D2R));
  for (let lon = -180 + (lat * 3 % step + step) % step / 2; lon < 180; lon += step) {
    const p = proj(lon, lat);
    if (countryAt(p) < 0) seaSeeds.push(p);
  }
}
// extra seeds in enclosed seas
for (const [lon, lat] of [[18, 40], [5, 40], [25, 35.5], [33, 34], [35, 43.5], [20, 57], [18, 62], [3, 56], [-3, 49.8], [51, 42], [38, 20], [52, 26], [-90, 25], [-75, 15], [135, 40], [124, 36], [113, 15], [125, 32], [-66, 45], [-86, 59]]) {
  const p = proj(lon, lat); if (countryAt(p) < 0 && !seaSeeds.some(s => (s[0] - p[0]) ** 2 + (s[1] - p[1]) ** 2 < 900)) seaSeeds.push(p);
}
const sdel = Delaunay.from(seaSeeds);
const svor = sdel.voronoi([0, 0, W, H]);
function landBetween(a, b) {
  for (let t = 0.1; t < 0.95; t += 0.1) { const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; if (countryAt(p) >= 0) return true; }
  return false;
}
const seas = seaSeeds.map((s, i) => ({ id: i, c: s, poly: svor.cellPolygon(i), adj: new Set() }));
for (let i = 0; i < seas.length; i++) for (const j of sdel.neighbors(i)) if (i < j && !landBetween(seas[i].c, seas[j].c)) { seas[i].adj.add(j); seas[j].adj.add(i); }
// wrap-around Pacific
const west = seas.filter(s => s.c[0] < 120), east = seas.filter(s => s.c[0] > W - 120);
for (const a of west) for (const b of east) if (Math.abs(a.c[1] - b.c[1]) < 140) { a.adj.add(b.id); b.adj.add(a.id); }
// canals (Suez, Panama, Kiel-ish Danish straits handled by seeds)
function nearestSea(p) { let bi = -1, bd = 1e18; seas.forEach(s => { const d = (s.c[0] - p[0]) ** 2 + (s.c[1] - p[1]) ** 2; if (d < bd) { bd = d; bi = s.id; } }); return bi; }
for (const [[a1, a2], [b1, b2]] of [[[32.5, 33], [36, 25]], [[-80, 10], [-80, 7]], [[3, 56], [11, 56.5]], [[11, 56.5], [18, 56]], [[29, 41.5], [25, 39.5]]]) {
  const a = nearestSea(proj(a1, a2)), b = nearestSea(proj(b1, b2)); if (a !== b) { seas[a].adj.add(b); seas[b].adj.add(a); }
}
// coastal province -> sea zone (nearest sea seed with no land in the way if possible)
provs.forEach(pv => {
  if (!pv.coastal) return;
  const cand = seas.map(s => [s.id, (s.c[0] - pv.c[0]) ** 2 + (s.c[1] - pv.c[1]) ** 2]).sort((a, b) => a[1] - b[1]).slice(0, 4);
  const clear = cand.find(([id]) => !landBetween(pv.cityPos || pv.c, seas[id].c) );
  pv.sea = (clear || cand[0])[0];
});
// ports: coastal provinces with a city
// ---------- write ----------
const r1 = v => Math.round(v);
function encodeMP(mp) {
  // flatten rings, simplify by dropping near-duplicate points; even-odd fill handles holes
  const rings = [];
  for (const poly of mp) for (const ring of poly) {
    const out = []; let lx = 1e9, ly = 1e9;
    for (const [x, y] of ring) { const X = r1(x), Y = r1(y); if (X !== lx || Y !== ly) { out.push(X, Y); lx = X; ly = Y; } }
    if (out.length >= 6) rings.push(out);
  }
  return rings;
}
const outProvs = provs.map(pv => {
  const o = { id: pv.id, o: pv.owner || 'XXX', m: pv.modern, t: pv.terr, c: [r1(pv.c[0]), r1(pv.c[1])], a: [...adj[pv.id]], r: encodeMP(pv.mp) };
  if (pv.coastal) { o.co = 1; o.s = pv.sea; }
  if (pv.city) { o.n = pv.city; o.vp = pv.vp; o.cp = [r1(pv.cityPos[0]), r1(pv.cityPos[1])]; }
  if (pv.cap) o.cap = pv.cap;
  return o;
});
const unowned = outProvs.filter(p => p.o === 'XXX').map(p => p.m);
console.log('unowned', [...new Set(unowned)].join(', '));
const outSeas = seas.map(s => ({ id: s.id, c: [r1(s.c[0]), r1(s.c[1])], a: [...s.adj], r: s.poly ? s.poly.flat().map(r1) : [] }));
const js = 'window.WORLD=' + JSON.stringify({ W, H, provinces: outProvs, seas: outSeas, proj: { latMax: LAT_MAX, latMin: LAT_MIN } }) + ';\n';
const outPath = process.env.OUT || path.join(__dirname, '..', 'js', 'data', 'world.js');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, js);
console.log('wrote', outPath, (js.length / 1e6).toFixed(2), 'MB', outProvs.length, 'provinces', outSeas.length, 'seas');
