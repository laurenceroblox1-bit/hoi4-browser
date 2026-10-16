# Iron Fronts — WW2 Grand Strategy in the Browser

A Hearts of Iron IV–inspired grand strategy game that runs entirely in your browser. No install, no build step.

## Play

Open `index.html` in Chrome, Firefox or Edge (double-clicking it works). If you'd rather use a local server: `python3 -m http.server`, then open http://localhost:8000.

## Features

- **World map, 1 January 1936**: ~3,200 provinces built from Natural Earth borders and redrawn to 1936 (British Raj, French and Italian Africa, Manchukuo, the Chinese warlords, Dutch East Indies, …). HoI4-style country labels, cities and victory points, sea zones, winter snow and autumn mud. Map modes: political, factions, ideology, terrain, industry.
- **World leaders**: about 80 nations, each with its 1936 leader. The major powers change leaders on historical dates (Baldwin → Chamberlain → Churchill, FDR → Truman, and so on). Portraits are loaded from Wikipedia while you play; if they can't load (for example offline), a drawn portrait is shown instead.
- **Division designer**: a 5×5 grid of combat battalions plus support companies (infantry, cavalry, mountaineers, marines, paratroopers, motorized, mechanized, light, medium and heavy tanks, artillery, anti-tank, anti-air, engineers, recon, hospitals, logistics, signal, and more). Stats update as you edit.
- **Research**: 9 categories, about 60 technologies, with an ahead-of-time penalty, doctrines and extra research slots.
- **Production and construction**: military factories produce equipment, civilian factories build new factories, and dockyards build ships.
- **Land combat**: soft and hard attack, defense, breakthrough, organization, armor and piercing, combat width, terrain, entrenchment, supply and encirclement, air support, and amphibious landings.
- **Navy**: battleships, carriers, cruisers, destroyers and submarines fight battles in sea zones. Also covers naval invasions, raiding and repair in port.
- **Air**: fighters, CAS, tactical and naval bombers. Missions are air superiority, close air support, strategic bombing and naval strike, and you can watch the planes fly.
- **Unit models**: tanks, infantry, artillery, ships and planes are drawn for each nation.
- **Diplomacy**: declare war, make peace, factions (Allies, Comintern, Axis), guarantees and military access.
- **Historical events**: Anschluss, Fall Weiss, the Winter War, Fall Gelb, Barbarossa, Pearl Harbor and more. You can turn them off.
- **Test menu** (`` ` `` key): cheats, spawn armies and fleets, start wars, annex countries, switch nations, jump in time, start a test battle, and a command console.
- Save and load (F5 / F9), stored in your browser.

## Controls

Drag to pan, scroll to zoom. Left-click a unit counter to select it (Shift-click to add more, Shift- or Ctrl-drag to box-select), then right-click a province to move or attack. Space pauses, +/- change speed.

Hotkeys: L politics · R research · G diplomacy · P production · B construction · A recruit · D designer · O army · N navy · F air · `` ` `` test menu.

## Rebuilding the map

`tools/build-map.js` generates `js/data/world.js`:

```
npm i world-atlas@2 topojson-client d3-delaunay polygon-clipping
node tools/build-map.js
```
