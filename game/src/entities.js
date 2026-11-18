// Emberdeep — entities: the Ember Knight player, foes, and the two bosses.
// Models are built from primitives; AI is patrol / chase / attack with
// telegraphed boss slams.
(function () {
  var ED = window.ED;
  var T = THREE;
  var scene = null;

  function mat(color, opts) {
    var o = opts || {};
    return new T.MeshStandardMaterial({
      color: color, roughness: o.rough === undefined ? 0.85 : o.rough,
      metalness: o.metal || 0, emissive: o.emissive || 0x000000,
      emissiveIntensity: o.ei === undefined ? 1 : o.ei,
      transparent: !!o.transparent, opacity: o.opacity === undefined ? 1 : o.opacity,
    });
  }
  function blobShadow(parent, r) {
    var s = new T.Mesh(new T.CircleGeometry(r, 20),
      new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    s.rotation.x = -Math.PI / 2; s.position.y = 0.03; parent.add(s); return s;
  }
  function hpBar(parent, w) {
    var g = new T.Group();
    var bg = new T.Mesh(new T.PlaneGeometry(w, 0.14), new T.MeshBasicMaterial({ color: 0x1a0d08, transparent: true, opacity: 0.85, depthWrite: false }));
    var fg = new T.Mesh(new T.PlaneGeometry(w, 0.1), new T.MeshBasicMaterial({ color: 0xff3a2a, depthWrite: false }));
    fg.position.z = 0.01;
    g.add(bg); g.add(fg);
    g.position.y = 2.4;
    parent.add(g);
    return { group: g, fg: fg, w: w };
  }

  // ---------- PLAYER ----------
  ED.createPlayer = function () {
    scene = ED.scene;
    var g = new T.Group();
    // body: ember-orange tunic over steel
    var body = new T.Mesh(new T.CapsuleGeometry(0.42, 0.7, 4, 10), mat(0xc85a1a, { rough: 0.7 }));
    body.position.y = 1.05; g.add(body);
    var belt = new T.Mesh(new T.CylinderGeometry(0.44, 0.46, 0.16, 10), mat(0x5a3a1a));
    belt.position.y = 0.85; g.add(belt);
    var head = new T.Mesh(new T.SphereGeometry(0.3, 12, 10), mat(0xe8b88a));
    head.position.y = 1.85; g.add(head);
    var helm = new T.Mesh(new T.ConeGeometry(0.32, 0.55, 10), mat(0x8a8f96, { metal: 0.8, rough: 0.35 }));
    helm.position.y = 2.1; g.add(helm);
    var plume = new T.Mesh(new T.BoxGeometry(0.08, 0.5, 0.4), mat(0xff5a1a, { emissive: 0x661100, ei: 0.8 }));
    plume.position.set(0, 2.35, -0.05); g.add(plume);
    // cape
    var cape = new T.Mesh(new T.PlaneGeometry(0.8, 1.1), mat(0x7a1a1a, { rough: 0.9 }));
    cape.position.set(0, 1.2, -0.42); cape.rotation.x = 0.15; g.add(cape);
    // sword arm (right): pivot group for swings
    var armR = new T.Group(); armR.position.set(0.5, 1.45, 0); g.add(armR);
    var armMesh = new T.Mesh(new T.CapsuleGeometry(0.13, 0.4, 4, 8), mat(0xc85a1a));
    armMesh.position.y = -0.2; armR.add(armMesh);
    var sword = new T.Group(); sword.position.set(0, -0.45, 0.1); armR.add(sword);
    var grip = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.35, 6), mat(0x2a1a0a));
    sword.add(grip);
    var guard = new T.Mesh(new T.BoxGeometry(0.3, 0.06, 0.08), mat(0xf5b942, { metal: 0.8, rough: 0.3 }));
    guard.position.y = -0.2; sword.add(guard);
    var blade = new T.Mesh(new T.BoxGeometry(0.12, 1.15, 0.03),
      mat(0xd8dce2, { metal: 0.9, rough: 0.2, emissive: 0x442200, ei: 0.6 }));
    blade.position.y = -0.85; sword.add(blade);
    var bladeGlow = new T.Mesh(new T.BoxGeometry(0.14, 1.1, 0.02),
      new T.MeshBasicMaterial({ color: 0xff8a20, transparent: true, opacity: 0.25, blending: T.AdditiveBlending, depthWrite: false }));
    bladeGlow.position.y = -0.85; sword.add(bladeGlow);
    // shield arm (left)
    var shield = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.08, 12), mat(0x5a6a8a, { metal: 0.7, rough: 0.4 }));
    shield.rotation.z = Math.PI / 2; shield.position.set(-0.55, 1.2, 0.15); g.add(shield);
    var boss = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), mat(0xf5b942, { metal: 0.8 }));
    boss.position.set(-0.6, 1.2, 0.15); g.add(boss);
    blobShadow(g, 0.7);
    scene.add(g);
    return {
      group: g, armR: armR, sword: sword, cape: cape, bladeGlow: bladeGlow,
      x: 0, z: 28, yaw: Math.PI, speed: 7.5,
      hp: 100, maxHp: 100, energy: 100, maxEnergy: 100,
      level: 1, xp: 0, xpNext: 40, gold: 0, score: 0, kills: 0,
      combo: 0, comboTimer: 0, swingTimer: 0, swingIndex: 0,
      dodgeTimer: 0, dodgeCd: 0, dodgeDir: 0, invuln: 0,
      skillCd: 0, skillTimer: 0, hurtTimer: 0, dead: false,
      mod: { dmgMul: 1, speedMul: 1, crit: 0.05, lifesteal: 0, dmgTakenMul: 1, goldMul: 1, xpMul: 1, skillCdMul: 1, thorns: 0, novaMul: 1 },
      relics: [], shopLv: { blade: 0, plate: 0, greaves: 0, charm: 0 },
      feats: {}, bestiary: {}, relicShelf: [],
    };
  };

  // ---------- ENEMIES ----------
  function buildEnemyMesh(type) {
    var g = new T.Group();
    var def = ED.ENEMIES[type];
    if (type === 'wisp') {
      var orb = new T.Mesh(new T.SphereGeometry(0.45, 12, 10),
        new T.MeshBasicMaterial({ color: def.color }));
      orb.position.y = 1.1; g.add(orb);
      var halo = new T.Mesh(new T.SphereGeometry(0.7, 12, 10),
        new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.25, blending: T.AdditiveBlending, depthWrite: false }));
      halo.position.y = 1.1; g.add(halo);
      var eye1 = new T.Mesh(new T.SphereGeometry(0.07, 6, 6), new T.MeshBasicMaterial({ color: 0x1a0a00 }));
      eye1.position.set(-0.15, 1.15, 0.4); g.add(eye1);
      var eye2 = eye1.clone(); eye2.position.x = 0.15; g.add(eye2);
      g.userData.bob = orb;
    } else if (type === 'imp') {
      var body = new T.Mesh(new T.ConeGeometry(0.55, 1.2, 8), mat(def.color));
      body.position.y = 0.7; g.add(body);
      var head = new T.Mesh(new T.SphereGeometry(0.32, 10, 8), mat(0xe84a2a));
      head.position.y = 1.5; g.add(head);
      var hornL = new T.Mesh(new T.ConeGeometry(0.09, 0.4, 6), mat(0x2a1a0a));
      hornL.position.set(-0.2, 1.8, 0); hornL.rotation.z = 0.4; g.add(hornL);
      var hornR = hornL.clone(); hornR.position.x = 0.2; hornR.rotation.z = -0.4; g.add(hornR);
      var eye = new T.Mesh(new T.SphereGeometry(0.06, 6, 6), new T.MeshBasicMaterial({ color: 0xffe040 }));
      eye.position.set(-0.12, 1.55, 0.28); g.add(eye);
      var eye2i = eye.clone(); eye2i.position.x = 0.12; g.add(eye2i);
    } else if (type === 'golem') {
      var torso = new T.Mesh(new T.BoxGeometry(1.4, 1.5, 0.9), mat(def.color, { rough: 0.95 }));
      torso.position.y = 1.35; g.add(torso);
      var headG = new T.Mesh(new T.BoxGeometry(0.6, 0.5, 0.6), mat(0x6a6f76));
      headG.position.y = 2.35; g.add(headG);
      var eyeG = new T.Mesh(new T.BoxGeometry(0.5, 0.1, 0.1), new T.MeshBasicMaterial({ color: 0xff5a10 }));
      eyeG.position.set(0, 2.35, 0.32); g.add(eyeG);
      var armL = new T.Mesh(new T.BoxGeometry(0.45, 1.3, 0.45), mat(0x7a7f86));
      armL.position.set(-0.95, 1.3, 0); g.add(armL);
      var armR = armL.clone(); armR.position.x = 0.95; g.add(armR);
      var legL = new T.Mesh(new T.BoxGeometry(0.5, 0.6, 0.5), mat(0x6a6f76));
      legL.position.set(-0.35, 0.3, 0); g.add(legL);
      var legR = legL.clone(); legR.position.x = 0.35; g.add(legR);
      var moss = new T.Mesh(new T.BoxGeometry(1.0, 0.2, 0.95), mat(0x3f6a2a));
      moss.position.y = 2.12; g.add(moss);
    } else if (type === 'stalker') {
      var sbody = new T.Mesh(new T.ConeGeometry(0.5, 1.5, 6), mat(def.color, { rough: 0.6 }));
      sbody.position.y = 0.85; g.add(sbody);
      var hood = new T.Mesh(new T.ConeGeometry(0.4, 0.9, 6), mat(0x2a1a3a));
      hood.position.y = 1.8; g.add(hood);
      var eyeS = new T.Mesh(new T.SphereGeometry(0.08, 6, 6), new T.MeshBasicMaterial({ color: 0xc98aff }));
      eyeS.position.set(-0.12, 1.7, 0.32); g.add(eyeS);
      var eyeS2 = eyeS.clone(); eyeS2.position.x = 0.12; g.add(eyeS2);
      var scythe = new T.Mesh(new T.BoxGeometry(0.06, 1.6, 0.06), mat(0x3a3a3a, { metal: 0.7 }));
      scythe.position.set(0.6, 1.1, 0.2); scythe.rotation.z = 0.3; g.add(scythe);
    } else if (type === 'warden') {
      var trunk = new T.Mesh(new T.CylinderGeometry(0.7, 1.1, 2.6, 8), mat(0x4a3520));
      trunk.position.y = 1.3; g.add(trunk);
      var canopy = new T.Mesh(new T.SphereGeometry(1.6, 10, 8), mat(0x2a6a2a));
      canopy.position.y = 3.4; canopy.scale.y = 0.75; g.add(canopy);
      var canopy2 = new T.Mesh(new T.SphereGeometry(1.1, 10, 8), mat(0x3f8a3f));
      canopy2.position.set(0.8, 4.2, 0.3); g.add(canopy2);
      var face = new T.Mesh(new T.BoxGeometry(0.9, 0.5, 0.2), new T.MeshBasicMaterial({ color: 0xffe040 }));
      face.position.set(0, 1.6, 0.95); g.add(face);
      var armW = new T.Mesh(new T.CylinderGeometry(0.22, 0.3, 2.2, 6), mat(0x4a3520));
      armW.position.set(-1.2, 1.8, 0); armW.rotation.z = 0.7; g.add(armW);
      var armW2 = armW.clone(); armW2.position.x = 1.2; armW2.rotation.z = -0.7; g.add(armW2);
      var roots = new T.Mesh(new T.ConeGeometry(1.2, 0.7, 8), mat(0x3a2a18));
      roots.position.y = 0.3; g.add(roots);
    } else if (type === 'colossus') {
      var cbody = new T.Mesh(new T.BoxGeometry(2.6, 2.6, 1.8), mat(0x3a2a24, { rough: 0.95 }));
      cbody.position.y = 1.9; g.add(cbody);
      var lava = new T.Mesh(new T.BoxGeometry(2.7, 0.5, 1.9),
        new T.MeshBasicMaterial({ color: 0xff5a10 }));
      lava.position.y = 1.9; g.add(lava);
      var chead = new T.Mesh(new T.BoxGeometry(1.1, 0.9, 1.0), mat(0x2a1e1a));
      chead.position.y = 3.6; g.add(chead);
      var ceye = new T.Mesh(new T.BoxGeometry(0.9, 0.16, 0.1), new T.MeshBasicMaterial({ color: 0xffd040 }));
      ceye.position.set(0, 3.65, 0.52); g.add(ceye);
      var crown = new T.Mesh(new T.ConeGeometry(0.35, 0.9, 4), mat(0x1a1a1a, { metal: 0.6 }));
      crown.position.set(-0.4, 4.3, 0); g.add(crown);
      var crown2 = crown.clone(); crown2.position.x = 0.4; g.add(crown2);
      var carmL = new T.Mesh(new T.BoxGeometry(0.8, 2.4, 0.8), mat(0x3a2a24));
      carmL.position.set(-1.8, 1.9, 0); g.add(carmL);
      var carmR = carmL.clone(); carmR.position.x = 1.8; g.add(carmR);
      var fistL = new T.Mesh(new T.BoxGeometry(1.0, 0.9, 1.0), mat(0x554444));
      fistL.position.set(-1.8, 0.6, 0); g.add(fistL);
      var fistR = fistL.clone(); fistR.position.x = 1.8; g.add(fistR);
      var legC = new T.Mesh(new T.BoxGeometry(0.9, 0.8, 0.9), mat(0x2a1e1a));
      legC.position.set(-0.7, 0.4, 0); g.add(legC);
      var legC2 = legC.clone(); legC2.position.x = 0.7; g.add(legC2);
      g.userData.armL = carmL; g.userData.armR = carmR;
    }
    blobShadow(g, def.radius * 0.9);
    return g;
  }

  ED.spawnEnemy = function (type, x, z, opts) {
    var def = ED.ENEMIES[type];
    var diff = ED.DIFFICULTIES[ED.state.difficulty];
    var o = opts || {};
    var mesh = buildEnemyMesh(type);
    mesh.position.set(x, 0, z);
    ED.scene.add(mesh);
    var bar = hpBar(mesh, def.boss ? 3.2 : 1.3);
    bar.group.position.y = def.boss ? 5.2 : 2.3;
    var e = {
      type: type, def: def, mesh: mesh, bar: bar,
      x: x, z: z, hp: def.hp * diff.hpMul * (o.hpMul || 1), maxHp: def.hp * diff.hpMul * (o.hpMul || 1),
      dmg: def.dmg * diff.dmgMul, speed: def.speed * ED.rand(0.9, 1.1),
      radius: def.radius, xp: def.xp, gold: def.gold,
      state: 'patrol', atkCd: ED.rand(0, 1), hitTimer: 0, windup: 0,
      patrolX: x, patrolZ: z, patrolTarget: null, wanderT: 0,
      slamTimer: 4, summonTimer: 8, chargeTimer: 6, phase: Math.random() * 10,
      dead: false, burnTimer: 0, burnDps: 0, endless: !!o.endless,
    };
    if (o.zone) e.zone = o.zone;
    ED.enemies.push(e);
    return e;
  };

  ED.removeEnemy = function (e) {
    ED.scene.remove(e.mesh);
    var i = ED.enemies.indexOf(e);
    if (i >= 0) ED.enemies.splice(i, 1);
  };

  // ---------- ENEMY AI ----------
  ED.updateEnemies = function (dt, t) {
    var p = ED.player;
    for (var i = ED.enemies.length - 1; i >= 0; i--) {
      var e = ED.enemies[i];
      if (e.dead) continue;
      var dx = p.x - e.x, dz = p.z - e.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (e.burnTimer > 0) {
        e.burnTimer -= dt;
        e.hp -= e.burnDps * dt;
        if (e.hp <= 0) { ED.killEnemy(e, true); continue; }
      }
      if (e.hitTimer > 0) e.hitTimer -= dt;
      if (e.atkCd > 0) e.atkCd -= dt;
      var speed = e.speed;
      if (e.def.boss) {
        updateBoss(e, dt, t, dist, dx, dz);
      } else if (dist < e.def.aggro && !p.dead) {
        e.state = 'chase';
        if (dist > e.radius + 0.9) {
          var step = speed * dt;
          var nx = e.x + dx / dist * step, nz = e.z + dz / dist * step;
          var c = ED.collide(nx, nz, e.radius);
          e.x = c[0]; e.z = c[1];
        } else if (e.atkCd <= 0) {
          // attack the player
          e.atkCd = 1.1;
          e.windup = 0.35;
          e.windupTarget = true;
        }
      } else {
        e.state = 'patrol';
        e.wanderT -= dt;
        if (e.wanderT <= 0) {
          e.patrolTarget = [e.patrolX + ED.rand(-4, 4), e.patrolZ + ED.rand(-4, 4)];
          e.wanderT = ED.rand(2, 5);
        }
        if (e.patrolTarget) {
          var pdx = e.patrolTarget[0] - e.x, pdz = e.patrolTarget[1] - e.z;
          var pd = Math.sqrt(pdx * pdx + pdz * pdz);
          if (pd > 0.3) {
            var ps = speed * 0.4 * dt;
            var nc = ED.collide(e.x + pdx / pd * ps, e.z + pdz / pd * ps, e.radius);
            e.x = nc[0]; e.z = nc[1];
            e.mesh.rotation.y = Math.atan2(pdx, pdz);
          }
        }
      }
      // windup strike lands
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0 && e.windupTarget) {
          e.windupTarget = false;
          var d2 = ED.dist2d(e.x, e.z, p.x, p.z);
          if (d2 < e.radius + 1.5 && p.invuln <= 0 && !p.dead) ED.hurtPlayer(e.dmg, e);
        }
      }
      // face the player when chasing
      if (e.state === 'chase') e.mesh.rotation.y = Math.atan2(dx, dz);
      // visuals: bob for wisps, walk wobble, hit flash
      var bob = 0;
      if (e.type === 'wisp') bob = Math.sin(t * 3 + e.phase) * 0.25 + 0.15;
      else if (e.state === 'chase') bob = Math.abs(Math.sin(t * 9 + e.phase)) * 0.08;
      e.mesh.position.set(e.x, bob, e.z);
      if (e.hitTimer > 0) e.mesh.position.x += Math.sin(t * 60) * 0.06;
      // hp bar faces camera
      e.bar.group.lookAt(ED.camera.position);
      var frac = ED.clamp(e.hp / e.maxHp, 0, 1);
      e.bar.fg.scale.x = frac;
      e.bar.fg.position.x = -(e.bar.w * (1 - frac)) / 2;
      e.bar.group.visible = e.hp < e.maxHp && !e.def.boss;
    }
  };
  function updateBoss(e, dt, t, dist, dx, dz) {
    var p = ED.player;
    if (e.type === 'warden') {
      e.slamTimer -= dt; e.summonTimer -= dt;
      if (dist > 2.2) {
        var step = e.speed * dt;
        var c = ED.collide(e.x + dx / dist * step, e.z + dz / dist * step, e.radius);
        e.x = c[0]; e.z = c[1];
      } else if (e.atkCd <= 0) { e.atkCd = 1.4; e.windup = 0.4; e.windupTarget = true; }
      if (e.slamTimer <= 0 && dist < 9) {
        e.slamTimer = 6;
        ED.bossSlam(e, 3.2, 22, 'Root Slam!');
      }
      if (e.summonTimer <= 0) {
        e.summonTimer = 11;
        var alive = ED.enemies.filter(function (x) { return x.type === 'wisp' && !x.dead; }).length;
        if (alive < 3) {
          ED.spawnEnemy('wisp', e.x + 2, e.z + 2);
          ED.spawnEnemy('wisp', e.x - 2, e.z - 1);
          ED.toast('The Warden calls the wisps!', '');
        }
      }
    } else if (e.type === 'colossus') {
      e.slamTimer -= dt; e.chargeTimer -= dt; e.summonTimer -= dt;
      if (e.chargeTimer <= 0 && dist > 5 && dist < 16) {
        e.chargeTimer = 8;
        // telegraphed charge: dash at the player
        e.charging = 0.9;
        ED.toast('The Colossus charges!', '');
        ED.sfx('boss');
      }
      if (e.charging > 0) {
        e.charging -= dt;
        var cs = 9 * dt;
        var cc = ED.collide(e.x + dx / dist * cs, e.z + dz / dist * cs, e.radius);
        e.x = cc[0]; e.z = cc[1];
        if (dist < e.radius + 1.2 && p.invuln <= 0 && !p.dead) ED.hurtPlayer(e.dmg * 1.2, e);
      } else if (dist > e.radius + 1.1) {
        var step2 = e.speed * dt;
        var c2 = ED.collide(e.x + dx / dist * step2, e.z + dz / dist * step2, e.radius);
        e.x = c2[0]; e.z = c2[1];
      } else if (e.atkCd <= 0) { e.atkCd = 1.5; e.windup = 0.45; e.windupTarget = true; }
      if (e.slamTimer <= 0 && dist < 10) {
        e.slamTimer = 7;
        ED.bossSlam(e, 4.2, 30, 'Magma Slam!');
      }
      if (e.summonTimer <= 0) {
        e.summonTimer = 13;
        if (e.hp < e.maxHp * 0.6) {
          ED.spawnEnemy('imp', e.x + 3, e.z, { endless: e.endless });
          ED.spawnEnemy('imp', e.x - 3, e.z, { endless: e.endless });
          ED.toast('The Colossus births cinder imps!', '');
        } else e.summonTimer = 4;
      }
      // arms raise before slam
      var armRaise = e.slamTimer < 1 ? 1 : 0;
      if (e.mesh.userData.armL) {
        e.mesh.userData.armL.rotation.z = ED.lerp(e.mesh.userData.armL.rotation.z || 0, armRaise * -1.2, dt * 4);
        e.mesh.userData.armR.rotation.z = ED.lerp(e.mesh.userData.armR.rotation.z || 0, armRaise * 1.2, dt * 4);
      }
    }
    e.mesh.rotation.y = Math.atan2(dx, dz);
  }

  ED.killEnemy = function (e, silent) {
    if (e.dead) return;
    e.dead = true;
    var p = ED.player;
    ED.burst(e.x, e.type === 'wisp' ? 1.2 : 0.6, e.z, e.def.color, e.def.boss ? 40 : 14);
    ED.sfx('die');
    p.kills++;
    p.bestiary[e.type] = (p.bestiary[e.type] || 0) + 1;
    var goldGain = Math.round(e.gold * p.mod.goldMul * ED.DIFFICULTIES[ED.state.difficulty].goldMul);
    var xpGain = Math.round(e.xp * p.mod.xpMul * ED.DIFFICULTIES[ED.state.difficulty].xpMul);
    p.gold += goldGain;
    p.score += e.def.boss ? 1000 : 100;
    ED.gainXp(xpGain);
    ED.spawnFloatText(e.x, 1.8, e.z, '+' + goldGain + 'g', '#f5b942');
    if (Math.random() < 0.25) ED.spawnPickup('gold', e.x + ED.rand(-1, 1), e.z + ED.rand(-1, 1), goldGain);
    if (!silent) ED.checkFeats();
    ED.removeEnemy(e);
    if (e.def.boss) ED.onBossKilled(e);
  };
})();
