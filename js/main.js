/* BLOCKHEAD ZOMBIES — DOM layer.
   Screens, HUD, buttons and the frame loop. game.js emits; this file renders
   everything that isn't the canvas. */
(function (BZ) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage');
  var hud = $('hud');

  var selectedChar = 'chad';
  var selectedDiff = BZ.Secrets.progress.difficulty || 'chill';
  var selectedClass = BZ.Secrets.progress.cls || 'goober';
  var lastHud = { points: 0 };
  var bannerT = 0;
  var installEvent = null;
  var lastResult = null;
  var wonThisRun = false;

  /* ---------------------------------------------------------------- SCREENS */
  var SCREENS = ['screen-title', 'screen-chars', 'screen-classes', 'screen-secrets', 'screen-howto', 'screen-pause', 'screen-over'];
  var screenStack = ['screen-title'];

  function show(id) {
    SCREENS.forEach(function (s) { $(s).hidden = (s !== id); });
    hud.hidden = !!id;
    if (id === null) { SCREENS.forEach(function (s) { $(s).hidden = true; }); hud.hidden = false; }
  }
  function openScreen(id) { screenStack.push(id); show(id); }
  function back() {
    screenStack.pop();
    var top = screenStack[screenStack.length - 1] || 'screen-title';
    show(top);
    if (top === 'screen-pause') BZ.Game.setPaused(true);
  }
  function toGame() { screenStack = []; show(null); }

  /* ------------------------------------------------------------ CHAR GRID */
  function drawCharPreview(cv, ch, locked) {
    var g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    var skin = ch.skin;
    if (locked) {
      // Silhouette: same shape, no identity.
      skin = Object.assign({}, skin, {
        skin: '#2f2a25', shirt: '#262119', pants: '#201b16',
        hair: skin.hair ? '#262119' : null, glow: null
      });
    }
    BZ.drawFigure(g, cv.width / 2, cv.height - 12, {
      skin: skin, aim: { x: 0.6, y: -0.15 }, phase: 0, scale: 2.25, flash: 0,
      silhouette: locked
    });
    if (locked) {
      g.fillStyle = 'rgba(156,144,134,0.9)';
      g.font = 'bold 34px monospace';
      g.textAlign = 'center';
      g.fillText('?', cv.width / 2, cv.height - 52);
    }
  }

  function buildCharGrid() {
    var grid = $('char-grid');
    grid.innerHTML = '';
    BZ.CHARACTERS.forEach(function (ch) {
      var locked = !BZ.Secrets.charUnlocked(ch.id);
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'char' + (locked ? ' locked' : '') + (ch.id === selectedChar ? ' sel' : '');

      var cv = document.createElement('canvas');
      cv.width = 148; cv.height = 168;
      card.appendChild(cv);

      var nm = document.createElement('div');
      nm.className = 'nm';
      nm.textContent = locked ? '???' : ch.name;
      card.appendChild(nm);

      var info = document.createElement('div');
      if (locked) {
        info.className = 'lk';
        info.textContent = ch.hint || 'Locked';
      } else {
        info.className = 'pv';
        info.textContent = ch.passive;
      }
      card.appendChild(info);

      if (!locked) {
        card.addEventListener('click', function () {
          selectedChar = ch.id;
          buildCharGrid();
          BZ.Audio.init(); BZ.Audio.buy();
        });
      }
      grid.appendChild(card);
      drawCharPreview(cv, ch, locked);
    });
  }

  /* ---------------------------------------------------------- CLASS GRID */
  function buildClassGrid() {
    var grid = $('class-grid');
    grid.innerHTML = '';
    BZ.CLASSES.forEach(function (cl) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'char' + (cl.id === selectedClass ? ' sel' : '');

      var glyph = document.createElement('div');
      glyph.className = 'glyph';
      glyph.style.background = cl.color;
      glyph.textContent = cl.icon;
      card.appendChild(glyph);

      var nm = document.createElement('div');
      nm.className = 'nm';
      nm.textContent = cl.name;
      card.appendChild(nm);

      var ab = document.createElement('div');
      ab.className = 'ab';
      ab.textContent = cl.ability + '  ·  ' + cl.cd + 's';
      card.appendChild(ab);

      var pv = document.createElement('div');
      pv.className = 'pv';
      pv.textContent = cl.blurb;
      card.appendChild(pv);

      var lk = document.createElement('div');
      lk.className = 'lk';
      lk.textContent = cl.tag;
      card.appendChild(lk);

      card.addEventListener('click', function () {
        selectedClass = cl.id;
        BZ.Secrets.setClass(cl.id);
        buildClassGrid();
        BZ.Audio.init(); BZ.Audio.buy();
      });
      grid.appendChild(card);
    });
  }

  /* ----------------------------------------------------------- DIFFICULTY */
  function buildDifficulty() {
    var seg = $('diff-seg');
    seg.innerHTML = '';
    BZ.DIFFICULTY_ORDER.forEach(function (id) {
      var d = BZ.DIFFICULTY[id];
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = d.name;
      b.setAttribute('aria-pressed', id === selectedDiff ? 'true' : 'false');
      b.addEventListener('click', function () {
        selectedDiff = id;
        BZ.Secrets.setDifficulty(id);
        buildDifficulty();
  buildClassGrid();
        BZ.Audio.init(); BZ.Audio.buy();
      });
      seg.appendChild(b);
    });
    $('diff-blurb').textContent = BZ.DIFFICULTY[selectedDiff].blurb;
  }

  /* -------------------------------------------------------------- SECRETS */
  function buildSecrets() {
    var list = $('secrets-list');
    list.innerHTML = '';
    $('sec-count').textContent = BZ.Secrets.count() + '/' + BZ.Secrets.total();
    BZ.Secrets.defs.forEach(function (d, i) {
      var found = BZ.Secrets.has(d.id);
      var row = document.createElement('div');
      row.className = 'sec' + (found ? ' found' : '');
      var n = document.createElement('div');
      n.className = 'n';
      n.textContent = found ? String(i + 1).padStart(2, '0') : '--';
      var b = document.createElement('div');
      b.className = 'b';
      var t = document.createElement('div');
      t.className = 't';
      t.textContent = found ? d.name : '? ? ?';
      var dd = document.createElement('div');
      dd.className = 'd';
      dd.textContent = found ? d.reveal : d.hint;
      b.appendChild(t); b.appendChild(dd);
      row.appendChild(n); row.appendChild(b);
      list.appendChild(row);
    });
  }

  function refreshTitleStats() {
    var p = BZ.Secrets.progress;
    $('st-best').textContent = p.bestRound;
    $('st-secrets').textContent = BZ.Secrets.count() + '/' + BZ.Secrets.total();
    $('st-kills').textContent = p.totalKills;
  }

  /* --------------------------------------------------------------- TOASTS */
  function toast(text, tone, long) {
    var el = document.createElement('div');
    el.className = 'toast' + (tone ? ' ' + tone : '') + (long ? ' long' : '');
    el.textContent = text;
    var box = $('toasts');
    box.appendChild(el);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(function () {
      el.style.transition = 'opacity .3s ease';
      el.style.opacity = '0';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }, long ? 5200 : 2600);
  }

  /* ------------------------------------------------------------------ HUD */
  var PERK_LETTER = { jug: 'J', speed: 'S', dtap: 'D', sprint: 'R', revive: 'Q' };

  function renderHud(h) {
    lastHud = h;
    $('hud-round').textContent = h.round || 1;
    $('hud-points').textContent = h.points.toLocaleString();
    $('hud-secrets').textContent = h.secrets + '/' + h.secretsTotal;
    $('zone-name').textContent = h.zone;

    var frac = Math.max(0, Math.min(1, h.hp / h.maxHp));
    $('hp-fill').style.width = (frac * 100) + '%';
    $('hp-text').textContent = h.hp;

    $('wpn-name').textContent = h.weapon;
    $('wpn-ammo').innerHTML = h.reloading
      ? '<small>RELOADING</small>'
      : h.ammo + '<small>/' + h.reserve + '</small>';
    $('wpn').className = 'wpn' + (h.reloading ? ' reloading' : '');

    if (h.cls) {
      var ab = $('btn-ability');
      ab.style.setProperty('--ability', h.cls.color);
      $('ability-label').textContent = h.cls.ability.split(' ')[0];
      ab.classList.toggle('ready', !!h.abilityReady);
      ab.title = h.cls.ability + ' — ' + h.cls.blurb;
    }
    $('nade-ct').textContent = 'x' + h.grenades;
    $('swap-ct').textContent = h.alt ? h.alt.slice(0, 8) : '—';

    var row = $('perk-row');
    row.innerHTML = '';
    h.perks.forEach(function (k) {
      var pip = document.createElement('div');
      pip.className = 'perk-pip';
      pip.style.background = BZ.PERKS[k].color;
      pip.textContent = PERK_LETTER[k] || '?';
      pip.title = BZ.PERKS[k].name;
      row.appendChild(pip);
    });

    var buffs = $('buffs');
    buffs.innerHTML = '';
    ['instakill', 'double', 'fire'].forEach(function (k) {
      var v = h.active[k];
      if (!v || v <= 0) return;
      var el = document.createElement('div');
      el.className = 'buff';
      el.style.background = BZ.POWERUPS[k].color;
      el.textContent = BZ.POWERUPS[k].name + '  ' + Math.ceil(v) + 's';
      buffs.appendChild(el);
    });
    if (h.active.lowgrav > 0) {
      var lg = document.createElement('div');
      lg.className = 'buff';
      lg.style.background = '#c77dff';
      lg.textContent = 'LOW GRAVITY  ' + Math.ceil(h.active.lowgrav) + 's';
      buffs.appendChild(lg);
    }
  }

  function renderPrompt(it) {
    var el = $('prompt');
    if (!it) { el.hidden = true; return; }
    el.hidden = false;
    el.className = it.kind === 'locked' ? 'locked' : '';
    $('prompt-label').textContent = it.label;
    var c = $('prompt-cost');
    if (it.cost > 0) {
      c.textContent = it.cost.toLocaleString();
      c.className = 'cost' + (lastHud.points < it.cost ? ' no' : '');
    } else {
      c.textContent = '';
      c.className = 'cost';
    }
  }

  function showBanner(round, doggo) {
    var b = $('banner');
    b.hidden = false;
    b.className = doggo ? 'doggo' : '';
    $('banner-round').textContent = doggo ? 'DOGGO ROUND' : 'ROUND ' + round;
    $('banner-sub').textContent = doggo
      ? 'THEY ARE FAST AND THEY ARE RUDE'
      : BZ.BARKS.roundStart[(Math.random() * BZ.BARKS.roundStart.length) | 0];
    bannerT = 2.3;
  }

  /* ------------------------------------------------------------ GAME EVENTS */
  BZ.Game.on(function (kind, payload) {
    switch (kind) {
      case 'hud': renderHud(payload); break;
      case 'prompt': renderPrompt(payload); break;
      case 'toast': toast(payload.text, payload.tone, payload.long); break;
      case 'round': showBanner(payload.round, payload.doggo); break;
      case 'cleared': toast('ROUND ' + payload.round + ' CLEARED', 'good'); break;
      case 'gameover': onGameOver(payload); break;
      case 'interloper':
        toast(payload.name + ': "' + payload.line + '"', 'secret');
        break;
      case 'win':
        wonThisRun = true;
        toast('YOU BEAT THE SHIFT. ROUND ' + payload.round + '. KEEP GOING IF YOU DARE.', 'secret', true);
        break;
    }
  });

  BZ.Secrets.onEvent(function (kind, payload) {
    if (kind === 'secret') toast('SECRET FOUND — ' + payload.name, 'secret');
    else if (kind === 'character') toast('NEW CHARACTER — ' + payload.name, 'secret');
    else if (kind === 'bighead') toast(payload ? 'BIG HEAD MODE: ON' : 'BIG HEAD MODE: OFF', 'secret');
  });

  function onGameOver(r) {
    lastResult = r;
    $('over-title').textContent = wonThisRun ? 'SHIFT COMPLETE'
      : r.round >= 15 ? 'LEGEND' : r.round >= 8 ? 'RESPECT' : 'OOF';
    $('over-line').textContent = r.name + ' as ' + r.char.name +
      (r.cls ? ', ' + r.cls.name : '') + ' — ' +
      (wonThisRun ? 'you finished the shift. the possums are still dancing.'
        : r.round >= 15 ? 'the horde will speak of this.'
        : r.round >= 8 ? 'a genuinely solid shift.'
        : 'the horde was unimpressed.');
    $('ov-round').textContent = r.round;
    $('ov-kills').textContent = r.kills;
    $('ov-time').textContent = formatTime(r.time);

    var best = BZ.Secrets.progress.bestRound;
    var nw = $('ov-new');
    nw.innerHTML = '';
    if (r.round >= best && r.round > 0) {
      var p = document.createElement('p');
      p.className = 'lede';
      p.style.color = 'var(--sodium)';
      p.textContent = 'New personal best.';
      nw.appendChild(p);
    }
    refreshTitleStats();
    screenStack = ['screen-title', 'screen-over'];
    show('screen-over');
  }

  function formatTime(s) {
    var m = Math.floor(s / 60);
    return m > 0 ? m + 'm ' + (s % 60) + 's' : s + 's';
  }

  /* --------------------------------------------------------------- BUTTONS */
  function startGame() {
    BZ.Audio.init();
    var nm = ($('name-input').value || '').trim().toUpperCase();
    if (nm) {
      BZ.Secrets.setName(nm);
      if (nm.replace(/[^A-Z]/g, '') === 'HASHBROWN') {
        BZ.Secrets.find('hashbrown');
      }
    }
    // If the chosen character got locked out somehow, fall back to a default.
    if (!BZ.Secrets.charUnlocked(selectedChar)) selectedChar = 'chad';
    toGame();
    wonThisRun = false;
    BZ.Game.start(selectedChar, nm || 'BLOCKHEAD', selectedDiff, selectedClass);
    checkOrientation();
  }

  $('btn-play').addEventListener('click', startGame);
  $('btn-again').addEventListener('click', startGame);
  $('btn-menu').addEventListener('click', function () {
    screenStack = ['screen-title'];
    show('screen-title');
    refreshTitleStats();
  });

  $('btn-chars').addEventListener('click', function () { buildCharGrid(); openScreen('screen-chars'); });
  $('btn-classes').addEventListener('click', function () { buildClassGrid(); openScreen('screen-classes'); });
  $('btn-secrets').addEventListener('click', function () { buildSecrets(); openScreen('screen-secrets'); });
  $('btn-howto').addEventListener('click', function () { openScreen('screen-howto'); });
  $('btn-howto2').addEventListener('click', function () { openScreen('screen-howto'); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-back]'), function (b) {
    b.addEventListener('click', back);
  });

  $('logo').addEventListener('click', function () {
    BZ.Audio.init();
    if (BZ.Secrets.logoTap()) refreshTitleStats();
  });

  // --- pause
  function pause() {
    if (!BZ.Game.isRunning()) return;
    BZ.Game.setPaused(true);
    screenStack = ['screen-title', 'screen-pause'];
    show('screen-pause');
    syncMute();
  }
  function resume() {
    toGame();
    BZ.Game.setPaused(false);
  }
  $('btn-pause').addEventListener('click', pause);
  $('btn-resume').addEventListener('click', resume);
  $('btn-quit').addEventListener('click', function () {
    BZ.Game.quit();
    BZ.Audio.stopSong();
    screenStack = ['screen-title'];
    show('screen-title');
    refreshTitleStats();
  });
  function syncMute() {
    $('btn-mute').textContent = 'Sound: ' + (BZ.Audio.isMuted() ? 'off' : 'on');
  }
  $('btn-mute').addEventListener('click', function () {
    BZ.Audio.setMuted(!BZ.Audio.isMuted());
    syncMute();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && BZ.Game.isRunning() && !BZ.Game.isPaused()) pause();
  });

  // --- action buttons
  function bindAction(id, name) {
    var el = $(id);
    function go(e) { e.preventDefault(); e.stopPropagation(); BZ.Game.action(name); }
    el.addEventListener('touchstart', go, { passive: false });
    el.addEventListener('click', function (e) {
      // Ignore the synthetic click that follows a handled touch.
      if (e.detail === 0) return;
      go(e);
    });
  }
  bindAction('btn-reload', 'reload');
  bindAction('btn-melee', 'melee');
  bindAction('btn-nade', 'grenade');
  bindAction('btn-swap', 'swap');
  bindAction('prompt', 'interact');
  bindAction('btn-ability', 'ability');

  // --- share
  $('btn-share').addEventListener('click', function () {
    if (!lastResult) return;
    var msg = 'I survived to ROUND ' + lastResult.round + ' in BLOCKHEAD ZOMBIES with ' +
      lastResult.kills + ' oofs and found ' + BZ.Secrets.count() + '/' + BZ.Secrets.total() +
      ' secrets. Beat that.';
    var url = location.href.split('#')[0];
    if (navigator.share) {
      navigator.share({ title: 'Blockhead Zombies', text: msg, url: url })
        .catch(function () { /* user dismissed the sheet */ });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(msg + ' ' + url).then(function () {
        toast('Score copied — paste it to your cousin.', 'good');
      }, function () {
        toast('Could not copy. Screenshot it instead.', 'bad');
      });
    } else {
      toast(msg, 'good', true);
    }
  });

  // --- install
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    installEvent = e;
    $('install-line').hidden = false;
  });
  $('btn-install').addEventListener('click', function () {
    if (!installEvent) return;
    installEvent.prompt();
    installEvent = null;
    $('install-line').hidden = true;
  });

  // --- orientation nudge
  function checkOrientation() {
    var portrait = window.innerHeight > window.innerWidth;
    $('rotate').hidden = !(portrait && window.innerWidth < 620 && BZ.Game.isRunning());
  }
  $('rotate').addEventListener('click', function () { $('rotate').hidden = true; });
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', function () { setTimeout(checkOrientation, 240); });

  /* ------------------------------------------------------------ FRAME LOOP */
  BZ.Game.attach(stage);

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (bannerT > 0) {
      bannerT -= dt;
      if (bannerT <= 0) $('banner').hidden = true;
    }

    BZ.Game.update(dt);
    BZ.Game.render();

    var S = BZ.Game.state();
    if (S && S.running && S.player) {
      var frac = S.player.cls.cd > 0 ? S.player.abilityCd / S.player.cls.cd : 0;
      $('ability-sweep').style.setProperty('--cd', (Math.max(0, frac) * 360).toFixed(0) + 'deg');
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ------------------------------------------------------------------ INIT */
  var saved = BZ.Secrets.progress.name;
  if (saved) $('name-input').value = saved;
  refreshTitleStats();
  buildCharGrid();
  buildDifficulty();
  buildClassGrid();

  // Kick the audio context awake on the very first interaction of any kind.
  ['touchstart', 'mousedown', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, function once() {
      BZ.Audio.init();
      window.removeEventListener(ev, once);
    }, { once: true });
  });

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline play just won't be available */ });
    });
  }
})(window.BZ = window.BZ || {});
