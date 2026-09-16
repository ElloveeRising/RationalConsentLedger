/* BLOCKHEAD ZOMBIES — everything on the map that isn't a zombie or you.
   Interlopers wander in between hordes to say one stupid thing and leave.
   Turrets and minions come from class abilities. All three share the same
   update/draw pass, and all of them reach the world through `H`, a small set
   of helpers game.js hands over so this file never reaches back into it. */
(function (BZ) {
  'use strict';

  var H = null;                // helpers injected by game.js
  var T = BZ.TILE;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }

  /* Finds a walkable tile in an unlocked zone, roughly `dist` away. */
  function findSpot(S, dist, tries) {
    for (var i = 0; i < (tries || 40); i++) {
      var a = Math.random() * Math.PI * 2;
      var d = dist * rand(0.6, 1.3);
      var x = S.player.x + Math.cos(a) * d;
      var y = S.player.y + Math.sin(a) * d;
      var tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (tx < 1 || ty < 1 || tx >= BZ.MAP_W - 1 || ty >= BZ.MAP_H - 1) continue;
      if (H.blocked(x, y, 15)) continue;
      var zone = S.world.zones[ty * BZ.MAP_W + tx];
      if (!zone || !S.unlocked[zone]) continue;
      return { x: x, y: y };
    }
    return null;
  }

  function nearestZombie(S, x, y, range) {
    var best = null, bestD = range * range;
    for (var i = 0; i < S.zombies.length; i++) {
      var z = S.zombies[i];
      if (z.state === 'outside') continue;
      var dx = z.x - x, dy = z.y - y;
      var d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = z; }
    }
    return best;
  }

  /* ------------------------------------------------------------ INTERLOPERS */
  function spawnInterloper(S, forceId) {
    if (S.interlopers.length >= 2) return null;
    var pool = [];
    BZ.INTERLOPERS.forEach(function (d) {
      var n = d.weight || 3;
      for (var i = 0; i < n; i++) pool.push(d);
    });
    var def = forceId
      ? BZ.INTERLOPERS.filter(function (d) { return d.id === forceId; })[0]
      : pick(pool);
    if (!def) return null;

    var spot = findSpot(S, 300) || findSpot(S, 170);
    if (!spot) return null;

    var a = Math.random() * Math.PI * 2;
    var it = {
      def: def, x: spot.x, y: spot.y,
      vx: Math.cos(a), vy: Math.sin(a),
      life: def.dur || 15,
      say: 3.2,                 // speech bubble timer
      phase: rand(0, 6.3),
      used: false,
      hop: 0,
      alpha: 1,
      flickerT: rand(0.6, 1.6),
      aim: { x: 1, y: 0 }
    };
    S.interlopers.push(it);
    H.emit('interloper', { name: def.name, line: def.line });
    BZ.Audio.points();
    return it;
  }

  function applyEffect(S, it) {
    if (it.used) return;
    var def = it.def;
    var pl = S.player;
    switch (def.effect) {
      case 'points':
        it.used = true;
        H.floater(it.x, it.y - 46, '+' + H.award(def.amount), BZ.COLORS.sodium, true);
        BZ.Audio.buy();
        break;
      case 'steal':
        it.used = true;
        pl.points = Math.max(0, pl.points - def.amount);
        H.floater(it.x, it.y - 46, '-' + def.amount, BZ.COLORS.red, true);
        H.emit('toast', { text: 'THE SNACK TAXMAN GOT YOU.', tone: 'bad' });
        BZ.Audio.deny();
        it.flee = true;
        break;
      case 'buff':
        it.used = true;
        pl.dmgMul *= 1.15;
        S.active.mewing = def.amount;
        H.emit('toast', { text: 'JAWLINE ACQUIRED. +15% DAMAGE.', tone: 'secret' });
        BZ.Audio.perk();
        break;
      case 'flash':
        it.used = true;
        for (var i = 0; i < S.zombies.length; i++) {
          S.zombies[i].stunT = Math.max(S.zombies[i].stunT || 0, def.amount);
        }
        S.flash = 0.85;
        H.emit('toast', { text: 'PHOTO TAKEN. EVERYONE IS STUNNED.', tone: 'good' });
        BZ.Audio.powerup();
        break;
      case 'powerup':
        it.used = true;
        H.grantPowerup(pick(['maxammo', 'instakill', 'double', 'nuke', 'carpenter', 'fire']), it.x, it.y);
        BZ.Audio.teddy();
        break;
      case 'minion':
        it.used = true;
        S.minions.push(makeMinion(it.x, it.y, 'broski', 26, it.def.skin));
        H.emit('toast', { text: 'LIL BROSKI IS FIGHTING FOR YOU.', tone: 'good' });
        BZ.Audio.perk();
        it.life = 0;
        break;
    }
  }

  function updateInterlopers(S, dt) {
    var pl = S.player;
    for (var i = S.interlopers.length - 1; i >= 0; i--) {
      var it = S.interlopers[i];
      var def = it.def;
      it.life -= dt;
      it.say -= dt;
      it.phase += dt * 7;
      if (def.repeat && it.say <= -2.5) it.say = 3.0;   // Greg never stops

      var sp = (def.speed || 60) * dt;
      var toP = { x: pl.x - it.x, y: pl.y - it.y };
      var dP = Math.hypot(toP.x, toP.y) || 1;

      switch (def.behaviour) {
        case 'idle':
          break;
        case 'cross':
          if (H.blocked(it.x + it.vx * sp, it.y, 13)) it.vx *= -1;
          if (H.blocked(it.x, it.y + it.vy * sp, 13)) it.vy *= -1;
          it.x += it.vx * sp; it.y += it.vy * sp;
          break;
        case 'phase':
          // Walks through walls, because he is simply too large to be stopped.
          it.x += it.vx * sp; it.y += it.vy * sp;
          break;
        case 'follow':
        case 'escort':
          if (it.flee) {
            it.x -= toP.x / dP * sp * 1.3;
            it.y -= toP.y / dP * sp * 1.3;
          } else if (dP > 34) {
            H.moveBy(it, toP.x / dP * sp, toP.y / dP * sp, 13);
          }
          break;
        case 'linger':
        case 'oblivious': {
          var tgt = def.behaviour === 'oblivious' ? nearestZombie(S, it.x, it.y, 420) : null;
          if (tgt) {
            var tdx = tgt.x - it.x, tdy = tgt.y - it.y;
            var td = Math.hypot(tdx, tdy) || 1;
            H.moveBy(it, tdx / td * sp, tdy / td * sp, 13);
          } else {
            if (Math.random() < dt * 0.9) {
              var na = Math.random() * Math.PI * 2;
              it.vx = Math.cos(na); it.vy = Math.sin(na);
            }
            if (H.blocked(it.x + it.vx * sp, it.y, 13)) it.vx *= -1;
            if (H.blocked(it.x, it.y + it.vy * sp, 13)) it.vy *= -1;
            it.x += it.vx * sp; it.y += it.vy * sp;
          }
          break;
        }
        case 'bounce':
          it.hop += dt * 8;
          if (Math.random() < dt * 1.4) {
            var ba = Math.random() * Math.PI * 2;
            it.vx = Math.cos(ba); it.vy = Math.sin(ba);
          }
          if (H.blocked(it.x + it.vx * sp, it.y, 13)) it.vx *= -1;
          if (H.blocked(it.x, it.y + it.vy * sp, 13)) it.vy *= -1;
          it.x += it.vx * sp; it.y += it.vy * sp;
          break;
        case 'flicker':
          it.flickerT -= dt;
          if (it.flickerT <= 0) {
            it.flickerT = rand(0.8, 2.0);
            var spot = findSpot(S, 190, 14);
            if (spot) { it.x = spot.x; it.y = spot.y; }
            H.burst(it.x, it.y - 20, '#cbb994', 8, 120);
          }
          it.alpha = 0.55 + 0.45 * Math.sin(it.phase * 0.6);
          break;
      }

      it.aim = { x: toP.x / dP, y: toP.y / dP };

      // Proximity effect
      if (!it.used && dP < 40) applyEffect(S, it);

      // The oblivious one does, in fact, get got.
      if (def.behaviour === 'oblivious') {
        var near = nearestZombie(S, it.x, it.y, 30);
        if (near) {
          H.emit('toast', { text: 'AIRPODS KID DID NOT HEAR THAT COMING.', tone: 'bad' });
          H.burst(it.x, it.y - 20, '#a78bfa', 18, 200);
          BZ.Audio.oof();
          it.life = 0;
        }
      }

      if (it.life <= 0) S.interlopers.splice(i, 1);
    }
  }

  /* ---------------------------------------------------------------- TURRETS */
  function deployTurret(S, x, y) {
    S.turrets.push({
      x: x, y: y, life: 26, cd: 0, angle: 0, target: null, phase: 0
    });
    BZ.Audio.pack();
    H.emit('toast', { text: 'SENTRY DEPLOYED. IT IS DOING ITS BEST.', tone: 'good' });
  }

  function updateTurrets(S, dt) {
    for (var i = S.turrets.length - 1; i >= 0; i--) {
      var t = S.turrets[i];
      t.life -= dt;
      t.cd -= dt;
      t.phase += dt;
      if (t.life <= 0) {
        H.burst(t.x, t.y - 14, '#8b8b93', 12, 160);
        S.turrets.splice(i, 1);
        continue;
      }
      var z = nearestZombie(S, t.x, t.y, 360);
      t.target = z;
      if (!z) continue;
      var dx = z.x - t.x, dy = (z.y - 20) - (t.y - 22);
      t.angle = Math.atan2(dy, dx);
      if (t.cd <= 0) {
        t.cd = 0.21;
        S.bullets.push({
          x: t.x + Math.cos(t.angle) * 16,
          y: (t.y - 22) + Math.sin(t.angle) * 16,
          vx: Math.cos(t.angle) * 900, vy: Math.sin(t.angle) * 900,
          dmg: 58, life: 0.5, pierce: 0, hit: [], splash: 0, kind: 'smg',
          friendly: true
        });
        BZ.Audio.shoot('smg');
      }
    }
  }

  /* ---------------------------------------------------------------- MINIONS */
  function makeMinion(x, y, kind, life, skin) {
    return {
      x: x, y: y, kind: kind, life: life, hp: 220,
      phase: Math.random() * 6.3, cd: 0, aim: { x: 1, y: 0 },
      skin: skin || { skin: '#8fb862', shirt: '#4a3a5d', pants: '#2a2333', hair: null, hat: null, wide: 1 }
    };
  }

  function raiseMinions(S, x, y, count) {
    var made = 0;
    for (var i = 0; i < count; i++) {
      var a = (i / count) * Math.PI * 2;
      var mx = x + Math.cos(a) * 34, my = y + Math.sin(a) * 34;
      if (H.blocked(mx, my, 13)) { mx = x; my = y; }
      S.minions.push(makeMinion(mx, my, 'raised', 22));
      made++;
    }
    if (made) {
      BZ.Audio.perk();
      H.burst(x, y - 20, '#c77dff', 22, 200);
      H.emit('toast', { text: made + ' GUYS RAISED. THEY ARE MID BUT THEY ARE YOURS.', tone: 'secret' });
    }
    return made;
  }

  function updateMinions(S, dt) {
    for (var i = S.minions.length - 1; i >= 0; i--) {
      var m = S.minions[i];
      m.life -= dt;
      m.cd -= dt;
      m.phase += dt * 7;
      if (m.life <= 0 || m.hp <= 0) {
        H.burst(m.x, m.y - 20, '#c77dff', 12, 150);
        S.minions.splice(i, 1);
        continue;
      }
      var z = nearestZombie(S, m.x, m.y, m.kind === 'broski' ? 420 : 300);
      if (!z) {
        // stay near the player when there's nothing to fight
        var pdx = S.player.x - m.x, pdy = S.player.y - m.y;
        var pd = Math.hypot(pdx, pdy) || 1;
        if (pd > 80) H.moveBy(m, pdx / pd * 120 * dt, pdy / pd * 120 * dt, 12);
        continue;
      }
      var dx = z.x - m.x, dy = z.y - m.y;
      var d = Math.hypot(dx, dy) || 1;
      m.aim = { x: dx / d, y: dy / d };

      if (m.kind === 'broski') {
        if (d > 140) H.moveBy(m, dx / d * 160 * dt, dy / d * 160 * dt, 12);
        if (m.cd <= 0) {
          m.cd = 0.4;
          S.bullets.push({
            x: m.x + m.aim.x * 12, y: m.y - 16 + m.aim.y * 12,
            vx: m.aim.x * 820, vy: m.aim.y * 820,
            dmg: 34, life: 0.6, pierce: 0, hit: [], splash: 0, kind: 'pistol',
            friendly: true
          });
          BZ.Audio.shoot('pistol');
        }
      } else {
        H.moveBy(m, dx / d * 128 * dt, dy / d * 128 * dt, 12);
        if (d < 32 && m.cd <= 0) {
          m.cd = 0.8;
          H.damageZombie(z, 95, false);
          H.burst(m.x + m.aim.x * 20, m.y - 18, '#c77dff', 5, 100);
        }
      }
    }
  }

  /* -------------------------------------------------------------------- API */
  BZ.Crew = {
    init: function (helpers) { H = helpers; },
    reset: function (S) { S.interlopers = []; S.turrets = []; S.minions = []; },
    spawn: spawnInterloper,
    deployTurret: deployTurret,
    raiseMinions: raiseMinions,
    update: function (S, dt) {
      updateInterlopers(S, dt);
      updateTurrets(S, dt);
      updateMinions(S, dt);
    }
  };
})(window.BZ = window.BZ || {});
