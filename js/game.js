/* BLOCKHEAD ZOMBIES — simulation + frame rendering.
   game.js owns all state and draws the world; main.js owns the DOM around it
   and listens through Game.on(). Zombies navigate with a BFS flow field
   recomputed a few times a second rather than per-entity pathfinding, which
   keeps 40 of them cheap enough for a phone. */
(function (BZ) {
  'use strict';

  var T = BZ.TILE, MW = BZ.MAP_W, MH = BZ.MAP_H;
  var S = null;            // live state; null until start()
  var canvas, ctx, dpr = 1;
  var listeners = [];
  var vw = 0, vh = 0;      // CSS-pixel viewport

  function emit(kind, payload) {
    for (var i = 0; i < listeners.length; i++) listeners[i](kind, payload);
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  /* ------------------------------------------------------------- COLLISION */
  function solidTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return true;
    var i = ty * MW + tx;
    var t = S.world.tiles[i];
    if (t === BZ.T_FLOOR) return false;
    if (t === BZ.T_DOOR) return !S.world.openDoors[S.world.doorAt[i]];
    return true;
  }
  function blocked(x, y, r) {
    var x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T);
    var y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
    for (var ty = y0; ty <= y1; ty++) {
      for (var tx = x0; tx <= x1; tx++) {
        if (!solidTile(tx, ty)) continue;
        var nx = clamp(x, tx * T, tx * T + T);
        var ny = clamp(y, ty * T, ty * T + T);
        var dx = x - nx, dy = y - ny;
        if (dx * dx + dy * dy < r * r) return true;
      }
    }
    return false;
  }
  function moveBy(e, dx, dy, r) {
    if (dx && !blocked(e.x + dx, e.y, r)) e.x += dx;
    if (dy && !blocked(e.x, e.y + dy, r)) e.y += dy;
  }

  /* ------------------------------------------------------------ FLOW FIELD */
  function computeFlow() {
    var f = S.flow;
    f.fill(-1);
    var px = Math.floor(S.player.x / T), py = Math.floor(S.player.y / T);
    if (px < 0 || py < 0 || px >= MW || py >= MH || solidTile(px, py)) return;
    var q = S.flowQueue;
    var head = 0, tail = 0;
    var start = py * MW + px;
    f[start] = 0; q[tail++] = start;
    while (head < tail) {
      var i = q[head++];
      var d = f[i] + 1;
      var x = i % MW, y = (i / MW) | 0;
      // 4-neighbour expansion; diagonal smoothing happens at movement time
      if (x > 0      && f[i - 1]  === -1 && !solidTile(x - 1, y)) { f[i - 1]  = d; q[tail++] = i - 1; }
      if (x < MW - 1 && f[i + 1]  === -1 && !solidTile(x + 1, y)) { f[i + 1]  = d; q[tail++] = i + 1; }
      if (y > 0      && f[i - MW] === -1 && !solidTile(x, y - 1)) { f[i - MW] = d; q[tail++] = i - MW; }
      if (y < MH - 1 && f[i + MW] === -1 && !solidTile(x, y + 1)) { f[i + MW] = d; q[tail++] = i + MW; }
    }
  }

  // Unit vector down the steepest descent of the flow field.
  function flowDir(x, y) {
    var tx = Math.floor(x / T), ty = Math.floor(y / T);
    var best = null, bestD = Infinity;
    for (var oy = -1; oy <= 1; oy++) {
      for (var ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        var nx = tx + ox, ny = ty + oy;
        if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
        if (solidTile(nx, ny)) continue;
        // no cutting diagonal corners through walls
        if (ox && oy && (solidTile(tx + ox, ty) || solidTile(tx, ty + oy))) continue;
        var d = S.flow[ny * MW + nx];
        if (d < 0) continue;
        var cost = d + (ox && oy ? 0.42 : 0);
        if (cost < bestD) { bestD = cost; best = { x: nx, y: ny }; }
      }
    }
    if (!best) return null;
    var cx = (best.x + 0.5) * T, cy = (best.y + 0.5) * T;
    var dx = cx - x, dy = cy - y, l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  }

  /* ----------------------------------------------------------------- SETUP */
  function makeWeapon(id, pap) {
    var def = BZ.WEAPONS[id];
    var mul = pap ? 2 : 1;
    return {
      id: id, def: def, pap: !!pap,
      ammo: def.mag, reserve: Math.round(def.reserve * (pap ? 1.5 : 1)),
      dmgMul: mul
    };
  }
  function weaponName(w) {
    return w.pap ? BZ.PAP_NAMES[w.id] : w.def.name;
  }

  function buildProps() {
    var props = [];
    function wc(o) { var c = BZ.tileCenter(o.x, o.y); return { wx: c.x, wy: c.y }; }

    BZ.WALLBUYS.forEach(function (o) {
      props.push(Object.assign({ type: 'wallbuy', zone: o.zone, weapon: o.weapon, r: 46 }, wc(o)));
    });
    BZ.PERK_SPOTS.forEach(function (o) {
      props.push(Object.assign({ type: 'perk', zone: o.zone, perk: o.perk, powered: false, r: 46 }, wc(o)));
    });
    BZ.WINDOWS.forEach(function (o, i) {
      props.push(Object.assign({ type: 'window', id: 'w' + i, zone: o.zone, dir: o.dir, boards: 6, r: 44 }, wc(o)));
    });
    BZ.SECRET_PROPS.forEach(function (o) {
      props.push(Object.assign({ type: o.kind, id: o.id, zone: o.zone, taken: false, hits: 0, r: 46 }, wc(o)));
    });
    props.push(Object.assign({ type: 'power', zone: BZ.POWER_SWITCH.zone, on: false, r: 52 }, wc(BZ.POWER_SWITCH)));
    props.push(Object.assign({ type: 'pack', zone: BZ.PACK_SPOT.zone, powered: false, r: 56 }, wc(BZ.PACK_SPOT)));
    var boxSpot = BZ.BOX_SPOTS[0];
    props.push(Object.assign({ type: 'box', zone: boxSpot.zone, spinning: false, spinT: 0, spins: 0, r: 52 }, wc(boxSpot)));
    props.push(Object.assign({ type: 'vault', zone: 'admin', open: false, used: false, r: 50 }, wc({ x: 41, y: 22 })));
    return props;
  }

  function findProp(type) {
    for (var i = 0; i < S.props.length; i++) if (S.props[i].type === type) return S.props[i];
    return null;
  }

  BZ.Game = {
    on: function (fn) { listeners.push(fn); },

    attach: function (cv) {
      canvas = cv;
      ctx = cv.getContext('2d', { alpha: false });
      BZ.Input.attach(cv);
      window.addEventListener('resize', BZ.Game.resize);
      BZ.Game.resize();
    },

    resize: function () {
      if (!canvas) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var r = canvas.getBoundingClientRect();
      vw = Math.max(1, r.width); vh = Math.max(1, r.height);
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    },

    isRunning: function () { return !!S && S.running; },
    isPaused: function () { return !!S && S.paused; },
    state: function () { return S; },

    setPaused: function (p) {
      if (!S) return;
      S.paused = p;
      if (p) BZ.Input.clearSticks();
    },

    start: function (charId, playerName) {
      var chDef = BZ.CHARACTERS.filter(function (c) { return c.id === charId; })[0] || BZ.CHARACTERS[0];
      var world = BZ.buildGrid();
      world.openDoors = {};

      var spawn = BZ.tileCenter(BZ.SPAWN_TILE.x, BZ.SPAWN_TILE.y);
      var maxHp = 100 + (chDef.id === 'harold' ? 60 : 0);

      S = {
        running: true, paused: false, over: false,
        time: 0, shake: 0, flash: 0,
        round: 0, phase: 'intro', phaseT: 2.4,
        toSpawn: 0, aliveCap: 0, roundKills: 0, roundDrops: 0,
        world: world,
        map: null,
        flow: new Int32Array(MW * MH),
        flowQueue: new Int32Array(MW * MH),
        flowT: 0,
        zombies: [], bullets: [], grenades: [], particles: [],
        floaters: [], powerups: [], props: buildProps(),
        unlocked: { lobby: true },
        cam: { x: 0, y: 0 },
        active: { instakill: 0, double: 0, fire: 0, lowgrav: 0 },
        prompt: null,
        player: {
          x: spawn.x, y: spawn.y, r: 13,
          hp: maxHp, maxHp: maxHp,
          points: chDef.id === 'hashbrown' ? 1000 : 500,
          weapons: [makeWeapon(chDef.id === 'admin' ? 'ray' : 'pistol')],
          cur: 0, perks: {}, grenades: 4,
          reloadT: 0, fireCd: 0, meleeCd: 0, swapT: 0,
          phase: 0, hurtFlash: 0, regenT: 0,
          char: chDef, name: playerName || 'BLOCKHEAD',
          usedRevive: false, downed: false,
          costMul: chDef.id === 'noobert' ? 0.88 : 1,
          pointMul: chDef.id === 'oofington' ? 1.22 : 1,
          meleeMul: chDef.id === 'chad' ? 1.4 : 1,
          speedMul: chDef.id === 'karen' ? 1.15 : 1,
          puMul: chDef.id === 'dj' ? 1.6 : 1,
          dmgMul: 1
        },
        run: {
          spent: 0, meleeKills: 0, shotsThisRound: 0, boxSpins: 0,
          teddies: 0, radios: 0, damageThisRound: 0, kills: 0,
          startTime: Date.now(), fishBuff: false
        }
      };

      S.map = BZ.bakeMap(world);
      computeFlow();
      updateCam(1);
      emit('started', { char: chDef });
      pushHud();
    },

    update: function (dt) { if (S && S.running && !S.paused) step(dt); },
    render: function () { if (S) draw(); },

    /* Exposed so DOM buttons can drive the same actions as the keyboard. */
    action: function (name) { BZ.Input.press(name); },
    swapWeapon: swapWeapon,
    quit: function () { if (S) { S.running = false; } }
  };

  /* ------------------------------------------------------------- ROUND FLOW */
  function zombieHp(r) {
    return r <= 9 ? 120 + 30 * (r - 1) : Math.round(390 * Math.pow(1.10, r - 9));
  }
  function zombieSpeed(r) { return Math.min(44 + r * 6.2, 152); }
  function isDoggoRound(r) { return r > 0 && r % 5 === 0; }
  function roundCount(r) {
    return isDoggoRound(r) ? Math.min(24, 6 + r) : Math.min(38, 6 + Math.round(r * 2.4));
  }

  function beginRound() {
    S.round += 1;
    S.toSpawn = roundCount(S.round);
    S.roundKills = 0;
    S.roundDrops = 0;
    S.run.shotsThisRound = 0;
    S.run.damageThisRound = 0;
    S.spawnT = 0.9;
    S.phase = 'active';
    BZ.Audio.roundStart(S.round);
    emit('round', { round: S.round, doggo: isDoggoRound(S.round) });

    if (S.round === 10) BZ.Secrets.milestone('round10');
    if (S.round === 15) BZ.Secrets.milestone('round15');
    // Cheapskate: round 10 with nothing spent.
    if (S.round >= 10 && S.run.spent === 0) BZ.Secrets.find('cheapskate');
    // Speed Demon: round 5 inside four minutes.
    if (S.round >= 5 && (Date.now() - S.run.startTime) < 4 * 60 * 1000) BZ.Secrets.find('speedrun');
  }

  function unlockedZones() { return S.unlocked; }

  function spawnZombie() {
    var candidates = S.props.filter(function (p) {
      return p.type === 'window' && S.unlocked[p.zone];
    });
    if (!candidates.length) return;
    var win = pick(candidates);
    var doggo = isDoggoRound(S.round);
    var hp = zombieHp(S.round) * (doggo ? 0.55 : 1);
    var out = 34;
    var ox = win.dir === 'w' ? -out : win.dir === 'e' ? out : 0;
    var oy = win.dir === 'n' ? -out : win.dir === 's' ? out : 0;

    var skins = [
      { skin: '#7fa650', shirt: '#4a5d3a', pants: '#33402a', hair: null, hat: null, wide: 1 },
      { skin: '#8fb862', shirt: '#5d4a3a', pants: '#3a3028', hair: '#2b2521', hat: null, wide: 1.1 },
      { skin: '#6f9648', shirt: '#3a4a5d', pants: '#2a3340', hair: null, hat: 'cap', wide: 0.94 },
      { skin: '#9ec46e', shirt: '#5d3a4a', pants: '#402a33', hair: '#4a3a2b', hat: null, wide: 1.05 }
    ];

    S.zombies.push({
      x: win.wx + ox, y: win.wy + oy,
      r: doggo ? 12 : 13,
      hp: hp, maxHp: hp,
      speed: zombieSpeed(S.round) * (doggo ? 1.85 : 1) * rand(0.9, 1.12),
      state: 'outside', win: win, tearT: rand(0.3, 1.2),
      atkCd: 0, phase: rand(0, 6.28), hurtFlash: 0,
      doggo: doggo, skin: pick(skins),
      aim: { x: 0, y: 1 }, groanT: rand(1, 6)
    });
  }

  /* -------------------------------------------------------------- PLAYER FX */
  function floater(x, y, text, color, big) {
    S.floaters.push({ x: x, y: y, text: text, color: color, life: big ? 1.5 : 0.95, big: !!big, vy: big ? -34 : -50 });
  }
  function burst(x, y, color, n, spd) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, s = rand(spd * 0.3, spd);
      S.particles.push({
        x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.25, 0.65), color: color, size: rand(2, 4.5)
      });
    }
  }
  function award(pts) {
    var p = Math.round(pts * S.player.pointMul * (S.active.double > 0 ? 2 : 1));
    S.player.points += p;
    return p;
  }

  /* ------------------------------------------------------------- INTERACT */
  function costOf(base) { return Math.round(base * S.player.costMul); }

  function currentInteractable() {
    var pl = S.player, best = null, bestD = Infinity;

    // Doors first — they're the biggest targets.
    for (var i = 0; i < BZ.DOORS.length; i++) {
      var d = BZ.DOORS[i];
      if (S.world.openDoors[d.id]) continue;
      if (!S.unlocked[d.from]) continue;
      var cx = (d.x + d.w / 2) * T, cy = (d.y + d.h / 2) * T;
      var dist = Math.hypot(pl.x - cx, pl.y - cy);
      if (dist < Math.max(d.w, d.h) * T * 0.5 + 58 && dist < bestD) {
        bestD = dist;
        best = { kind: 'door', door: d, label: 'OPEN ' + d.label, cost: costOf(d.cost) };
      }
    }

    for (i = 0; i < S.props.length; i++) {
      var p = S.props[i];
      if (!S.unlocked[p.zone]) continue;
      var dd = Math.hypot(pl.x - p.wx, pl.y - p.wy);
      if (dd > p.r || dd >= bestD) continue;
      var entry = null;
      switch (p.type) {
        case 'wallbuy': {
          var def = BZ.WEAPONS[p.weapon];
          var owned = pl.weapons.filter(function (w) { return w.id === p.weapon; })[0];
          if (owned) {
            if (owned.reserve >= Math.round(def.reserve * (owned.pap ? 1.5 : 1))) break;
            entry = { kind: 'ammo', prop: p, label: 'REFILL ' + weaponName(owned), cost: costOf(def.ammoCost) };
          } else {
            entry = { kind: 'wallbuy', prop: p, label: 'BUY ' + def.name, cost: costOf(def.wall) };
          }
          break;
        }
        case 'perk': {
          var pd = BZ.PERKS[p.perk];
          if (pl.perks[p.perk]) break;
          if (pd.needsPower && !p.powered) { entry = { kind: 'locked', label: pd.name + ' — NEEDS POWER', cost: 0 }; break; }
          entry = { kind: 'perk', prop: p, label: pd.name, cost: costOf(pd.cost) };
          break;
        }
        case 'box':
          if (p.spinning) break;
          entry = { kind: 'box', prop: p, label: 'MYSTERY BOX', cost: S.active.fire > 0 ? 10 : costOf(950) };
          break;
        case 'power':
          if (p.on) break;
          entry = { kind: 'power', prop: p, label: 'TURN ON THE POWER', cost: 0 };
          break;
        case 'pack':
          if (!p.powered) { entry = { kind: 'locked', label: 'PACK-A-PUNCH — NEEDS POWER', cost: 0 }; break; }
          entry = { kind: 'pack', prop: p, label: 'PACK-A-PUNCH ' + weaponName(pl.weapons[pl.cur]), cost: costOf(5000) };
          break;
        case 'window':
          if (p.boards >= 6) break;
          entry = { kind: 'repair', prop: p, label: 'REBOARD THE WINDOW', cost: 0 };
          break;
        case 'teddy':
          if (p.taken) break;
          entry = { kind: 'teddy', prop: p, label: 'GRAB THE TEDDY BEAR', cost: 0 };
          break;
        case 'radio':
          if (p.taken) break;
          entry = { kind: 'radio', prop: p, label: 'PLAY THE RADIO', cost: 0 };
          break;
        case 'jukebox':
          if (BZ.Audio.songPlaying()) break;
          if (S.run.teddies < 3) { entry = { kind: 'locked', label: 'JUKEBOX — SOMETHING IS MISSING', cost: 0 }; break; }
          entry = { kind: 'jukebox', prop: p, label: 'PLAY THE ANTHEM', cost: 0 };
          break;
        case 'skylight':
          entry = { kind: 'skylight', prop: p, label: 'TOUCH THE MOON', cost: 0 };
          break;
        case 'vault':
          if (!p.open || p.used) break;
          entry = { kind: 'vault', prop: p, label: 'TAKE THE FREE PERK', cost: 0 };
          break;
      }
      if (entry) { best = entry; bestD = dd; }
    }
    return best;
  }

  function spend(cost) {
    if (S.player.points < cost) {
      BZ.Audio.deny();
      emit('toast', { text: pick(BZ.BARKS.broke), tone: 'bad' });
      return false;
    }
    S.player.points -= cost;
    S.run.spent += cost;
    return true;
  }

  function doInteract() {
    var it = S.prompt;
    if (!it) return;
    var pl = S.player;

    switch (it.kind) {
      case 'locked':
        BZ.Audio.deny();
        break;

      case 'door':
        if (!spend(it.cost)) return;
        S.world.openDoors[it.door.id] = true;
        S.unlocked[it.door.opens] = true;
        S.map = BZ.bakeMap(S.world);
        computeFlow();
        // Power machines in the newly opened zone light up if power is on.
        refreshPower();
        BZ.Audio.door();
        S.shake = 7;
        emit('toast', { text: it.door.label + ' OPEN', tone: 'good' });
        break;

      case 'wallbuy': {
        if (!spend(it.cost)) return;
        var nw = makeWeapon(it.prop.weapon);
        if (pl.weapons.length < 2) { pl.weapons.push(nw); pl.cur = pl.weapons.length - 1; }
        else { pl.weapons[pl.cur] = nw; }
        pl.reloadT = 0;
        BZ.Audio.buy();
        emit('toast', { text: nw.def.name, tone: 'good' });
        break;
      }
      case 'ammo': {
        if (!spend(it.cost)) return;
        var own = pl.weapons.filter(function (w) { return w.id === it.prop.weapon; })[0];
        own.reserve = Math.round(own.def.reserve * (own.pap ? 1.5 : 1));
        BZ.Audio.buy();
        emit('toast', { text: 'AMMO TOPPED UP', tone: 'good' });
        break;
      }
      case 'perk': {
        if (!spend(it.cost)) return;
        applyPerk(it.prop.perk);
        break;
      }
      case 'box':
        if (!spend(it.cost)) return;
        startBoxSpin(it.prop);
        break;

      case 'power': {
        it.prop.on = true;
        refreshPower();
        BZ.Audio.power();
        S.shake = 12;
        emit('toast', { text: 'POWER ON — PERKS ONLINE', tone: 'good' });
        break;
      }
      case 'pack': {
        var w = pl.weapons[pl.cur];
        if (w.pap) { BZ.Audio.deny(); emit('toast', { text: 'ALREADY PUNCHED', tone: 'bad' }); return; }
        if (!spend(it.cost)) return;
        var up = makeWeapon(w.id, true);
        pl.weapons[pl.cur] = up;
        BZ.Audio.pack();
        emit('toast', { text: BZ.PAP_NAMES[w.id], tone: 'good' });
        break;
      }
      case 'repair': {
        it.prop.boards = Math.min(6, it.prop.boards + 1);
        floater(it.prop.wx, it.prop.wy - 20, '+' + award(10), BZ.COLORS.sodium);
        BZ.Audio.hit();
        break;
      }
      case 'teddy': {
        it.prop.taken = true;
        S.run.teddies += 1;
        BZ.Audio.teddy();
        floater(it.prop.wx, it.prop.wy - 24, 'BEAR ' + S.run.teddies + '/3', BZ.COLORS.sodium, true);
        if (S.run.teddies >= 3) {
          BZ.Secrets.find('teddies');
          BZ.Audio.startSong();
          var jb = findProp('jukebox'); if (jb) jb.playing = true;
          grantPowerup('maxammo', pl.x, pl.y);
          emit('toast', { text: 'THE ANTHEM BEGINS', tone: 'secret' });
        } else {
          emit('toast', { text: pick(BZ.BARKS.teddy), tone: 'good' });
        }
        break;
      }
      case 'radio': {
        it.prop.taken = true;
        S.run.radios += 1;
        BZ.Audio.secret();
        emit('toast', { text: BZ.RADIO_LINES[Math.min(3, S.run.radios - 1)], tone: 'secret', long: true });
        if (S.run.radios >= 4) BZ.Secrets.find('radios');
        break;
      }
      case 'jukebox':
        it.prop.playing = true;
        BZ.Audio.startSong();
        emit('toast', { text: 'THE ANTHEM RETURNS', tone: 'secret' });
        break;

      case 'skylight': {
        it.prop.hits = (it.prop.hits || 0) + 1;
        BZ.Audio.points();
        if (it.prop.hits >= 5) {
          it.prop.hits = 0;
          S.active.lowgrav = 30;
          BZ.Secrets.find('moon');
          emit('toast', { text: 'GRAVITY HAS LEFT THE BUILDING', tone: 'secret' });
        } else {
          floater(it.prop.wx, it.prop.wy - 30, '' + it.prop.hits + '/5', BZ.COLORS.bone);
        }
        break;
      }
      case 'vault': {
        it.prop.used = true;
        var avail = BZ.PERK_ORDER.filter(function (k) { return !pl.perks[k]; });
        if (avail.length) applyPerk(pick(avail));
        else { award(2000); emit('toast', { text: 'NOTHING LEFT — HAVE POINTS', tone: 'good' }); }
        break;
      }
    }
    pushHud();
  }

  function applyPerk(key) {
    var pl = S.player;
    pl.perks[key] = true;
    if (key === 'jug') { pl.maxHp += 120; pl.hp += 120; }
    BZ.Audio.perk();
    emit('toast', { text: BZ.PERKS[key].name + ' — ' + BZ.PERKS[key].blurb, tone: 'good' });
    if (BZ.PERK_ORDER.every(function (k) { return pl.perks[k]; })) BZ.Secrets.find('perkaholic');
    pushHud();
  }

  function refreshPower() {
    var sw = findProp('power');
    var on = sw && sw.on;
    S.props.forEach(function (p) {
      if (p.type === 'perk' || p.type === 'pack') p.powered = !!on;
    });
  }

  function startBoxSpin(box) {
    box.spinning = true;
    box.spinT = 1.8;
    box.spins += 1;
    S.run.boxSpins += 1;
    BZ.Audio.boxSpin();
  }

  function resolveBox(box) {
    box.spinning = false;
    // 1-in-8 teddy bear: the box packs up and moves.
    if (Math.random() < 0.125 && S.run.boxSpins > 1) {
      var spots = BZ.BOX_SPOTS.filter(function (s) {
        return S.unlocked[s.zone] && Math.hypot((s.x + 0.5) * T - box.wx, (s.y + 0.5) * T - box.wy) > 4;
      });
      if (spots.length) {
        var s2 = pick(spots);
        var c = BZ.tileCenter(s2.x, s2.y);
        box.wx = c.x; box.wy = c.y; box.zone = s2.zone;
      }
      BZ.Audio.teddy();
      S.player.points += S.active.fire > 0 ? 10 : costOf(950); // refund
      emit('toast', { text: pick(BZ.BARKS.teddy) + ' THE BOX MOVED.', tone: 'bad' });
      pushHud();
      return;
    }

    // Weighted roll across the box pool.
    var pool = [];
    BZ.BOX_POOL.forEach(function (id) {
      var n = BZ.WEAPONS[id].rarity;
      for (var i = 0; i < n; i++) pool.push(id);
    });
    var got = pick(pool);
    var pl = S.player;
    var nw = makeWeapon(got);
    if (pl.weapons.length < 2) { pl.weapons.push(nw); pl.cur = pl.weapons.length - 1; }
    else pl.weapons[pl.cur] = nw;
    pl.reloadT = 0;
    BZ.Audio.buy();
    emit('toast', { text: 'YOU GOT: ' + nw.def.name, tone: 'good' });
    if (got === 'ray' && S.run.boxSpins === 1) BZ.Secrets.find('boxluck');
    pushHud();
  }

  /* --------------------------------------------------------------- COMBAT */
  function fire() {
    var pl = S.player;
    var w = pl.weapons[pl.cur];
    if (pl.reloadT > 0 || pl.swapT > 0) return;
    if (w.ammo <= 0) {
      if (w.reserve > 0) startReload();
      else BZ.Audio.dry();
      return;
    }
    var d = w.def;
    pl.fireCd = 60 / d.rpm;
    w.ammo -= 1;
    S.run.shotsThisRound += 1;

    var aim = BZ.Input.state.aim;
    var baseAng = Math.atan2(aim.y, aim.x);
    var dmgMul = w.dmgMul * (pl.perks.dtap ? 1.55 : 1) * pl.dmgMul;

    for (var i = 0; i < d.pellets; i++) {
      var a = baseAng + (Math.random() - 0.5) * d.spread * 2;
      S.bullets.push({
        x: pl.x + Math.cos(baseAng) * 16,
        y: pl.y - 18 + Math.sin(baseAng) * 16,
        vx: Math.cos(a) * d.speed, vy: Math.sin(a) * d.speed,
        dmg: d.dmg * dmgMul, life: d.range / d.speed,
        pierce: d.pierce || 0, hit: [],
        splash: d.splash || 0, kind: d.kind
      });
    }
    pl.muzzle = 1;
    S.shake = Math.max(S.shake, d.kind === 'shotgun' || d.kind === 'launcher' ? 5 : 2);
    BZ.Audio.shoot(d.kind);
    pushHud();
  }

  function startReload() {
    var pl = S.player, w = pl.weapons[pl.cur];
    if (pl.reloadT > 0) return;
    var full = w.def.mag;
    if (w.ammo >= full || w.reserve <= 0) return;
    pl.reloadT = w.def.reload * (pl.perks.speed ? 0.55 : 1);
    BZ.Audio.reload();
  }
  function finishReload() {
    var pl = S.player, w = pl.weapons[pl.cur];
    var need = w.def.mag - w.ammo;
    var take = Math.min(need, w.reserve);
    w.ammo += take; w.reserve -= take;
    pushHud();
  }

  function swapWeapon() {
    var pl = S.player;
    if (pl.weapons.length < 2 || pl.swapT > 0) return;
    pl.cur = (pl.cur + 1) % pl.weapons.length;
    pl.swapT = 0.35;
    pl.reloadT = 0;
    BZ.Audio.reload();
    pushHud();
  }

  function melee() {
    var pl = S.player;
    if (pl.meleeCd > 0) return;
    pl.meleeCd = 0.55;
    BZ.Audio.melee();
    var aim = BZ.Input.state.aim;
    var dmg = 150 * pl.meleeMul * pl.dmgMul;
    var hitAny = false;
    for (var i = 0; i < S.zombies.length; i++) {
      var z = S.zombies[i];
      if (z.state === 'outside') continue;
      var dx = z.x - pl.x, dy = z.y - pl.y;
      var dist = Math.hypot(dx, dy);
      if (dist > 62) continue;
      var dot = (dx / dist) * aim.x + (dy / dist) * aim.y;
      if (dot < 0.30) continue;
      hitAny = true;
      damageZombie(z, dmg, true);
    }
    if (hitAny) S.shake = Math.max(S.shake, 4);
  }

  function throwGrenade() {
    var pl = S.player;
    if (pl.grenades <= 0) { BZ.Audio.dry(); return; }
    pl.grenades -= 1;
    var aim = BZ.Input.state.aim;
    S.grenades.push({
      x: pl.x, y: pl.y - 16,
      vx: aim.x * 330, vy: aim.y * 330,
      t: 1.5
    });
    BZ.Audio.melee();
    pushHud();
  }

  function explode(x, y, radius, dmg) {
    burst(x, y, BZ.COLORS.sodium, 26, 320);
    burst(x, y, '#ff6b35', 18, 220);
    S.shake = Math.max(S.shake, 14);
    BZ.Audio.nuke();
    for (var i = S.zombies.length - 1; i >= 0; i--) {
      var z = S.zombies[i];
      var d = Math.hypot(z.x - x, z.y - y);
      if (d > radius) continue;
      damageZombie(z, dmg * (1 - d / radius * 0.5), false);
    }
  }

  function damageZombie(z, dmg, isMelee) {
    if (S.active.instakill > 0) dmg = 1e9;
    z.hp -= dmg;
    z.hurtFlash = 0.22;
    burst(z.x, z.y - 20, '#6b8f3a', 4, 90);
    if (z.hp <= 0) {
      killZombie(z, isMelee);
    } else {
      floater(z.x, z.y - 34, '+' + award(10), BZ.COLORS.sodium);
      BZ.Audio.points();
    }
  }

  function killZombie(z, isMelee) {
    var idx = S.zombies.indexOf(z);
    if (idx === -1) return;
    S.zombies.splice(idx, 1);
    S.roundKills += 1;
    S.run.kills += 1;
    burst(z.x, z.y - 20, '#6b8f3a', 14, 190);
    BZ.Audio.oof();
    var pts = award(isMelee ? 130 : 60);
    floater(z.x, z.y - 40, '+' + pts, isMelee ? BZ.COLORS.toxic : BZ.COLORS.sodium, isMelee);

    if (isMelee) {
      S.run.meleeKills += 1;
      if (S.run.meleeKills >= 25) BZ.Secrets.find('swordmaster');
    }

    // Power-up drops, capped so late rounds don't turn into a light show.
    if (S.roundDrops < 3 && Math.random() < 0.042) {
      S.roundDrops += 1;
      var types = ['maxammo', 'instakill', 'double', 'nuke', 'carpenter', 'fire'];
      grantPowerup(pick(types), z.x, z.y);
    }
    pushHud();
  }

  function grantPowerup(type, x, y) {
    S.powerups.push({ type: type, x: x, y: y, life: 22 });
  }

  function collectPowerup(pu) {
    var def = BZ.POWERUPS[pu.type];
    var pl = S.player;
    BZ.Audio.powerup();
    emit('toast', { text: def.name, tone: 'good' });

    switch (pu.type) {
      case 'maxammo':
        pl.weapons.forEach(function (w) {
          w.reserve = Math.round(w.def.reserve * (w.pap ? 1.5 : 1));
          w.ammo = w.def.mag;
        });
        pl.grenades = 4;
        break;
      case 'instakill': S.active.instakill = def.dur * pl.puMul; break;
      case 'double':    S.active.double = def.dur * pl.puMul; break;
      case 'fire':      S.active.fire = def.dur * pl.puMul; break;
      case 'nuke': {
        var n = S.zombies.length;
        if (n >= 20) BZ.Secrets.find('oofnuke');
        for (var i = S.zombies.length - 1; i >= 0; i--) killZombie(S.zombies[i], false);
        award(400);
        S.shake = 18; S.flash = 0.7;
        BZ.Audio.nuke();
        break;
      }
      case 'carpenter':
        S.props.forEach(function (p) { if (p.type === 'window') p.boards = 6; });
        award(200);
        break;
    }
    pushHud();
  }

  /* ----------------------------------------------------------------- STEP */
  function step(dt) {
    dt = Math.min(dt, 0.05);
    S.time += dt;
    var pl = S.player;

    // --- timers
    ['instakill', 'double', 'fire', 'lowgrav'].forEach(function (k) {
      if (S.active[k] > 0) S.active[k] = Math.max(0, S.active[k] - dt);
    });
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 34);
    if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 2.2);
    if (pl.muzzle > 0) pl.muzzle = Math.max(0, pl.muzzle - dt * 9);
    if (pl.hurtFlash > 0) pl.hurtFlash = Math.max(0, pl.hurtFlash - dt * 3);
    if (pl.fireCd > 0) pl.fireCd -= dt;
    if (pl.meleeCd > 0) pl.meleeCd -= dt;
    if (pl.swapT > 0) pl.swapT -= dt;
    if (pl.reloadT > 0) { pl.reloadT -= dt; if (pl.reloadT <= 0) finishReload(); }

    // --- health regen
    pl.regenT += dt;
    if (pl.regenT > 4.5 && pl.hp < pl.maxHp) {
      pl.hp = Math.min(pl.maxHp, pl.hp + 26 * dt);
      pushHud();
    }

    // --- input
    BZ.Input.update({ x: pl.x - S.cam.x, y: pl.y - 20 - S.cam.y });
    var inp = BZ.Input.state;
    if (BZ.Input.consume('reload')) startReload();
    if (BZ.Input.consume('melee')) melee();
    if (BZ.Input.consume('grenade')) throwGrenade();
    if (BZ.Input.consume('swap')) swapWeapon();
    if (BZ.Input.consume('interact')) doInteract();

    // --- movement
    var spd = 190 * pl.speedMul * (pl.perks.sprint ? 1.30 : 1);
    if (S.active.lowgrav > 0) spd *= 1.35;
    var mx = inp.move.x, my = inp.move.y;
    var mlen = Math.hypot(mx, my);
    if (mlen > 1) { mx /= mlen; my /= mlen; mlen = 1; }
    if (mlen > 0.01) {
      moveBy(pl, mx * spd * dt, my * spd * dt, pl.r);
      pl.phase += dt * 11 * Math.min(1, mlen + 0.3);
      if (!inp.aiming && !inp.mouse.has && mlen > 0.2) {
        inp.aim.x = mx / mlen; inp.aim.y = my / mlen;
      }
    }

    // --- firing
    if (inp.firing && pl.fireCd <= 0) fire();

    // --- rounds
    if (S.phase === 'intro') {
      S.phaseT -= dt;
      if (S.phaseT <= 0) beginRound();
    } else if (S.phase === 'active') {
      if (S.toSpawn > 0) {
        S.spawnT -= dt;
        var interval = Math.max(0.22, 1.5 - S.round * 0.06);
        var cap = Math.min(isDoggoRound(S.round) ? 12 : 22, 5 + S.round * 2);
        if (S.spawnT <= 0 && S.zombies.length < cap) {
          spawnZombie();
          S.toSpawn -= 1;
          S.spawnT = interval * rand(0.7, 1.3);
        }
      } else if (S.zombies.length === 0) {
        // round cleared
        if (isDoggoRound(S.round) && S.run.damageThisRound === 0) BZ.Secrets.find('goodboy');
        if (S.round >= 3 && S.run.shotsThisRound === 0) BZ.Secrets.find('pacifist');
        S.phase = 'intro';
        S.phaseT = 4.2;
        emit('cleared', { round: S.round });
      }
    }

    // --- flow field refresh
    S.flowT -= dt;
    if (S.flowT <= 0) { computeFlow(); S.flowT = 0.16; }

    updateZombies(dt);
    updateBullets(dt);
    updateGrenades(dt);
    updateParticles(dt);
    updatePowerups(dt);

    // --- box spin
    var box = findProp('box');
    if (box && box.spinning) {
      box.spinT -= dt;
      if (box.spinT <= 0) resolveBox(box);
    }

    // --- interaction prompt
    var it = currentInteractable();
    var sig = it ? it.kind + '|' + it.label + '|' + it.cost : '';
    if (sig !== S.promptSig) {
      S.promptSig = sig;
      S.prompt = it;
      emit('prompt', it);
    } else {
      S.prompt = it;
    }

    updateCam(dt);
  }

  function updateZombies(dt) {
    var pl = S.player;
    var zs = S.zombies;

    for (var i = zs.length - 1; i >= 0; i--) {
      var z = zs[i];
      if (z.hurtFlash > 0) z.hurtFlash -= dt;
      if (z.atkCd > 0) z.atkCd -= dt;
      z.groanT -= dt;
      if (z.groanT <= 0) { z.groanT = rand(4, 11); if (Math.random() < 0.5) (z.doggo ? BZ.Audio.bark() : BZ.Audio.zombieGroan()); }

      if (z.state === 'outside') {
        var win = z.win;
        if (win.boards > 0) {
          z.tearT -= dt;
          if (z.tearT <= 0) {
            win.boards -= 1;
            z.tearT = z.doggo ? 0.5 : 1.05;
            burst(win.wx, win.wy - 10, '#8a6230', 6, 120);
            BZ.Audio.hit();
          }
        } else {
          z.state = 'enter';
        }
        z.phase += dt * 4;
        continue;
      }

      if (z.state === 'enter') {
        // Walk to the window's inner tile, then join the chase.
        var dx0 = z.win.wx - z.x, dy0 = z.win.wy - z.y;
        var d0 = Math.hypot(dx0, dy0);
        if (d0 < 6) { z.state = 'chase'; }
        else {
          var sp0 = z.speed * 0.85 * dt;
          z.x += dx0 / d0 * sp0;
          z.y += dy0 / d0 * sp0;
        }
        z.phase += dt * 7;
        continue;
      }

      // chase
      var dir = flowDir(z.x, z.y);
      var toP = { x: pl.x - z.x, y: pl.y - z.y };
      var dP = Math.hypot(toP.x, toP.y);
      // Close in a straight line once basically on top of the player.
      if (dP < 70) dir = { x: toP.x / dP, y: toP.y / dP };
      if (!dir) dir = { x: 0, y: 0 };

      // separation so they spread into a horde instead of a single file
      var sx = 0, sy = 0;
      for (var j = 0; j < zs.length; j++) {
        if (j === i) continue;
        var o = zs[j];
        if (o.state === 'outside') continue;
        var ox = z.x - o.x, oy = z.y - o.y;
        var od = ox * ox + oy * oy;
        if (od > 900 || od < 0.01) continue;
        var f = 1 - Math.sqrt(od) / 30;
        sx += ox * f * 0.06; sy += oy * f * 0.06;
      }

      var vx = dir.x + sx, vy = dir.y + sy;
      var vl = Math.hypot(vx, vy) || 1;
      var sp = z.speed * dt;
      moveBy(z, vx / vl * sp, vy / vl * sp, z.r);
      z.aim = { x: toP.x / (dP || 1), y: toP.y / (dP || 1) };
      z.phase += dt * (z.doggo ? 10 : 6.5) * (z.speed / 90);

      // attack
      if (dP < 30 && z.atkCd <= 0) {
        z.atkCd = z.doggo ? 0.7 : 0.9;
        hurtPlayer(z.doggo ? 22 : 28);
      }
    }
  }

  function hurtPlayer(dmg) {
    var pl = S.player;
    pl.hp -= dmg;
    pl.hurtFlash = 1;
    pl.regenT = 0;
    S.run.damageThisRound += dmg;
    S.shake = Math.max(S.shake, 6);
    BZ.Audio.hurt();
    if (pl.hp <= 0) {
      if (pl.perks.revive && !pl.usedRevive) {
        pl.usedRevive = true;
        pl.hp = pl.maxHp;
        delete pl.perks.revive;
        S.flash = 0.8;
        BZ.Audio.perk();
        emit('toast', { text: 'QUICK RESPAWN USED — YOU OWE SOMEBODY', tone: 'good' });
      } else {
        gameOver();
      }
    }
    pushHud();
  }

  function gameOver() {
    S.running = false;
    S.over = true;
    BZ.Audio.oof();
    BZ.Audio.stopSong();
    BZ.Secrets.recordRun(S.round, S.run.kills);
    emit('gameover', {
      round: S.round,
      kills: S.run.kills,
      points: S.player.points,
      name: S.player.name,
      char: S.player.char,
      time: Math.round((Date.now() - S.run.startTime) / 1000)
    });
  }

  function updateBullets(dt) {
    for (var i = S.bullets.length - 1; i >= 0; i--) {
      var b = S.bullets[i];
      b.life -= dt;
      if (b.life <= 0) { S.bullets.splice(i, 1); continue; }

      // Sub-step so fast rounds can't tunnel through zombies or walls.
      var steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 9));
      var sdt = dt / steps;
      var dead = false;
      for (var s = 0; s < steps && !dead; s++) {
        b.x += b.vx * sdt;
        b.y += b.vy * sdt;
        if (blocked(b.x, b.y, 2)) {
          burst(b.x, b.y, '#c9a227', 4, 120);
          if (b.splash) explode(b.x, b.y, b.splash, b.dmg);
          dead = true; break;
        }
        for (var j = 0; j < S.zombies.length; j++) {
          var z = S.zombies[j];
          if (z.state === 'outside') continue;
          if (b.hit.indexOf(z) !== -1) continue;
          var zy = z.y - 20;
          if (Math.abs(b.x - z.x) < z.r + 3 && Math.abs(b.y - zy) < 22) {
            b.hit.push(z);
            if (b.splash) { explode(b.x, b.y, b.splash, b.dmg); dead = true; }
            else {
              damageZombie(z, b.dmg, false);
              if (b.pierce > 0) b.pierce -= 1; else dead = true;
            }
            break;
          }
        }
        if (dead) break;
        // shootable secret props
        for (var k = 0; k < S.props.length; k++) {
          var p = S.props[k];
          if (p.type !== 'fishtank' && p.type !== 'poster') continue;
          if (!S.unlocked[p.zone]) continue;
          if (Math.abs(b.x - p.wx) < 26 && Math.abs(b.y - (p.wy - 20)) < 22) {
            hitSecretProp(p);
            dead = true;
            break;
          }
        }
      }
      if (dead) S.bullets.splice(i, 1);
    }
  }

  function hitSecretProp(p) {
    p.hits = (p.hits || 0) + 1;
    burst(p.wx, p.wy - 20, p.type === 'fishtank' ? BZ.COLORS.volt : '#d9c9a8', 5, 130);
    BZ.Audio.hit();

    if (p.type === 'fishtank' && !p.taken && p.hits >= 25) {
      p.taken = true;
      S.run.fishBuff = true;
      S.player.dmgMul *= 1.10;
      BZ.Secrets.find('fish');
      emit('toast', { text: 'THE FISH IS FREE. +10% DAMAGE.', tone: 'secret' });
    }
    if (p.type === 'poster' && !p.taken && p.hits >= 10) {
      p.taken = true;
      var vault = findProp('vault');
      if (vault) vault.open = true;
      BZ.Secrets.find('vault');
      S.shake = 10;
      emit('toast', { text: 'THE VAULT IS OPEN', tone: 'secret' });
    }
  }

  function updateGrenades(dt) {
    for (var i = S.grenades.length - 1; i >= 0; i--) {
      var g = S.grenades[i];
      g.t -= dt;
      var nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
      if (blocked(nx, g.y, 5)) g.vx *= -0.45; else g.x = nx;
      if (blocked(g.x, ny, 5)) g.vy *= -0.45; else g.y = ny;
      g.vx *= (1 - 1.6 * dt);
      g.vy *= (1 - 1.6 * dt);
      if (g.t <= 0) {
        explode(g.x, g.y, 100, 620);
        S.grenades.splice(i, 1);
      }
    }
  }

  function updateParticles(dt) {
    for (var i = S.particles.length - 1; i >= 0; i--) {
      var p = S.particles[i];
      p.life -= dt;
      if (p.life <= 0) { S.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= (1 - 3 * dt); p.vy *= (1 - 3 * dt);
    }
    for (i = S.floaters.length - 1; i >= 0; i--) {
      var f = S.floaters[i];
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= (1 - 1.4 * dt);
      if (f.life <= 0) S.floaters.splice(i, 1);
    }
  }

  function updatePowerups(dt) {
    var pl = S.player;
    for (var i = S.powerups.length - 1; i >= 0; i--) {
      var pu = S.powerups[i];
      pu.life -= dt;
      if (pu.life <= 0) { S.powerups.splice(i, 1); continue; }
      if (Math.hypot(pu.x - pl.x, pu.y - pl.y) < 44) {
        S.powerups.splice(i, 1);
        collectPowerup(pu);
      }
    }
  }

  function updateCam(dt) {
    var pl = S.player;
    var tx = pl.x - vw / 2;
    var ty = pl.y - 20 - vh / 2;
    // Lead the camera slightly toward where you're aiming.
    var aim = BZ.Input.state.aim;
    tx += aim.x * 46; ty += aim.y * 34;
    var maxX = MW * T - vw, maxY = MH * T - vh;
    tx = maxX <= 0 ? maxX / 2 : clamp(tx, 0, maxX);
    ty = maxY <= 0 ? maxY / 2 : clamp(ty, 0, maxY);
    var k = dt >= 1 ? 1 : 1 - Math.pow(0.0012, dt);
    S.cam.x += (tx - S.cam.x) * k;
    S.cam.y += (ty - S.cam.y) * k;
  }

  function pushHud() {
    if (!S) return;
    var pl = S.player;
    var w = pl.weapons[pl.cur];
    emit('hud', {
      hp: Math.max(0, Math.round(pl.hp)), maxHp: pl.maxHp,
      points: pl.points, round: S.round,
      weapon: weaponName(w), ammo: w.ammo, reserve: w.reserve,
      reloading: pl.reloadT > 0,
      grenades: pl.grenades,
      perks: Object.keys(pl.perks),
      secrets: BZ.Secrets.count(), secretsTotal: BZ.Secrets.total(),
      zone: zoneOfPlayer(),
      alt: pl.weapons.length > 1 ? weaponName(pl.weapons[(pl.cur + 1) % pl.weapons.length]) : null,
      active: S.active
    });
  }

  function zoneOfPlayer() {
    var tx = Math.floor(S.player.x / T), ty = Math.floor(S.player.y / T);
    var z = S.world.zones[ty * MW + tx];
    return (BZ.ZONES[z] && BZ.ZONES[z].name) || '';
  }

  /* ---------------------------------------------------------------- RENDER */
  function draw() {
    var C = BZ.COLORS;
    ctx.fillStyle = C.void;
    ctx.fillRect(0, 0, vw, vh);

    var shx = 0, shy = 0;
    if (S.shake > 0.1) {
      shx = rand(-S.shake, S.shake);
      shy = rand(-S.shake, S.shake);
    }

    ctx.save();
    ctx.translate(Math.round(-S.cam.x + shx), Math.round(-S.cam.y + shy));

    // baked map
    if (S.map) ctx.drawImage(S.map, 0, 0);

    var t = S.time;

    // depth-sorted actors + props
    var list = [];
    S.props.forEach(function (p) {
      if (!S.unlocked[p.zone]) return;
      if (p.type === 'teddy' && p.taken) return;
      list.push({ y: p.wy, kind: 'prop', o: p });
    });
    S.powerups.forEach(function (pu) { list.push({ y: pu.y, kind: 'pu', o: pu }); });
    S.zombies.forEach(function (z) { list.push({ y: z.y, kind: 'z', o: z }); });
    list.push({ y: S.player.y, kind: 'player', o: S.player });
    S.grenades.forEach(function (g) { list.push({ y: g.y, kind: 'nade', o: g }); });
    list.sort(function (a, b) { return a.y - b.y; });

    var bigHead = BZ.Secrets.progress.bigHead;
    var aim = BZ.Input.state.aim;

    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.kind === 'prop') BZ.drawProp(ctx, e.o, t);
      else if (e.kind === 'pu') BZ.drawPowerup(ctx, e.o, t);
      else if (e.kind === 'z') {
        var z = e.o;
        if (z.doggo) {
          BZ.drawDoggo(ctx, z.x, z.y, { phase: z.phase, aim: z.aim, hurtFlash: z.hurtFlash, scale: 1 });
        } else {
          BZ.drawFigure(ctx, z.x, z.y, {
            skin: z.skin, aim: z.aim, phase: z.phase, zombie: true,
            bigHead: bigHead, hurtFlash: z.hurtFlash,
            scale: S.active.lowgrav > 0 ? 1.05 : 1
          });
        }
        // health pip for wounded zombies
        if (z.hp < z.maxHp && z.state !== 'outside') {
          var frac = Math.max(0, z.hp / z.maxHp);
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(z.x - 15, z.y - 58, 30, 4);
          ctx.fillStyle = C.toxic;
          ctx.fillRect(z.x - 15, z.y - 58, 30 * frac, 4);
        }
      } else if (e.kind === 'player') {
        var pl = e.o;
        BZ.drawFigure(ctx, pl.x, pl.y, {
          skin: pl.char.skin, aim: aim, phase: pl.phase,
          bigHead: bigHead, flash: pl.muzzle, hurtFlash: pl.hurtFlash,
          weaponColor: pl.weapons[pl.cur].pap ? C.sodium : '#8b8b93',
          scale: 1
        });
      } else if (e.kind === 'nade') {
        ctx.fillStyle = '#4a5d3a';
        ctx.beginPath(); ctx.arc(e.o.x, e.o.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = e.o.t < 0.5 && Math.floor(e.o.t * 12) % 2 ? C.red : C.toxic;
        ctx.fillRect(e.o.x - 2, e.o.y - 8, 4, 3);
      }
    }

    // bullets
    ctx.lineCap = 'round';
    for (i = 0; i < S.bullets.length; i++) {
      var b = S.bullets[i];
      var isE = b.kind === 'energy' || b.kind === 'launcher';
      ctx.strokeStyle = isE ? C.toxic : 'rgba(255,214,140,0.95)';
      ctx.lineWidth = isE ? 5 : 2.4;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.014, b.y - b.vy * 0.014);
      ctx.stroke();
    }

    // particles
    for (i = 0; i < S.particles.length; i++) {
      var p = S.particles[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // floating numbers
    ctx.textAlign = 'center';
    for (i = 0; i < S.floaters.length; i++) {
      var f = S.floaters[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.6));
      ctx.fillStyle = f.color;
      ctx.font = (f.big ? 'bold 20px ' : 'bold 14px ') + '"Silkscreen", monospace';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // --- screen-space overlays
    // sodium vignette
    var vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.34, vw / 2, vh / 2, Math.max(vw, vh) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(10,7,5,0.52)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, vw, vh);

    if (S.player.hurtFlash > 0.02) {
      ctx.fillStyle = 'rgba(224,49,49,' + (S.player.hurtFlash * 0.30) + ')';
      ctx.fillRect(0, 0, vw, vh);
    }
    if (S.flash > 0) {
      ctx.fillStyle = 'rgba(242,233,223,' + (S.flash * 0.55) + ')';
      ctx.fillRect(0, 0, vw, vh);
    }
    // low health pulse
    var hpFrac = S.player.hp / S.player.maxHp;
    if (hpFrac < 0.34) {
      var pulse = 0.18 + 0.14 * Math.sin(S.time * 7);
      ctx.fillStyle = 'rgba(224,49,49,' + (pulse * (1 - hpFrac / 0.34)) + ')';
      ctx.fillRect(0, 0, vw, vh);
    }

    BZ.drawSticks(ctx, BZ.Input.state.sticks);
  }
})(window.BZ = window.BZ || {});
