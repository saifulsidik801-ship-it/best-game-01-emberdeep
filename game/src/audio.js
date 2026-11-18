// Emberdeep — synthesized sound: WebAudio only, no audio files.
(function () {
  var ED = window.ED;
  var ctx = null, master = null, muted = false, ambientNodes = null;

  function ensure() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }
  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!ensure() || muted) return;
    var t0 = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, vol, filterFreq, delay) {
    if (!ensure() || muted) return;
    var t0 = ctx.currentTime + (delay || 0);
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
    var g = ctx.createGain(); g.gain.value = vol || 0.25;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }
  ED.sfx = function (name) {
    if (muted) return;
    switch (name) {
      case 'swing': noise(0.12, 0.12, 2600); break;
      case 'hit': tone(180, 0.1, 'square', 0.16, 90); noise(0.08, 0.14, 900); break;
      case 'crit': tone(520, 0.14, 'square', 0.2, 140); noise(0.1, 0.16, 1600); break;
      case 'hurt': tone(140, 0.22, 'sawtooth', 0.22, 60); break;
      case 'die': tone(320, 0.35, 'sawtooth', 0.16, 50); noise(0.25, 0.12, 700); break;
      case 'coin': tone(880, 0.09, 'sine', 0.16); tone(1320, 0.14, 'sine', 0.14, null, 0.07); break;
      case 'relic': tone(523, 0.14, 'sine', 0.18); tone(659, 0.14, 'sine', 0.18, null, 0.1); tone(784, 0.22, 'sine', 0.2, null, 0.2); break;
      case 'levelup': [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.18, 'triangle', 0.2, null, i * 0.09); }); break;
      case 'nova': noise(0.5, 0.3, 500); tone(220, 0.5, 'sawtooth', 0.2, 55); break;
      case 'dodge': noise(0.16, 0.1, 1800); break;
      case 'gate': tone(110, 0.6, 'sine', 0.22, 220); tone(165, 0.6, 'sine', 0.14, 330, 0.1); break;
      case 'chest': tone(660, 0.1, 'triangle', 0.18); tone(990, 0.2, 'triangle', 0.18, null, 0.08); break;
      case 'boss': tone(70, 0.9, 'sawtooth', 0.3, 40); noise(0.7, 0.2, 300); break;
      case 'win': [523, 659, 784, 1046, 1318].forEach(function (f, i) { tone(f, 0.3, 'triangle', 0.2, null, i * 0.12); }); break;
      case 'lose': [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0.35, 'triangle', 0.18, null, i * 0.16); }); break;
      case 'feat': tone(1046, 0.12, 'sine', 0.16); tone(1568, 0.2, 'sine', 0.16, null, 0.09); break;
      case 'click': tone(700, 0.05, 'square', 0.08); break;
      default: break;
    }
  };
  ED.toggleMute = function () { muted = !muted; return muted; };
  ED.isMuted = function () { return muted; };
  ED.unlockAudio = function () { if (ensure() && ctx.state === 'suspended') ctx.resume(); };
  // Quiet wind + crackle bed, started on first gesture.
  ED.startAmbient = function () {
    if (!ensure() || ambientNodes || muted) return;
    try {
      var len = ctx.sampleRate * 2;
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0), last = 0;
      for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      var g = ctx.createGain(); g.gain.value = 0.05;
      var lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
      var lg = ctx.createGain(); lg.gain.value = 0.025;
      lfo.connect(lg); lg.connect(g.gain);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(); lfo.start();
      ambientNodes = { src: src, lfo: lfo };
    } catch (e) { /* ambient is optional */ }
  };
})();
