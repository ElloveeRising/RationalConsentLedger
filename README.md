# 🧟 BLOCKHEAD ZOMBIES

A wacky round-based zombie survival game that runs in a phone browser. Think
round-based bunker survival, but everyone is a blocky plastic action figure and
the guns are named by someone who was not taking it seriously.

**No install, no app store, no account.** Open the link, tap play. Add it to
your home screen and it runs offline like a real app.

---

## How to play

| | |
|---|---|
| **Move** | Touch and drag anywhere on the **left** half of the screen |
| **Shoot** | Touch and drag on the **right** half — drag away from centre to fire that way |
| **Buy** | Walk up to a door, wall gun, perk machine or the mystery box, then tap the prompt |
| **Points** | Hits earn 10, kills 60, foam sword kills 130. Points are money |
| **Power** | Perk machines and Pack-a-Punch stay dark until you find the generator |
| **Windows** | Zombies tear the boards off. Tap the reboard prompt to nail them back |
| **Every 5th round** | Doggo round. They are fast and they are rude |

Keyboard also works: `WASD` move · mouse aim · click to fire · `R` reload ·
`E` interact · `F` sword · `G` grenade · `Q` swap · `Esc` pause.

## The map

Five zones behind buyable doors, with a loop you can train the horde around:

```
  OBBY HALL  ──d5──  THE LOOT CAVE ──d4── ADMIN WING
      │                    │                (Pack-a-Punch)
     d1                   d3
      │                    │
  THE LOBBY  ──d2──  GENERATOR BAY
   (spawn)             (the power switch)
```

## Characters

Eight of them, each with a real gameplay passive. Two are unlocked from the
start; the rest are earned.

| | |
|---|---|
| **Chad Thundercube** | Foam sword hits 40% harder |
| **Lil Noobert** | Everything costs 12% less |
| **DJ Bricksteady** | Power-ups last 60% longer |
| **Karen Voidwalker** | Moves 15% faster |
| **Sir Oofington III** | Earns 22% more points |
| **Mr. Hashbrown** | Starts with 1000 points |
| **Bacon Hairold** | +60 max health |
| **The Admin** | Spawns holding the Oof Cannon |

## Secrets

There are **16**. Some are objects hidden in the map, some are ways of playing.
They persist between sessions, so the counter on the title screen is a
scoreboard — compare it with whoever you shared this with.

No spoilers here on purpose. The in-game Secrets screen gives you a hint for
every one you haven't cracked yet, and the full story once you have.

Three starting nudges: *the melee button is not decorative*, *something in the
Lobby is watching you*, and *an old code still works.*

---

## Running it yourself

It's plain HTML, CSS and JavaScript — no build step, no dependencies, no
bundler.

```bash
git clone <this repo>
cd blockhead-zombies
python3 -m http.server 8000
# open http://localhost:8000
```

Serve it over HTTP rather than opening `index.html` directly, so the service
worker and offline caching work.

### Publishing it

Any static host works. For GitHub Pages: **Settings → Pages → Deploy from a
branch → `main` / `(root)`**. The URL it gives you is the link to share.

## How it's built

| File | Does |
|---|---|
| `index.html` | Shell, design system, every screen and the HUD |
| `js/data.js` | Weapons, perks, power-ups, characters — all balance numbers |
| `js/mapdata.js` | Rooms, doors, windows, prop placement, tile-grid builder |
| `js/audio.js` | Every sound, synthesised at runtime via WebAudio |
| `js/secrets.js` | The 16 secrets, unlocks and localStorage persistence |
| `js/input.js` | Twin floating touch sticks + keyboard/mouse fallback |
| `js/render.js` | Extruded tile map, blocky figures, props, effects |
| `js/game.js` | Simulation: rounds, AI, weapons, economy, frame rendering |
| `js/main.js` | Screens, HUD, buttons, sharing, PWA install |

A few notes on the interesting parts:

- **No art assets.** Characters and props are drawn as blocky primitives at
  runtime, so the whole game is a few hundred KB of text.
- **No sound assets.** Gunshots, groans, the oof and the hidden anthem are all
  synthesised from oscillators and filtered noise.
- **Pathfinding is a flow field.** A BFS over the tile grid runs from the
  player a few times a second; every zombie just walks downhill on it. That
  keeps 40 of them cheap enough for a phone instead of running 40 A\* searches.
- **The map is baked once.** Tiles are extruded into an offscreen canvas and
  re-baked only when a door opens, so each frame is one blit plus the actors.

### Tweaking it

Almost everything you'd want to change is a number in `js/data.js` (gun damage,
perk costs, power-up durations) or `js/mapdata.js` (room sizes, door prices,
where things are hidden). Round scaling lives in `zombieHp`, `zombieSpeed` and
`roundCount` near the top of the round-flow section in `js/game.js`.

---

Built with [Claude Code](https://claude.com/claude-code).
