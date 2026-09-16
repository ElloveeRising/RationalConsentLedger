/* BLOCKHEAD ZOMBIES — the facility.
   The map is declared as rooms + connecting doors rather than ASCII art so
   that edits can't silently desync row widths. buildGrid() bakes it into the
   tile arrays the engine reads. Coordinates are TILES; world = tile * TILE. */
(function (BZ) {
  'use strict';

  BZ.TILE = 40;
  BZ.MAP_W = 48;
  BZ.MAP_H = 36;

  // Tile codes
  BZ.T_SOLID = 0;
  BZ.T_FLOOR = 1;
  BZ.T_DOOR = 2;   // becomes floor once purchased
  BZ.T_PROP = 3;   // solid decorative pillar

  BZ.ZONES = {
    lobby: { id: 'lobby', name: 'THE LOBBY',      tint: '#3b322b' },
    obby:  { id: 'obby',  name: 'OBBY HALL',      tint: '#37313f' },
    power: { id: 'power', name: 'GENERATOR BAY',  tint: '#40352a' },
    loot:  { id: 'loot',  name: 'THE LOOT CAVE',  tint: '#2f3a35' },
    admin: { id: 'admin', name: 'ADMIN WING',     tint: '#3f2d37' }
  };

  BZ.ROOMS = [
    { zone: 'lobby', x: 3,  y: 22, w: 15, h: 11 },
    { zone: 'obby',  x: 3,  y: 8,  w: 15, h: 11 },
    { zone: 'power', x: 22, y: 22, w: 14, h: 11 },
    { zone: 'loot',  x: 22, y: 8,  w: 14, h: 11 },
    { zone: 'admin', x: 39, y: 15, w: 7,  h: 12 }
  ];

  // Buying a door unlocks `opens` (the zone on its far side) and permanently
  // carves the passage. `from` is the zone you must already own to see it.
  BZ.DOORS = [
    { id: 'd1', from: 'lobby', opens: 'obby',  cost: 750,  x: 8,  y: 19, w: 4, h: 3, label: 'OBBY HALL' },
    { id: 'd2', from: 'lobby', opens: 'power', cost: 1000, x: 18, y: 25, w: 4, h: 4, label: 'GENERATOR BAY' },
    { id: 'd3', from: 'power', opens: 'loot',  cost: 1250, x: 27, y: 19, w: 4, h: 3, label: 'THE LOOT CAVE' },
    { id: 'd5', from: 'obby',  opens: 'loot',  cost: 1500, x: 18, y: 11, w: 4, h: 4, label: 'SHORTCUT' },
    { id: 'd4', from: 'loot',  opens: 'admin', cost: 1750, x: 36, y: 16, w: 3, h: 3, label: 'ADMIN WING' }
  ];

  // Solid cover inside rooms — keeps firing lanes interesting and gives the
  // flow-field something to path around.
  BZ.PILLARS = [
    [7, 26], [13, 26], [7, 29], [13, 29],
    [7, 12], [13, 12], [10, 16],
    [26, 26], [32, 26], [29, 30],
    [25, 12], [32, 12]
  ];

  // Barricaded windows. Zombies queue outside, tear boards, then climb in.
  BZ.WINDOWS = [
    { zone: 'lobby', x: 3,  y: 26, dir: 'w' },
    { zone: 'lobby', x: 10, y: 32, dir: 's' },
    { zone: 'lobby', x: 17, y: 30, dir: 'e' },
    { zone: 'obby',  x: 3,  y: 12, dir: 'w' },
    { zone: 'obby',  x: 10, y: 8,  dir: 'n' },
    { zone: 'obby',  x: 17, y: 16, dir: 'e' },
    { zone: 'power', x: 35, y: 26, dir: 'e' },
    { zone: 'power', x: 28, y: 32, dir: 's' },
    { zone: 'power', x: 22, y: 30, dir: 'w' },
    { zone: 'loot',  x: 22, y: 10, dir: 'w' },
    { zone: 'loot',  x: 28, y: 8,  dir: 'n' },
    { zone: 'loot',  x: 35, y: 16, dir: 'e' },
    { zone: 'admin', x: 39, y: 16, dir: 'w' },
    { zone: 'admin', x: 45, y: 25, dir: 'e' }
  ];

  // Wall-mounted weapon purchases.
  BZ.WALLBUYS = [
    { zone: 'lobby', x: 4,  y: 23, weapon: 'smg' },
    { zone: 'obby',  x: 5,  y: 10, weapon: 'shotgun' },
    { zone: 'power', x: 23, y: 24, weapon: 'ar' }
  ];

  BZ.PERK_SPOTS = [
    { zone: 'obby',  x: 14, y: 17, perk: 'revive' },
    { zone: 'power', x: 24, y: 31, perk: 'jug' },
    { zone: 'loot',  x: 23, y: 9,  perk: 'dtap' },
    { zone: 'loot',  x: 34, y: 9,  perk: 'speed' },
    { zone: 'admin', x: 40, y: 25, perk: 'sprint' }
  ];

  // The mystery box hops between these when the teddy bear shows up.
  BZ.BOX_SPOTS = [
    { zone: 'obby',  x: 10, y: 13 },
    { zone: 'loot',  x: 28, y: 13 },
    { zone: 'power', x: 28, y: 27 },
    { zone: 'lobby', x: 10, y: 27 },
    { zone: 'admin', x: 42, y: 20 }
  ];

  BZ.POWER_SWITCH = { zone: 'power', x: 33, y: 31 };
  BZ.PACK_SPOT    = { zone: 'admin', x: 42, y: 17 };

  // Secret props. `kind` is handled by secrets.js.
  BZ.SECRET_PROPS = [
    { kind: 'teddy',    id: 'teddy1',  zone: 'lobby', x: 16, y: 31 },
    { kind: 'teddy',    id: 'teddy2',  zone: 'obby',  x: 4,  y: 17 },
    { kind: 'teddy',    id: 'teddy3',  zone: 'power', x: 29, y: 23 },
    { kind: 'radio',    id: 'radio1',  zone: 'lobby', x: 4,  y: 31 },
    { kind: 'radio',    id: 'radio2',  zone: 'obby',  x: 16, y: 9  },
    { kind: 'radio',    id: 'radio3',  zone: 'power', x: 34, y: 23 },
    { kind: 'radio',    id: 'radio4',  zone: 'loot',  x: 25, y: 17 },
    { kind: 'fishtank', id: 'fish',    zone: 'lobby', x: 14, y: 23 },
    { kind: 'skylight', id: 'moon',    zone: 'obby',  x: 10, y: 11 },
    { kind: 'poster',   id: 'poster',  zone: 'admin', x: 45, y: 20 },
    { kind: 'jukebox',  id: 'jukebox', zone: 'loot',  x: 28, y: 17 }
  ];

  /* ------------------------------------------------------------- TERRAIN
     Things in the rooms you can actually do something with.
       barrel  — shoot it, it goes off, takes the horde with it
       crate   — shoot it open for points or ammo
       bounce  — obby pad; step on it and get launched
       goo     — slows anything walking through
       zap     — buyable floor plate that cooks whatever stands on it
     Barrels and crates come back at the start of each round. */
  BZ.TERRAIN = [
    // THE LOBBY
    { kind: 'barrel', zone: 'lobby', x: 5,  y: 24 },
    { kind: 'barrel', zone: 'lobby', x: 15, y: 29 },
    { kind: 'crate',  zone: 'lobby', x: 8,  y: 31 },
    { kind: 'crate',  zone: 'lobby', x: 12, y: 24 },
    { kind: 'zap',    zone: 'lobby', x: 10, y: 30 },

    // OBBY HALL — it is an obby, it gets the pads
    { kind: 'bounce', zone: 'obby',  x: 6,  y: 15 },
    { kind: 'bounce', zone: 'obby',  x: 14, y: 11 },
    { kind: 'barrel', zone: 'obby',  x: 16, y: 13 },
    { kind: 'crate',  zone: 'obby',  x: 8,  y: 9  },
    { kind: 'zap',    zone: 'obby',  x: 11, y: 17 },

    // GENERATOR BAY
    { kind: 'barrel', zone: 'power', x: 24, y: 27 },
    { kind: 'barrel', zone: 'power', x: 31, y: 23 },
    { kind: 'barrel', zone: 'power', x: 34, y: 29 },
    { kind: 'crate',  zone: 'power', x: 27, y: 31 },
    { kind: 'zap',    zone: 'power', x: 30, y: 25 },

    // THE LOOT CAVE
    { kind: 'goo',    zone: 'loot',  x: 26, y: 10 },
    { kind: 'goo',    zone: 'loot',  x: 31, y: 15 },
    { kind: 'bounce', zone: 'loot',  x: 24, y: 14 },
    { kind: 'crate',  zone: 'loot',  x: 33, y: 11 },
    { kind: 'barrel', zone: 'loot',  x: 29, y: 9  },
    { kind: 'zap',    zone: 'loot',  x: 30, y: 12 },

    // ADMIN WING
    { kind: 'barrel', zone: 'admin', x: 44, y: 18 },
    { kind: 'crate',  zone: 'admin', x: 40, y: 22 },
    { kind: 'goo',    zone: 'admin', x: 43, y: 24 },
    { kind: 'zap',    zone: 'admin', x: 41, y: 19 }
  ];

  BZ.TERRAIN_SPEC = {
    barrel: { r: 26, hp: 1,  blast: 118, dmg: 640, respawn: true },
    crate:  { r: 24, hp: 3,  respawn: true },
    bounce: { r: 30, power: 560, cd: 0.7 },
    goo:    { r: 40, slow: 0.42 },
    zap:    { r: 34, cost: 750, dur: 22, dps: 260 }
  };

  BZ.SPAWN_TILE = { x: 10, y: 28 }; // player start, in the lobby

  /* ------------------------------------------------------------------ BUILD */
  // Produces { tiles, zones } as flat Int8Array/Array of length MAP_W*MAP_H.
  BZ.buildGrid = function buildGrid() {
    var W = BZ.MAP_W, H = BZ.MAP_H;
    var tiles = new Int8Array(W * H);      // starts all T_SOLID (0)
    var zones = new Array(W * H).fill(null);
    var doorAt = new Array(W * H).fill(null);

    function carve(rect, code, zone, doorId) {
      for (var y = rect.y; y < rect.y + rect.h; y++) {
        for (var x = rect.x; x < rect.x + rect.w; x++) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          var i = y * W + x;
          tiles[i] = code;
          if (zone) zones[i] = zone;
          if (doorId) doorAt[i] = doorId;
        }
      }
    }

    BZ.ROOMS.forEach(function (r) { carve(r, BZ.T_FLOOR, r.zone); });
    BZ.DOORS.forEach(function (d) { carve(d, BZ.T_DOOR, d.opens, d.id); });
    BZ.PILLARS.forEach(function (p) {
      var i = p[1] * W + p[0];
      if (tiles[i] === BZ.T_FLOOR) tiles[i] = BZ.T_PROP;
    });

    return { tiles: tiles, zones: zones, doorAt: doorAt, w: W, h: H };
  };

  BZ.tileIndex = function (tx, ty) { return ty * BZ.MAP_W + tx; };
  BZ.tileCenter = function (tx, ty) {
    return { x: (tx + 0.5) * BZ.TILE, y: (ty + 0.5) * BZ.TILE };
  };
})(window.BZ = window.BZ || {});
