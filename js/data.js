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
    crossbow: {
      id: 'crossbow', name: 'CROSSBOW OF CONSEQUENCES', kind: 'bow',
      dmg: 260, pellets: 1, spread: 0.006, rpm: 110, mag: 8, reserve: 64,
      reload: 2.1, speed: 1250, range: 1100, pierce: 6, rarity: 3, ammoCost: 700
    },
    blower: {
      id: 'blower', name: 'THE LEAF BLOWER', kind: 'blower',
      dmg: 11, pellets: 4, spread: 0.42, rpm: 1100, mag: 180, reserve: 540,
      reload: 2.0, speed: 560, range: 250, knockback: 320, rarity: 3, ammoCost: 450
    },
    bees: {
      id: 'bees', name: 'THE BEE CANNON', kind: 'bees',
      dmg: 60, pellets: 3, spread: 0.55, rpm: 240, mag: 36, reserve: 216,
      reload: 2.6, speed: 380, range: 900, homing: 3.4, rarity: 2, ammoCost: 800
    },
    quad: {
      id: 'quad', name: 'QUAD-BARREL BRAINROT', kind: 'shotgun',
      dmg: 44, pellets: 16, spread: 0.40, rpm: 60, mag: 4, reserve: 40,
      reload: 3.1, speed: 700, range: 300, knockback: 180, rarity: 2, ammoCost: 800,
      shellReload: true
    },
    airhorn: {
      id: 'airhorn', name: 'THE AIRHORN', kind: 'horn',
      dmg: 26, pellets: 5, spread: 0.50, rpm: 180, mag: 24, reserve: 120,
      reload: 1.8, speed: 640, range: 300, stun: 2.2, rarity: 3, ammoCost: 500
    },
    stapler: {
      id: 'stapler', name: 'THE STAPLER', kind: 'meme',
      dmg: 16, pellets: 1, spread: 0.10, rpm: 1500, mag: 300, reserve: 900,
      reload: 1.2, speed: 900, range: 420, rarity: 2, ammoCost: 150, joke: true
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
    mop: 'THE DAMP DESTROYER',
    crossbow: 'CROSSBOW OF SEVERE CONSEQUENCES',
    blower: 'THE LEAF OBLITERATOR',
    bees: 'THE ENTIRE HIVE',
    quad: 'OCTA-BARREL TERMINAL BRAINROT',
    airhorn: 'THE FOGHORN OF JUDGEMENT',
    stapler: 'THE INDUSTRIAL STAPLER'
  };

  BZ.BOX_POOL = ['smg', 'shotgun', 'ar', 'lmg', 'sniper', 'ray', 'tube', 'mop',
                 'crossbow', 'blower', 'bees', 'quad', 'airhorn', 'stapler'];

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

  /* ------------------------------------------------------------------ CLASSES
     A class is the active ability; the character is the passive and the face.
     You pick both, so the combinations are the build. */
  BZ.CLASSES = [
    {
      id: 'goober', name: 'THE GOOBER', ability: 'GROUND POUND',
      tag: 'Structurally a beanbag. Emotionally unavailable.',
      blurb: 'Slam the floor. Everything nearby goes flying.',
      color: '#9ef01a', cd: 11, hp: 90, speed: 0.92, icon: 'G'
    },
    {
      id: 'gremlin', name: 'GREMLIN ENGINEER', ability: 'DEPLOY TURRET',
      tag: 'Found the toolbox. Nobody gave him the toolbox.',
      blurb: 'Drop a sentry gun that shoots for you. Lasts 26 seconds.',
      color: '#ffb02e', cd: 24, hp: 0, speed: 1, icon: 'E'
    },
    {
      id: 'summoner', name: 'SUMMONER OF MID', ability: 'RAISE THE BOYS',
      tag: 'Necromancer, but the summons are deeply average.',
      blurb: 'Nearby corpses get back up on your side. They try their best.',
      color: '#c77dff', cd: 20, hp: 0, speed: 1, icon: 'S'
    },
    {
      id: 'yapper', name: 'THE YAPPER', ability: 'YAP',
      tag: 'Has not stopped talking since round one.',
      blurb: 'Out-talk the horde. Everything nearby freezes and takes damage.',
      color: '#4cc9f0', cd: 15, hp: 0, speed: 1, icon: 'Y'
    },
    {
      id: 'speedrunner', name: 'SIGMA SPEEDRUNNER', ability: 'ZOOM',
      tag: 'Frame-perfect. Extremely fragile. No notes.',
      blurb: 'Dash straight through the horde, hurting everything you clip.',
      color: '#e03131', cd: 8, hp: -25, speed: 1.22, icon: 'Z'
    }
  ];

  /* --------------------------------------------------------------- CHARACTERS */
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

  /* ------------------------------------------------------------- INTERLOPERS
     Non-hostile weirdos who wander in between the hordes, say one thing, do
     one thing, and leave. `weight` biases the random pick. */
  BZ.INTERLOPERS = [
    {
      id: 'janitor', name: 'SIGMA JANITOR', line: 'NOT MY SHIFT.',
      behaviour: 'cross', effect: 'points', amount: 150, weight: 5, speed: 62,
      skin: { skin: '#c98b4b', shirt: '#2f6f4f', pants: '#2a2520', hair: '#1b1b1f', hat: null, wide: 1.05 },
      prop: 'mop'
    },
    {
      id: 'greg', name: 'NPC GREG', line: 'HELLO, TRAVELLER.',
      behaviour: 'idle', effect: 'none', weight: 6, speed: 0, dur: 14,
      skin: { skin: '#e9c46a', shirt: '#6b7280', pants: '#4b5563', hair: '#3f3f46', hat: null, wide: 1 },
      repeat: true
    },
    {
      id: 'taxman', name: 'THE SNACK TAXMAN', line: 'TAXED.',
      behaviour: 'follow', effect: 'steal', amount: 75, weight: 4, speed: 150, dur: 9,
      skin: { skin: '#f6d6c2', shirt: '#1b1b1f', pants: '#1b1b1f', hair: null, hat: 'top', wide: 0.95 }
    },
    {
      id: 'mike', name: 'MEWING MIKE', line: '...',
      behaviour: 'linger', effect: 'buff', amount: 20, weight: 4, speed: 40, dur: 12,
      skin: { skin: '#f2b06a', shirt: '#ffffff', pants: '#1f2937', hair: '#2b2521', hat: null, wide: 1.15 }
    },
    {
      id: 'tourist', name: 'OHIO TOURIST', line: 'BRO THIS PLACE IS PEAK.',
      behaviour: 'linger', effect: 'flash', amount: 2.6, weight: 4, speed: 70, dur: 10,
      skin: { skin: '#d9a066', shirt: '#22d3ee', pants: '#f59e0b', hair: null, hat: 'cap', wide: 1 },
      prop: 'camera'
    },
    {
      id: 'goober', name: 'A GOOBER', line: '*squelch*',
      behaviour: 'bounce', effect: 'powerup', weight: 5, speed: 95, dur: 13,
      skin: { skin: '#9ef01a', shirt: '#7cc70f', pants: '#6aa80d', hair: null, hat: null, wide: 1.4, potato: true }
    },
    {
      id: 'intern', name: 'BACKROOMS INTERN', line: 'IS IT STILL 1997?',
      behaviour: 'flicker', effect: 'points', amount: 300, weight: 3, speed: 55, dur: 11,
      skin: { skin: '#cbb994', shirt: '#b8a878', pants: '#8c7f5c', hair: '#5c5138', hat: null, wide: 0.95 }
    },
    {
      id: 'gyatt', name: 'THE GYATT GUARD', line: 'I AM SO BIG.',
      behaviour: 'phase', effect: 'none', weight: 3, speed: 46,
      skin: { skin: '#a3703c', shirt: '#7f1d1d', pants: '#3f1414', hair: null, hat: null, wide: 2.1 },
      scale: 1.75
    },
    {
      id: 'broski', name: 'LIL BROSKI', line: 'I GOT YOU, BRO.',
      behaviour: 'escort', effect: 'minion', weight: 4, speed: 175, dur: 18,
      skin: { skin: '#ffd43b', shirt: '#ef4444', pants: '#1e40af', hair: null, hat: 'cap', wide: 0.8, small: true }
    },
    {
      id: 'airpods', name: 'AIRPODS KID', line: 'WHAT?',
      behaviour: 'oblivious', effect: 'none', weight: 4, speed: 58, dur: 16,
      skin: { skin: '#f2b06a', shirt: '#a78bfa', pants: '#312e81', hair: '#18181b', hat: 'phones', wide: 1 }
    }
  ];

  /* ------------------------------------------------------------ DANCE LEVELS
     The possum celebration escalates as you rack things up. Level 5 is the
     full-screen party you get for actually finishing a shift. */
  BZ.DANCE_LEVELS = [
    { level: 1, possums: 1, dur: 3.4, confetti: 0,   strobe: false, title: 'NICE.',              sub: 'a possum noticed' },
    { level: 2, possums: 2, dur: 4.0, confetti: 40,  strobe: false, title: 'LET HIM COOK',       sub: 'the possums are pleased' },
    { level: 3, possums: 4, dur: 4.6, confetti: 90,  strobe: true,  title: 'CERTIFIED',          sub: 'conga line initiated' },
    { level: 4, possums: 7, dur: 5.4, confetti: 160, strobe: true,  title: 'ABSOLUTELY COOKING', sub: 'management has been notified' },
    { level: 5, possums: 14, dur: 12, confetti: 420, strobe: true,  title: 'SHIFT COMPLETE',     sub: 'everybody dances. no exceptions.' }
  ];
  BZ.WIN_ROUND = 20;

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
