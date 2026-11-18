// Emberdeep — combat: sword combo, Ember Nova skill, dodge roll, damage
// numbers, particles, pickups, XP/level-ups and player damage.
(function () {
  var ED = window.ED;
  var T = THREE;
  var bursts = [];      // particle bursts {points, vel, life, maxLife}
  var floatTexts = [];  // {sprite, life}
  var pickups = [];     // {kind, mesh, x, z, value, relicId, bob}
  var telegraphs = [];  // boss AoE rings {mesh, x, z, r, t, dur, dmg}

  // ---------- PARTICLES ----------
  ED.burst = function (x, y, z, color, count) {
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(count * 3);
    var vel = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      var a = Math.random() * Math.PI * 2, up = Math.random() * 3 + 1, sp = Math.random() * 3 + 1;
      vel[i * 3] = Math.cos(a) * sp; vel[i * 3 + 1] = up; vel[i * 3 + 2] = Math.sin(a) * sp;
    }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    var m = new T.PointsMaterial({ color: color, size: 0.22, transparent: true, opacity: 1,
      blending: T.AdditiveBlending, depthWrite: false });
    var pts = new T.Points(geo, m);
    ED.scene.add(pts);
    bursts.push({ pts: pts, vel: vel, life: 0.7, maxLife: 0.7, count: count });
  };
  ED.updateBursts = function (dt) {
    for (var i = bursts.length - 1; i >= 0; i--) {
      var b = bursts[i];
      b.life -= dt;
      var pos = b.pts.geometry.attributes.position.array;
      for (var j = 0; j < b.count; j++) {
        pos[j * 3] += b.vel[j * 3] * dt;
        pos[j * 3 + 1] += b.vel[j * 3 + 1] * dt;
        pos[j * 3 + 2] += b.vel[j * 3 + 2] * dt;
        b.vel[j * 3 + 1] -= 6 * dt;
        if (pos[j * 3 + 1] < 0.05) pos[j * 3 + 1] = 0.05;
      }
      b.pts.geometry.attributes.position.needsUpdate = true;
      b.pts.material.opacity = Math.max(0, b.life / b.maxLife);
      if (b.life <= 0) { ED.scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i, 1); }
    }
  };
  // ---------- FLOATING TEXT ----------
  function makeTextSprite(text, color) {
    var c = document.createElement('canvas'); c.width = 256; c.height = 64;
    var g = c.getContext('2d');
    g.font = 'bold 34px Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 6;
    g.strokeText(text, 128, 32);
    g.fillStyle = color; g.fillText(text, 128, 32);
    var tex = new T.CanvasTexture(c);
    var sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(2.2, 0.55, 1);
    return sp;
  }
  ED.spawnFloatText = function (x, y, z, text, color) {
    var sp = makeTextSprite(text, color || '#ffffff');
    sp.position.set(x, y, z);
    ED.scene.add(sp);
    floatTexts.push({ sprite: sp, life: 1.0 });
  };
  ED.updateFloatTexts = function (dt) {
    for (var i = floatTexts.length - 1; i >= 0; i--) {
      var f = floatTexts[i];
      f.life -= dt;
      f.sprite.position.y += dt * 1.4;
      f.sprite.material.opacity = Math.max(0, f.life);
      if (f.life <= 0) { ED.scene.remove(f.sprite); f.sprite.material.map.dispose(); f.sprite.material.dispose(); floatTexts.splice(i, 1); }
    }
  };

  // ---------- SWORD COMBO ----------
  ED.tryAttack = function () {
    var p = ED.player;
    if (!p || p.dead || ED.state.mode !== 'playing') return;
    if (p.swingTimer > 0.12 || p.dodgeTimer > 0) return;
    p.swingTimer = 0.34;
    p.swingIndex = (p.swingIndex + 1) % 3;
    p.combo++;
    p.comboTimer = 2.2;
    ED.sfx('swing');
    // swing arc visual
    p.armR.rotation.x = -1.9;
    // hit check after a short delay, in front of the player
    var idx = p.swingIndex;
    setTimeout(function () {
      if (ED.state.mode !== 'playing' || p.dead) return;
      var range = 2.6, arc = 1.15;
      var baseDmg = (idx === 2 ? 22 : 12) * p.mod.dmgMul;
      var hitAny = false;
      for (var i = ED.enemies.length - 1; i >= 0; i--) {
        var e = ED.enemies[i];
        if (e.dead) continue;
        var d = ED.dist2d(p.x, p.z, e.x, e.z);
        if (d > range + e.radius) continue;
        var ang = Math.atan2(e.x - p.x, e.z - p.z);
        var diff = Math.abs(((ang - p.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (diff > arc) continue;
        hitAny = true;
        var crit = Math.random() < p.mod.crit;
        var dmg = Math.round(baseDmg * (crit ? 2 : 1) * ED.rand(0.9, 1.1));
        ED.damageEnemy(e, dmg, crit);
        if (p.mod.lifesteal > 0) p.hp = Math.min(p.maxHp, p.hp + p.mod.lifesteal);
      }
      if (hitAny) ED.sfx('hit');
    }, 110);
  };
  ED.damageEnemy = function (e, dmg, crit) {
    e.hp -= dmg;
    e.hitTimer = 0.18;
    ED.burst(e.x, 1.2, e.z, crit ? 0xffd040 : 0xff8a20, crit ? 12 : 7);
    ED.spawnFloatText(e.x, 2.0, e.z, (crit ? 'CRIT ' : '') + dmg, crit ? '#ffd040' : '#ffffff');
    if (e.hp <= 0) ED.killEnemy(e);
    else if (e.def.boss) ED.updateBossBar(e);
    if (crit) ED.sfx('crit');
  };
  // ---------- EMBER NOVA (skill) ----------
  ED.trySkill = function () {
    var p = ED.player;
    if (!p || p.dead || ED.state.mode !== 'playing') return;
    if (p.skillCd > 0) { ED.toast('Ember Nova is recharging…', ''); return; }
    if (p.energy < 30) { ED.toast('Not enough energy (need 30).', ''); return; }
    p.energy -= 30;
    p.skillCd = 6 * p.mod.skillCdMul;
    p.skillTimer = 0.5;
    ED.sfx('nova');
    ED.burst(p.x, 1, p.z, 0xff6a20, 46);
    ED.burst(p.x, 0.4, p.z, 0xffd040, 26);
    // expanding ring mesh
    var ring = new T.Mesh(new T.RingGeometry(0.4, 0.7, 32),
      new T.MeshBasicMaterial({ color: 0xff8a20, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, 0.12, p.z);
    ED.scene.add(ring);
    telegraphs.push({ mesh: ring, x: p.x, z: p.z, r: 5, t: 0, dur: 0.45, dmg: 0, friendly: true });
    var dmg = Math.round(40 * p.mod.dmgMul * p.mod.novaMul);
    for (var i = ED.enemies.length - 1; i >= 0; i--) {
      var e = ED.enemies[i];
      if (e.dead) continue;
      if (ED.dist2d(p.x, p.z, e.x, e.z) < 5 + e.radius) {
        ED.damageEnemy(e, dmg, false);
        e.burnTimer = 3; e.burnDps = 6 * p.mod.novaMul;
      }
    }
  };
  // ---------- DODGE ----------
  ED.tryDodge = function () {
    var p = ED.player;
    if (!p || p.dead || ED.state.mode !== 'playing') return;
    if (p.dodgeCd > 0 || p.dodgeTimer > 0) return;
    p.dodgeTimer = 0.32;
    p.dodgeCd = 1.1 * (p.mod.dodgeCdMul || 1);
    p.invuln = 0.45;
    p.dodgeDir = p.yaw;
    ED.sfx('dodge');
    ED.burst(p.x, 0.4, p.z, 0x9fd8ff, 10);
  };
  // ---------- PLAYER DAMAGE / DEATH ----------
  ED.hurtPlayer = function (dmg, src) {
    var p = ED.player;
    if (!p || p.dead || p.invuln > 0 || ED.state.mode !== 'playing') return;
    var taken = Math.max(1, Math.round(dmg * p.mod.dmgTakenMul));
    if (p.mod.armorSoak) taken = Math.max(1, taken - p.mod.armorSoak);
    p.hp -= taken;
    p.hurtTimer = 0.3;
    p.combo = 0;
    ED.sfx('hurt');
    var fl = ED.$('dmgFlash');
    fl.style.opacity = '1';
    setTimeout(function () { fl.style.opacity = '0'; }, 130);
    ED.spawnFloatText(p.x, 2.2, p.z, '-' + taken, '#ff5a5a');
    if (src && p.mod.thorns > 0) ED.damageEnemy(src, p.mod.thorns, false);
    if (p.hp <= 0) {
      if (p.relics.indexOf('phoenix') >= 0 && !p.phoenixUsed) {
        p.phoenixUsed = true;
        p.hp = Math.round(p.maxHp * 0.5);
        p.invuln = 2;
        ED.burst(p.x, 1.2, p.z, 0xff8a20, 50);
        ED.toast('The Phoenix Feather burns — you rise again!', 'gold');
        ED.sfx('relic');
        return;
      }
      p.hp = 0; p.dead = true;
      ED.onPlayerDeath();
    }
  };
  // ---------- BOSS TELEGRAPHS ----------
  ED.bossSlam = function (e, radius, dmg, label) {
    var ring = new T.Mesh(new T.RingGeometry(radius - 0.4, radius, 40),
      new T.MeshBasicMaterial({ color: 0xff2d2d, transparent: true, opacity: 0.85, side: T.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(e.x, 0.1, e.z);
    ED.scene.add(ring);
    telegraphs.push({ mesh: ring, x: e.x, z: e.z, r: radius, t: 0, dur: 0.9, dmg: dmg, friendly: false });
    ED.toast(label, '');
    ED.sfx('boss');
  };
  ED.updateTelegraphs = function (dt) {
    var p = ED.player;
    for (var i = telegraphs.length - 1; i >= 0; i--) {
      var tg = telegraphs[i];
      tg.t += dt;
      if (tg.friendly) {
        var s = 1 + tg.t / tg.dur * 5;
        tg.mesh.scale.set(s, s, 1);
        tg.mesh.material.opacity = Math.max(0, 0.9 - tg.t / tg.dur);
      } else {
        tg.mesh.material.opacity = 0.5 + Math.sin(tg.t * 14) * 0.35;
        if (tg.t >= tg.dur) {
          ED.burst(tg.x, 0.4, tg.z, 0xff5a10, 30);
          ED.sfx('hit');
          if (p && !p.dead && p.invuln <= 0 && ED.dist2d(p.x, p.z, tg.x, tg.z) < tg.r) ED.hurtPlayer(tg.dmg, null);
        }
      }
      if (tg.t >= tg.dur) { ED.scene.remove(tg.mesh); tg.mesh.geometry.dispose(); tg.mesh.material.dispose(); telegraphs.splice(i, 1); }
    }
  };
  // ---------- PICKUPS ----------
  ED.spawnPickup = function (kind, x, z, value, relicId) {
    var g = new T.Group();
    var mesh;
    if (kind === 'gold') {
      mesh = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.08, 12), new T.MeshStandardMaterial({ color: 0xf5b942, metalness: 0.9, roughness: 0.25, emissive: 0x664400, emissiveIntensity: 0.7 }));
      mesh.rotation.x = Math.PI / 2;
    } else if (kind === 'heart') {
      mesh = new T.Mesh(new T.SphereGeometry(0.3, 10, 8), new T.MeshStandardMaterial({ color: 0xff3a5a, emissive: 0x660011, emissiveIntensity: 0.8 }));
      mesh.scale.set(1, 0.85, 0.6);
    } else { // relic
      var relic = ED.relicById(relicId);
      mesh = new T.Mesh(new T.OctahedronGeometry(0.42, 0), new T.MeshStandardMaterial({ color: 0xc98aff, metalness: 0.6, roughness: 0.2, emissive: 0x4a1a8a, emissiveIntensity: 1 }));
      var halo = new T.Mesh(new T.SphereGeometry(0.7, 10, 8), new T.MeshBasicMaterial({ color: 0xc98aff, transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false }));
      g.add(halo);
      g.userData.label = relic ? relic.name : 'Relic';
    }
    g.add(mesh);
    g.position.set(x, 0.7, z);
    ED.scene.add(g);
    pickups.push({ kind: kind, mesh: g, x: x, z: z, value: value || 0, relicId: relicId || null, bob: Math.random() * 6 });
  };
  ED.updatePickups = function (dt, t) {
    var p = ED.player;
    if (!p) return;
    for (var i = pickups.length - 1; i >= 0; i--) {
      var pk = pickups[i];
      pk.mesh.position.y = 0.7 + Math.sin(t * 2.5 + pk.bob) * 0.15;
      pk.mesh.rotation.y += dt * 1.6;
      if (ED.dist2d(p.x, p.z, pk.x, pk.z) < 1.1 && !p.dead) {
        if (pk.kind === 'gold') { p.gold += pk.value; p.score += pk.value; ED.sfx('coin'); ED.spawnFloatText(pk.x, 1.4, pk.z, '+' + pk.value + 'g', '#f5b942'); }
        else if (pk.kind === 'heart') { p.hp = Math.min(p.maxHp, p.hp + 20); ED.sfx('coin'); ED.spawnFloatText(pk.x, 1.4, pk.z, '+20 HP', '#ff5a7a'); }
        else if (pk.kind === 'relic') ED.collectRelic(pk.relicId);
        ED.scene.remove(pk.mesh);
        pickups.splice(i, 1);
      }
    }
  };
  ED.collectRelic = function (id) {
    var p = ED.player;
    if (!id) return;
    if (p.relics.indexOf(id) >= 0) { p.gold += 40; ED.toast('Duplicate relic — sold for 40 gold.', ''); return; }
    var r = ED.relicById(id);
    p.relics.push(id);
    ED.applyRelic(p, id);
    ED.sfx('relic');
    ED.toast('RELIC FOUND: ' + r.name + ' — ' + r.desc, 'gold');
    ED.burst(p.x, 1.2, p.z, 0xc98aff, 30);
    ED.checkFeats();
    ED.updateRelicHud();
  };
  ED.applyRelic = function (p, id) {
    switch (id) {
      case 'emberheart': p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp + 30); break;
      case 'swiftboots': p.mod.speedMul *= 1.12; break;
      case 'stormbrand': p.mod.dmgMul *= 1.25; break;
      case 'thornmail': p.mod.thorns += 12; break;
      case 'lifedrinker': p.mod.lifesteal += 3; break;
      case 'frostward': p.mod.dmgTakenMul *= 0.85; break;
      case 'goldmagnet': p.mod.goldMul *= 1.4; break;
      case 'ironhide': p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); p.mod.armorSoak = (p.mod.armorSoak || 0) + 10; break;
      case 'berserker': p.mod.dmgMul *= 1.15; p.mod.crit += 0.10; break;
      case 'phoenix': break; // handled in hurtPlayer
      case 'bark': p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); p.mod.dmgMul *= 1.08; break;
      case 'core': p.mod.novaMul *= 1.6; break;
      case 'lucky': p.mod.xpMul *= 1.25; p.mod.crit += 0.10; break;
      case 'voidlens': p.mod.skillCdMul *= 0.65; break;
      default: break;
    }
  };
  // ---------- XP / LEVEL ----------
  ED.gainXp = function (n) {
    var p = ED.player;
    p.xp += n;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = Math.round(40 * Math.pow(1.35, p.level - 1));
      p.hp = Math.min(p.maxHp, p.hp + 15);
      ED.sfx('levelup');
      ED.burst(p.x, 1.2, p.z, 0xc98aff, 36);
      ED.queueLevelUp();
    }
  };
})();
