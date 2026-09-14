/* BLOCKHEAD ZOMBIES — rendering.
   The map is extruded tiles baked once into an offscreen canvas (re-baked only
   when a door opens), then blitted per frame. Actors are drawn as upright
   blocky figures anchored at their feet and depth-sorted by y, which gives the
   diorama look without any sprite assets. */
(function (BZ) {
  'use strict';

  var C = {
    void:       '#14100e',
    wallTop:    '#15110f',
    wallTopLit: '#1c1714',
    wallFace:   '#0e0b09',
    floorLine:  'rgba(0,0,0,0.20)',
    sodium:     '#ffb02e',
    toxic:      '#9ef01a',
    red:        '#e03131',
    bone:       '#f2e9df',
    volt:       '#4cc9f0',
    shadow:     'rgba(0,0,0,0.38)'
  };
  BZ.COLORS = C;

  var T = BZ.TILE;
  var FACE_H = 14;
  var WALL_BAND = 3;

  // Stable pseudo-random from tile coords — grime that doesn't crawl.
  function hash(x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  /* -------------------------------------------------------------- MAP BAKE */
  BZ.bakeMap = function bakeMap(world) {
    var W = BZ.MAP_W, H = BZ.MAP_H;
    var cv = document.createElement('canvas');
    cv.width = W * T;
    cv.height = H * T + FACE_H;
    var g = cv.getContext('2d');

    g.fillStyle = C.void;
    g.fillRect(0, 0, cv.width, cv.height);

    function solid(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
      var t = world.tiles[ty * W + tx];
      return t === BZ.T_SOLID || t === BZ.T_PROP ||
             (t === BZ.T_DOOR && !world.openDoors[world.doorAt[ty * W + tx]]);
    }
    function isFloorLike(tx, ty) { return !solid(tx, ty); }

    // --- floors
    for (var ty = 0; ty < H; ty++) {
      for (var tx = 0; tx < W; tx++) {
        if (!isFloorLike(tx, ty)) continue;
        var i = ty * W + tx;
        var zone = world.zones[i];
        var tint = (BZ.ZONES[zone] && BZ.ZONES[zone].tint) || '#2b2521';
        g.fillStyle = tint;
        g.fillRect(tx * T, ty * T, T, T);

        // Grime + tile seams.
        var h = hash(tx, ty);
        if (h > 0.86) {
          g.fillStyle = 'rgba(0,0,0,0.16)';
          var s = 6 + h * 14;
          g.fillRect(tx * T + h * 20, ty * T + (1 - h) * 20, s, s * 0.7);
        } else if (h < 0.10) {
          g.fillStyle = 'rgba(255,255,255,0.030)';
          g.fillRect(tx * T + 4, ty * T + 6, T - 12, T - 18);
        }
        g.strokeStyle = C.floorLine;
        g.lineWidth = 1;
        g.strokeRect(tx * T + 0.5, ty * T + 0.5, T - 1, T - 1);
      }
    }

    // --- wall tops
    for (ty = 0; ty < H; ty++) {
      for (tx = 0; tx < W; tx++) {
        if (!solid(tx, ty)) continue;
        // Draw a band of wall around open space. It needs to be thick enough
        // that the camera, clamped to the map bounds, never shows bare void.
        var exposed = false;
        for (var ry = -WALL_BAND; ry <= WALL_BAND && !exposed; ry++) {
          for (var rx = -WALL_BAND; rx <= WALL_BAND; rx++) {
            if (isFloorLike(tx + rx, ty + ry)) { exposed = true; break; }
          }
        }
        if (!exposed) continue;
        var lit = isFloorLike(tx, ty + 1);
        g.fillStyle = lit ? C.wallTopLit : C.wallTop;
        g.fillRect(tx * T, ty * T, T, T);
        if (hash(tx + 9, ty + 4) > 0.80) {
          g.fillStyle = 'rgba(255,255,255,0.022)';
          g.fillRect(tx * T + 8, ty * T + 10, 16, 12);
        }
        // Sodium-lit rim on whichever sides face open floor.
        g.fillStyle = 'rgba(255,176,46,0.16)';
        if (isFloorLike(tx, ty - 1)) g.fillRect(tx * T, ty * T, T, 3);
        if (isFloorLike(tx - 1, ty)) g.fillRect(tx * T, ty * T, 3, T);
        if (isFloorLike(tx + 1, ty)) g.fillRect(tx * T + T - 3, ty * T, 3, T);
      }
    }

    // --- south faces + contact shadow
    for (ty = 0; ty < H; ty++) {
      for (tx = 0; tx < W; tx++) {
        if (!solid(tx, ty) || !isFloorLike(tx, ty + 1)) continue;
        var fy = (ty + 1) * T;
        var grd = g.createLinearGradient(0, fy, 0, fy + FACE_H);
        grd.addColorStop(0, '#3a3129');
        grd.addColorStop(1, C.wallFace);
        g.fillStyle = grd;
        g.fillRect(tx * T, fy, T, FACE_H);
        g.fillStyle = 'rgba(255,176,46,0.30)';
        g.fillRect(tx * T, fy, T, 2);
        var sh = g.createLinearGradient(0, fy + FACE_H, 0, fy + FACE_H + 12);
        sh.addColorStop(0, 'rgba(0,0,0,0.34)');
        sh.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = sh;
        g.fillRect(tx * T, fy + FACE_H, T, 12);
      }
    }

    // --- closed doors get hazard stripes so they read as "buy me"
    BZ.DOORS.forEach(function (d) {
      if (world.openDoors[d.id]) return;
      var x = d.x * T, y = d.y * T, w = d.w * T, h = d.h * T;
      g.save();
      g.beginPath(); g.rect(x, y, w, h); g.clip();
      g.fillStyle = '#171310';
      g.fillRect(x, y, w, h);
      g.lineWidth = 12;
      g.strokeStyle = 'rgba(255,176,46,0.75)';
      for (var s = -h; s < w + h; s += 34) {
        g.beginPath();
        g.moveTo(x + s, y + h);
        g.lineTo(x + s + h, y);
        g.stroke();
      }
      g.restore();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 3;
      g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    });

    return cv;
  };

  /* ----------------------------------------------------------- BLOCK FIGURE */
  function rr(g, x, y, w, h, col) {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  // A face lighter on top, darker at the bottom — cheap plastic sheen.
  function block(g, x, y, w, h, col, shadeTop) {
    rr(g, x, y, w, h, col);
    g.fillStyle = 'rgba(255,255,255,' + (shadeTop == null ? 0.10 : shadeTop) + ')';
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.max(1, Math.round(h * 0.22)));
    g.fillStyle = 'rgba(0,0,0,0.16)';
    g.fillRect(Math.round(x), Math.round(y + h * 0.78), Math.round(w), Math.max(1, Math.round(h * 0.22)));
  }

  /* Draws a blocky actor standing at world point (x, y).
     opts: skin, aim {x,y}, phase (walk cycle), scale, bigHead, flash,
           zombie (bool), dead, hurtFlash */
  BZ.drawFigure = function drawFigure(g, x, y, opts) {
    var sk = opts.skin;
    var s = (opts.scale || 1) * (sk.small ? 0.86 : 1);
    var wide = sk.wide || 1;
    var faceLeft = opts.aim && opts.aim.x < 0;
    var ph = opts.phase || 0;
    var bob = Math.sin(ph) * 1.6 * s;
    var legSwing = Math.sin(ph) * 4 * s;

    g.save();
    g.translate(x, y);

    // ground shadow
    g.fillStyle = C.shadow;
    g.beginPath();
    g.ellipse(0, 0, 13 * s * wide, 5.2 * s, 0, 0, Math.PI * 2);
    g.fill();

    if (sk.glow) {
      g.save();
      g.globalAlpha = 0.30;
      g.fillStyle = sk.glow;
      g.beginPath();
      g.ellipse(0, -18 * s, 22 * s, 24 * s, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    g.translate(0, bob);
    if (faceLeft) g.scale(-1, 1);

    var LEG_H = 11 * s, TOR_H = 13 * s, HEAD = 13 * s * (opts.bigHead ? 2.15 : 1);
    var torW = 15 * s * wide;
    var legW = 5.4 * s * wide;

    // legs
    block(g, -torW / 2 + 0.5, -LEG_H + legSwing * 0.5, legW, LEG_H - legSwing * 0.5, sk.pants);
    block(g, torW / 2 - legW - 0.5, -LEG_H - legSwing * 0.5, legW, LEG_H + legSwing * 0.5, sk.pants);

    var torY = -LEG_H - TOR_H;
    // back arm
    var armW = 4.6 * s * wide, armH = 12 * s;
    block(g, -torW / 2 - armW + 1.5, torY + 2 * s - legSwing * 0.35, armW, armH, opts.zombie ? sk.skin : sk.shirt);

    // torso
    if (sk.potato) {
      g.fillStyle = sk.shirt;
      g.beginPath();
      g.ellipse(0, torY + TOR_H / 2, torW * 0.62, TOR_H * 0.68, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(-torW * 0.4, torY + 2, torW * 0.8, 3);
    } else {
      block(g, -torW / 2, torY, torW, TOR_H, sk.shirt);
      if (opts.zombie) {
        // torn shirt
        g.fillStyle = 'rgba(0,0,0,0.28)';
        g.fillRect(-torW / 2 + 2, torY + TOR_H * 0.55, torW * 0.42, TOR_H * 0.45);
        g.fillStyle = sk.skin;
        g.fillRect(-torW / 2 + torW * 0.55, torY + TOR_H * 0.6, torW * 0.3, TOR_H * 0.4);
      }
    }

    // front arm — aims at the target for the player, reaches out for zombies
    var shoulderY = torY + 3 * s;
    g.save();
    g.translate(torW / 2 - 1, shoulderY);
    var ang;
    if (opts.zombie) {
      ang = -0.22 + Math.sin(ph * 0.9) * 0.10;
    } else if (opts.aim) {
      var ax = Math.abs(opts.aim.x) < 0.001 ? 0.001 : opts.aim.x;
      ang = Math.atan2(opts.aim.y * 0.55, Math.abs(ax));
    } else { ang = 0; }
    g.rotate(ang);
    block(g, -1, -armW / 2, armH * 1.02, armW, opts.zombie ? sk.skin : sk.shirt);
    if (!opts.zombie && opts.weaponColor) {
      rr(g, armH * 0.86, -2.4 * s, 13 * s, 4.6 * s, opts.weaponColor);
      rr(g, armH * 0.86 + 3 * s, 1.4 * s, 4 * s, 3.4 * s, '#1b1b1f');
      if (opts.flash > 0) {
        g.globalAlpha = Math.min(1, opts.flash);
        g.fillStyle = C.sodium;
        g.beginPath();
        g.moveTo(armH * 0.86 + 13 * s, -0.6 * s);
        g.lineTo(armH * 0.86 + 13 * s + 15 * s, -6 * s);
        g.lineTo(armH * 0.86 + 13 * s + 19 * s, -0.4 * s);
        g.lineTo(armH * 0.86 + 13 * s + 15 * s, 5 * s);
        g.closePath();
        g.fill();
        g.globalAlpha = 1;
      }
    }
    g.restore();

    // second zombie arm, reaching
    if (opts.zombie) {
      g.save();
      g.translate(-torW / 2 + 1, shoulderY + 2);
      g.rotate(-0.12 + Math.sin(ph * 0.9 + 1) * 0.10);
      block(g, -1, -armW / 2, armH * 0.95, armW, sk.skin);
      g.restore();
    }

    // head
    var headY = torY - HEAD;
    if (opts.zombie) g.rotate(0);
    block(g, -HEAD / 2, headY, HEAD, HEAD, sk.skin, 0.14);

    // face
    var eyeY = headY + HEAD * 0.40;
    if (opts.zombie) {
      g.fillStyle = '#101010';
      g.fillRect(-HEAD * 0.30, eyeY, HEAD * 0.16, HEAD * 0.16);
      g.fillStyle = C.toxic;
      g.fillRect(HEAD * 0.14, eyeY - 1, HEAD * 0.18, HEAD * 0.18);
      g.fillStyle = '#101010';
      g.fillRect(-HEAD * 0.22, headY + HEAD * 0.68, HEAD * 0.46, HEAD * 0.12);
    } else {
      g.fillStyle = '#141414';
      g.fillRect(-HEAD * 0.28, eyeY, HEAD * 0.15, HEAD * 0.18);
      g.fillRect(HEAD * 0.13, eyeY, HEAD * 0.15, HEAD * 0.18);
      g.fillStyle = 'rgba(20,20,20,0.85)';
      g.fillRect(-HEAD * 0.14, headY + HEAD * 0.66, HEAD * 0.30, HEAD * 0.09);
    }

    // hair / hats
    var HC = opts.silhouette
      ? function () { return '#262119'; }
      : function (c) { return c; };
    if (sk.hair) rr(g, -HEAD / 2, headY - 2.5 * s, HEAD, 5 * s, HC(sk.hair));
    if (sk.hat === 'top') {
      rr(g, -HEAD * 0.62, headY - 3 * s, HEAD * 1.24, 3 * s, HC('#16161a'));
      rr(g, -HEAD * 0.34, headY - 13 * s, HEAD * 0.68, 11 * s, HC('#16161a'));
      rr(g, -HEAD * 0.34, headY - 7 * s, HEAD * 0.68, 2.4 * s, HC(C.sodium));
    } else if (sk.hat === 'phones') {
      rr(g, -HEAD * 0.62, headY + HEAD * 0.18, HEAD * 0.2, HEAD * 0.4, HC('#e03131'));
      rr(g, HEAD * 0.42, headY + HEAD * 0.18, HEAD * 0.2, HEAD * 0.4, HC('#e03131'));
      rr(g, -HEAD * 0.5, headY - 3 * s, HEAD, 3 * s, HC('#2b2b31'));
    } else if (sk.hat === 'bob') {
      rr(g, -HEAD * 0.58, headY - 4 * s, HEAD * 1.16, 6 * s, HC(sk.hair || '#f1f3f5'));
      rr(g, -HEAD * 0.58, headY + 1, HEAD * 0.18, HEAD * 0.55, HC(sk.hair || '#f1f3f5'));
    } else if (sk.hat === 'bacon') {
      for (var b = 0; b < 4; b++) {
        rr(g, -HEAD * 0.55 + b * HEAD * 0.30, headY - 7 * s + (b % 2) * 2, HEAD * 0.26, 9 * s, HC('#c1121f'));
      }
    } else if (sk.hat === 'crown') {
      rr(g, -HEAD * 0.5, headY - 5 * s, HEAD, 3.4 * s, HC(C.sodium));
      for (var k = 0; k < 3; k++) rr(g, -HEAD * 0.42 + k * HEAD * 0.34, headY - 10 * s, HEAD * 0.2, 6 * s, HC(C.sodium));
    } else if (sk.hat === 'cap') {
      rr(g, -HEAD * 0.5, headY - 4 * s, HEAD, 4.5 * s, HC(sk.shirt));
      rr(g, HEAD * 0.3, headY - 1.5 * s, HEAD * 0.5, 2.4 * s, HC(sk.shirt));
    }

    if (opts.hurtFlash > 0) {
      g.globalAlpha = Math.min(0.75, opts.hurtFlash);
      g.fillStyle = '#ffffff';
      g.fillRect(-torW, headY - 14 * s, torW * 2, (0 - headY) + 16 * s);
      g.globalAlpha = 1;
    }

    g.restore();
  };

  /* Doggos — low, fast, four-legged, extremely rude. */
  BZ.drawDoggo = function (g, x, y, opts) {
    var s = opts.scale || 1;
    var ph = opts.phase || 0;
    g.save();
    g.translate(x, y);
    g.fillStyle = C.shadow;
    g.beginPath(); g.ellipse(0, 0, 15 * s, 5 * s, 0, 0, Math.PI * 2); g.fill();
    if (opts.aim && opts.aim.x < 0) g.scale(-1, 1);
    var legs = Math.sin(ph * 1.8) * 3.4 * s;
    rr(g, -11 * s, -8 * s + legs, 4 * s, 8 * s, '#241f1c');
    rr(g, 6 * s, -8 * s - legs, 4 * s, 8 * s, '#241f1c');
    block(g, -13 * s, -20 * s, 24 * s, 13 * s, '#33291f');
    block(g, 7 * s, -27 * s, 12 * s, 11 * s, '#3d3225');
    rr(g, 8 * s, -31 * s, 3.5 * s, 5 * s, '#33291f');
    rr(g, 14 * s, -31 * s, 3.5 * s, 5 * s, '#33291f');
    g.fillStyle = C.red;
    g.fillRect(12 * s, -24 * s, 3.4 * s, 3.4 * s);
    g.fillStyle = '#f2e9df';
    g.fillRect(16 * s, -20 * s, 4 * s, 2.4 * s);
    if (opts.hurtFlash > 0) {
      g.globalAlpha = Math.min(0.7, opts.hurtFlash);
      g.fillStyle = '#fff';
      g.fillRect(-14 * s, -32 * s, 34 * s, 32 * s);
      g.globalAlpha = 1;
    }
    g.restore();
  };

  /* ----------------------------------------------------------------- PROPS */
  function placard(g, x, y, w, h, fill, stroke) {
    g.fillStyle = fill;
    g.beginPath();
    var c = 5;
    g.moveTo(x + c, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h - c);
    g.lineTo(x + w - c, y + h); g.lineTo(x, y + h); g.lineTo(x, y + c);
    g.closePath(); g.fill();
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); }
  }
  BZ.placard = placard;

  BZ.drawProp = function drawProp(g, p, t) {
    var x = p.wx, y = p.wy;
    var pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
    g.save();
    g.translate(x, y);

    switch (p.type) {
      case 'box': {
        var lid = p.spinning ? Math.sin(t * 22) * 6 : 0;
        g.fillStyle = C.shadow;
        g.beginPath(); g.ellipse(0, 0, 26, 9, 0, 0, Math.PI * 2); g.fill();
        block(g, -24, -26, 48, 26, '#6b4a22');
        rr(g, -24, -26, 48, 4, '#8a6230');
        rr(g, -3, -26, 6, 26, '#8a6230');
        block(g, -25, -34 - lid, 50, 9, '#7d5628');
        g.fillStyle = p.spinning ? C.sodium : 'rgba(255,176,46,' + (0.35 + pulse * 0.5) + ')';
        g.fillRect(-16, -20, 32, 3);
        if (p.spinning) {
          g.globalAlpha = 0.55 + pulse * 0.45;
          g.fillStyle = C.sodium;
          g.beginPath(); g.ellipse(0, -40, 22, 10, 0, 0, Math.PI * 2); g.fill();
          g.globalAlpha = 1;
        }
        break;
      }
      case 'perk': {
        var def = BZ.PERKS[p.perk];
        g.fillStyle = C.shadow;
        g.beginPath(); g.ellipse(0, 0, 20, 7, 0, 0, Math.PI * 2); g.fill();
        block(g, -17, -54, 34, 54, p.powered ? '#2f2a26' : '#241f1c');
        rr(g, -13, -48, 26, 30, p.powered ? def.color : '#1a1714');
        if (p.powered) {
          g.globalAlpha = 0.25 + pulse * 0.35;
          g.fillStyle = def.color;
          g.fillRect(-19, -56, 38, 58);
          g.globalAlpha = 1;
        }
        rr(g, -13, -14, 26, 6, '#15120f');
        g.fillStyle = p.powered ? '#1b1714' : '#54493f';
        g.font = 'bold 13px monospace';
        g.textAlign = 'center';
        g.fillText(def.name.charAt(0), 0, -28);
        break;
      }
      case 'wallbuy': {
        var w = BZ.WEAPONS[p.weapon];
        g.globalAlpha = 0.85;
        placard(g, -26, -30, 52, 26, '#1b1714', 'rgba(255,176,46,0.55)');
        g.globalAlpha = 1;
        rr(g, -20, -22, 40, 6, '#8b8b93');
        rr(g, -20, -16, 12, 4, '#5a5a62');
        g.fillStyle = 'rgba(255,176,46,' + (0.5 + pulse * 0.4) + ')';
        g.fillRect(-26, -32, 52, 2);
        break;
      }
      case 'power': {
        g.fillStyle = C.shadow;
        g.beginPath(); g.ellipse(0, 0, 24, 8, 0, 0, Math.PI * 2); g.fill();
        block(g, -22, -58, 44, 58, '#2a2520');
        rr(g, -15, -50, 30, 22, p.on ? C.toxic : '#3a322c');
        if (p.on) {
          g.globalAlpha = 0.2 + pulse * 0.3;
          g.fillStyle = C.toxic;
          g.fillRect(-26, -62, 52, 64);
          g.globalAlpha = 1;
        }
        rr(g, -6, -24, 12, 16, p.on ? C.toxic : C.red);
        for (var i = 0; i < 3; i++) rr(g, -18 + i * 13, -6, 8, 4, '#15120f');
        break;
      }
      case 'pack': {
        g.fillStyle = C.shadow;
        g.beginPath(); g.ellipse(0, 0, 30, 10, 0, 0, Math.PI * 2); g.fill();
        block(g, -30, -50, 60, 50, p.powered ? '#2f2620' : '#221d19');
        rr(g, -22, -42, 44, 22, p.powered ? C.sodium : '#332c26');
        if (p.powered) {
          g.globalAlpha = 0.22 + pulse * 0.34;
          g.fillStyle = C.sodium;
          g.fillRect(-34, -56, 68, 58);
          g.globalAlpha = 1;
          g.fillStyle = '#1b1714';
          g.font = 'bold 11px monospace';
          g.textAlign = 'center';
          g.fillText('P.A.P', 0, -27);
        }
        rr(g, -26, -12, 52, 5, '#15120f');
        break;
      }
      case 'teddy': {
        if (p.taken) break;
        g.fillStyle = C.shadow;
        g.beginPath(); g.ellipse(0, 0, 11, 4, 0, 0, Math.PI * 2); g.fill();
        var bob2 = Math.sin(t * 2 + p.wx) * 1.5;
        g.translate(0, bob2);
        block(g, -8, -16, 16, 16, '#b5651d');
        rr(g, -9, -22, 6, 6, '#8a4b16');
        rr(g, 3, -22, 6, 6, '#8a4b16');
        g.fillStyle = '#1b1714';
        g.fillRect(-4, -12, 2.5, 2.5);
        g.fillRect(1.5, -12, 2.5, 2.5);
        g.fillStyle = 'rgba(255,176,46,' + (0.15 + pulse * 0.30) + ')';
        g.beginPath(); g.ellipse(0, -8, 20, 20, 0, 0, Math.PI * 2); g.fill();
        break;
      }
      case 'radio': {
        block(g, -13, -18, 26, 18, p.taken ? '#2a2520' : '#3a322c');
        rr(g, -9, -14, 12, 9, '#15120f');
        rr(g, 5, -14, 5, 5, p.taken ? '#54493f' : C.toxic);
        rr(g, -2, -24, 2, 7, '#8b8b93');
        if (!p.taken) {
          g.globalAlpha = 0.12 + pulse * 0.2;
          g.fillStyle = C.toxic;
          g.beginPath(); g.ellipse(0, -10, 24, 18, 0, 0, Math.PI * 2); g.fill();
          g.globalAlpha = 1;
        }
        break;
      }
      case 'fishtank': {
        block(g, -24, -36, 48, 36, 'rgba(76,201,240,0.20)');
        g.strokeStyle = '#3a322c'; g.lineWidth = 3;
        g.strokeRect(-24, -36, 48, 36);
        g.fillStyle = 'rgba(76,201,240,0.35)';
        g.fillRect(-22, -30, 44, 28);
        // the fish
        var fx = Math.sin(t * 0.9) * 13;
        g.save();
        g.translate(fx, -18 + Math.sin(t * 1.7) * 4);
        if (Math.cos(t * 0.9) < 0) g.scale(-1, 1);
        g.fillStyle = p.taken ? C.sodium : '#ff922b';
        g.beginPath(); g.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(-6, 0); g.lineTo(-11, -4); g.lineTo(-11, 4); g.closePath(); g.fill();
        g.fillStyle = '#1b1714'; g.fillRect(3, -1.5, 2, 2);
        g.restore();
        rr(g, -22, -6, 44, 4, '#4a3f33');
        break;
      }
      case 'skylight': {
        g.globalAlpha = 0.30 + pulse * 0.12;
        var grd = g.createRadialGradient(0, -10, 4, 0, -10, 52);
        grd.addColorStop(0, 'rgba(226,232,240,0.75)');
        grd.addColorStop(1, 'rgba(226,232,240,0)');
        g.fillStyle = grd;
        g.beginPath(); g.ellipse(0, -10, 52, 40, 0, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(242,233,223,0.85)';
        g.beginPath(); g.arc(0, -14, 11, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(20,16,14,0.25)';
        g.beginPath(); g.arc(4, -17, 3, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(-3, -10, 2, 0, Math.PI * 2); g.fill();
        break;
      }
      case 'poster': {
        placard(g, -20, -34, 40, 32, p.taken ? '#2a2520' : '#d9c9a8', '#3a322c');
        g.fillStyle = '#3a322c';
        g.fillRect(-13, -28, 26, 15);
        g.fillStyle = p.taken ? '#54493f' : '#8a6230';
        g.fillRect(-15, -10, 30, 3);
        g.fillStyle = 'rgba(20,16,14,0.6)';
        g.font = '6px monospace'; g.textAlign = 'center';
        g.fillText('EMPLOYEE', 0, -5);
        break;
      }
      case 'jukebox': {
        block(g, -18, -46, 36, 46, '#4a2f5a');
        rr(g, -13, -40, 26, 18, '#15120f');
        g.fillStyle = p.playing ? C.sodium : '#54493f';
        for (var b2 = 0; b2 < 5; b2++) {
          var hgt = p.playing ? 4 + Math.abs(Math.sin(t * 6 + b2)) * 12 : 3;
          g.fillRect(-11 + b2 * 5, -24 - hgt, 3.4, hgt);
        }
        rr(g, -15, -16, 30, 5, '#2a1b33');
        break;
      }
      case 'window': {
        // Boarded barricade; boards get torn off one at a time.
        var horiz = (p.dir === 'n' || p.dir === 's');
        for (var bi = 0; bi < 6; bi++) {
          if (bi >= p.boards) continue;
          var off = -18 + bi * 7;
          g.save();
          g.rotate(horiz ? 0 : Math.PI / 2);
          g.translate(0, off);
          g.rotate((bi % 2 ? 1 : -1) * 0.10);
          rr(g, -20, -2.6, 40, 5.2, bi % 2 ? '#8a6230' : '#6b4a22');
          g.fillStyle = 'rgba(0,0,0,0.22)';
          g.fillRect(-20, 1, 40, 1.6);
          g.restore();
        }
        break;
      }
      case 'vault': {
        if (p.open) {
          g.fillStyle = 'rgba(255,176,46,0.12)';
          g.fillRect(-26, -26, 52, 52);
        } else {
          block(g, -26, -44, 52, 44, '#453a30');
          g.strokeStyle = '#2a2520'; g.lineWidth = 4;
          g.beginPath(); g.arc(0, -22, 13, 0, Math.PI * 2); g.stroke();
          rr(g, -2.5, -34, 5, 24, '#2a2520');
        }
        break;
      }
    }
    g.restore();
  };

  /* --------------------------------------------------------------- POWERUP */
  BZ.drawPowerup = function (g, pu, t) {
    var def = BZ.POWERUPS[pu.type];
    var bob = Math.sin(t * 3.4 + pu.x) * 4;
    var blink = pu.life < 4 && Math.floor(pu.life * 8) % 2 === 0;
    g.save();
    g.translate(pu.x, pu.y);
    g.fillStyle = C.shadow;
    g.beginPath(); g.ellipse(0, 0, 12, 4.5, 0, 0, Math.PI * 2); g.fill();
    g.translate(0, -20 + bob);
    if (!blink) {
      g.globalAlpha = 0.28;
      g.fillStyle = def.color;
      g.beginPath(); g.arc(0, 0, 22, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    g.rotate(Math.sin(t * 2) * 0.18);
    block(g, -12, -12, 24, 24, blink ? '#54493f' : def.color);
    g.fillStyle = '#14100e';
    g.font = 'bold 13px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(def.glyph, 0, 1);
    g.restore();
  };

  /* ----------------------------------------------------------- STICKS / FX */
  /* Idle "ghost" sticks. Nothing on screen said which half of the display
     does what, so for the first few seconds both zones announce themselves
     and then get out of the way once you've used them. */
  function ghostStick(g, cx, cy, label, sub, alpha, accent) {
    g.save();
    g.globalAlpha = alpha;
    g.setLineDash([7, 7]);
    g.lineWidth = 2;
    g.strokeStyle = accent;
    g.beginPath(); g.arc(cx, cy, 58, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    g.globalAlpha = alpha * 0.5;
    g.beginPath(); g.arc(cx, cy, 22, 0, Math.PI * 2); g.fillStyle = accent; g.fill();
    g.globalAlpha = alpha;
    g.fillStyle = accent;
    g.textAlign = 'center';
    g.font = 'bold 12px "Silkscreen", monospace';
    g.fillText(label, cx, cy + 84);
    g.globalAlpha = alpha * 0.8;
    g.font = '11px "Archivo", sans-serif';
    g.fillStyle = C.bone;
    g.fillText(sub, cx, cy + 102);
    g.restore();
  }

  BZ.drawSticks = function (g, sticks, hint, vw, vh) {
    if (hint && hint.t > 0) {
      var a = Math.min(1, hint.t / 1.2) * 0.62;
      var cy = vh * 0.58;
      if (!sticks.move && !hint.moved) {
        ghostStick(g, vw * 0.24, cy, 'MOVE', 'drag anywhere this side', a, C.bone);
      }
      if (!sticks.aim && !hint.aimed) {
        ghostStick(g, vw * 0.76, cy, 'SHOOT', 'drag to fire · tap to swing', a, C.sodium);
      }
    }
    ['move', 'aim'].forEach(function (k) {
      var s = sticks[k];
      if (!s) return;
      var col = k === 'move' ? 'rgba(242,233,223,0.55)' : 'rgba(255,176,46,0.75)';
      g.save();
      g.lineWidth = 2.5;
      g.strokeStyle = col;
      g.globalAlpha = 0.55;
      g.beginPath(); g.arc(s.ox, s.oy, s.r, 0, Math.PI * 2); g.stroke();
      var dx = s.x - s.ox, dy = s.y - s.oy;
      var len = Math.hypot(dx, dy);
      if (len > s.r) { dx = dx / len * s.r; dy = dy / len * s.r; }
      g.globalAlpha = 0.85;
      g.fillStyle = col;
      g.beginPath(); g.arc(s.ox + dx, s.oy + dy, 24, 0, Math.PI * 2); g.fill();
      g.restore();
    });
  };
})(window.BZ = window.BZ || {});
