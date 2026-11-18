// Emberdeep — the living world: Emberdeep Town hub, Whisperwood forest,
// and the Sunken Halls dungeon (two halls + Colossus Vault). Built from
// Three.js primitives, seeded so the layout is the same every run.
(function () {
  var ED = window.ED;
  var T = THREE;
  var rng = ED.mulberry32(1337);

  var scene, camera, renderer;
  var walls = [];          // {x1,z1,x2,z2} solid blockers
  var gates = {};          // key -> {door, wall, open}
  var torches = [];        // {light, flame, base}
  var npcs = [];
  var critters = [];
  var smith = null;
  var particleSystems = [];
  var flags = [];
  var chestList = [];
  var fountainSpray = null;

  function mat(color, opts) {
    var o = opts || {};
    return new T.MeshStandardMaterial({
      color: color, roughness: o.rough === undefined ? 0.9 : o.rough,
      metalness: o.metal || 0, emissive: o.emissive || 0x000000,
      emissiveIntensity: o.ei === undefined ? 1 : o.ei,
      transparent: !!o.transparent, opacity: o.opacity === undefined ? 1 : o.opacity,
    });
  }
  function box(w, h, d, color, opts) {
    var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color, opts));
    m.castShadow = false; return m;
  }
  function addWall(x1, z1, x2, z2, h, color) {
    walls.push({ x1: Math.min(x1, x2), z1: Math.min(z1, z2), x2: Math.max(x1, x2), z2: Math.max(z1, z2) });
    var w = Math.abs(x2 - x1) || 1, d = Math.abs(z2 - z1) || 1;
    var m = box(Math.max(w, 0.6), h || 4, Math.max(d, 0.6), color || 0x4a4038);
    m.position.set((x1 + x2) / 2, (h || 4) / 2, (z1 + z2) / 2);
    scene.add(m);
    return m;
  }
  function ground(x, z, w, d, color) {
    var g = new T.Mesh(new T.PlaneGeometry(w, d), mat(color, { rough: 1 }));
    g.rotation.x = -Math.PI / 2; g.position.set(x, 0, z);
    g.receiveShadow = false; scene.add(g); return g;
  }
  function blobShadow(parent, r) {
    var s = new T.Mesh(new T.CircleGeometry(r, 20),
      new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    s.rotation.x = -Math.PI / 2; s.position.y = 0.03; parent.add(s); return s;
  }
  function makeTorch(x, z, withLight) {
    var g = new T.Group();
    var pole = new T.Mesh(new T.CylinderGeometry(0.07, 0.1, 1.6, 6), mat(0x3a2a1a));
    pole.position.y = 0.8; g.add(pole);
    var cup = new T.Mesh(new T.CylinderGeometry(0.16, 0.1, 0.25, 6), mat(0x222222, { metal: 0.6 }));
    cup.position.y = 1.65; g.add(cup);
    var flame = new T.Mesh(new T.ConeGeometry(0.22, 0.7, 8),
      new T.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.95 }));
    flame.position.y = 2.0; g.add(flame);
    var glow = new T.Mesh(new T.SphereGeometry(0.42, 8, 8),
      new T.MeshBasicMaterial({ color: 0xff7a20, transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false }));
    glow.position.y = 2.0; g.add(glow);
    var light = null;
    if (withLight) {
      light = new T.PointLight(0xff8a30, 22, 16, 1.8);
      light.position.y = 2.1; g.add(light);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    torches.push({ light: light, flame: flame, glow: glow, base: 22 });
    return g;
  }
  function makeFlag(x, z, color) {
    var g = new T.Group();
    var pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.07, 4.4, 6), mat(0x4a3520));
    pole.position.y = 2.2; g.add(pole);
    var cloth = new T.Mesh(new T.PlaneGeometry(1.5, 0.85), mat(color, { rough: 0.8 }));
    cloth.position.set(0.8, 3.8, 0); cloth.castShadow = false; g.add(cloth);
    g.position.set(x, 0, z); scene.add(g);
    flags.push(cloth); return g;
  }
  function makePoints(count, color, size, area, yBase, ySpread) {
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(count * 3);
    var seed = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      pos[i * 3] = ED.rand(area.x1, area.x2);
      pos[i * 3 + 1] = yBase + Math.random() * ySpread;
      pos[i * 3 + 2] = ED.rand(area.z1, area.z2);
      seed[i * 3] = Math.random() * 10; seed[i * 3 + 1] = Math.random() * 10; seed[i * 3 + 2] = Math.random() * 10;
    }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    var m = new T.PointsMaterial({ color: color, size: size, transparent: true, opacity: 0.85,
      blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    var pts = new T.Points(geo, m);
    scene.add(pts);
    return { pts: pts, seed: seed, count: count, area: area, yBase: yBase, ySpread: ySpread };
  }

  // ---------- HUB: Emberdeep Town ----------
  function buildHub() {
    ground(0, 28, 44, 40, 0x6a5a42);
    // stone plaza in the middle
    var plaza = new T.Mesh(new T.CircleGeometry(7, 28), mat(0x8a7a62, { rough: 0.95 }));
    plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.02, 28); scene.add(plaza);
    // perimeter walls with a north gate (to forest) and south wall
    addWall(-22, 46, 22, 48, 5, 0x5a4a38);           // south
    addWall(-22, 8, -20, 48, 5, 0x5a4a38);           // west
    addWall(20, 8, 22, 48, 5, 0x5a4a38);             // east
    addWall(-22, 6, -3, 8, 5, 0x5a4a38);             // north-left of gate
    addWall(3, 6, 22, 8, 5, 0x5a4a38);               // north-right of gate
    // gate arch
    var archL = box(1.2, 6, 1.6, 0x6a563e); archL.position.set(-3.4, 3, 7); scene.add(archL);
    var archR = box(1.2, 6, 1.6, 0x6a563e); archR.position.set(3.4, 3, 7); scene.add(archR);
    var archT = box(8, 1.4, 1.6, 0x6a563e); archT.position.set(0, 6.4, 7); scene.add(archT);
    var door = box(5.6, 5.2, 0.5, 0x2e2013, { metal: 0.3 });
    door.position.set(0, 2.6, 7); scene.add(door);
    var gateWall = { x1: -2.8, z1: 6.6, x2: 2.8, z2: 7.4 };
    walls.push(gateWall);
    gates.forest = { door: door, wall: gateWall, open: false };
    // fountain
    var basin = new T.Mesh(new T.CylinderGeometry(3.2, 3.5, 0.9, 20), mat(0x7a7468));
    basin.position.set(0, 0.45, 34); scene.add(basin);
    var water = new T.Mesh(new T.CylinderGeometry(2.9, 2.9, 0.2, 20),
      new T.MeshStandardMaterial({ color: 0x3a9fd8, roughness: 0.15, metalness: 0.2, emissive: 0x0a3a55, emissiveIntensity: 0.5 }));
    water.position.set(0, 0.85, 34); scene.add(water);
    var spout = new T.Mesh(new T.CylinderGeometry(0.25, 0.4, 1.6, 8), mat(0x8a8070));
    spout.position.set(0, 1.6, 34); scene.add(spout);
    fountainSpray = makePoints(50, 0x9fd8ff, 0.16, { x1: -1.2, x2: 1.2, z1: 32.8, z2: 35.2 }, 1.2, 1.6);
    particleSystems.push({ kind: 'spray', sys: fountainSpray });
    // market stalls (4) with striped awnings and goods
    var stallCols = [0xd43a2a, 0x2a7ad4, 0x3f9a4f, 0xd4a02a];
    var stallPos = [[-12, 18], [12, 18], [-13, 36], [13, 38]];
    for (var i = 0; i < 4; i++) {
      var g = new T.Group();
      var counter = box(3.4, 1, 1.6, 0x6a4a26); counter.position.y = 0.5; g.add(counter);
      var awn = box(3.8, 0.12, 2.2, stallCols[i]); awn.position.y = 2.4; awn.rotation.x = 0.18; g.add(awn);
      var pole1 = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 2.4, 6), mat(0x4a3520)); pole1.position.set(-1.7, 1.2, 0.9); g.add(pole1);
      var pole2 = pole1.clone(); pole2.position.x = 1.7; g.add(pole2);
      for (var k = 0; k < 5; k++) {
        var good = box(0.4, 0.3, 0.4, [0xffb03a, 0x7ad43a, 0xd43aa0, 0x3ad4c8, 0xf5e6c8][k], { emissive: 0x221100, ei: 0.4 });
        good.position.set(-1.2 + k * 0.6, 1.15, 0); g.add(good);
      }
      g.position.set(stallPos[i][0], 0, stallPos[i][1]);
      scene.add(g);
      walls.push({ x1: stallPos[i][0] - 1.9, z1: stallPos[i][1] - 1.1, x2: stallPos[i][0] + 1.9, z2: stallPos[i][1] + 1.1 });
    }
    // smithy (east side): anvil, forge glow, chimney
    var smithy = new T.Group();
    var hut = box(6, 3.4, 5, 0x54402a); hut.position.y = 1.7; smithy.add(hut);
    var roof = box(7, 0.4, 6, 0x8a2f1a); roof.position.y = 3.6; roof.rotation.z = 0.12; smithy.add(roof);
    var forge = box(1.6, 1.2, 1.2, 0x1a1a1a, { emissive: 0xff5a10, ei: 1.6 }); forge.position.set(-1.5, 0.6, 2.2); smithy.add(forge);
    var anvil = box(1.1, 0.5, 0.5, 0x333333, { metal: 0.8, rough: 0.4 }); anvil.position.set(0.5, 1.15, 2.2); smithy.add(anvil);
    var anvilBase = box(0.7, 0.9, 0.7, 0x4a3520); anvilBase.position.set(0.5, 0.45, 2.2); smithy.add(anvilBase);
    smithy.position.set(15, 0, 30); scene.add(smithy);
    walls.push({ x1: 12, z1: 27.4, x2: 18, z2: 32.6 });
    var forgeLight = new T.PointLight(0xff6a20, 30, 14, 1.8); forgeLight.position.set(13.5, 2, 32.2); scene.add(forgeLight);
    torches.push({ light: forgeLight, flame: null, glow: null, base: 30 });
    // smith NPC Bram, hammering at the anvil
    smith = makeNpc(0x8a5a2a, 0xd4a02a, 14.2, 32.4);
    smith.group.rotation.y = Math.PI;
    smith.hammering = true;
    // torches + flags around the plaza
    makeTorch(-6, 12, true); makeTorch(6, 12, true); makeTorch(-8, 44, false); makeTorch(8, 44, false);
    makeTorch(-18, 28, false); makeTorch(18, 28, false);
    makeFlag(-6, 10, 0xd43a2a); makeFlag(6, 10, 0x2a7ad4); makeFlag(-10, 44, 0x3f9a4f); makeFlag(10, 44, 0xd4a02a);
    // wandering townsfolk
    var npcDefs = [
      { robe: 0x7a4fd0, skin: 0xe8b88a, path: [[-8, 22], [8, 26], [6, 40], [-6, 38]] },
      { robe: 0x3f9a4f, skin: 0xd8a070, path: [[-14, 26], [-4, 30], [-10, 42], [-16, 34]] },
      { robe: 0xd4a02a, skin: 0xe8b88a, path: [[10, 22], [16, 30], [10, 42], [4, 32]] },
      { robe: 0x2a7ad4, skin: 0xc89060, path: [[-4, 14], [4, 16], [2, 24], [-6, 20]] },
      { robe: 0xd43aa0, skin: 0xe8b88a, path: [[-16, 40], [-8, 44], [-2, 40], [-12, 36]] },
      { robe: 0x5a6a7a, skin: 0xd8a070, path: [[8, 40], [14, 44], [16, 36], [10, 32]] },
    ];
    npcDefs.forEach(function (d) { var n = makeNpc(d.robe, d.skin, d.path[0][0], d.path[0][1]); n.path = d.path; n.wp = 1; npcs.push(n); });
    // hay bales, barrels, crates for clutter
    for (var b = 0; b < 8; b++) {
      var barrel = new T.Mesh(new T.CylinderGeometry(0.5, 0.55, 1, 10), mat(0x6a4a26));
      barrel.position.set(ED.rand(-19, 19), 0.5, ED.rand(12, 44)); scene.add(barrel);
    }
    for (var c = 0; c < 6; c++) {
      var crate = box(ED.rand(0.7, 1.1), ED.rand(0.7, 1.1), ED.rand(0.7, 1.1), 0x7a5a30);
      crate.position.set(ED.rand(-19, 19), 0.5, ED.rand(12, 44)); crate.rotation.y = ED.rand(0, 3); scene.add(crate);
    }
    // dust motes drifting over the plaza
    var dust = makePoints(90, 0xffe0a0, 0.1, { x1: -20, x2: 20, z1: 10, z2: 46 }, 0.5, 4);
    particleSystems.push({ kind: 'dust', sys: dust });
  }
  function makeNpc(robe, skin, x, z) {
    var g = new T.Group();
    var body = new T.Mesh(new T.CylinderGeometry(0.32, 0.45, 1.1, 8), mat(robe));
    body.position.y = 0.85; g.add(body);
    var head = new T.Mesh(new T.SphereGeometry(0.28, 10, 8), mat(skin));
    head.position.y = 1.65; g.add(head);
    var hat = new T.Mesh(new T.ConeGeometry(0.34, 0.5, 8), mat(robe));
    hat.position.y = 1.95; g.add(hat);
    blobShadow(g, 0.5);
    g.position.set(x, 0, z);
    scene.add(g);
    return { group: g, x: x, z: z, speed: ED.rand(0.8, 1.4), phase: Math.random() * 10, hammering: false };
  }

  // ---------- FOREST: Whisperwood ----------
  function buildForest() {
    ground(0, -19, 40, 56, 0x2e4a26);
    // mossy path stones down the middle
    for (var s = -44; s <= 6; s += 3.2) {
      var stone = new T.Mesh(new T.CylinderGeometry(ED.rand(0.7, 1.1), ED.rand(0.8, 1.2), 0.12, 7), mat(0x8a8578));
      stone.position.set(ED.rand(-0.8, 0.8), 0.06, s); scene.add(stone);
    }
    // perimeter walls (tree-line hedges) with gate gap at north (z=-46) and south gap at hub gate
    addWall(-20, -48, -18, 6, 4, 0x2a3a22);
    addWall(18, -48, 20, 6, 4, 0x2a3a22);
    addWall(-20, -48, -3, -46, 4, 0x2a3a22);
    addWall(3, -48, 20, -46, 4, 0x2a3a22);
    // dungeon gate arch at north
    var archL = box(1.2, 6, 1.6, 0x3a3a32); archL.position.set(-3.4, 3, -47); scene.add(archL);
    var archR = box(1.2, 6, 1.6, 0x3a3a32); archR.position.set(3.4, 3, -47); scene.add(archR);
    var archT = box(8, 1.4, 1.6, 0x3a3a32); archT.position.set(0, 6.4, -47); scene.add(archT);
    var door = box(5.6, 5.2, 0.5, 0x1e1a24, { metal: 0.4 });
    door.position.set(0, 2.6, -47); scene.add(door);
    var gw = { x1: -2.8, z1: -47.4, x2: 2.8, z2: -46.6 };
    walls.push(gw);
    gates.dungeon = { door: door, wall: gw, open: false };
    // trees: instanced trunks + canopies, dense
    var trunkGeo = new T.CylinderGeometry(0.22, 0.4, 3.2, 6);
    var trunkMat = mat(0x4a3520);
    var canGeo = new T.ConeGeometry(1.7, 4.2, 7);
    var canMat = mat(0x2a5a2a);
    var canMat2 = mat(0x3a6a2a);
    var treeCount = 80;
    var trunks = new T.InstancedMesh(trunkGeo, trunkMat, treeCount);
    var cans = new T.InstancedMesh(canGeo, canMat, treeCount);
    var cans2 = new T.InstancedMesh(new T.ConeGeometry(1.2, 3, 7), canMat2, treeCount);
    var m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), pos = new T.Vector3();
    var placed = 0, guard = 0;
    while (placed < treeCount && guard++ < 800) {
      var tx = ED.rand(-19, 19), tz = ED.rand(-46, 6);
      if (Math.abs(tx) < 4.5 && tz > -46) continue; // keep the path clear
      var scv = ED.rand(0.8, 1.7);
      pos.set(tx, 1.6 * scv, tz); sc.set(scv, scv, scv); q.setFromAxisAngle(new T.Vector3(0, 1, 0), ED.rand(0, 6));
      m4.compose(pos, q, sc); trunks.setMatrixAt(placed, m4);
      pos.set(tx, (3.2 + 2.0) * scv, tz); m4.compose(pos, q, sc); cans.setMatrixAt(placed, m4);
      pos.set(tx, (3.2 + 3.6) * scv, tz); m4.compose(pos, q, sc); cans2.setMatrixAt(placed, m4);
      placed++;
    }
    trunks.count = placed; cans.count = placed; cans2.count = placed;
    scene.add(trunks); scene.add(cans); scene.add(cans2);
    // bushes + rocks (instanced)
    var bushGeo = new T.SphereGeometry(0.9, 8, 6);
    var bushes = new T.InstancedMesh(bushGeo, mat(0x2a4a22), 46);
    for (var i = 0; i < 46; i++) {
      pos.set(ED.rand(-18, 18), 0.4, ED.rand(-45, 5)); sc.set(ED.rand(0.6, 1.5), ED.rand(0.5, 0.9), ED.rand(0.6, 1.5));
      q.setFromAxisAngle(new T.Vector3(0, 1, 0), ED.rand(0, 6)); m4.compose(pos, q, sc); bushes.setMatrixAt(i, m4);
    }
    scene.add(bushes);
    var rockGeo = new T.DodecahedronGeometry(0.8, 0);
    var rocks = new T.InstancedMesh(rockGeo, mat(0x6a6a66), 26);
    for (var r = 0; r < 26; r++) {
      pos.set(ED.rand(-18, 18), 0.3, ED.rand(-45, 5)); sc.set(ED.rand(0.4, 1.3), ED.rand(0.3, 0.8), ED.rand(0.4, 1.3));
      q.setFromAxisAngle(new T.Vector3(0, 1, 0), ED.rand(0, 6)); m4.compose(pos, q, sc); rocks.setMatrixAt(r, m4);
    }
    scene.add(rocks);
    // glowing mushrooms
    for (var mu = 0; mu < 18; mu++) {
      var mg = new T.Group();
      var stem = new T.Mesh(new T.CylinderGeometry(0.12, 0.18, 0.5, 6), mat(0xe8dcc0));
      stem.position.y = 0.25; mg.add(stem);
      var cap = new T.Mesh(new T.SphereGeometry(0.42, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        mat(mu % 2 ? 0x3ad4c8 : 0xd43aa0, { emissive: mu % 2 ? 0x1a8a80 : 0x8a1a60, ei: 0.9 }));
      cap.position.y = 0.5; mg.add(cap);
      mg.position.set(ED.rand(-17, 17), 0, ED.rand(-44, 4));
      if (Math.abs(mg.position.x) < 4) mg.position.x += 6;
      scene.add(mg);
    }
    // god-ray shafts
    for (var sh = 0; sh < 7; sh++) {
      var shaft = new T.Mesh(new T.ConeGeometry(ED.rand(1.5, 2.6), 14, 8, 1, true),
        new T.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.05, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      shaft.position.set(ED.rand(-14, 14), 7, ED.rand(-42, 0));
      shaft.rotation.z = 0.25; scene.add(shaft);
    }
    // fireflies, falling leaves, pollen
    var flies = makePoints(90, 0xc8ff5a, 0.14, { x1: -18, x2: 18, z1: -45, z2: 5 }, 0.8, 3.2);
    particleSystems.push({ kind: 'firefly', sys: flies });
    var leaves = makePoints(130, 0xd4a02a, 0.16, { x1: -18, x2: 18, z1: -45, z2: 5 }, 3, 5);
    particleSystems.push({ kind: 'leaves', sys: leaves });
    var pollen = makePoints(70, 0xfff2b0, 0.09, { x1: -18, x2: 18, z1: -45, z2: 5 }, 0.5, 4);
    particleSystems.push({ kind: 'dust', sys: pollen });
    // hopping critters (rabbits)
    for (var cr = 0; cr < 5; cr++) {
      var cg = new T.Group();
      var cbody = new T.Mesh(new T.SphereGeometry(0.32, 8, 6), mat(0xf0e8d8));
      cbody.scale.set(1, 0.8, 1.3); cbody.position.y = 0.3; cg.add(cbody);
      var ear = new T.Mesh(new T.ConeGeometry(0.09, 0.5, 6), mat(0xf0e8d8));
      ear.position.set(-0.12, 0.75, 0); cg.add(ear);
      var ear2 = ear.clone(); ear2.position.x = 0.12; cg.add(ear2);
      blobShadow(cg, 0.4);
      cg.position.set(ED.rand(-14, 14), 0, ED.rand(-40, 0));
      scene.add(cg);
      critters.push({ group: cg, tx: cg.position.x, tz: cg.position.z, hop: Math.random() * 5, wait: ED.rand(1, 3) });
    }
    // warden clearing: ring of stones + big old tree at north
    for (var st = 0; st < 8; st++) {
      var a = st / 8 * Math.PI * 2;
      var menhir = box(0.8, ED.rand(1.6, 2.6), 0.6, 0x7a7a72);
      menhir.position.set(Math.cos(a) * 7, 1, -38 + Math.sin(a) * 7);
      menhir.rotation.y = a; scene.add(menhir);
    }
    var oldTrunk = new T.Mesh(new T.CylinderGeometry(0.8, 1.3, 7, 8), mat(0x3a2a18));
    oldTrunk.position.set(0, 3.5, -42); scene.add(oldTrunk);
    var oldCan = new T.Mesh(new T.SphereGeometry(4, 10, 8), mat(0x1e4a22));
    oldCan.position.set(0, 8.5, -42); oldCan.scale.y = 0.7; scene.add(oldCan);
    // forest chest (relic) near the clearing
    addChest(-9, -36);
    // torches at the dungeon gate
    makeTorch(-5, -44, true); makeTorch(5, -44, true);
  }
  function addChest(x, z) {
    var g = new T.Group();
    var base = box(1.3, 0.7, 0.9, 0x6a4a26); base.position.y = 0.35; g.add(base);
    var lid = box(1.3, 0.35, 0.9, 0x8a5a2a); lid.position.y = 0.85; g.add(lid);
    var trim = box(1.34, 0.12, 0.94, 0xf5b942, { metal: 0.7, emissive: 0x664400, ei: 0.6 }); trim.position.y = 0.68; g.add(trim);
    var glow = new T.Mesh(new T.SphereGeometry(0.9, 8, 8),
      new T.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.14, blending: T.AdditiveBlending, depthWrite: false }));
    glow.position.y = 0.7; g.add(glow);
    blobShadow(g, 0.9);
    g.position.set(x, 0, z); scene.add(g);
    var chest = { group: g, lid: lid, x: x, z: z, opened: false, glow: glow };
    chestList.push(chest);
    return chest;
  }

  // ---------- DUNGEON: Sunken Halls + Colossus Vault ----------
  function buildDungeon() {
    ground(0, -63, 32, 34, 0x3a3230);   // hall I
    ground(0, -112, 32, 34, 0x38302e);  // hall II
    ground(0, -154, 32, 32, 0x2e2622);  // vault
    ground(0, -88, 10, 20, 0x403630);   // corridor 1
    ground(0, -134, 10, 14, 0x403630);  // corridor 2
    // outer walls
    addWall(-16, -80, -14, -48, 5, 0x4a4038);
    addWall(14, -80, 16, -48, 5, 0x4a4038);
    addWall(-16, -128, -14, -96, 5, 0x4a4038);
    addWall(14, -128, 16, -96, 5, 0x4a4038);
    addWall(-16, -170, -14, -140, 5, 0x4a4038);
    addWall(14, -170, 16, -140, 5, 0x4a4038);
    addWall(-16, -170, 16, -168, 5, 0x4a4038);
    // hall I north wall with door gap (z=-80)
    addWall(-16, -82, -3, -80, 5, 0x4a4038);
    addWall(3, -82, 16, -80, 5, 0x4a4038);
    var door1 = box(5.6, 5, 0.5, 0x241a12, { metal: 0.4 }); door1.position.set(0, 2.5, -81); scene.add(door1);
    var gw1 = { x1: -2.8, z1: -81.4, x2: 2.8, z2: -80.6 }; walls.push(gw1);
    gates.hall2 = { door: door1, wall: gw1, open: false };
    // corridor side walls
    addWall(-5, -96, -3, -80, 5, 0x4a4038);
    addWall(3, -96, 5, -80, 5, 0x4a4038);
    addWall(-5, -140, -3, -128, 5, 0x4a4038);
    addWall(3, -140, 5, -128, 5, 0x4a4038);
    // hall II north wall with door gap (z=-128)
    addWall(-16, -130, -3, -128, 5, 0x4a4038);
    addWall(3, -130, 16, -128, 5, 0x4a4038);
    var door2 = box(5.6, 5, 0.5, 0x241a12, { metal: 0.4 }); door2.position.set(0, 2.5, -129); scene.add(door2);
    var gw2 = { x1: -2.8, z1: -129.4, x2: 2.8, z2: -128.6 }; walls.push(gw2);
    gates.boss = { door: door2, wall: gw2, open: false };
    // dungeon south wall is the forest gate wall (already built); add side walls linking
    addWall(-16, -50, -14, -46, 5, 0x4a4038);
    addWall(14, -50, 16, -46, 5, 0x4a4038);
    // pillars in both halls
    [[-10, -56], [10, -56], [-10, -72], [10, -72], [-10, -104], [10, -104], [-10, -120], [10, -120]].forEach(function (p) {
      var pil = new T.Mesh(new T.CylinderGeometry(0.9, 1.1, 7, 8), mat(0x5a5048));
      pil.position.set(p[0], 3.5, p[1]); scene.add(pil);
      var cap = box(2.4, 0.5, 2.4, 0x6a6058); cap.position.set(p[0], 7, p[1]); scene.add(cap);
      walls.push({ x1: p[0] - 1, z1: p[1] - 1, x2: p[0] + 1, z2: p[1] + 1 });
    });
    // banners
    [[-13, -58, 0xd43a2a], [13, -58, 0xd43a2a], [-13, -104, 0x7a4fd0], [13, -104, 0x7a4fd0], [-13, -150, 0xff5a1a], [13, -150, 0xff5a1a]].forEach(function (b) {
      var ban = new T.Mesh(new T.PlaneGeometry(2, 3.4), mat(b[2], { rough: 0.85 }));
      ban.position.set(b[0], 3.4, b[1]); scene.add(ban); flags.push(ban);
    });
    // braziers with ember glow
    [[-8, -78], [8, -78], [-8, -98], [8, -98], [-8, -126], [8, -126], [-10, -166], [10, -166]].forEach(function (p, i) {
      var br = new T.Mesh(new T.CylinderGeometry(0.7, 0.4, 1.1, 8), mat(0x2a2a2a, { metal: 0.5 }));
      br.position.set(p[0], 0.55, p[1]); scene.add(br);
      var coals = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 0.25, 8),
        new T.MeshBasicMaterial({ color: 0xff5a10 }));
      coals.position.set(p[0], 1.15, p[1]); scene.add(coals);
      torches.push({ light: null, flame: coals, glow: null, base: 0 });
      if (i % 2 === 0) { var l = new T.PointLight(0xff6a20, 18, 13, 1.8); l.position.set(p[0], 2, p[1]); scene.add(l); torches.push({ light: l, flame: coals, glow: null, base: 18 }); }
    });
    makeTorch(-12, -52, true); makeTorch(12, -52, true);
    makeTorch(-12, -144, true); makeTorch(12, -144, true);
    // lava cracks in the vault (emissive strips)
    for (var lc = 0; lc < 6; lc++) {
      var crack = box(ED.rand(3, 6), 0.06, 0.5, 0x000000, { emissive: 0xff4a00, ei: 2.2 });
      crack.position.set(ED.rand(-11, 11), 0.04, ED.rand(-164, -144));
      crack.rotation.y = ED.rand(0, 3); scene.add(crack);
    }
    // rubble
    for (var rb = 0; rb < 20; rb++) {
      var rub = new T.Mesh(new T.DodecahedronGeometry(ED.rand(0.3, 0.8), 0), mat(0x55504a));
      rub.position.set(ED.rand(-14, 14), 0.3, ED.rand(-166, -50));
      if (Math.abs(rub.position.x) < 3 && rub.position.z > -96 && rub.position.z < -80) continue;
      scene.add(rub);
    }
    // dust + rising embers
    var dust = makePoints(140, 0xc8b890, 0.09, { x1: -15, x2: 15, z1: -168, z2: -50 }, 0.3, 5);
    particleSystems.push({ kind: 'dust', sys: dust });
    var embers = makePoints(90, 0xff6a20, 0.14, { x1: -15, x2: 15, z1: -168, z2: -50 }, 0.2, 3);
    particleSystems.push({ kind: 'embers', sys: embers });
    // chests: one per hall
    addChest(-12, -74);
    addChest(12, -108);
  }

  ED.buildWorld = function () {
    scene = new T.Scene();
    scene.background = new T.Color(0x141021);
    scene.fog = new T.Fog(0x141021, 45, 150);
    camera = new T.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 300);
    renderer = new T.WebGLRenderer({ canvas: ED.$('game'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    // lights: warm sun + cool ambient
    var hemi = new T.HemisphereLight(0x8a9fd8, 0x3a2a1a, 0.85);
    scene.add(hemi);
    var sun = new T.DirectionalLight(0xffe0b0, 1.5);
    sun.position.set(30, 50, 40); scene.add(sun);
    var deep = new T.AmbientLight(0x402a18, 0.5); scene.add(deep);
    buildHub(); buildForest(); buildDungeon();
    ED.scene = scene; ED.camera = camera; ED.renderer = renderer;
    ED.walls = walls; ED.gates = gates; ED.chestList = chestList;
    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  };

  // Push a circle (x,z,r) out of wall AABBs. Returns corrected [x,z].
  ED.collide = function (x, z, r) {
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      var cx = ED.clamp(x, w.x1, w.x2), cz = ED.clamp(z, w.z1, w.z2);
      var dx = x - cx, dz = z - cz;
      var d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          var d = Math.sqrt(d2);
          x = cx + dx / d * r; z = cz + dz / d * r;
        } else {
          // centre inside the box: push out along the smallest overlap axis
          var l = x - (w.x1 - r), rr = (w.x2 + r) - x, t = z - (w.z1 - r), bb = (w.z2 + r) - z;
          var m = Math.min(l, rr, t, bb);
          if (m === l) x = w.x1 - r; else if (m === rr) x = w.x2 + r;
          else if (m === t) z = w.z1 - r; else z = w.z2 + r;
        }
      }
    }
    // world bounds
    x = ED.clamp(x, -21.5, 21.5); z = ED.clamp(z, -169, 47.5);
    return [x, z];
  };
  ED.openGate = function (key) {
    var g = gates[key];
    if (!g || g.open) return false;
    g.open = true;
    var wi = walls.indexOf(g.wall);
    if (wi >= 0) walls.splice(wi, 1);
    g.door.visible = false;
    ED.sfx('gate');
    return true;
  };
  ED.isGateOpen = function (key) { return !!(gates[key] && gates[key].open); };

  ED.updateWorld = function (dt, t) {
    var i, p;
    // torch flames flicker
    for (i = 0; i < torches.length; i++) {
      var tc = torches[i];
      if (tc.flame) {
        var f = 0.85 + Math.sin(t * 11 + i * 1.7) * 0.12 + Math.sin(t * 23 + i) * 0.05;
        tc.flame.scale.set(f, 1 + (f - 0.85) * 1.4, f);
      }
      if (tc.light) tc.light.intensity = tc.base * (0.88 + Math.sin(t * 9 + i * 2.3) * 0.12);
    }
    // flags and banners sway
    for (i = 0; i < flags.length; i++) flags[i].rotation.y = Math.sin(t * 1.6 + i * 1.3) * 0.14;
    // townsfolk wander their loops
    for (i = 0; i < npcs.length; i++) {
      var n = npcs[i];
      if (n.hammering) {
        n.group.rotation.y = Math.PI + Math.sin(t * 5) * 0.15;
        n.group.position.y = Math.abs(Math.sin(t * 5)) * 0.06;
        continue;
      }
      var target = n.path[n.wp];
      var dx = target[0] - n.group.position.x, dz = target[1] - n.group.position.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < 0.3) { n.wp = (n.wp + 1) % n.path.length; continue; }
      n.group.position.x += dx / d * n.speed * dt;
      n.group.position.z += dz / d * n.speed * dt;
      n.group.rotation.y = Math.atan2(dx, dz);
      n.group.position.y = Math.abs(Math.sin(t * 8 + n.phase)) * 0.05;
    }
    // critters hop around
    for (i = 0; i < critters.length; i++) {
      var c = critters[i];
      c.wait -= dt;
      if (c.wait <= 0) {
        c.tx = ED.clamp(c.group.position.x + ED.rand(-6, 6), -16, 16);
        c.tz = ED.clamp(c.group.position.z + ED.rand(-6, 6), -44, 4);
        c.wait = ED.rand(1.5, 4);
      }
      var cdx = c.tx - c.group.position.x, cdz = c.tz - c.group.position.z;
      var cd = Math.sqrt(cdx * cdx + cdz * cdz);
      if (cd > 0.2) {
        c.group.position.x += cdx / cd * 1.6 * dt;
        c.group.position.z += cdz / cd * 1.6 * dt;
        c.group.rotation.y = Math.atan2(cdx, cdz);
        c.group.position.y = Math.abs(Math.sin(t * 10 + i)) * 0.25;
      }
    }
    // particles
    for (i = 0; i < particleSystems.length; i++) {
      var ps = particleSystems[i], sys = ps.sys;
      var pos = sys.pts.geometry.attributes.position.array;
      for (p = 0; p < sys.count; p++) {
        var s = sys.seed;
        if (ps.kind === 'firefly') {
          pos[p * 3] += Math.sin(t * 0.7 + s[p * 3]) * 0.008;
          pos[p * 3 + 1] += Math.cos(t * 0.9 + s[p * 3 + 1]) * 0.006;
          pos[p * 3 + 2] += Math.cos(t * 0.5 + s[p * 3 + 2]) * 0.008;
        } else if (ps.kind === 'leaves') {
          pos[p * 3 + 1] -= dt * (0.5 + s[p * 3] * 0.08);
          pos[p * 3] += Math.sin(t * 1.2 + s[p * 3 + 1]) * 0.01;
          if (pos[p * 3 + 1] < 0.1) pos[p * 3 + 1] = sys.yBase + sys.ySpread;
        } else if (ps.kind === 'embers') {
          pos[p * 3 + 1] += dt * (0.8 + s[p * 3] * 0.1);
          pos[p * 3] += Math.sin(t * 2 + s[p * 3 + 2]) * 0.012;
          if (pos[p * 3 + 1] > sys.yBase + sys.ySpread) pos[p * 3 + 1] = sys.yBase;
        } else if (ps.kind === 'spray') {
          pos[p * 3 + 1] += dt * (1.2 + s[p * 3] * 0.1);
          if (pos[p * 3 + 1] > sys.yBase + sys.ySpread) pos[p * 3 + 1] = sys.yBase;
        } else { // dust / pollen: slow drift
          pos[p * 3] += Math.sin(t * 0.4 + s[p * 3]) * 0.004;
          pos[p * 3 + 1] += Math.sin(t * 0.6 + s[p * 3 + 1]) * 0.003;
        }
      }
      sys.pts.geometry.attributes.position.needsUpdate = true;
    }
    // chest glow pulse
    for (i = 0; i < chestList.length; i++) {
      var ch = chestList[i];
      if (!ch.opened && ch.glow) ch.glow.material.opacity = 0.1 + Math.sin(t * 2.5 + i) * 0.06;
    }
  };
})();
