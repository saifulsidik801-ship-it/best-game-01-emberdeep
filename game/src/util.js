// Emberdeep — shared utilities and the global game namespace.
// All game modules attach to window.ED so the classic scripts load in order.
(function () {
  var ED = window.ED = window.ED || {};
  ED.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  ED.lerp = function (a, b, t) { return a + (b - a) * t; };
  ED.rand = function (a, b) { return a + Math.random() * (b - a); };
  ED.randInt = function (a, b) { return Math.floor(ED.rand(a, b + 1)); };
  ED.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  ED.dist2d = function (ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); };
  ED.angleTo = function (ax, az, bx, bz) { return Math.atan2(bx - ax, bz - az); };
  ED.fmtTime = function (s) {
    s = Math.max(0, Math.floor(s));
    var m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  };
  ED.fmtNum = function (n) { return Math.floor(n).toLocaleString('en-US'); };
  // Seeded RNG for deterministic world dressing (same layout every run).
  ED.mulberry32 = function (seed) {
    var t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  };
  ED.$ = function (id) { return document.getElementById(id); };
  ED.show = function (id) { var e = ED.$(id); if (e) e.classList.remove('hidden'); };
  ED.hide = function (id) { var e = ED.$(id); if (e) e.classList.add('hidden'); };
  ED.isShown = function (id) { var e = ED.$(id); return !!e && !e.classList.contains('hidden'); };
})();
