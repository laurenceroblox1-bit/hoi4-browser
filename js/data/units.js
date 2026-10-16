// Equipment produced by military factories. cost = production cost per unit (IC).
window.EQUIPMENT = {
  infantry_equipment: { name: 'Infantry Equipment', short: 'Inf Eq', cost: 0.5, icon: 'rifle' },
  support_equipment: { name: 'Support Equipment', short: 'Support', cost: 4, icon: 'support' },
  artillery: { name: 'Artillery', short: 'Artillery', cost: 3.5, icon: 'artillery' },
  anti_tank: { name: 'Anti-Tank Guns', short: 'AT', cost: 4, icon: 'at' },
  anti_air: { name: 'Anti-Air Guns', short: 'AA', cost: 4, icon: 'aa' },
  motorized: { name: 'Trucks', short: 'Trucks', cost: 2.5, icon: 'truck' },
  mechanized: { name: 'Half-tracks', short: 'Mech', cost: 4.5, icon: 'halftrack' },
  light_tank: { name: 'Light Tanks', short: 'Lt Tank', cost: 8, icon: 'light_tank' },
  medium_tank: { name: 'Medium Tanks', short: 'Md Tank', cost: 12, icon: 'medium_tank' },
  heavy_tank: { name: 'Heavy Tanks', short: 'Hv Tank', cost: 20, icon: 'heavy_tank' },
  fighter: { name: 'Fighters', short: 'Fighter', cost: 22, icon: 'fighter', air: true },
  cas: { name: 'Close Air Support', short: 'CAS', cost: 24, icon: 'cas', air: true },
  tac_bomber: { name: 'Tactical Bombers', short: 'Tac Bomber', cost: 40, icon: 'tac_bomber', air: true },
  nav_bomber: { name: 'Naval Bombers', short: 'Nav Bomber', cost: 36, icon: 'nav_bomber', air: true },
};

// Battalions usable in the division designer.
// soft/hard attack, def(ense), brk (breakthrough), hp, org, speed (km/h), armor, pierce, hard(ness), width, mp (manpower), eq
window.BATTALIONS = {
  infantry: { name: 'Infantry', group: 'infantry', model: 'infantry', soft: 6, hard: 1, def: 22, brk: 3, hp: 25, org: 60, speed: 4, armor: 0, pierce: 4, hardness: 0, width: 2, mp: 1000, eq: { infantry_equipment: 100 } },
  cavalry: { name: 'Cavalry', group: 'infantry', model: 'cavalry', soft: 6, hard: 1, def: 20, brk: 3, hp: 25, org: 70, speed: 6, armor: 0, pierce: 4, hardness: 0, width: 2, mp: 1000, eq: { infantry_equipment: 120 } },
  mountaineers: { name: 'Mountaineers', group: 'infantry', model: 'infantry', soft: 7, hard: 1, def: 24, brk: 3, hp: 20, org: 70, speed: 4, armor: 0, pierce: 4, hardness: 0, width: 2, mp: 1000, eq: { infantry_equipment: 120, support_equipment: 10 }, req: 'special_forces', terrain: { mountain: 0.25, hills: 0.15 } },
  marines: { name: 'Marines', group: 'infantry', model: 'infantry', soft: 6, hard: 1, def: 22, brk: 3, hp: 20, org: 70, speed: 4, armor: 0, pierce: 4, hardness: 0, width: 2, mp: 1000, eq: { infantry_equipment: 120, support_equipment: 10 }, req: 'special_forces', amphibious: true },
  paratroopers: { name: 'Paratroopers', group: 'infantry', model: 'infantry', soft: 6, hard: 1, def: 20, brk: 4, hp: 20, org: 70, speed: 4, armor: 0, pierce: 4, hardness: 0, width: 2, mp: 1000, eq: { infantry_equipment: 120, support_equipment: 10 }, req: 'paratroopers' },
  motorized: { name: 'Motorized', group: 'mobile', model: 'truck', soft: 6, hard: 1, def: 22, brk: 3, hp: 25, org: 60, speed: 12, armor: 0, pierce: 4, hardness: 0.1, width: 2, mp: 1200, eq: { infantry_equipment: 100, motorized: 35 }, req: 'motorised_infantry' },
  mechanized: { name: 'Mechanized', group: 'mobile', model: 'halftrack', soft: 8, hard: 3, def: 30, brk: 7, hp: 30, org: 60, speed: 10, armor: 10, pierce: 10, hardness: 0.6, width: 2, mp: 1000, eq: { infantry_equipment: 100, mechanized: 50 }, req: 'mechanised_infantry' },
  light_tank: { name: 'Light Tanks', group: 'armor', model: 'light_tank', soft: 18, hard: 8, def: 4, brk: 26, hp: 2, org: 10, speed: 10, armor: 20, pierce: 25, hardness: 0.8, width: 2, mp: 500, eq: { light_tank: 60 } },
  medium_tank: { name: 'Medium Tanks', group: 'armor', model: 'medium_tank', soft: 28, hard: 22, def: 5, brk: 40, hp: 2, org: 10, speed: 8, armor: 50, pierce: 60, hardness: 0.9, width: 2, mp: 500, eq: { medium_tank: 50 }, req: 'medium_tank1' },
  heavy_tank: { name: 'Heavy Tanks', group: 'armor', model: 'heavy_tank', soft: 30, hard: 26, def: 8, brk: 45, hp: 2, org: 10, speed: 4, armor: 85, pierce: 85, hardness: 0.95, width: 2, mp: 500, eq: { heavy_tank: 40 }, req: 'heavy_tank1' },
  artillery: { name: 'Artillery', group: 'support_line', model: 'artillery', soft: 25, hard: 2, def: 10, brk: 6, hp: 0.6, org: 0, speed: 4, armor: 0, pierce: 5, hardness: 0, width: 3, mp: 500, eq: { artillery: 12 } },
  anti_tank: { name: 'Anti-Tank', group: 'support_line', model: 'at', soft: 2, hard: 15, def: 4, brk: 1, hp: 0.6, org: 0, speed: 4, armor: 0, pierce: 50, hardness: 0, width: 1, mp: 500, eq: { anti_tank: 12 } },
  anti_air: { name: 'Anti-Air', group: 'support_line', model: 'aa', soft: 3, hard: 7, def: 4, brk: 1, hp: 0.6, org: 0, speed: 4, armor: 0, pierce: 20, hardness: 0, width: 1, mp: 500, eq: { anti_air: 12 }, aa: 15 },
};
window.SUPPORT = {
  engineer: { name: 'Engineers', model: 'infantry', soft: 1, def: 12, brk: 2, hp: 3, org: 10, mp: 300, eq: { infantry_equipment: 30, support_equipment: 10 }, desc: '+def, +entrench' },
  recon: { name: 'Recon', model: 'cavalry', soft: 1, def: 2, brk: 2, hp: 2, org: 10, mp: 200, eq: { infantry_equipment: 40 }, desc: '+speed, +initiative', speedBonus: 1.1 },
  field_hospital: { name: 'Field Hospital', model: 'support', hp: 2, org: 5, mp: 500, eq: { support_equipment: 30 }, desc: '-strength losses', losses: 0.85, req: 'field_hospital' },
  logistics: { name: 'Logistics', model: 'truck', hp: 2, org: 5, mp: 300, eq: { support_equipment: 20, motorized: 10 }, desc: '-attrition', req: 'logistics_company' },
  signal: { name: 'Signal', model: 'support', hp: 2, org: 5, mp: 300, eq: { support_equipment: 20 }, desc: '+org recovery', recovery: 1.25, req: 'signal_company' },
  sup_artillery: { name: 'Artillery Co.', model: 'artillery', soft: 12, hard: 1, def: 5, brk: 3, hp: 0.2, mp: 300, eq: { artillery: 12 } },
  sup_aa: { name: 'AA Co.', model: 'aa', soft: 2, hard: 4, def: 2, hp: 0.2, mp: 300, eq: { anti_air: 10 }, aa: 10 },
  sup_at: { name: 'AT Co.', model: 'at', soft: 1, hard: 8, def: 3, hp: 0.2, mp: 300, eq: { anti_tank: 10 }, pierce: 45 },
  maintenance: { name: 'Maintenance', model: 'support', hp: 2, org: 5, mp: 300, eq: { support_equipment: 20 }, desc: '+reliability', req: 'maintenance_company' },
};

// Ships, produced in dockyards. atk = light/heavy gun attack, torp = torpedo attack, aa, hp, armor, speed (knots)
window.SHIPS = {
  destroyer: { name: 'Destroyer', short: 'DD', cost: 450, hp: 20, atk: 6, heavy: 0, torp: 30, aa: 3, armor: 0, speed: 34, subDetect: 30, model: 'destroyer' },
  submarine: { name: 'Submarine', short: 'SS', cost: 400, hp: 15, atk: 1, heavy: 0, torp: 40, aa: 0, armor: 0, speed: 16, stealth: 0.6, model: 'submarine' },
  light_cruiser: { name: 'Light Cruiser', short: 'CL', cost: 1100, hp: 45, atk: 18, heavy: 0, torp: 12, aa: 8, armor: 25, speed: 32, subDetect: 10, model: 'light_cruiser' },
  heavy_cruiser: { name: 'Heavy Cruiser', short: 'CA', cost: 1800, hp: 70, atk: 6, heavy: 28, torp: 8, aa: 8, armor: 80, speed: 31, model: 'heavy_cruiser' },
  battleship: { name: 'Battleship', short: 'BB', cost: 4500, hp: 120, atk: 8, heavy: 65, torp: 0, aa: 12, armor: 150, speed: 25, model: 'battleship' },
  carrier: { name: 'Carrier', short: 'CV', cost: 4000, hp: 95, atk: 2, heavy: 0, torp: 0, aa: 18, armor: 40, speed: 30, planes: 60, model: 'carrier', req: 'carrier1' },
};
window.SHIP_NAMES = {
  ENG: ['Hood', 'Nelson', 'Rodney', 'Warspite', 'Valiant', 'Barham', 'Malaya', 'Revenge', 'Royal Oak', 'Ramillies', 'Renown', 'Repulse', 'Ark Royal', 'Furious', 'Courageous', 'Glorious', 'Eagle', 'Hermes', 'Exeter', 'Ajax', 'Achilles', 'Belfast', 'Sheffield', 'Norfolk', 'Suffolk', 'Dorsetshire', 'Cossack', 'Kelly', 'Glowworm'],
  GER: ['Bismarck', 'Tirpitz', 'Scharnhorst', 'Gneisenau', 'Deutschland', 'Admiral Scheer', 'Graf Spee', 'Hipper', 'Prinz Eugen', 'Blücher', 'Emden', 'Königsberg', 'Karlsruhe', 'Köln', 'Leipzig', 'Nürnberg', 'U-47', 'U-99', 'U-110'],
  USA: ['Arizona', 'Pennsylvania', 'Nevada', 'Oklahoma', 'Tennessee', 'California', 'Maryland', 'West Virginia', 'Colorado', 'New Mexico', 'Idaho', 'Mississippi', 'Texas', 'New York', 'Lexington', 'Saratoga', 'Ranger', 'Yorktown', 'Enterprise', 'Hornet', 'Indianapolis', 'Houston', 'Portland', 'Astoria', 'Juneau'],
  JAP: ['Nagato', 'Mutsu', 'Ise', 'Hyuga', 'Fuso', 'Yamashiro', 'Kongo', 'Hiei', 'Haruna', 'Kirishima', 'Akagi', 'Kaga', 'Hosho', 'Ryujo', 'Soryu', 'Hiryu', 'Takao', 'Atago', 'Chokai', 'Maya', 'Myoko', 'Nachi', 'Mogami', 'Mikuma'],
  ITA: ['Conte di Cavour', 'Giulio Cesare', 'Caio Duilio', 'Andrea Doria', 'Littorio', 'Vittorio Veneto', 'Zara', 'Pola', 'Fiume', 'Gorizia', 'Trento', 'Trieste', 'Bolzano'],
  FRA: ['Dunkerque', 'Strasbourg', 'Bretagne', 'Provence', 'Lorraine', 'Courbet', 'Paris', 'Béarn', 'Algérie', 'Foch', 'Dupleix', 'Colbert', 'Suffren', 'Duquesne', 'Tourville'],
  SOV: ['Marat', 'Oktyabrskaya Revolutsiya', 'Parizhskaya Kommuna', 'Kirov', 'Voroshilov', 'Krasny Kavkaz', 'Chervona Ukraina', 'Krasny Krym'],
};

// Air wings. stats per plane.
window.PLANES = {
  fighter: { name: 'Fighters', range: 180, agility: 1, air: 20, def: 18, ground: 0, naval: 0, strat: 0 },
  cas: { name: 'Close Air Support', range: 140, agility: 0.5, air: 6, def: 10, ground: 1.0, naval: 0.2, strat: 0 },
  tac_bomber: { name: 'Tactical Bombers', range: 260, agility: 0.3, air: 4, def: 14, ground: 0.6, naval: 0.15, strat: 0.8 },
  nav_bomber: { name: 'Naval Bombers', range: 240, agility: 0.4, air: 4, def: 12, ground: 0.1, naval: 1.0, strat: 0 },
};
window.AIR_MISSIONS = {
  superiority: 'Air Superiority', cas: 'Close Air Support', bombing: 'Strategic Bombing', naval_strike: 'Naval Strike', idle: 'Idle',
};

window.TERRAIN = {
  plains: { name: 'Plains', atk: 0, move: 1, width: 90, color: '#c9c08a' },
  forest: { name: 'Forest', atk: -0.15, move: 0.7, width: 84, color: '#4f6b3a' },
  hills: { name: 'Hills', atk: -0.25, move: 0.6, width: 80, color: '#a08a5a' },
  mountain: { name: 'Mountains', atk: -0.5, move: 0.45, width: 75, color: '#8a7a6a' },
  desert: { name: 'Desert', atk: 0, move: 0.9, width: 90, color: '#e0c98a' },
  jungle: { name: 'Jungle', atk: -0.3, move: 0.5, width: 84, color: '#3a6a3a' },
  tundra: { name: 'Tundra', atk: -0.1, move: 0.7, width: 80, color: '#b0b8b0' },
  urban: { name: 'Urban', atk: -0.3, move: 0.8, width: 96, color: '#8a8a8a' },
};

// Default division templates available to every nation at start
window.DEFAULT_TEMPLATES = [
  { name: 'Infantry Division', line: ['infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'artillery', 'artillery'], support: ['engineer'] },
  { name: 'Light Armor Division', line: ['light_tank', 'light_tank', 'light_tank', 'infantry', 'infantry', 'infantry', 'artillery'], support: ['recon'] },
  { name: 'Militia', line: ['infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry'], support: [] },
];
