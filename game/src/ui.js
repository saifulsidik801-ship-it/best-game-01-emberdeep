// Emberdeep — UI: HUD, menus, shop, level-up choices, almanac, feats, toasts.
(function () {
  var ED = window.ED;
  var toastTimer = null;

  ED.toast = function (msg, kind) {
    var box = ED.$('toasts');
    if (!box) return;
    var d = document.createElement('div');
    if (kind === 'gold') d.className = 'gold';
    d.textContent = msg;
    box.appendChild(d);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 3400);
  };
  ED.setObjective = function (text) { ED.$('objText').textContent = text; };
  ED.setZone = function (key) {
    var z = ED.ZONES.find(function (x) { return x.key === key; });
    if (z) ED.$('zoneName').textContent = z.name;
    var pips = ED.$('zonePips');
    pips.innerHTML = '';
    var order = ['hub', 'forest', 'dungeon1', 'dungeon2', 'boss'];
    var idx = order.indexOf(key);
    order.forEach(function (k, i) {
      var s = document.createElement('span');
      if (i < idx) s.className = 'done';
      else if (i === idx) s.className = 'now';
      s.title = ED.ZONES[i].pip;
      pips.appendChild(s);
    });
  };
  ED.updateHud = function () {
    var p = ED.player;
    if (!p) return;
    ED.$('hpfill').style.width = ED.clamp(p.hp / p.maxHp * 100, 0, 100) + '%';
    ED.$('hpnum').textContent = Math.ceil(p.hp) + ' / ' + p.maxHp;
    ED.$('enfill').style.width = ED.clamp(p.energy / p.maxEnergy * 100, 0, 100) + '%';
    ED.$('ennum').textContent = Math.floor(p.energy) + ' / ' + p.maxEnergy;
    ED.$('xpfill').style.width = ED.clamp(p.xp / p.xpNext * 100, 0, 100) + '%';
    ED.$('xpnum').textContent = p.xp + ' / ' + p.xpNext;
    ED.$('lvlBadge').textContent = 'Lv ' + p.level + '  Ember Knight';
    ED.$('scoreNum').textContent = ED.fmtNum(p.score);
    ED.$('goldNum').textContent = ED.fmtNum(p.gold);
    ED.$('killNum').textContent = p.kills;
    ED.$('timeNum').textContent = ED.fmtTime(ED.state.elapsed);
    ED.$('diffTag').textContent = ED.DIFFICULTIES[ED.state.difficulty].label + (ED.state.endless ? ' · ENDLESS' : '');
    // skill cooldown overlays
    var sc = ED.$('skillCd');
    if (p.skillCd > 0) { sc.classList.remove('hidden'); sc.textContent = Math.ceil(p.skillCd); }
    else sc.classList.add('hidden');
    var dc = ED.$('dodgeCd');
    if (p.dodgeCd > 0) { dc.classList.remove('hidden'); dc.textContent = Math.ceil(p.dodgeCd); }
    else dc.classList.add('hidden');
    // combo
    var cb = ED.$('combo');
    if (p.combo >= 2 && p.comboTimer > 0) {
      cb.classList.remove('hidden');
      ED.$('comboNum').textContent = 'x' + p.combo;
    } else cb.classList.add('hidden');
    // low HP vignette
    ED.$('lowHp').style.opacity = p.hp < p.maxHp * 0.3 && !p.dead ? String(0.55 - p.hp / p.maxHp) : '0';
  };
  ED.updateRelicHud = function () {
    var p = ED.player;
    var box = ED.$('relics');
    box.innerHTML = '';
    p.relics.forEach(function (id) {
      var r = ED.relicById(id);
      var d = document.createElement('div');
      d.className = 'relic';
      d.textContent = r.icon;
      d.title = r.name + ' — ' + r.desc;
      box.appendChild(d);
    });
    if (p.relics.length === 0) {
      var d0 = document.createElement('div');
      d0.className = 'relic'; d0.textContent = '·'; d0.title = 'No relics yet — open chests and slay bosses.';
      box.appendChild(d0);
    }
  };
  ED.showBossBar = function (name) {
    ED.$('bossName').textContent = name;
    ED.show('bossBar');
  };
  ED.hideBossBar = function () { ED.hide('bossBar'); };
  ED.updateBossBar = function (e) {
    ED.$('bossFill').style.width = ED.clamp(e.hp / e.maxHp * 100, 0, 100) + '%';
  };
  ED.showInteract = function (text) {
    var el = ED.$('interact');
    el.textContent = text;
    el.classList.remove('hidden');
  };
  ED.hideInteract = function () { ED.hide('interact'); };

  // ---------- LEVEL-UP ----------
  ED.showLevelUp = function (choices) {
    var box = ED.$('levelCards');
    box.innerHTML = '';
    choices.forEach(function (b, i) {
      var c = document.createElement('div');
      c.className = 'upCard';
      c.innerHTML = '<div class="ic">' + b.icon + '</div><b>' + b.name + '</b><span>' + b.desc + '</span><span style="color:#8a7a5a">Press ' + (i + 1) + '</span>';
      c.addEventListener('click', function () { ED.pickBoon(b); });
      box.appendChild(c);
    });
    ED.show('levelScreen');
  };
  ED.hideLevelUp = function () { ED.hide('levelScreen'); };

  // ---------- SHOP ----------
  ED.openShop = function () {
    var p = ED.player;
    ED.state.mode = 'shop';
    ED.$('shopGold').textContent = ED.fmtNum(p.gold);
    var grid = ED.$('shopGrid');
    grid.innerHTML = '';
    ED.SHOP.forEach(function (item) {
      var lv = p.shopLv[item.id];
      var maxed = lv >= 3;
      var cost = maxed ? 0 : item.costs[lv];
      var d = document.createElement('div');
      d.className = 'shopItem';
      d.innerHTML = '<b>' + item.icon + ' ' + item.name + '</b> <span class="lvl">Lv ' + lv + '/3</span>' +
        '<p>' + item.desc + '</p>' +
        (maxed ? '<span class="price">MASTERED</span>'
               : '<span class="price">' + cost + ' gold</span> <button class="btn" style="padding:6px 14px;font-size:13px;margin:0 0 0 8px"' +
                 (p.gold < cost ? ' disabled' : '') + ' data-buy="' + item.id + '">BUY</button>');
      grid.appendChild(d);
    });
    grid.querySelectorAll('[data-buy]').forEach(function (btn) {
      btn.addEventListener('click', function () { ED.buyShopItem(btn.getAttribute('data-buy')); });
    });
    // relic shelf: 3 random unowned relics, 150 gold
    var shelf = ED.$('relicShelf');
    shelf.innerHTML = '';
    if (p.relicShelf.length === 0) {
      var pool = ED.RELICS.filter(function (r) { return p.relics.indexOf(r.id) < 0; });
      for (var i = 0; i < 3 && pool.length; i++) {
        var idx = Math.floor(Math.random() * pool.length);
        p.relicShelf.push(pool.splice(idx, 1)[0].id);
      }
    }
    p.relicShelf.forEach(function (id) {
      var r = ED.relicById(id);
      var d = document.createElement('div');
      d.className = 'shopItem';
      d.innerHTML = '<b>' + r.icon + ' ' + r.name + '</b><p>' + r.desc + '</p>' +
        '<span class="price">150 gold</span> <button class="btn" style="padding:6px 14px;font-size:13px;margin:0 0 0 8px"' +
        (p.gold < 150 ? ' disabled' : '') + ' data-relic="' + id + '">BUY</button>';
      shelf.appendChild(d);
    });
    shelf.querySelectorAll('[data-relic]').forEach(function (btn) {
      btn.addEventListener('click', function () { ED.buyRelic(btn.getAttribute('data-relic')); });
    });
    ED.show('shopScreen');
  };
  ED.closeShop = function () {
    ED.hide('shopScreen');
    if (ED.state.mode === 'shop') ED.state.mode = 'playing';
  };

  // ---------- ALMANAC ----------
  ED.openAlmanac = function () {
    var p = ED.player;
    var best = ED.$('bestiary');
    var rows = '';
    Object.keys(ED.ENEMIES).forEach(function (k) {
      var def = ED.ENEMIES[k];
      var n = p.bestiary[k] || 0;
      rows += '<tr><td>' + def.name + (def.boss ? ' 👑' : '') + '</td><td>HP ' + def.hp + ' · DMG ' + def.dmg + '</td><td>' + (n > 0 ? 'Slain: ' + n : '— not met —') + '</td></tr>';
    });
    best.innerHTML = '<table class="almanac"><tr><th>Foe</th><th>Power</th><th>Your record</th></tr>' + rows + '</table>';
    var rl = ED.$('relicList');
    var rrows = '';
    ED.RELICS.forEach(function (r) {
      var got = p.relics.indexOf(r.id) >= 0;
      rrows += '<tr><td>' + r.icon + ' ' + r.name + '</td><td>' + r.desc + '</td><td>' + (got ? '✅ held' : '—') + '</td></tr>';
    });
    rl.innerHTML = '<table class="almanac"><tr><th>Relic</th><th>Effect</th><th>Status</th></tr>' + rrows + '</table>';
    var fl = ED.$('featList');
    fl.innerHTML = '';
    ED.FEATS.forEach(function (f) {
      var d = document.createElement('div');
      var done = !!p.feats[f.id];
      d.className = 'feat ' + (done ? 'done' : 'locked');
      d.textContent = (done ? '🏆 ' : '🔒 ') + f.name + ' — ' + f.desc;
      fl.appendChild(d);
    });
    ED.show('almanacScreen');
  };
  ED.closeAlmanac = function () { ED.hide('almanacScreen'); };

  // ---------- FEATS ----------
  ED.unlockFeat = function (id) {
    var p = ED.player;
    if (!p || p.feats[id]) return;
    p.feats[id] = true;
    var f = ED.FEATS.find(function (x) { return x.id === id; });
    if (f) { ED.toast('🏆 FEAT UNLOCKED: ' + f.name, 'gold'); ED.sfx('feat'); }
  };
  ED.checkFeats = function () {
    var p = ED.player;
    if (!p) return;
    if (p.kills >= 1) ED.unlockFeat('firstblood');
    if (p.relics.length >= 5) ED.unlockFeat('relic5');
    if (p.combo >= 10) ED.unlockFeat('combo10');
    if (p.gold >= 500) ED.unlockFeat('rich');
    if (ED.state.endlessWave >= 5) ED.unlockFeat('endless5');
  };

  // ---------- WIN / DEATH ----------
  ED.showWin = function () {
    var p = ED.player;
    var timeBonus = Math.max(0, 600 - Math.floor(ED.state.elapsed)) * 5;
    var total = p.score + timeBonus;
    p.score = total;
    ED.$('winStats').innerHTML =
      '⏱️ Time: <b>' + ED.fmtTime(ED.state.elapsed) + '</b><br>' +
      '⚔️ Foes slain: <b>' + p.kills + '</b><br>' +
      '💰 Gold held: <b>' + ED.fmtNum(p.gold) + '</b><br>' +
      '🎒 Relics: <b>' + p.relics.length + ' / 14</b><br>' +
      '📈 Level reached: <b>' + p.level + '</b><br>' +
      '⏳ Time bonus: <b>+' + ED.fmtNum(timeBonus) + '</b><br>' +
      '🏆 FINAL SCORE: <b>' + ED.fmtNum(total) + '</b>';
    ED.show('winScreen');
    ED.sfx('win');
  };
  ED.showDeath = function () {
    var p = ED.player;
    ED.$('deadStats').innerHTML =
      '⏱️ Survived: <b>' + ED.fmtTime(ED.state.elapsed) + '</b> in ' + ED.$('zoneName').textContent + '<br>' +
      '⚔️ Foes slain: <b>' + p.kills + '</b> · Level <b>' + p.level + '</b><br>' +
      '🏆 Score: <b>' + ED.fmtNum(p.score) + '</b>';
    ED.show('deadScreen');
    ED.sfx('lose');
  };
  ED.hideAllOverlays = function () {
    ['titleScreen', 'pauseScreen', 'levelScreen', 'shopScreen', 'almanacScreen', 'winScreen', 'deadScreen'].forEach(ED.hide);
  };
})();
