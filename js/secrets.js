/* BLOCKHEAD ZOMBIES — secrets & persistence.
   Sixteen findable things. Some are props hidden in the map, some are ways of
   playing. Progress survives between sessions in localStorage so two people
   can compare counts. Every write goes through save() and every read tolerates
   a blocked/absent store (private tabs, cleared site data). */
(function (BZ) {
  'use strict';

  var KEY = 'blockhead-zombies/v1';

  var DEFAULT_PROGRESS = {
    secrets: [],        // ids found, ever
    chars: ['chad', 'noobert'],
    bestRound: 0,
    totalKills: 0,
    games: 0,
    bigHead: false,
    name: '',
    difficulty: 'chill',
    cls: 'goober',
    wins: 0,
    bestDance: 0
  };

  var progress = null;

  function load() {
    var base = JSON.parse(JSON.stringify(DEFAULT_PROGRESS));
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        Object.keys(base).forEach(function (k) {
          if (parsed[k] !== undefined && parsed[k] !== null) base[k] = parsed[k];
        });
      }
    } catch (e) { /* storage unavailable — run with defaults */ }
    return base;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(progress)); }
    catch (e) { /* nothing we can do; the run still works */ }
  }

  progress = load();

  /* ---------------------------------------------------------------- SECRETS */
  // `hint` shows before discovery; `reveal` shows once found.
  var DEFS = [
    { id: 'konami',      name: 'KONAMI KID',        hint: 'An old code still works somewhere.',              reveal: 'Entered the code. Big Head Mode is yours forever.' },
    { id: 'teddies',     name: 'BEAR NECESSITIES',  hint: 'Three bears are hiding. Nobody knows why.',        reveal: 'Found all 3 teddy bears — the anthem plays and DJ Bricksteady joins.' },
    { id: 'fish',        name: 'BLOXY FISH',        hint: 'Something in the Lobby is watching you swim by.',  reveal: 'Emptied a magazine into the fish tank. +10% damage for the run.' },
    { id: 'radios',      name: 'AIRWAVES',          hint: 'Four voices are still broadcasting.',              reveal: 'Heard every radio broadcast in one run.' },
    { id: 'vault',       name: 'VAULT BOY',         hint: 'Employee of the Month has a secret.',              reveal: 'Shot the poster until the vault opened. Free perk inside.' },
    { id: 'cheapskate',  name: 'CHEAPSKATE',        hint: 'Get far without spending a single point.',         reveal: 'Reached round 10 having spent nothing. Incredible restraint.' },
    { id: 'swordmaster', name: 'FOAM SWORD MASTER', hint: 'The melee button is not decorative.',              reveal: '25 foam sword kills in one run.' },
    { id: 'pacifist',    name: 'GUN? NEVER MET HER',hint: 'Clear a whole round without firing a shot.',       reveal: 'Cleared an entire round with melee only.' },
    { id: 'oofnuke',     name: 'OOF NUKE',          hint: 'Nukes are better when the room is full.',          reveal: 'Popped a nuke with 20+ zombies alive.' },
    { id: 'boxluck',     name: "BEGINNER'S LUCK",   hint: 'The box rewards the bold. Occasionally.',          reveal: 'Pulled the Oof Cannon on your very first box spin.' },
    { id: 'goodboy',     name: 'GOOD BOY',          hint: 'Every fifth round has teeth.',                     reveal: 'Survived a Doggo round without taking a scratch.' },
    { id: 'speedrun',    name: 'SPEED DEMON',       hint: 'Some people are in a hurry.',                      reveal: 'Reached round 5 in under four minutes.' },
    { id: 'hashbrown',   name: 'CRISPY',            hint: 'Your name matters more than you think.',           reveal: 'You typed the crispy word. Mr. Hashbrown is playable.' },
    { id: 'moon',        name: 'MOON WALKER',       hint: 'Obby Hall has a hole in the roof.',                reveal: 'Tapped the skylight five times. Gravity got weird.' },
    { id: 'perkaholic',  name: 'PERKAHOLIC',        hint: 'Drink everything.',                                reveal: 'Held all five perks at the same time.' },
    { id: 'admin',       name: 'THE ADMIN KNOWS',   hint: 'Find everything else.',                            reveal: 'Fifteen secrets found. The Admin is playable.' }
  ];

  var byId = {};
  DEFS.forEach(function (d) { byId[d.id] = d; });

  // Which character each secret (or milestone) unlocks.
  var UNLOCKS = {
    teddies: 'dj',
    secrets5: 'oofington',
    hashbrown: 'hashbrown',
    admin: 'admin',
    round10: 'karen',
    round15: 'harold'
  };

  var listeners = [];

  function notify(kind, payload) {
    listeners.forEach(function (fn) { fn(kind, payload); });
  }

  function unlockChar(charId) {
    if (!charId || progress.chars.indexOf(charId) !== -1) return false;
    progress.chars.push(charId);
    save();
    var ch = BZ.CHARACTERS.filter(function (c) { return c.id === charId; })[0];
    if (ch) notify('character', ch);
    return true;
  }

  var API = {
    defs: DEFS,
    progress: progress,

    onEvent: function (fn) { listeners.push(fn); },

    has: function (id) { return progress.secrets.indexOf(id) !== -1; },
    count: function () { return progress.secrets.length; },
    total: function () { return DEFS.length; },

    /* Records a secret. Returns true only the first time, so callers can fire
       rewards without worrying about being called repeatedly. */
    find: function (id) {
      if (!byId[id] || API.has(id)) return false;
      progress.secrets.push(id);
      save();
      notify('secret', byId[id]);
      if (UNLOCKS[id]) unlockChar(UNLOCKS[id]);
      if (progress.secrets.length >= 5) unlockChar(UNLOCKS.secrets5);
      // Fifteen of the sixteen opens the last one.
      if (progress.secrets.length >= 15 && !API.has('admin')) API.find('admin');
      return true;
    },

    /* Milestones aren't secrets but they unlock characters the same way. */
    milestone: function (id) {
      if (UNLOCKS[id]) return unlockChar(UNLOCKS[id]);
      return false;
    },

    charUnlocked: function (charId) {
      return progress.chars.indexOf(charId) !== -1;
    },

    recordRun: function (round, kills) {
      progress.games += 1;
      progress.totalKills += kills;
      if (round > progress.bestRound) progress.bestRound = round;
      if (round >= 10) API.milestone('round10');
      if (round >= 15) API.milestone('round15');
      save();
    },

    setBigHead: function (v) { progress.bigHead = !!v; save(); },
    setName: function (n) { progress.name = n; save(); },
    setDifficulty: function (d) { progress.difficulty = d; save(); },
    setClass: function (c) { progress.cls = c; save(); },
    recordWin: function (round) {
      progress.wins = (progress.wins || 0) + 1;
      progress.bestDance = 5;
      save();
    },

    reset: function () {
      progress = JSON.parse(JSON.stringify(DEFAULT_PROGRESS));
      API.progress = progress;
      save();
    }
  };

  /* ----------------------------------------------------------- KONAMI CODE */
  var CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft',
              'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
  var pos = 0;
  window.addEventListener('keydown', function (e) {
    if (e.code === CODE[pos]) {
      pos++;
      if (pos === CODE.length) {
        pos = 0;
        API.setBigHead(!progress.bigHead);
        API.find('konami');
        notify('bighead', progress.bigHead);
      }
    } else {
      pos = (e.code === CODE[0]) ? 1 : 0;
    }
  });

  /* Touch equivalent: ten taps on the title logo. */
  API.logoTap = (function () {
    var n = 0, last = 0;
    return function () {
      var t = Date.now();
      if (t - last > 1200) n = 0;
      last = t;
      n++;
      if (n >= 10) {
        n = 0;
        API.setBigHead(!progress.bigHead);
        API.find('konami');
        notify('bighead', progress.bigHead);
        return true;
      }
      return false;
    };
  })();

  BZ.Secrets = API;
})(window.BZ = window.BZ || {});
