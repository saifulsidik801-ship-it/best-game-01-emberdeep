// Emberdeep — main loop: input, camera, zones, objectives, run lifecycle.
(function () {
  var ED = window.ED;
  var T = THREE;
  var keys = {};
  var camYaw = Math.PI, camPitch = 0.42;
  var dragging = false, dragMoved = 0, lastX = 0, lastY = 0;
  var clock = null, raycaster = new T.Raycaster();
  var stageKills = 0, stageGoal = 0;
  var wardenSpawned = false, bossSpawned = false;
  var deaths = 0;

  ED.state = {
    mode: 'title', difficulty: 'flame', elapsed: 0,
    zone: 'hub', stage: 'hub', endless: false, endlessWave: 0,
    levelUpQueue: 0, pendingBoons: [], startTime: 0,
  };
  ED.enemies = [];

  // ---------- RUN LIFECYCLE ----------
  function resetGates() {
    Object.keys(ED.gates).forEach(function (k) {
      var g = ED.gates[k];
      g.open = false;
      g.door.visible = true;
      if (ED.walls.indexOf(g.wall) < 0) ED.walls.push(g.wall);
    });
  }
  function clearField() {
    for (var i = ED.enemies.length - 1; i >= 0; i--) ED.removeEnemy(ED.enemies[i]);
    ED.enemies.length = 0;
  }
  function resetRun(difficulty) {
    var p = ED.player;
    var diff = ED.DIFFICULTIES[difficulty];
    clearField();
    resetGates();
    ED.chestList.forEach(function (c) { c.opened = false; c.lid.rotation.x = 0; c.glow.visible = true; });
    p.x = 0; p.z = 28; p.yaw = Math.PI;
    p.maxHp = Math.round(100 * diff.playerHpMul);
    p.hp = p.maxHp; p.energy = 100;
    p.level = 1; p.xp = 0; p.xpNext = 40; p.gold = 0; p.score = 0; p.kills = 0;
    p.combo = 0; p.comboTimer = 0; p.swingTimer = 0; p.dodgeTimer = 0; p.dodgeCd = 0;
    p.skillCd = 0; p.invuln = 0; p.dead = false; p.phoenixUsed = false;
    p.mod = { dmgMul: 1, speedMul: 1, crit: 0.05, lifesteal: 0, dmgTakenMul: 1, goldMul: 1, xpMul: 1, skillCdMul: 1, thorns: 0, novaMul: 1 };
    p.relics = []; p.shopLv = { blade: 0, plate: 0, greaves: 0, charm: 0 };
    p.feats = {}; p.bestiary = {}; p.relicShelf = [];
    ED.state.mode = 'playing';
    ED.state.difficulty = difficulty;
    ED.state.elapsed = 0; ED.state.zone = 'hub'; ED.state.stage = 'hub';
    ED.state.endless = false; ED.state.endlessWave = 0; ED.state.levelUpQueue = 0;
    stageKills = 0; stageGoal = 0; wardenSpawned = false; bossSpawned = false; deaths = 0;
    camYaw = Math.PI; camPitch = 0.42;
    ED.hideAllOverlays();
    ED.show('hud');
    ED.setZone('hub');
    ED.setObjective('Explore Emberdeep Town — visit the Smithy (E), then take the north gate to the Whisperwood.');
    ED.hideBossBar();
    ED.updateRelicHud();
    ED.updateHud();
    ED.$('status').textContent = 'Delve started on ' + diff.label + ' difficulty.';
  }
  ED.startGame = function (difficulty) {
    ED.unlockAudio(); ED.startAmbient();
    resetRun(difficulty || ED.state.difficulty);
    ED.toast('The delve begins. The Whisperwood waits north.', 'gold');
  };
  ED.restartRun = function () {
    try { sessionStorage.setItem('ed-autostart', ED.state.difficulty); } catch (e) { /* ignore */ }
    location.reload();
  };

  // ---------- STAGES ----------
  function spawnStage(stage) {
    if (stage === 'forest') {
      stageGoal = 8; stageKills = 0;
      var spots = [[-12, -10], [10, -14], [-6, -26], [8, -30], [-14, -38], [12, -6], [-3, -18], [5, -40]];
      spots.forEach(function (s, i) { ED.spawnEnemy(i % 2 ? 'imp' : 'wisp', s[0], s[1], { zone: 'forest' }); });
      ED.setObjective('Clear the Whisperwood — feral wisps and imps (0/8).');
    } else if (stage === 'dungeon1') {
      stageGoal = 6; stageKills = 0;
      [[-9, -56, 'imp'], [9, -58, 'golem'], [-6, -68, 'imp'], [7, -70, 'stalker'], [0, -62, 'golem'], [-11, -66, 'imp']].forEach(function (s) {
        ED.spawnEnemy(s[2], s[0], s[1], { zone: 'dungeon1' });
      });
      ED.setObjective('Clear Sunken Hall I — stone wakes here (0/6).');
    } else if (stage === 'dungeon2') {
      stageGoal = 8; stageKills = 0;
      [[-10, -104, 'golem'], [10, -106, 'imp'], [-6, -116, 'stalker'], [6, -118, 'golem'], [0, -110, 'imp'], [-12, -112, 'stalker'], [12, -120, 'golem'], [-3, -122, 'imp']].forEach(function (s) {
        ED.spawnEnemy(s[2], s[0], s[1], { zone: 'dungeon2' });
      });
      ED.setObjective('Clear Sunken Hall II — the Vault door lies ahead (0/8).');
    } else if (stage === 'boss') {
      stageGoal = 1; stageKills = 0;
      var boss = ED.spawnEnemy('colossus', 0, -158, { zone: 'boss' });
      ED.spawnEnemy('imp', -6, -150, { zone: 'boss' });
      ED.spawnEnemy('imp', 6, -150, { zone: 'boss' });
      bossSpawned = true;
      ED.showBossBar('👑 MAGMA COLOSSUS');
      ED.updateBossBar(boss);
      ED.setObjective('SLAY THE MAGMA COLOSSUS!');
      ED.sfx('boss');
      ED.toast('👑 The Magma Colossus rises from the lava!', 'gold');
    }
  }
  function stageProgress() {
    var st = ED.state.stage;
    if (st === 'forest') ED.setObjective('Clear the Whisperwood — feral wisps and imps (' + stageKills + '/8).');
    else if (st === 'dungeon1') ED.setObjective('Clear Sunken Hall I — stone wakes here (' + stageKills + '/6).');
    else if (st === 'dungeon2') ED.setObjective('Clear Sunken Hall II — the Vault door lies ahead (' + stageKills + '/8).');
  }
  ED.onEnemyStageKill = function (e) {
    var st = ED.state.stage;
    if (e.zone && e.zone !== st && st !== 'boss') return;
    if (st === 'forest' || st === 'dungeon1' || st === 'dungeon2') {
      stageKills++;
      stageProgress();
      if (stageKills >= stageGoal) {
        if (st === 'forest' && !wardenSpawned) {
          wardenSpawned = true;
          ED.setObjective('Something vast stirs in the clearing… SLAY THE WARDEN!');
          var w = ED.spawnEnemy('warden', 0, -38, { zone: 'forest' });
          ED.showBossBar('🌳 WARDEN OF THE WOOD');
          ED.updateBossBar(w);
          ED.sfx('boss');
          ED.toast('🌳 The Warden of the Wood awakens!', 'gold');
        } else if (st === 'dungeon1') {
          ED.openGate('hall2');
          ED.setObjective('Hall I is clear! The door to Hall II stands open — press on.');
          ED.toast('The door to Hall II grinds open.', 'gold');
        } else if (st === 'dungeon2') {
          ED.openGate('boss');
          ED.setObjective('Hall II is clear! The Colossus Vault stands open — finish it.');
          ED.toast('The Vault door grinds open. The Colossus waits.', 'gold');
        }
      }
    }
  };
  ED.onBossKilled = function (e) {
    ED.hideBossBar();
    if (e.type === 'warden') {
      ED.unlockFeat('warden');
      if (deaths === 0) ED.unlockFeat('flawless');
      ED.openGate('dungeon');
      ED.state.stage = 'dungeon1';
      ED.setZone('dungeon1');
      ED.setObjective('The Warden falls! The Sunken Halls lie open — descend, Ember Knight.');
      ED.toast('The way down is open. A relic glints in the dark…', 'gold');
      var wRelic = ED.pickUnownedRelic();
      if (wRelic) ED.spawnPickup('relic', ED.rand(-3, 3), -52, 0, wRelic);
      ED.spawnPickup('heart', 2, -50);
      setTimeout(function () { spawnStage('dungeon1'); }, 400);
    } else if (e.type === 'colossus') {
      ED.unlockFeat('colossus');
      if (ED.state.elapsed < 360) ED.unlockFeat('speedy');
      if (ED.state.endless) {
        ED.state.endlessWave++;
        ED.toast('Wave ' + ED.state.endlessWave + ' cleared!', 'gold');
        ED.player.hp = Math.min(ED.player.maxHp, ED.player.hp + 30);
        setTimeout(function () { ED.startEndlessWave(ED.state.endlessWave + 1); }, 1200);
      } else {
        ED.state.mode = 'win';
        ED.hide('hud');
        ED.showWin();
      }
    }
  };
  ED.pickUnownedRelic = function () {
    var p = ED.player;
    var pool = ED.RELICS.filter(function (r) { return p.relics.indexOf(r.id) < 0; });
    if (!pool.length) return null;
    return ED.pick(pool).id;
  };
  ED.onPlayerDeath = function () {
    deaths++;
    ED.state.mode = 'dead';
    ED.hide('hud');
    ED.hideBossBar();
    ED.showDeath();
  };
  // ---------- ENDLESS ----------
  ED.startEndless = function () {
    ED.hideAllOverlays();
    ED.show('hud');
    ED.state.mode = 'playing';
    ED.state.endless = true;
    ED.state.endlessWave = 1;
    ED.state.zone = 'boss';
    ED.setZone('boss');
    var p = ED.player;
    p.dead = false; p.hp = p.maxHp; p.x = 0; p.z = -146; p.yaw = Math.PI;
    ED.startEndlessWave(1);
  };
  ED.startEndlessWave = function (n) {
    ED.state.endlessWave = n;
    var count = 3 + n;
    var types = ['imp', 'wisp', 'stalker', 'golem'];
    for (var i = 0; i < count; i++) {
      var t = types[Math.floor(Math.random() * (n >= 3 ? 4 : 3))];
      ED.spawnEnemy(t, ED.rand(-11, 11), ED.rand(-164, -146), { zone: 'boss', endless: true, hpMul: 1 + (n - 1) * 0.12 });
    }
    if (n % 3 === 0) ED.spawnEnemy('golem', 0, -160, { zone: 'boss', endless: true, hpMul: 1 + (n - 1) * 0.15 });
    ED.setObjective('ENDLESS — Wave ' + n + ': clear every foe! (' + ED.enemies.length + ' remain)');
    ED.toast('🌊 Endless Wave ' + n + '!', 'gold');
    ED.checkFeats();
  };
  ED.onEndlessKill = function () {
    if (!ED.state.endless || ED.state.mode !== 'playing') return;
    var left = ED.enemies.filter(function (e) { return !e.dead; }).length;
    if (left === 0) {
      ED.player.hp = Math.min(ED.player.maxHp, ED.player.hp + 25);
      ED.player.gold += 50;
      ED.toast('Wave ' + ED.state.endlessWave + ' cleared! +50 gold, +25 HP.', 'gold');
      scheduleNextWave();
    } else {
      ED.setObjective('ENDLESS — Wave ' + ED.state.endlessWave + ': clear every foe! (' + left + ' remain)');
    }
  };
  // Next wave waits out level-up / pause overlays instead of giving up.
  function scheduleNextWave() {
    setTimeout(function () {
      if (!ED.state.endless) return;
      if (ED.state.mode === 'playing') ED.startEndlessWave(ED.state.endlessWave + 1);
      else if (ED.state.mode === 'levelup' || ED.state.mode === 'paused' || ED.state.mode === 'shop') scheduleNextWave();
    }, 1500);
  }

  // ---------- LEVEL-UP ----------
  ED.queueLevelUp = function () { ED.state.levelUpQueue++; };
  ED.showPendingLevelUp = function () {
    var pool = ED.BOONS.slice();
    var choices = [];
    for (var i = 0; i < 3; i++) choices.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    ED.state.pendingBoons = choices;
    ED.state.mode = 'levelup';
    ED.showLevelUp(choices);
  };
  ED.pickBoon = function (boon) {
    boon.apply(ED.player);
    ED.sfx('levelup');
    ED.toast('Boon: ' + boon.name + ' — ' + boon.desc, 'gold');
    ED.state.levelUpQueue--;
    ED.hideLevelUp();
    if (ED.state.levelUpQueue > 0) ED.showPendingLevelUp();
    else ED.state.mode = 'playing';
    ED.updateHud();
  };
  // ---------- SHOP ----------
  ED.buyShopItem = function (id) {
    var p = ED.player;
    var item = ED.SHOP.find(function (x) { return x.id === id; });
    var lv = p.shopLv[id];
    if (lv >= 3) return;
    var cost = item.costs[lv];
    if (p.gold < cost) return;
    p.gold -= cost;
    p.shopLv[id] = lv + 1;
    if (id === 'blade') p.mod.dmgMul *= 1.15;
    if (id === 'plate') { p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp + 30); }
    if (id === 'greaves') p.mod.speedMul *= 1.08;
    if (id === 'charm') p.mod.skillCdMul *= 0.85;
    ED.sfx('coin');
    ED.toast(item.name + ' upgraded to Lv ' + (lv + 1) + '!', 'gold');
    ED.openShop();
  };
  ED.buyRelic = function (id) {
    var p = ED.player;
    if (p.gold < 150) return;
    p.gold -= 150;
    p.relicShelf = p.relicShelf.filter(function (x) { return x !== id; });
    ED.collectRelic(id);
    ED.openShop();
  };

  // ---------- INPUT ----------
  function bindInput() {
    window.addEventListener('keydown', function (ev) {
      if (ev.repeat) return;
      keys[ev.code] = true;
      if (ev.code === 'Space') { ev.preventDefault(); ED.tryDodge(); }
      if (ev.code === 'KeyQ') ED.trySkill();
      if (ev.code === 'KeyJ') ED.tryAttack();
      if (ev.code === 'KeyE') ED.interact();
      if (ev.code === 'KeyM') { var m = ED.toggleMute(); ED.toast(m ? 'Sound muted.' : 'Sound on.'); }
      if (ev.code === 'KeyI') {
        if (ED.state.mode === 'playing') { ED.state.mode = 'paused'; ED.openAlmanac(); }
        else if (ED.isShown('almanacScreen')) { ED.closeAlmanac(); if (ED.state.mode === 'paused') ED.resumeGame(); }
      }
      if (ev.code === 'KeyP' || ev.code === 'Escape') {
        if (ED.state.mode === 'playing') ED.pauseGame();
        else if (ED.state.mode === 'paused' && !ED.isShown('almanacScreen')) ED.resumeGame();
      }
      if (ED.state.mode === 'levelup') {
        if (ev.code === 'Digit1') ED.pickBoon(ED.state.pendingBoons[0]);
        if (ev.code === 'Digit2') ED.pickBoon(ED.state.pendingBoons[1]);
        if (ev.code === 'Digit3') ED.pickBoon(ED.state.pendingBoons[2]);
      }
    });
    window.addEventListener('keyup', function (ev) { keys[ev.code] = false; });
    var canvas = ED.$('game');
    canvas.addEventListener('pointerdown', function (ev) {
      dragging = true; dragMoved = 0; lastX = ev.clientX; lastY = ev.clientY;
      ED.unlockAudio(); ED.startAmbient();
    });
    window.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      var dx = ev.clientX - lastX, dy = ev.clientY - lastY;
      dragMoved += Math.abs(dx) + Math.abs(dy);
      lastX = ev.clientX; lastY = ev.clientY;
      camYaw -= dx * 0.005;
      camPitch = ED.clamp(camPitch + dy * 0.004, 0.12, 1.1);
    });
    window.addEventListener('pointerup', function (ev) {
      if (dragging && dragMoved < 6 && ev.target === canvas) {
        // click = attack toward the clicked ground point
        var nx = (ev.clientX / window.innerWidth) * 2 - 1;
        var ny = -(ev.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera({ x: nx, y: ny }, ED.camera);
        var origin = raycaster.ray.origin, dir = raycaster.ray.direction;
        if (dir.y < -0.05) {
          var t = -origin.y / dir.y;
          var px = origin.x + dir.x * t, pz = origin.z + dir.z * t;
          var p = ED.player;
          if (p) p.yaw = Math.atan2(px - p.x, pz - p.z);
        }
        ED.tryAttack();
      }
      dragging = false;
    });
    // menu buttons
    ED.$('startBtn').addEventListener('click', function () { ED.sfx('click'); ED.startGame(ED.state.difficulty); });
    ED.$('howBtn').addEventListener('click', function () {
      var p = ED.$('howPanel');
      p.classList.toggle('hidden');
    });
    document.querySelectorAll('.diffBtn').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.diffBtn').forEach(function (x) { x.classList.remove('sel'); });
        b.classList.add('sel');
        ED.state.difficulty = b.getAttribute('data-diff');
        ED.sfx('click');
      });
    });
    ED.$('resumeBtn').addEventListener('click', function () { ED.resumeGame(); });
    ED.$('restartBtn').addEventListener('click', function () { ED.restartRun(); });
    ED.$('quitBtn').addEventListener('click', function () { location.reload(); });
    ED.$('almanacBtn').addEventListener('click', function () { ED.openAlmanac(); });
    ED.$('closeAlmanacBtn').addEventListener('click', function () {
      ED.closeAlmanac();
      if (ED.state.mode === 'paused' && !ED.isShown('pauseScreen')) ED.resumeGame();
    });
    ED.$('closeShopBtn').addEventListener('click', function () { ED.closeShop(); });
    ED.$('retryBtn').addEventListener('click', function () { ED.restartRun(); });
    ED.$('deadTitleBtn').addEventListener('click', function () { location.reload(); });
    ED.$('againBtn').addEventListener('click', function () { ED.restartRun(); });
    ED.$('winTitleBtn').addEventListener('click', function () { location.reload(); });
    ED.$('endlessBtn').addEventListener('click', function () { ED.startEndless(); });
  }
  ED.setCamera = function (yaw, pitch) {
    camYaw = yaw;
    if (pitch !== undefined) camPitch = pitch;
  };
  ED.pauseGame = function () {
    if (ED.state.mode !== 'playing') return;
    ED.state.mode = 'paused';
    ED.show('pauseScreen');
  };
  ED.resumeGame = function () {
    ED.hide('pauseScreen');
    ED.closeAlmanac();
    if (ED.state.mode === 'paused') ED.state.mode = 'playing';
  };
  ED.interact = function () {
    var p = ED.player;
    if (!p || p.dead || ED.state.mode !== 'playing') return;
    var it = ED.nearInteract;
    if (!it) return;
    if (it.type === 'smith') { ED.openShop(); ED.sfx('click'); }
    else if (it.type === 'chest') {
      var ch = it.chest;
      ch.opened = true;
      ch.lid.rotation.x = -1.1;
      ch.glow.visible = false;
      ED.sfx('chest');
      var relic = ED.pickUnownedRelic();
      if (relic) ED.spawnPickup('relic', ch.x + 1.5, ch.z + 1, 0, relic);
      else ED.spawnPickup('gold', ch.x + 1.5, ch.z + 1, 100);
      ED.toast('The chest creaks open…', 'gold');
    } else if (it.type === 'gate') {
      if (ED.openGate(it.gate)) {
        ED.toast('The gate grinds open!', 'gold');
        if (it.gate === 'forest') {
          ED.state.stage = 'forest'; ED.state.zone = 'forest'; ED.setZone('forest');
          spawnStage('forest');
        } else if (it.gate === 'dungeon') {
          ED.state.zone = 'dungeon1'; ED.setZone('dungeon1');
          ED.setObjective('Descend! Clear Sunken Hall I (0/6).');
        }
      }
    }
  };

  // ---------- ZONE DETECTION ----------
  function detectZone() {
    var p = ED.player;
    var z = p.z;
    var zone = z > 7 ? 'hub' : z > -47 ? 'forest' : z > -80 ? 'dungeon1' : z > -96 ? 'dungeon1' : z > -128 ? 'dungeon2' : z > -140 ? 'dungeon2' : 'boss';
    if (zone !== ED.state.zone) {
      ED.state.zone = zone;
      ED.setZone(zone);
      if (zone === 'forest' && ED.state.stage === 'forest') ED.setObjective('Clear the Whisperwood — feral wisps and imps (' + stageKills + '/8).');
      if (zone === 'dungeon2' && ED.state.stage === 'dungeon1') {
        ED.state.stage = 'dungeon2';
        spawnStage('dungeon2');
      }
      if (zone === 'boss' && ED.state.stage === 'dungeon2') {
        ED.state.stage = 'boss';
        spawnStage('boss');
      }
    }
  }
  function detectInteract() {
    var p = ED.player;
    ED.nearInteract = null;
    if (ED.state.mode !== 'playing') { ED.hideInteract(); return; }
    // smith (near smithy, hub)
    if (ED.dist2d(p.x, p.z, 14.2, 32.4) < 3.2) {
      ED.nearInteract = { type: 'smith' };
      ED.showInteract('[E] Talk to Smith Bram — open the Ember Smithy');
      return;
    }
    // chests
    for (var i = 0; i < ED.chestList.length; i++) {
      var c = ED.chestList[i];
      if (!c.opened && ED.dist2d(p.x, p.z, c.x, c.z) < 2.2) {
        ED.nearInteract = { type: 'chest', chest: c };
        ED.showInteract('[E] Open the ember chest');
        return;
      }
    }
    // gates
    var gateChecks = [
      { gate: 'forest', x: 0, z: 7, label: '[E] Enter the Whisperwood', ok: ED.state.stage === 'hub' },
      { gate: 'dungeon', x: 0, z: -47, label: '[E] Descend into the Sunken Halls', ok: wardenSpawned && ED.enemies.filter(function (e) { return e.type === 'warden'; }).length === 0 },
    ];
    for (var g = 0; g < gateChecks.length; g++) {
      var gc = gateChecks[g];
      if (gc.ok && ED.dist2d(p.x, p.z, gc.x, gc.z) < 3.5) {
        ED.nearInteract = { type: 'gate', gate: gc.gate };
        ED.showInteract(gc.label);
        return;
      }
    }
    ED.hideInteract();
  }

  // ---------- PLAYER UPDATE ----------
  function updatePlayer(dt, t) {
    var p = ED.player;
    if (p.dead) return;
    // timers
    if (p.swingTimer > 0) p.swingTimer -= dt;
    if (p.skillCd > 0) p.skillCd -= dt;
    if (p.dodgeCd > 0) p.dodgeCd -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.hurtTimer > 0) p.hurtTimer -= dt;
    if (p.comboTimer > 0) { p.comboTimer -= dt; if (p.comboTimer <= 0) p.combo = 0; }
    p.energy = Math.min(p.maxEnergy, p.energy + 8 * dt);
    // movement (WASD relative to camera)
    var fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    var rx = -fz, rz = fx;
    var mx = 0, mz = 0;
    if (keys.KeyW || keys.ArrowUp) { mx += fx; mz += fz; }
    if (keys.KeyS || keys.ArrowDown) { mx -= fx; mz -= fz; }
    if (keys.KeyA || keys.ArrowLeft) { mx -= rx; mz -= rz; }
    if (keys.KeyD || keys.ArrowRight) { mx += rx; mz += rz; }
    var moving = (mx !== 0 || mz !== 0);
    if (p.dodgeTimer > 0) {
      p.dodgeTimer -= dt;
      var ds = 16 * dt;
      var c = ED.collide(p.x + Math.sin(p.dodgeDir) * ds, p.z + Math.cos(p.dodgeDir) * ds, 0.6);
      p.x = c[0]; p.z = c[1];
      p.group.rotation.x = -0.9; // roll tuck
    } else {
      p.group.rotation.x = 0;
      if (moving) {
        var len = Math.sqrt(mx * mx + mz * mz);
        mx /= len; mz /= len;
        var sp = p.speed * p.mod.speedMul;
        var nc = ED.collide(p.x + mx * sp * dt, p.z + mz * sp * dt, 0.6);
        p.x = nc[0]; p.z = nc[1];
        p.yaw = Math.atan2(mx, mz);
      }
    }
    // visuals
    var walkPhase = moving ? t * 11 : 0;
    p.group.position.set(p.x, moving && p.dodgeTimer <= 0 ? Math.abs(Math.sin(walkPhase)) * 0.08 : 0, p.z);
    p.group.rotation.y = p.yaw;
    p.cape.rotation.x = 0.15 + (moving ? 0.35 : 0) + Math.sin(t * 2) * 0.03;
    if (p.swingTimer > 0) {
      var sw = 1 - p.swingTimer / 0.34;
      p.armR.rotation.x = -1.9 + sw * 2.6;
      p.armR.rotation.z = p.swingIndex === 2 ? -0.6 + sw * 0.6 : 0.4 - sw * 0.8;
    } else {
      p.armR.rotation.x = ED.lerp(p.armR.rotation.x, 0, dt * 10);
      p.armR.rotation.z = ED.lerp(p.armR.rotation.z, 0, dt * 10);
    }
    p.bladeGlow.material.opacity = 0.2 + Math.sin(t * 3) * 0.1 + (p.swingTimer > 0 ? 0.4 : 0);
    // hurt flash: tint body red briefly
    p.group.traverse(function (o) {
      if (o.isMesh && o.material && o.material.emissive) {
        o.material.emissiveIntensity = p.hurtTimer > 0 ? 0.9 : (o.userData.baseEi !== undefined ? o.userData.baseEi : 1);
      }
    });
  }
  function updateCamera(dt) {
    var p = ED.player;
    var dist = 9.5, height = 5.2;
    var tx, tz, ty;
    if (ED.state.mode === 'title') {
      var a = performance.now() * 0.00008;
      tx = Math.sin(a) * 16; tz = 28 + Math.cos(a) * 16; ty = 7;
      ED.camera.position.set(tx, ty, tz);
      ED.camera.lookAt(0, 1.5, 28);
      return;
    }
    tx = p.x + Math.sin(camYaw) * dist;
    tz = p.z + Math.cos(camYaw) * dist;
    ty = height + Math.sin(camPitch - 0.42) * 4;
    ED.camera.position.x = ED.lerp(ED.camera.position.x, tx, 1 - Math.pow(0.001, dt));
    ED.camera.position.y = ED.lerp(ED.camera.position.y, ty, 1 - Math.pow(0.001, dt));
    ED.camera.position.z = ED.lerp(ED.camera.position.z, tz, 1 - Math.pow(0.001, dt));
    ED.camera.lookAt(p.x, 1.6, p.z);
  }

  // ---------- MAIN LOOP ----------
  function loop() {
    requestAnimationFrame(loop);
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;
    if (ED.state.mode === 'playing') {
      ED.state.elapsed += dt;
      updatePlayer(dt, t);
      ED.updateEnemies(dt, t);
      ED.updatePickups(dt, t);
      ED.updateTelegraphs(dt);
      ED.updateBursts(dt);
      ED.updateFloatTexts(dt);
      detectZone();
      detectInteract();
      // stage kill accounting is event-driven via killEnemy -> onEnemyStageKill; also check endless
      if (ED.state.levelUpQueue > 0) ED.showPendingLevelUp();
      ED.updateHud();
    } else if (ED.state.mode === 'title') {
      ED.updateBursts(dt);
    }
    ED.updateWorld(dt, t);
    updateCamera(dt);
    ED.renderer.render(ED.scene, ED.camera);
  }

  // Hook killEnemy to also run stage accounting (wrapped after entities load).
  function installHooks() {
    var origKill = ED.killEnemy;
    ED.killEnemy = function (e, silent) {
      var wasBoss = e.def.boss;
      origKill(e, silent);
      if (!wasBoss) {
        ED.onEnemyStageKill(e);
        ED.onEndlessKill();
      }
    };
  }

  // ---------- BOOT ----------
  ED.boot = function () {
    ED.buildWorld();
    ED.player = ED.createPlayer();
    ED.player.group.position.set(0, 0, 28);
    bindInput();
    installHooks();
    clock = new T.Clock();
    // fps tag
    var frames = 0, lastFpsT = performance.now();
    setInterval(function () {
      var now = performance.now();
      var fps = Math.round(frames * 1000 / (now - lastFpsT));
      frames = 0; lastFpsT = now;
      ED.$('fpsTag').textContent = 'Emberdeep · ' + fps + ' fps · ' + ED.state.mode;
    }, 1000);
    var origRender = ED.renderer.render.bind(ED.renderer);
    ED.renderer.render = function () { frames++; return origRender.apply(null, arguments); };
    // autostart (restart flow)
    var auto = null;
    try { auto = sessionStorage.getItem('ed-autostart'); sessionStorage.removeItem('ed-autostart'); } catch (e) { /* ignore */ }
    if (auto && ED.DIFFICULTIES[auto]) {
      document.querySelectorAll('.diffBtn').forEach(function (x) { x.classList.toggle('sel', x.getAttribute('data-diff') === auto); });
      ED.startGame(auto);
    }
    ED.shotsInit();
    loop();
  };

  // Debug handle for playtests and screenshot hooks.
  window.__ED = {
    state: function () {
      var p = ED.player;
      return {
        mode: ED.state.mode, zone: ED.state.zone, stage: ED.state.stage,
        hp: p ? Math.round(p.hp) : 0, maxHp: p ? p.maxHp : 0,
        gold: p ? p.gold : 0, score: p ? p.score : 0, kills: p ? p.kills : 0,
        level: p ? p.level : 0, enemies: ED.enemies.length,
        relics: p ? p.relics.slice() : [], elapsed: ED.state.elapsed,
        endless: ED.state.endless, endlessWave: ED.state.endlessWave,
        gates: { forest: ED.isGateOpen('forest'), dungeon: ED.isGateOpen('dungeon'), hall2: ED.isGateOpen('hall2'), boss: ED.isGateOpen('boss') },
      };
    },
    start: function (d) { ED.startGame(d || 'flame'); },
    teleport: function (x, z) { var p = ED.player; p.x = x; p.z = z; },
    killAll: function () { ED.enemies.slice().forEach(function (e) { ED.killEnemy(e); }); },
    win: function () { ED.state.mode = 'win'; ED.hide('hud'); ED.showWin(); },
    ED: ED,
  };
  document.addEventListener('DOMContentLoaded', function () { ED.boot(); });
})();
