/* BLOCKHEAD ZOMBIES — the possum situation.
   Hitting a milestone summons possums. The more you have achieved, the more
   possums, until finishing a shift earns the full-screen party. Everything
   here draws in SCREEN space on top of the world, so it doesn't care where
   the camera is. */
(function (BZ) {
  'use strict';

  var C = BZ.COLORS;
  var PARTY_COLORS = ['#ffb02e', '#9ef01a', '#4cc9f0', '#e03131', '#c77dff', '#f2e9df'];

  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ------------------------------------------------------------------ POSSUM
     Blocky, grey, permanently thrilled. Drawn at screen (x, y) = its feet. */
  function drawPossum(g, x, y, phase, scale, hyped) {
    var s = scale || 1;
    var bob = Math.abs(Math.sin(phase)) * 7 * s;
    var lean = Math.sin(phase * 0.5) * 0.22;
    var armL = Math.sin(phase) * 1.1;
    var armR = Math.sin(phase + Math.PI) * 1.1;

    g.save();
    g.translate(x, y);

    g.fillStyle = 'rgba(0,0,0,0.34)';
    g.beginPath();
    g.ellipse(0, 0, 17 * s, 5.5 * s, 0, 0, Math.PI * 2);
    g.fill();

    g.translate(0, -bob);
    g.rotate(lean);

    // tail — a long pink noodle that whips with the beat
    g.strokeStyle = '#e8a0b4';
    g.lineWidth = 5 * s;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-12 * s, -14 * s);
    g.quadraticCurveTo(-34 * s, -22 * s + Math.sin(phase * 1.4) * 14 * s, -26 * s, -44 * s);
    g.stroke();

    // legs
    g.fillStyle = '#6b6b74';
    g.fillRect(-10 * s, -12 * s, 6 * s, 12 * s);
    g.fillRect(4 * s, -12 * s, 6 * s, 12 * s);

    // body
    g.fillStyle = '#9a9aa4';
    g.fillRect(-13 * s, -34 * s, 26 * s, 23 * s);
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.fillRect(-13 * s, -34 * s, 26 * s, 6 * s);
    g.fillStyle = '#c9c9d2';
    g.fillRect(-7 * s, -28 * s, 14 * s, 15 * s);

    // arms, thrown with abandon
    g.save(); g.translate(-13 * s, -30 * s); g.rotate(-0.6 + armL);
    g.fillStyle = '#9a9aa4'; g.fillRect(-11 * s, -3 * s, 12 * s, 5.5 * s); g.restore();
    g.save(); g.translate(13 * s, -30 * s); g.rotate(0.6 + armR);
    g.fillStyle = '#9a9aa4'; g.fillRect(-1 * s, -3 * s, 12 * s, 5.5 * s); g.restore();

    // head
    g.fillStyle = '#c9c9d2';
    g.fillRect(-11 * s, -50 * s, 22 * s, 17 * s);
    g.fillStyle = '#e8e8f0';
    g.fillRect(-9 * s, -47 * s, 18 * s, 12 * s);
    // ears
    g.fillStyle = '#e8a0b4';
    g.fillRect(-13 * s, -55 * s, 7 * s, 7 * s);
    g.fillRect(6 * s, -55 * s, 7 * s, 7 * s);
    // snout + nose
    g.fillStyle = '#f0f0f6';
    g.fillRect(-4 * s, -40 * s, 8 * s, 7 * s);
    g.fillStyle = '#e8708f';
    g.fillRect(-2.5 * s, -36 * s, 5 * s, 4 * s);
    // eyes — wide open, always
    g.fillStyle = '#16161a';
    g.fillRect(-7 * s, -45 * s, 4 * s, 4.5 * s);
    g.fillRect(3 * s, -45 * s, 4 * s, 4.5 * s);

    if (hyped) {
      g.fillStyle = PARTY_COLORS[(phase | 0) % PARTY_COLORS.length];
      g.fillRect(-12 * s, -58 * s, 24 * s, 4 * s);   // party hat brim
      g.beginPath();
      g.moveTo(-8 * s, -58 * s); g.lineTo(0, -74 * s); g.lineTo(8 * s, -58 * s);
      g.closePath(); g.fill();
    }
    g.restore();
  }

  /* -------------------------------------------------------------------- API */
  BZ.Dance = {
    reset: function (S) { S.dance = null; S.danceSeen = 0; },

    active: function (S) { return !!(S && S.dance); },
    freezing: function (S) { return !!(S && S.dance && S.dance.freeze); },

    /* level 1-5; see BZ.DANCE_LEVELS. Re-triggering a level you've already
       had is allowed but never downgrades an in-flight party. */
    trigger: function (S, level, title, sub) {
      var def = BZ.DANCE_LEVELS[Math.max(0, Math.min(BZ.DANCE_LEVELS.length - 1, level - 1))];
      if (S.dance && S.dance.def.level >= def.level) return;

      var possums = [];
      for (var i = 0; i < def.possums; i++) {
        possums.push({
          fx: (i + 0.5) / def.possums + rand(-0.035, 0.035),  // fraction of width
          fy: def.level >= 4 ? rand(0.42, 0.92) : rand(0.70, 0.88),
          phase: rand(0, 6.3),
          speed: rand(7.5, 10.5),
          scale: def.level >= 4 ? rand(0.7, 1.35) : rand(0.9, 1.15),
          delay: i * 0.08
        });
      }

      var confetti = [];
      for (var c = 0; c < def.confetti; c++) {
        confetti.push({
          fx: Math.random(), y: rand(-1.1, 0) ,
          vy: rand(0.10, 0.30), vx: rand(-0.05, 0.05),
          rot: rand(0, 6.3), vr: rand(-7, 7),
          col: PARTY_COLORS[(Math.random() * PARTY_COLORS.length) | 0],
          w: rand(5, 11), h: rand(7, 14)
        });
      }

      S.dance = {
        def: def, t: 0, dur: def.dur,
        possums: possums, confetti: confetti,
        title: title || def.title, sub: sub || def.sub,
        freeze: def.level >= 5
      };
      S.danceSeen = Math.max(S.danceSeen || 0, def.level);
      BZ.Audio.secret();
      if (def.level >= 3 && !BZ.Audio.songPlaying()) BZ.Audio.startSong();
    },

    update: function (S, dt) {
      var d = S.dance;
      if (!d) return;
      d.t += dt;
      for (var i = 0; i < d.possums.length; i++) {
        d.possums[i].phase += dt * d.possums[i].speed;
      }
      for (var c = 0; c < d.confetti.length; c++) {
        var p = d.confetti[c];
        p.y += p.vy * dt;
        p.fx += p.vx * dt * 0.12;
        p.rot += p.vr * dt;
        if (p.y > 1.15) { p.y = -0.1; p.fx = Math.random(); }
      }
      if (d.t >= d.dur) S.dance = null;
    },

    draw: function (g, S, vw, vh) {
      var d = S.dance;
      if (!d) return;
      var def = d.def;
      // ease in and out so it never snaps
      var k = Math.min(1, d.t / 0.35) * Math.min(1, (d.dur - d.t) / 0.6);
      if (k <= 0) return;

      g.save();

      // strobe / disco wash
      if (def.strobe) {
        var hue = (d.t * 220) % 360;
        g.globalAlpha = 0.13 * k;
        g.fillStyle = 'hsl(' + hue + ',85%,55%)';
        g.fillRect(0, 0, vw, vh);
        g.globalAlpha = 0.10 * k;
        g.fillStyle = 'hsl(' + ((hue + 140) % 360) + ',85%,55%)';
        g.fillRect(0, 0, vw, vh / 2);
        g.globalAlpha = 1;
      }
      if (def.level >= 5) {
        // sweeping disco beams for the finale
        for (var b = 0; b < 5; b++) {
          var a = d.t * 1.5 + b * 1.256;
          g.save();
          g.globalAlpha = 0.11 * k;
          g.fillStyle = PARTY_COLORS[b % PARTY_COLORS.length];
          g.translate(vw / 2, -40);
          g.rotate(Math.sin(a) * 0.75);
          g.beginPath();
          g.moveTo(-26, 0); g.lineTo(26, 0);
          g.lineTo(190, vh + 120); g.lineTo(-190, vh + 120);
          g.closePath(); g.fill();
          g.restore();
        }
        g.globalAlpha = 1;
      }

      // confetti
      for (var c = 0; c < d.confetti.length; c++) {
        var p = d.confetti[c];
        if (p.y < -0.05) continue;
        g.save();
        g.globalAlpha = k;
        g.translate(p.fx * vw, p.y * vh);
        g.rotate(p.rot);
        g.fillStyle = p.col;
        g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        g.restore();
      }
      g.globalAlpha = 1;

      // possums
      for (var i = 0; i < d.possums.length; i++) {
        var po = d.possums[i];
        if (d.t < po.delay) continue;
        g.globalAlpha = k;
        drawPossum(g, po.fx * vw, po.fy * vh, po.phase, po.scale * (vw < 560 ? 0.78 : 1), def.level >= 3);
      }
      g.globalAlpha = 1;

      // banner
      var cy = def.level >= 4 ? vh * 0.22 : vh * 0.30;
      g.textAlign = 'center';
      g.globalAlpha = k;
      g.font = 'bold ' + Math.round(Math.min(56, vw * 0.085)) + 'px "Silkscreen", monospace';
      g.lineWidth = 6;
      g.strokeStyle = 'rgba(10,7,5,0.85)';
      g.strokeText(d.title, vw / 2, cy);
      g.fillStyle = def.level >= 3 ? PARTY_COLORS[(d.t * 8 | 0) % PARTY_COLORS.length] : C.sodium;
      g.fillText(d.title, vw / 2, cy);

      g.font = 'bold ' + Math.round(Math.min(15, vw * 0.028)) + 'px "Archivo", sans-serif';
      g.strokeStyle = 'rgba(10,7,5,0.85)';
      g.lineWidth = 4;
      g.strokeText(d.sub.toUpperCase(), vw / 2, cy + 28);
      g.fillStyle = C.bone;
      g.fillText(d.sub.toUpperCase(), vw / 2, cy + 28);
      g.globalAlpha = 1;

      g.restore();
    },

    drawPossum: drawPossum
  };
})(window.BZ = window.BZ || {});
