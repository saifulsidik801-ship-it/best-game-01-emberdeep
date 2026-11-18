// Emberdeep — static data: difficulties, enemies, relics, shop, feats, boons.
// All original names and numbers, tuned for a 6–9 minute delve.
(function () {
  var ED = window.ED;
  ED.DIFFICULTIES = {
    ember:   { label: 'EMBER',   hpMul: 0.8,  dmgMul: 0.8,  goldMul: 1.0, xpMul: 1.0, playerHpMul: 1.2, desc: 'Gentle' },
    flame:   { label: 'FLAME',   hpMul: 1.0,  dmgMul: 1.0,  goldMul: 1.0, xpMul: 1.0, playerHpMul: 1.0, desc: 'Balanced' },
    inferno: { label: 'INFERNO', hpMul: 1.5,  dmgMul: 1.4,  goldMul: 1.5, xpMul: 1.5, playerHpMul: 1.0, desc: 'Brutal' },
  };
  // Enemy archetypes. hp/dmg are base (Flame); scaled by difficulty.
  ED.ENEMIES = {
    wisp:   { name: 'Ember Wisp',   hp: 30,  dmg: 8,  speed: 2.6, xp: 12, gold: 6,  radius: 0.55, color: 0xffb03a, flying: true,  aggro: 13 },
    imp:    { name: 'Cinder Imp',   hp: 45,  dmg: 10, speed: 3.1, xp: 16, gold: 9,  radius: 0.6,  color: 0xd43a2a, flying: false, aggro: 12 },
    golem:  { name: 'Stone Golem',  hp: 120, dmg: 16, speed: 1.5, xp: 30, gold: 16, radius: 0.95, color: 0x8a8f96, flying: false, aggro: 11 },
    stalker:{ name: 'Deep Stalker', hp: 70,  dmg: 14, speed: 3.8, xp: 24, gold: 14, radius: 0.6,  color: 0x7a4fd0, flying: false, aggro: 15 },
    warden: { name: 'Warden of the Wood', hp: 420, dmg: 18, speed: 1.9, xp: 150, gold: 120, radius: 1.5, color: 0x3f8a4f, flying: false, aggro: 99, boss: true },
    colossus:{ name: 'Magma Colossus', hp: 900, dmg: 24, speed: 2.1, xp: 400, gold: 300, radius: 2.1, color: 0xff5a1a, flying: false, aggro: 99, boss: true },
  };
  // 14 relics. effect is applied as a player modifier (see entities.js applyRelic).
  ED.RELICS = [
    { id: 'emberheart',  icon: '❤️', name: 'Emberheart',       desc: '+30 max HP and heal 30 HP now.' },
    { id: 'swiftboots', icon: '🥾', name: 'Swiftboots',       desc: '+12% move speed.' },
    { id: 'stormbrand', icon: '⚡', name: 'Stormbrand',       desc: '+25% sword damage.' },
    { id: 'thornmail',  icon: '🌵', name: 'Thornmail',        desc: 'Attackers take 12 damage back.' },
    { id: 'lifedrinker',icon: '🩸', name: 'Lifedrinker',      desc: 'Heal 3 HP on every sword hit.' },
    { id: 'frostward',  icon: '❄️', name: 'Frostward',        desc: 'Take 15% less damage.' },
    { id: 'goldmagnet', icon: '🧲', name: 'Goldmagnet',       desc: '+40% gold from all sources.' },
    { id: 'ironhide',   icon: '🛡️', name: 'Ironhide',         desc: '+25 max HP and +10 armor soak.' },
    { id: 'berserker',  icon: '😡', name: 'Berserker Charm',  desc: '+15% damage, +10% crit chance.' },
    { id: 'phoenix',    icon: '🔥', name: 'Phoenix Feather',  desc: 'Revive once at 50% HP when you fall.' },
    { id: 'bark',       icon: '🌳', name: "Warden's Bark",    desc: '+20 max HP, +8% damage.' },
    { id: 'core',       icon: '🪨', name: 'Colossus Core',    desc: 'Ember Nova deals +60% damage.' },
    { id: 'lucky',      icon: '🍀', name: 'Lucky Coin',       desc: '+25% XP and +10% crit chance.' },
    { id: 'voidlens',   icon: '👁️', name: 'Void Lens',        desc: 'Ember Nova recharges 35% faster.' },
  ];
  ED.relicById = function (id) { return ED.RELICS.find(function (r) { return r.id === id; }); };
  // Smithy upgrades: 4 tracks, 3 levels each.
  ED.SHOP = [
    { id: 'blade', icon: '🗡️', name: 'Sharpened Blade', desc: '+15% sword damage per level.', costs: [60, 120, 200], apply: 'dmg' },
    { id: 'plate', icon: '🛡️', name: 'Ember Plate',     desc: '+30 max HP per level.',        costs: [60, 120, 200], apply: 'hp' },
    { id: 'greaves', icon: '🥾', name: 'Swift Greaves',  desc: '+8% move speed per level.',    costs: [50, 100, 170], apply: 'speed' },
    { id: 'charm', icon: '🔮', name: 'Focus Charm',     desc: 'Ember Nova recharges 15% faster per level.', costs: [50, 100, 170], apply: 'cdr' },
  ];
  // Level-up boon pool (pick 3 distinct at random).
  ED.BOONS = [
    { id: 'might',   icon: '💪', name: 'Might',        desc: '+20% sword damage.',        apply: function (p) { p.mod.dmgMul *= 1.20; } },
    { id: 'vitality',icon: '💚', name: 'Vitality',     desc: '+25 max HP, heal 25.',      apply: function (p) { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); } },
    { id: 'haste',   icon: '💨', name: 'Haste',        desc: '+10% move speed.',          apply: function (p) { p.mod.speedMul *= 1.10; } },
    { id: 'focus',   icon: '✨', name: 'Focus',        desc: 'Ember Nova recharges 25% faster.', apply: function (p) { p.mod.skillCdMul *= 0.75; } },
    { id: 'crit',    icon: '🎯', name: 'Deadly Eye',   desc: '+12% critical chance.',     apply: function (p) { p.mod.crit += 0.12; } },
    { id: 'leech',   icon: '🧛', name: 'Ember Leech',  desc: 'Heal 2 HP on every hit.',   apply: function (p) { p.mod.lifesteal += 2; } },
    { id: 'greed',   icon: '💰', name: 'Greed',        desc: '+30% gold, +15% XP.',      apply: function (p) { p.mod.goldMul *= 1.3; p.mod.xpMul *= 1.15; } },
    { id: 'ward',    icon: '🛡️', name: 'Stone Ward',   desc: 'Take 10% less damage.',     apply: function (p) { p.mod.dmgTakenMul *= 0.9; } },
  ];
  ED.FEATS = [
    { id: 'firstblood', name: 'First Blood',      desc: 'Defeat your first foe.' },
    { id: 'warden',     name: 'Warden Slayer',    desc: 'Defeat the Warden of the Wood.' },
    { id: 'colossus',   name: 'Colossus Slayer',  desc: 'Defeat the Magma Colossus and win the delve.' },
    { id: 'relic5',     name: 'Relic Hunter',     desc: 'Hold 5 relics at once.' },
    { id: 'combo10',    name: 'Combo Master',     desc: 'Reach a 10-hit combo.' },
    { id: 'flawless',   name: 'Flawless Wood',    desc: 'Clear the Whisperwood without falling.' },
    { id: 'rich',       name: 'Ember Rich',       desc: 'Hold 500 gold at once.' },
    { id: 'endless5',   name: 'Endless V',        desc: 'Survive 5 waves of Endless mode.' },
    { id: 'speedy',     name: 'Swift Delve',      desc: 'Win the delve in under 6 minutes.' },
  ];
  ED.ZONES = [
    { key: 'hub',     name: 'Emberdeep Town',   pip: 'Town' },
    { key: 'forest',  name: 'Whisperwood',      pip: 'Wood' },
    { key: 'dungeon1',name: 'Sunken Halls I',   pip: 'Hall I' },
    { key: 'dungeon2',name: 'Sunken Halls II',  pip: 'Hall II' },
    { key: 'boss',    name: 'Colossus Vault',   pip: 'Vault' },
  ];
})();
