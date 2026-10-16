// Tech tree. cost = research days at base speed. eq: equipment quality level increase.
// mods: additive national modifiers. unlock: battalions / support / ships / equipment made available.
window.TECH_CATEGORIES = [
  { id: 'infantry', name: 'Infantry', icon: 'infantry' },
  { id: 'support', name: 'Support', icon: 'support' },
  { id: 'armor', name: 'Armor', icon: 'medium_tank' },
  { id: 'artillery', name: 'Artillery', icon: 'artillery' },
  { id: 'land_doctrine', name: 'Land Doctrine', icon: 'doctrine' },
  { id: 'naval', name: 'Naval', icon: 'battleship' },
  { id: 'air', name: 'Air', icon: 'fighter' },
  { id: 'industry', name: 'Industry', icon: 'factory' },
  { id: 'electronics', name: 'Electronics', icon: 'radio' },
];

window.TECHS = [
  // Infantry
  { id: 'inf_weapons1', cat: 'infantry', name: 'Infantry Weapons I', year: 1936, cost: 100, eq: { infantry_equipment: 1 }, desc: 'Improved rifles: +soft attack' },
  { id: 'inf_weapons2', cat: 'infantry', name: 'Infantry Weapons II', year: 1939, cost: 120, req: ['inf_weapons1'], eq: { infantry_equipment: 1 } },
  { id: 'inf_weapons3', cat: 'infantry', name: 'Infantry Weapons III', year: 1942, cost: 140, req: ['inf_weapons2'], eq: { infantry_equipment: 1 } },
  { id: 'special_forces', cat: 'infantry', name: 'Special Forces', year: 1936, cost: 100, req: ['inf_weapons1'], unlock: ['mountaineers', 'marines'], desc: 'Unlocks Mountaineers & Marines' },
  { id: 'paratroopers', cat: 'infantry', name: 'Airborne Infantry', year: 1938, cost: 110, req: ['special_forces'], unlock: ['paratroopers'] },
  { id: 'motorised_infantry', cat: 'infantry', name: 'Motorized Infantry', year: 1936, cost: 100, unlock: ['motorized'], desc: 'Unlocks Motorized battalions' },
  { id: 'mechanised_infantry', cat: 'infantry', name: 'Mechanized Infantry', year: 1940, cost: 140, req: ['motorised_infantry'], unlock: ['mechanized'] },
  { id: 'mechanised_infantry2', cat: 'infantry', name: 'Mechanized Infantry II', year: 1943, cost: 150, req: ['mechanised_infantry'], eq: { mechanized: 1 } },
  // Support
  { id: 'support_weapons', cat: 'support', name: 'Support Weapons', year: 1936, cost: 90, mods: { def: 0.05 }, desc: '+5% defense' },
  { id: 'field_hospital', cat: 'support', name: 'Field Hospitals', year: 1937, cost: 100, req: ['support_weapons'], unlock: ['field_hospital'] },
  { id: 'logistics_company', cat: 'support', name: 'Logistics Company', year: 1937, cost: 100, req: ['support_weapons'], unlock: ['logistics'] },
  { id: 'signal_company', cat: 'support', name: 'Signal Company', year: 1938, cost: 100, req: ['support_weapons'], unlock: ['signal'] },
  { id: 'maintenance_company', cat: 'support', name: 'Maintenance Company', year: 1939, cost: 100, req: ['logistics_company'], unlock: ['maintenance'] },
  { id: 'support_weapons2', cat: 'support', name: 'Support Weapons II', year: 1940, cost: 120, req: ['support_weapons'], mods: { def: 0.05, org: 3 } },
  // Armor
  { id: 'light_tank2', cat: 'armor', name: 'Improved Light Tank', year: 1936, cost: 110, eq: { light_tank: 1 }, desc: 'Better light tanks' },
  { id: 'medium_tank1', cat: 'armor', name: 'Basic Medium Tank', year: 1936, cost: 120, unlock: ['medium_tank'], desc: 'Unlocks Medium Tanks (Panzer III, T-34, Sherman)' },
  { id: 'medium_tank2', cat: 'armor', name: 'Improved Medium Tank', year: 1940, cost: 140, req: ['medium_tank1'], eq: { medium_tank: 1 } },
  { id: 'medium_tank3', cat: 'armor', name: 'Advanced Medium Tank', year: 1943, cost: 160, req: ['medium_tank2'], eq: { medium_tank: 1 } },
  { id: 'heavy_tank1', cat: 'armor', name: 'Basic Heavy Tank', year: 1938, cost: 140, req: ['medium_tank1'], unlock: ['heavy_tank'], desc: 'Unlocks Heavy Tanks (Tiger, KV-1)' },
  { id: 'heavy_tank2', cat: 'armor', name: 'Improved Heavy Tank', year: 1942, cost: 160, req: ['heavy_tank1'], eq: { heavy_tank: 1 } },
  // Artillery
  { id: 'artillery1', cat: 'artillery', name: 'Interwar Artillery', year: 1936, cost: 100, eq: { artillery: 1 } },
  { id: 'artillery2', cat: 'artillery', name: 'Improved Artillery', year: 1939, cost: 120, req: ['artillery1'], eq: { artillery: 1 } },
  { id: 'artillery3', cat: 'artillery', name: 'Advanced Artillery', year: 1942, cost: 140, req: ['artillery2'], eq: { artillery: 1 } },
  { id: 'at1', cat: 'artillery', name: 'Interwar Anti-Tank', year: 1936, cost: 90, eq: { anti_tank: 1 } },
  { id: 'at2', cat: 'artillery', name: 'Improved Anti-Tank', year: 1940, cost: 120, req: ['at1'], eq: { anti_tank: 1 } },
  { id: 'aa1', cat: 'artillery', name: 'Interwar Anti-Air', year: 1936, cost: 90, eq: { anti_air: 1 } },
  { id: 'aa2', cat: 'artillery', name: 'Improved Anti-Air', year: 1940, cost: 120, req: ['aa1'], eq: { anti_air: 1 } },
  // Land doctrine
  { id: 'doc_mobile', cat: 'land_doctrine', name: 'Mobile Warfare', year: 1936, cost: 150, mods: { brk: 0.1, speed: 0.1 }, desc: 'Blitzkrieg: +10% breakthrough, +10% speed', excl: 'doc_superior_firepower doc_grand_battleplan doc_mass_assault' },
  { id: 'doc_superior_firepower', cat: 'land_doctrine', name: 'Superior Firepower', year: 1936, cost: 150, mods: { soft: 0.1 }, desc: '+10% soft attack', excl: 'doc_mobile doc_grand_battleplan doc_mass_assault' },
  { id: 'doc_grand_battleplan', cat: 'land_doctrine', name: 'Grand Battleplan', year: 1936, cost: 150, mods: { def: 0.15, entrench: 0.05 }, desc: '+15% defense', excl: 'doc_mobile doc_superior_firepower doc_mass_assault' },
  { id: 'doc_mass_assault', cat: 'land_doctrine', name: 'Mass Assault', year: 1936, cost: 150, mods: { org: 5, manpower: 0.2 }, desc: '+5 org, +20% manpower', excl: 'doc_mobile doc_superior_firepower doc_grand_battleplan' },
  { id: 'doc_tier2', cat: 'land_doctrine', name: 'Combined Arms', year: 1939, cost: 170, reqAny: ['doc_mobile', 'doc_superior_firepower', 'doc_grand_battleplan', 'doc_mass_assault'], mods: { soft: 0.05, brk: 0.05, def: 0.05 } },
  { id: 'doc_tier3', cat: 'land_doctrine', name: 'Operational Integrity', year: 1942, cost: 190, req: ['doc_tier2'], mods: { org: 5, soft: 0.05 } },
  // Naval
  { id: 'destroyer2', cat: 'naval', name: 'Improved Destroyer', year: 1936, cost: 100, eq: { destroyer: 1 } },
  { id: 'cruiser2', cat: 'naval', name: 'Improved Cruiser', year: 1936, cost: 110, eq: { light_cruiser: 1, heavy_cruiser: 1 } },
  { id: 'battleship2', cat: 'naval', name: 'Improved Battleship', year: 1937, cost: 140, eq: { battleship: 1 } },
  { id: 'carrier1', cat: 'naval', name: 'Carrier Doctrine', year: 1936, cost: 140, unlock: ['carrier'], desc: 'Unlocks Aircraft Carriers' },
  { id: 'submarine2', cat: 'naval', name: 'Improved Submarine', year: 1937, cost: 110, eq: { submarine: 1 } },
  { id: 'naval_doc', cat: 'naval', name: 'Fleet in Being', year: 1936, cost: 130, mods: { naval: 0.15 }, desc: '+15% naval attack' },
  { id: 'amphib', cat: 'naval', name: 'Amphibious Operations', year: 1938, cost: 120, mods: { invasion: 0.5 }, desc: 'Faster naval invasions, smaller penalty' },
  // Air
  { id: 'fighter2', cat: 'air', name: 'Fighter II', year: 1938, cost: 120, eq: { fighter: 1 }, desc: 'Bf 109E / Spitfire class' },
  { id: 'fighter3', cat: 'air', name: 'Fighter III', year: 1941, cost: 140, req: ['fighter2'], eq: { fighter: 1 } },
  { id: 'cas2', cat: 'air', name: 'Improved CAS', year: 1939, cost: 120, eq: { cas: 1 }, desc: 'Ju 87 Stuka class' },
  { id: 'tac2', cat: 'air', name: 'Improved Tactical Bomber', year: 1939, cost: 120, eq: { tac_bomber: 1 } },
  { id: 'navbomb2', cat: 'air', name: 'Improved Naval Bomber', year: 1939, cost: 120, eq: { nav_bomber: 1 } },
  { id: 'air_doc', cat: 'air', name: 'Air Superiority Doctrine', year: 1936, cost: 140, mods: { air: 0.15 } },
  { id: 'radar', cat: 'electronics', name: 'Radar', year: 1939, cost: 150, req: ['electronics1'], mods: { air: 0.1, naval: 0.1 } },
  // Industry
  { id: 'industry1', cat: 'industry', name: 'Basic Machine Tools', year: 1936, cost: 120, mods: { eff_cap: 0.1, factory: 0.1 }, desc: '+10% factory output' },
  { id: 'industry2', cat: 'industry', name: 'Improved Machine Tools', year: 1938, cost: 140, req: ['industry1'], mods: { eff_cap: 0.1, factory: 0.1 } },
  { id: 'industry3', cat: 'industry', name: 'Advanced Machine Tools', year: 1941, cost: 160, req: ['industry2'], mods: { eff_cap: 0.1, factory: 0.1 } },
  { id: 'construction1', cat: 'industry', name: 'Construction I', year: 1936, cost: 100, mods: { construction: 0.1 }, desc: '+10% construction speed' },
  { id: 'construction2', cat: 'industry', name: 'Construction II', year: 1938, cost: 120, req: ['construction1'], mods: { construction: 0.1 } },
  { id: 'construction3', cat: 'industry', name: 'Construction III', year: 1940, cost: 140, req: ['construction2'], mods: { construction: 0.15 } },
  { id: 'synth', cat: 'industry', name: 'Synthetic Oil', year: 1938, cost: 120, req: ['industry1'], mods: { factory: 0.05 } },
  // Electronics
  { id: 'electronics1', cat: 'electronics', name: 'Electronic Engineering', year: 1936, cost: 110, mods: { research: 0.05 }, desc: '+5% research speed' },
  { id: 'computing', cat: 'electronics', name: 'Mechanical Computing', year: 1938, cost: 130, req: ['electronics1'], mods: { research: 0.05 }, desc: '+5% research speed, +1 research slot', slot: 1 },
  { id: 'computing2', cat: 'electronics', name: 'Computing Machine', year: 1940, cost: 150, req: ['computing'], mods: { research: 0.1 }, slot: 1 },
  { id: 'rocketry', cat: 'electronics', name: 'Rocket Engines', year: 1942, cost: 180, req: ['computing'], mods: { soft: 0.05 } },
  { id: 'atomic', cat: 'electronics', name: 'Atomic Research', year: 1943, cost: 250, req: ['computing2'], mods: { research: 0.1 }, desc: 'The road to the bomb' },
];

// What each country begins the game already knowing
window.START_TECHS = {
  _all: [],
  _major: ['inf_weapons1', 'support_weapons', 'artillery1'],
  GER: ['inf_weapons1', 'support_weapons', 'artillery1', 'motorised_infantry', 'light_tank2', 'at1', 'aa1', 'electronics1', 'industry1'],
  SOV: ['inf_weapons1', 'support_weapons', 'artillery1', 'light_tank2', 'medium_tank1', 'motorised_infantry'],
  ENG: ['inf_weapons1', 'support_weapons', 'destroyer2', 'cruiser2', 'carrier1', 'naval_doc', 'electronics1'],
  USA: ['inf_weapons1', 'support_weapons', 'destroyer2', 'cruiser2', 'carrier1', 'motorised_infantry', 'industry1'],
  JAP: ['inf_weapons1', 'support_weapons', 'destroyer2', 'cruiser2', 'carrier1', 'battleship2', 'special_forces'],
  FRA: ['inf_weapons1', 'support_weapons', 'artillery1', 'at1', 'light_tank2', 'medium_tank1'],
  ITA: ['inf_weapons1', 'support_weapons', 'artillery1', 'destroyer2', 'submarine2'],
};
