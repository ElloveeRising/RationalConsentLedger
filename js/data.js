/* BLOCKHEAD ZOMBIES — static game data.
   Everything balance-related lives here so it can be tweaked without
   touching engine code. Damage is per-bullet, rpm is rounds per minute. */
(function (BZ) {
  'use strict';

  /* ---------------------------------------------------------------- WEAPONS */
  // slot: weapons the player can hold. `wall` = buyable off a wall, `box` =
  // mystery box only. `rarity` weights the box roll (higher = more common).
  BZ.WEAPONS = {
    pistol: {
      id: 'pistol', name: 'PEA SHOOTER', kind: 'pistol',
      dmg: 42, pellets: 1, spread: 0.035, rpm: 330, mag: 9, reserve: 90,
      reload: 1.15, speed: 820, range: 560, rarity: 0, ammoCost: 250
    },
    smg: {
      id: 'smg', name: 'SPRAY N PRAY', kind: 'smg',
      dmg: 30, pellets: 1, spread: 0.075, rpm: 800, mag: 32, reserve: 256,
      reload: 1.6, speed: 880, range: 520, rarity: 5, wall: 1000, ammoCost: 500
    },
    shotgun: {
      id: 'shotgun', name: 'BOOMSTICK', kind: 'shotgun',
      dmg: 36, pellets: 8, spread: 0.30, rpm: 95, mag: 6, reserve: 48,
      reload: 2.2, speed: 720, range: 300, rarity: 5, wall: 1200, ammoCost: 600,
      shellReload: true
    },
    ar: {
      id: 'ar', name: 'BACON HAIR AR', kind: 'ar',
      dmg: 50, pellets: 1, spread: 0.045, rpm: 620, mag: 30, reserve: 270,
      reload: 1.9, speed: 950, range: 640, rarity: 4, wall: 1300, ammoCost: 650
    },
    lmg: {
      id: 'lmg', name: 'BRRRT-9000', kind: 'lmg',
      dmg: 44, pellets: 1, spread: 0.09, rpm: 900, mag: 100, reserve: 400,
      reload: 4.0, speed: 900, range: 600, rarity: 3, ammoCost: 750
    },
    sniper: {
      id: 'sniper', name: 'THE LAG SWITCH', kind: 'sniper',
      dmg: 420, pellets: 1, spread: 0.004, rpm: 55, mag: 5, reserve: 40,
      reload: 2.6, speed: 1600, range: 1400, pierce: 4, rarity: 3, ammoCost: 700
    },
    ray: {
      id: 'ray', name: 'OOF CANNON', kind: 'energy',
      dmg: 280, pellets: 1, spread: 0.02, rpm: 200, mag: 20, reserve: 160,
      reload: 2.4, speed: 620, range: 700, splash: 62, rarity: 1, ammoCost: 900
    },
    tube: {
      id: 'tube', name: 'NOOB TUBE', kind: 'launcher',
      dmg: 900, pellets: 1, spread: 0.01, rpm: 50, mag: 4, reserve: 16,
      reload: 3.0, speed: 540, range: 900, splash: 115, rarity: 2, ammoCost: 900
    },
    mop: {
      id: 'mop', name: 'THE WET MOP', kind: 'meme',
      dmg: 9, pellets: 3, spread: 0.5, rpm: 1400, mag: 200, reserve: 600,
      reload: 1.0, speed: 500, range: 220, rarity: 2, ammoCost: 100, joke: true
    }
  };

  // Pack-a-Punch: doubles damage, boosts reserve, renames with more shouting.
  BZ.PAP_NAMES = {
    pistol: 'MEGA PEA SHOOTER 9001',
    smg: 'SPRAY N SLAY',
    shotgun: 'BOOMSTICK ULTRA',
    ar: 'BACON HAIR BLB-9',
    lmg: 'BRRRT-INFINITY',
    sniper: 'THE WIFI KILLER',
    ray: 'OOF CANNON XL',
    tube: 'NOOB NUKE',
    mop: 'THE DAMP DESTROYER'
  };

  BZ.BOX_POOL = ['smg', 'shotgun', 'ar', 'lmg', 'sniper', 'ray', 'tube', 'mop'];

  /* ------------------------------------------------------------------ PERKS */
  BZ.PERKS = {
    jug: {
      id: 'jug', name: 'JUGGERNOOB', cost: 2500, color: '#e03131',
      blurb: 'Chunkier. +120 max health.', needsPower: true
    },
    speed: {
      id: 'speed', name: 'SPEED COLA ZERO', cost: 3000, color: '#4cc9f0',
      blurb: 'Reload at ludicrous speed.', needsPower: true
    },
    dtap: {
      id: 'dtap', name: 'DOUBLE TROUBLE', cost: 2000, color: '#ffb02e',
      blurb: '+55% bullet damage.', needsPower: true
    },
    sprint: {
      id: 'sprint', name: 'SPRINT JUICE', cost: 2000, color: '#9ef01a',
      blurb: 'Run 30% faster. Tastes green.', needsPower: true
    },
    revive: {
      id: 'revive', name: 'QUICK RESPAWN', cost: 1500, color: '#c77dff',
      blurb: 'Get back up once. Just once.', needsPower: false
    }
  };
  BZ.PERK_ORDER = ['jug', 'speed', 'dtap', 'sprint', 'revive'];

  /* --------------------------------------------------------------- POWERUPS */
  BZ.POWERUPS = {
    maxammo:  { id: 'maxammo',  name: 'MAX AMMO',     color: '#f2e9df', glyph: 'A', dur: 0 },
    instakill:{ id: 'instakill',name: 'INSTA-OOF',    color: '#e03131', glyph: 'K', dur: 15 },
    double:   { id: 'double',   name: 'DOUBLE POINTS',color: '#ffb02e', glyph: 'X2',dur: 20 },
    nuke:     { id: 'nuke',     name: 'OOF NUKE',     color: '#9ef01a', glyph: 'N', dur: 0 },
    carpenter:{ id: 'carpenter',name: 'CARPENTER',    color: '#c98b4b', glyph: 'C', dur: 0 },
    fire:     { id: 'fire',     name: 'FIRE SALE',    color: '#4cc9f0', glyph: 'S', dur: 25 }
  };

  /* ------------------------------------------------------------- CHARACTERS */
  // `skin` drives the blocky renderer. `perk` is a passive applied at spawn.
  BZ.CHARACTERS = [
    {
      id: 'chad', name: 'CHAD THUNDERCUBE',
      tag: 'Leg day every day, even the apocalypse.',
      skin: { skin: '#f2b06a', shirt: '#3a86ff', pants: '#22333b', hair: '#7a4a21', hat: null, wide: 1.22 },
      passive: 'Foam sword hits 40% harder.',
      unlocked: true
    },
    {
      id: 'noobert', name: 'LIL NOOBERT',
      tag: 'Spawned in yesterday. Extremely confident.',
      skin: { skin: '#ffd43b', shirt: '#4dabf7', pants: '#69db7c', hair: null, hat: null, wide: 0.86, small: true },
      passive: 'Everything costs 12% less.',
      unlocked: true
    },
    {
      id: 'dj', name: 'DJ BRICKSTEADY',
      tag: 'Drops beats. Also drops zombies.',
      skin: { skin: '#c98b4b', shirt: '#7048e8', pants: '#1b1b1f', hair: '#1b1b1f', hat: 'phones', wide: 1.0 },
      passive: 'Power-ups last 60% longer.',
      unlockedBy: 'teddies', hint: 'Find every teddy bear in one run.'
    },
    {
      id: 'karen', name: 'KAREN VOIDWALKER',
      tag: 'Would like to speak to the horde manager.',
      skin: { skin: '#f6d6c2', shirt: '#e8590c', pants: '#495057', hair: '#f1f3f5', hat: 'bob', wide: 0.96 },
      passive: 'Moves 15% faster. Stomping counts.',
      unlockedBy: 'round10', hint: 'Reach round 10.'
    },
    {
      id: 'oofington', name: 'SIR OOFINGTON III',
      tag: 'Old money. New undead.',
      skin: { skin: '#e9c46a', shirt: '#212529', pants: '#212529', hair: null, hat: 'top', wide: 1.02 },
      passive: 'Earns 22% more points.',
      unlockedBy: 'secrets5', hint: 'Uncover 5 secrets.'
    },
    {
      id: 'hashbrown', name: 'MR. HASHBROWN',
      tag: 'He is a hashbrown. Do not question it.',
      skin: { skin: '#d9862b', shirt: '#b5651d', pants: '#8a4b16', hair: null, hat: null, wide: 1.35, potato: true },
      passive: 'Starts with 1000 points.',
      unlockedBy: 'hashbrown', hint: 'Name yourself something crispy.'
    },
    {
      id: 'harold', name: 'BACON HAIROLD',
      tag: 'The hair is not bacon. He insists.',
      skin: { skin: '#f2b06a', shirt: '#adb5bd', pants: '#343a40', hair: '#c1121f', hat: 'bacon', wide: 1.0 },
      passive: '+60 max health.',
      unlockedBy: 'round15', hint: 'Reach round 15.'
    },
    {
      id: 'admin', name: 'THE ADMIN',
      tag: 'Was never supposed to be playable.',
      skin: { skin: '#ff4d6d', shirt: '#1b1b1f', pants: '#1b1b1f', hair: null, hat: 'crown', wide: 1.1, glow: '#ff4d6d' },
      passive: 'Spawns holding the Oof Cannon.',
      unlockedBy: 'admin', hint: 'Uncover 15 secrets.'
    }
  ];

  /* --------------------------------------------------------------- BARK LINES */
  /* ------------------------------------------------------------- DIFFICULTY */
  // `rate` multiplies the gap between spawns, so higher = calmer.
  BZ.DIFFICULTY = {
    chill:  { id: 'chill',  name: 'CHILL',  blurb: 'Slower horde, gentler ramp. Room to learn the controls.',
              speed: 0.86, count: 0.78, rate: 1.30 },
    normal: { id: 'normal', name: 'NORMAL', blurb: 'The intended shift.',
              speed: 1.00, count: 1.00, rate: 1.00 },
    sweaty: { id: 'sweaty', name: 'SWEATY', blurb: 'Faster, thicker, and it starts immediately.',
              speed: 1.16, count: 1.28, rate: 0.72 }
  };
  BZ.DIFFICULTY_ORDER = ['chill', 'normal', 'sweaty'];

  BZ.BARKS = {
    roundStart: ['THEY KEEP COMING', 'MORE OF THEM', 'HERE WE GO AGAIN', 'ROUND UP'],
    buy: ['WORTH IT', 'SPEND SPEND SPEND', 'TREAT YOURSELF'],
    broke: ['NOT ENOUGH POINTS', 'BROKE', 'GO KILL SOMETHING FIRST'],
    teddy: ['AWWW.', 'THE BEAR MOCKS YOU', 'IT WENT SOMEWHERE ELSE'],
    down: ['OOF', 'BIG OOF', 'THAT IS EMBARRASSING']
  };

  BZ.RADIO_LINES = [
    'RADIO 1/4 — "...day nine. The vending machines gained sentience. The green one is friendly."',
    'RADIO 2/4 — "...whoever keeps hiding the teddy bears, I know it is you, Gary."',
    'RADIO 3/4 — "...the Admin was last seen entering the vault. We have not opened it since."',
    'RADIO 4/4 — "...if you are hearing this, you found them all. The hashbrown was real. Goodbye."'
  ];
})(window.BZ = window.BZ || {});
