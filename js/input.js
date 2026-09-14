/* BLOCKHEAD ZOMBIES — input.
   Twin floating sticks for touch (left half moves, right half aims + fires)
   plus a full keyboard/mouse fallback so the game is playable on a desktop
   while you're tweaking it. Action buttons are DOM elements; they call
   press(name) so both input paths funnel through one place. */
(function (BZ) {
  'use strict';

  var state = {
    move: { x: 0, y: 0 },        // normalised -1..1
    aim:  { x: 0, y: -1 },       // unit vector, last known facing
    aiming: false,               // right stick held / mouse down
    firing: false,
    mouse: { x: 0, y: 0, has: false },
    usedTouch: false,
    // Edge-triggered actions, consumed by the game loop.
    queued: {},
    // Live stick visuals for the renderer.
    sticks: { move: null, aim: null }
  };

  var DEAD = 0.16;
  var TAP_MS = 260;
  var TAP_SLOP = 22;
  var RADIUS = 62;

  function press(name) { state.queued[name] = true; }
  function consume(name) {
    if (state.queued[name]) { state.queued[name] = false; return true; }
    return false;
  }

  /* ------------------------------------------------------------------ TOUCH */
  var touches = {}; // identifier -> {role, ox, oy, x, y}

  function stickVector(t) {
    var dx = t.x - t.ox, dy = t.y - t.oy;
    var len = Math.hypot(dx, dy);
    if (len < 1) return { x: 0, y: 0, mag: 0 };
    var clamped = Math.min(len, RADIUS);
    return { x: dx / len, y: dy / len, mag: clamped / RADIUS };
  }

  function recompute() {
    var mv = null, am = null;
    for (var id in touches) {
      var t = touches[id];
      if (t.role === 'move') mv = t;
      else if (t.role === 'aim') am = t;
    }
    if (mv) {
      var v = stickVector(mv);
      state.move.x = v.mag > DEAD ? v.x * v.mag : 0;
      state.move.y = v.mag > DEAD ? v.y * v.mag : 0;
      state.sticks.move = { ox: mv.ox, oy: mv.oy, x: mv.x, y: mv.y, r: RADIUS };
    } else {
      state.move.x = 0; state.move.y = 0;
      state.sticks.move = null;
    }
    if (am) {
      var a = stickVector(am);
      if (a.mag > DEAD) {
        state.aim.x = a.x; state.aim.y = a.y;
        state.aiming = true;
        state.firing = true;
      } else {
        state.aiming = true;
        state.firing = false;
      }
      state.sticks.aim = { ox: am.ox, oy: am.oy, x: am.x, y: am.y, r: RADIUS };
    } else {
      state.aiming = false;
      state.firing = false;
      state.sticks.aim = null;
    }
  }

  function attach(el) {
    function localPoint(touch) {
      var r = el.getBoundingClientRect();
      return { x: touch.clientX - r.left, y: touch.clientY - r.top };
    }

    el.addEventListener('touchstart', function (e) {
      // Let DOM buttons handle their own taps.
      if (e.target !== el) return;
      e.preventDefault();
      state.usedTouch = true;
      var r = el.getBoundingClientRect();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        var p = localPoint(t);
        var role = p.x < r.width * 0.5 ? 'move' : 'aim';
        // One stick per side; a second finger on a taken side is ignored.
        var taken = false;
        for (var id in touches) if (touches[id].role === role) taken = true;
        if (taken) continue;
        touches[t.identifier] = { role: role, ox: p.x, oy: p.y, x: p.x, y: p.y,
                                  t0: Date.now(), moved: 0 };
      }
      recompute();
    }, { passive: false });

    el.addEventListener('touchmove', function (e) {
      var moved = false;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (!touches[t.identifier]) continue;
        var p = localPoint(t);
        var rec = touches[t.identifier];
        rec.moved = Math.max(rec.moved, Math.hypot(p.x - rec.ox, p.y - rec.oy));
        rec.x = p.x;
        rec.y = p.y;
        moved = true;
      }
      if (moved) { e.preventDefault(); recompute(); }
    }, { passive: false });

    function end(e) {
      var changed = false;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        var rec = touches[t.identifier];
        if (!rec) continue;
        // A quick tap on the aim side (rather than a drag) swings the sword.
        // Both thumbs are already committed to the sticks, so melee needs a
        // gesture rather than yet another button to reach for.
        if (rec.role === 'aim' && rec.moved < TAP_SLOP && (Date.now() - rec.t0) < TAP_MS) {
          press('melee');
        }
        delete touches[t.identifier];
        changed = true;
      }
      if (changed) recompute();
    }
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });

    /* ----------------------------------------------------------- MOUSE */
    el.addEventListener('mousemove', function (e) {
      var r = el.getBoundingClientRect();
      state.mouse.x = e.clientX - r.left;
      state.mouse.y = e.clientY - r.top;
      state.mouse.has = true;
    });
    el.addEventListener('mousedown', function (e) {
      if (e.target !== el) return;
      e.preventDefault();
      state.firing = true; state.aiming = true;
    });
    window.addEventListener('mouseup', function () {
      state.firing = false; state.aiming = false;
    });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  /* --------------------------------------------------------------- KEYBOARD */
  var keys = {};
  var KEYMAP = {
    KeyR: 'reload', KeyE: 'interact', KeyF: 'melee', KeyG: 'grenade',
    Space: 'interact', KeyQ: 'swap', Escape: 'pause', KeyP: 'pause',
    KeyM: 'mute'
  };

  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    keys[e.code] = true;
    if (KEYMAP[e.code]) { press(KEYMAP[e.code]); e.preventDefault(); }
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  window.addEventListener('blur', function () {
    keys = {}; touches = {}; recompute();
  });

  function keyboardMove() {
    var x = 0, y = 0;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;
    if (keys.KeyW || keys.ArrowUp) y -= 1;
    if (keys.KeyS || keys.ArrowDown) y += 1;
    if (x || y) {
      var l = Math.hypot(x, y);
      return { x: x / l, y: y / l };
    }
    return null;
  }

  BZ.Input = {
    state: state,
    attach: attach,
    press: press,
    consume: consume,
    /* Called once per frame before the sim. `playerScreen` lets the mouse act
       as an aim source relative to where the player is actually drawn. */
    update: function (playerScreen) {
      var km = keyboardMove();
      if (km) { state.move.x = km.x; state.move.y = km.y; }
      if (state.mouse.has && !state.usedTouch && playerScreen) {
        var dx = state.mouse.x - playerScreen.x;
        var dy = state.mouse.y - playerScreen.y;
        var l = Math.hypot(dx, dy);
        if (l > 4) { state.aim.x = dx / l; state.aim.y = dy / l; }
      }
    },
    clearSticks: function () { touches = {}; recompute(); }
  };
})(window.BZ = window.BZ || {});
