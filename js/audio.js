/* BLOCKHEAD ZOMBIES — procedural audio.
   Every sound is synthesised at runtime: zero asset downloads, so the game
   installs and runs offline from a single cached bundle. The AudioContext is
   created lazily on the first user gesture to satisfy mobile autoplay rules. */
(function (BZ) {
  'use strict';

  var ctx = null, master = null, musicGain = null, sfxGain = null;
  var started = false;
  var muted = false;
  var songTimer = null;

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 1;
    sfxGain.connect(master);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.0;
    musicGain.connect(master);
    return ctx;
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  // --- primitives -----------------------------------------------------------
  function tone(opts) {
    if (!ctx || muted) return;
    var t0 = now() + (opts.delay || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = opts.type || 'square';
    osc.frequency.setValueAtTime(opts.f0, t0);
    if (opts.f1 != null) {
      if (opts.exp) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.f1), t0 + opts.dur);
      else osc.frequency.linearRampToValueAtTime(opts.f1, t0 + opts.dur);
    }
    var peak = (opts.gain == null ? 0.2 : opts.gain);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(g);
    g.connect(opts.bus || sfxGain);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.02);
  }

  var noiseBuf = null;
  function noise(dur, gain, filterType, f0, f1, delay) {
    if (!ctx || muted) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.0, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var t0 = now() + (delay || 0);
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    var flt = ctx.createBiquadFilter();
    flt.type = filterType || 'lowpass';
    flt.frequency.setValueAtTime(f0, t0);
    if (f1 != null) flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt); flt.connect(g); g.connect(sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // --- game sounds ----------------------------------------------------------
  var SHOT = {
    pistol:   function () { noise(0.10, 0.30, 'bandpass', 1600, 500); tone({ type: 'square', f0: 220, f1: 60, dur: 0.09, gain: 0.18, exp: true }); },
    smg:      function () { noise(0.06, 0.22, 'bandpass', 2000, 700); tone({ type: 'square', f0: 260, f1: 90, dur: 0.05, gain: 0.12, exp: true }); },
    shotgun:  function () { noise(0.26, 0.42, 'lowpass', 1800, 180); tone({ type: 'sawtooth', f0: 140, f1: 40, dur: 0.22, gain: 0.22, exp: true }); },
    ar:       function () { noise(0.08, 0.30, 'bandpass', 1800, 600); tone({ type: 'square', f0: 240, f1: 70, dur: 0.07, gain: 0.16, exp: true }); },
    lmg:      function () { noise(0.05, 0.26, 'bandpass', 1500, 500); tone({ type: 'sawtooth', f0: 200, f1: 80, dur: 0.05, gain: 0.14, exp: true }); },
    sniper:   function () { noise(0.42, 0.40, 'lowpass', 2600, 120); tone({ type: 'sawtooth', f0: 320, f1: 40, dur: 0.36, gain: 0.26, exp: true }); },
    energy:   function () { tone({ type: 'sine', f0: 900, f1: 180, dur: 0.20, gain: 0.26, exp: true }); tone({ type: 'square', f0: 1400, f1: 300, dur: 0.14, gain: 0.10, exp: true }); },
    launcher: function () { noise(0.20, 0.34, 'lowpass', 900, 120); tone({ type: 'sawtooth', f0: 110, f1: 34, dur: 0.26, gain: 0.24, exp: true }); },
    meme:     function () { tone({ type: 'triangle', f0: 300 + Math.random() * 500, f1: 120, dur: 0.05, gain: 0.10, exp: true }); }
  };

  var API = {
    init: function () {
      if (started) { if (ctx && ctx.state === 'suspended') ctx.resume(); return; }
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
      started = true;
    },
    setMuted: function (m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.9;
    },
    isMuted: function () { return muted; },

    shoot: function (kind) { (SHOT[kind] || SHOT.pistol)(); },
    dry:   function () { tone({ type: 'square', f0: 130, f1: 90, dur: 0.05, gain: 0.10, exp: true }); },
    reload: function () {
      noise(0.05, 0.14, 'bandpass', 900, 600);
      noise(0.05, 0.16, 'bandpass', 1300, 800, 0.14);
    },
    hit:  function () { noise(0.05, 0.18, 'bandpass', 700, 300); },
    melee: function () { noise(0.14, 0.24, 'lowpass', 1200, 200); tone({ type: 'triangle', f0: 180, f1: 60, dur: 0.12, gain: 0.12, exp: true }); },

    oof: function () {
      // The signature descending grunt.
      tone({ type: 'square', f0: 420, f1: 150, dur: 0.16, gain: 0.24, exp: true });
      tone({ type: 'sawtooth', f0: 210, f1: 80, dur: 0.20, gain: 0.14, exp: true, delay: 0.02 });
    },
    zombieGroan: function () {
      var base = 90 + Math.random() * 60;
      tone({ type: 'sawtooth', f0: base, f1: base * 0.6, dur: 0.55, gain: 0.07, exp: true });
      noise(0.5, 0.05, 'lowpass', 500, 200);
    },
    bark: function () {
      tone({ type: 'sawtooth', f0: 520, f1: 200, dur: 0.10, gain: 0.18, exp: true });
      tone({ type: 'square', f0: 380, f1: 140, dur: 0.12, gain: 0.10, exp: true, delay: 0.10 });
    },

    buy:   function () { tone({ type: 'square', f0: 660, dur: 0.07, gain: 0.16 }); tone({ type: 'square', f0: 990, dur: 0.12, gain: 0.16, delay: 0.07 }); },
    deny:  function () { tone({ type: 'square', f0: 200, dur: 0.09, gain: 0.16 }); tone({ type: 'square', f0: 150, dur: 0.14, gain: 0.16, delay: 0.09 }); },
    points: function () { tone({ type: 'sine', f0: 1200, dur: 0.05, gain: 0.05 }); },
    door:  function () { noise(0.55, 0.28, 'lowpass', 700, 90); tone({ type: 'sawtooth', f0: 90, f1: 45, dur: 0.5, gain: 0.12, exp: true }); },

    perk: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone({ type: 'triangle', f0: f, dur: 0.16, gain: 0.15, delay: i * 0.09 });
      });
    },
    powerup: function () {
      [784, 1047, 1319].forEach(function (f, i) {
        tone({ type: 'square', f0: f, dur: 0.13, gain: 0.14, delay: i * 0.06 });
      });
    },
    nuke: function () {
      noise(1.2, 0.40, 'lowpass', 1200, 60);
      tone({ type: 'sawtooth', f0: 180, f1: 28, dur: 1.1, gain: 0.24, exp: true });
    },
    boxSpin: function () {
      for (var i = 0; i < 14; i++) {
        tone({ type: 'square', f0: 400 + i * 60, dur: 0.06, gain: 0.08, delay: i * 0.11 });
      }
    },
    teddy: function () {
      [660, 587, 523, 440].forEach(function (f, i) {
        tone({ type: 'triangle', f0: f, dur: 0.18, gain: 0.16, delay: i * 0.13 });
      });
    },
    power: function () {
      tone({ type: 'sawtooth', f0: 60, f1: 240, dur: 1.4, gain: 0.22 });
      noise(1.4, 0.12, 'highpass', 200, 2400);
    },
    pack: function () {
      [392, 523, 659, 784, 1047, 1319].forEach(function (f, i) {
        tone({ type: 'square', f0: f, dur: 0.14, gain: 0.13, delay: i * 0.07 });
      });
    },
    roundStart: function (round) {
      var root = 110;
      [0, 3, 7].forEach(function (s, i) {
        tone({ type: 'sawtooth', f0: root * Math.pow(2, s / 12), dur: 0.9, gain: 0.12, delay: i * 0.16 });
      });
      if (round % 5 === 0) API.bark();
    },
    secret: function () {
      [1047, 1319, 1568, 2093].forEach(function (f, i) {
        tone({ type: 'triangle', f0: f, dur: 0.22, gain: 0.16, delay: i * 0.10 });
      });
    },
    hurt: function () { noise(0.16, 0.22, 'lowpass', 600, 140); },

    /* The hidden anthem — unlocked by the teddy bear secret. Two-bar loop of
       bass + lead, scheduled ahead in chunks so it survives frame hitches. */
    startSong: function () {
      if (!ctx || songTimer) return;
      musicGain.gain.setTargetAtTime(0.5, now(), 0.6);
      var lead = [0, 3, 5, 7, 10, 7, 5, 3, 0, 3, 5, 10, 12, 10, 7, 5];
      var bass = [0, 0, 5, 5, 7, 7, 3, 3];
      var step = 0;
      var stepDur = 0.16;
      function chunk() {
        for (var i = 0; i < 8; i++) {
          var s = step + i;
          var d = i * stepDur;
          var ln = 220 * Math.pow(2, lead[s % lead.length] / 12);
          tone({ type: 'square', f0: ln, dur: stepDur * 0.85, gain: 0.09, delay: d, bus: musicGain });
          if (s % 2 === 0) {
            var bn = 55 * Math.pow(2, bass[(s >> 1) % bass.length] / 12);
            tone({ type: 'triangle', f0: bn, dur: stepDur * 1.7, gain: 0.16, delay: d, bus: musicGain });
          }
          if (s % 4 === 2) noise(0.08, 0.10, 'highpass', 3000, 1800, d);
        }
        step += 8;
      }
      chunk();
      songTimer = setInterval(chunk, 8 * stepDur * 1000);
    },
    stopSong: function () {
      if (songTimer) { clearInterval(songTimer); songTimer = null; }
      if (musicGain) musicGain.gain.setTargetAtTime(0.0, now(), 0.4);
    },
    songPlaying: function () { return !!songTimer; }
  };

  BZ.Audio = API;
})(window.BZ = window.BZ || {});
