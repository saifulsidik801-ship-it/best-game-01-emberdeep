// Emberdeep — screenshot hooks: ?shot=title|gameplay|shop|win puts the real
// game into that exact state (real HUD numbers, real entities) so screenshots
// are truth-checked renders of the game itself.
(function () {
  var ED = window.ED;
  ED.shotsInit = function () {
    var params = new URLSearchParams(location.search);
    var shot = params.get('shot');
    if (!shot) return;
    setTimeout(function () { ED.applyShot(shot); }, 700);
  };
  ED.applyShot = function (shot) {
    var p = ED.player;
    if (!p) return;
    if (shot === 'title') {
      // title screen is the default state; nothing to do.
      return;
    }
    ED.startGame('flame');
    if (shot === 'gameplay') {
      // Mid-fight in Sunken Hall I: real enemies, real HUD values.
      // Player south of the pack, camera behind looking north into the hall.
      ED.state.stage = 'dungeon1';
      ED.state.zone = 'dungeon1';
      ED.setZone('dungeon1');
      ED.setObjective('Clear Sunken Hall I — stone wakes here (3/6).');
      p.x = -2; p.z = -60; p.yaw = 0;
      p.hp = 82; p.maxHp = 100; p.energy = 64;
      p.level = 3; p.xp = 55; p.xpNext = 73;
      p.gold = 340; p.score = 1250; p.kills = 14;
      p.combo = 5; p.comboTimer = 2.0;
      ED.setCamera(0, 0.42);
      ED.spawnEnemy('golem', -6, -68, { zone: 'dungeon1' });
      ED.spawnEnemy('imp', 2, -68, { zone: 'dungeon1' });
      ED.spawnEnemy('stalker', 5, -66, { zone: 'dungeon1' });
      ED.spawnEnemy('imp', -9, -65, { zone: 'dungeon1' });
      ED.spawnEnemy('wisp', 0, -72, { zone: 'dungeon1' });
      ED.collectRelic('stormbrand');
      ED.collectRelic('swiftboots');
      p.swingTimer = 0.22; p.swingIndex = 1;
      ED.burst(-4, 1.2, -66, 0xff8a20, 18);
      ED.burst(2, 1.0, -67, 0xffd040, 10);
      ED.updateRelicHud();
      ED.updateHud();
    } else if (shot === 'shop') {
      p.x = 13.5; p.z = 30.5; p.yaw = Math.PI * 0.5;
      p.gold = 520; p.score = 480; p.kills = 6; p.level = 2;
      ED.collectRelic('emberheart');
      ED.openShop();
      ED.updateHud();
    } else if (shot === 'win') {
      p.level = 6; p.xp = 40; p.xpNext = 138;
      p.gold = 620; p.kills = 31; p.hp = 68;
      p.score = 8200;
      p.relics = [];
      ['stormbrand', 'emberheart', 'swiftboots', 'frostward', 'lucky'].forEach(function (id) {
        if (p.relics.indexOf(id) < 0) { p.relics.push(id); ED.applyRelic(p, id); }
      });
      ED.state.elapsed = 462; // 7:42 — time bonus is computed from this live value
      ED.updateRelicHud();
      ED.state.mode = 'win';
      ED.hide('hud');
      ED.showWin();
    }
  };
})();
