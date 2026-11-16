# MYRIA — a drop of living light

A soft-body game about a formless creature of luminous hydrogel that lives between the glass plates
of a microscope slide. It reaches with a crown of feelers, drinks light, squeezes through gaps, is cut
into siblings and fuses whole again — and it grows.

**Play:** open `index.html` in a browser (Chrome, Edge, Firefox, Safari). It is one self-contained
file: no server, no install, no network. Any window shape works, portrait included.

## Controls — one stick's worth

| Intent | Mouse | Keyboard | Touch | Pad |
|---|---|---|---|---|
| **Flow** | move the pointer — the creature follows it; rest the pointer on it and it rests | WASD / arrows | drag anywhere (an anchor wakes under your thumb) | left stick |
| **Dart** (a burst of speed; costs a little mass you can fetch back) | click | Space | tap, or flick | A |
| **Lance** (a coiled dart: it cleaves a bigger neighbour in two) | hold, then release | — | — | — |
| **Bud** (throw off a sibling) | right-click | E | second-finger tap | X |
| **Swell / pop** (hold a breath: twice the silhouette, the same mass; let go to shove) | hold right button | hold F | hold a second finger | Y |
| **Rally** (call siblings home to fuse) | hold middle button | hold Q | pinch | B |
| **Focus** another sibling | click it | Tab | tap it | bumpers |
| Pause | ‖ | Esc / P | ‖ | Start |

Nothing else to learn: feelers fetch nearby light by themselves, pushing into a gap softens the gel
so it flows through, resting near a pad or an open pore settles you onto it, and resting against a
wall where something is watching makes you a veil it cannot see.

## What is in it

- **The Atrium** — the title is written in motes. Wake the sleeping pearl and eat the word.
- **Odyssey** — twenty single-screen chambers in four strata (Dew · Glassworks · Chemistry · Abyss),
  each teaching one idea through physics alone: squeezing, darting through a soap film, budding to
  hold two pads, threading a comb, blades, grinders and healing springs, pistons, sticky resin against
  a river, quicksilver among hunters, oil that will not mix, shear-thickening armour, ferrofluid
  leaping between pulsing poles, frost that stiffens you and vents that thaw a frozen door, watchers
  you hide from by holding still, a gyre of currents, a black hole, bluffing giants with a held
  breath, a hunt, and a heart that needs you in three places at once.
  Three living stars per chamber: **Radiance** (all the light), **Grace** (lose almost nothing),
  **Swift** (under par). The pore opens at 60 % — the rest is appetite. Named tricks (Thread the
  Needle, Surgical Shear, Ghost Wall, Paper Tiger, Cleave…) are noticed when you find them.
- **Abyss** — an endless generated descent with grazers, lancers, thornbacks and oil for neighbours.
  Bigger membranes siphon smaller ones (the swallowed pigment swirls inside you before it becomes
  yours). Every second chamber you choose one of three ways to change; every fifth is a predator
  dish. Three embers; where a dive ends, an echo of your light waits for the next one.
- **Daily** — the same dive for everyone today: one seed, one mutated axiom.
- **Duet** — two players, one screen (pointer + W A S D / Space / F): **Together**, a co-op dive where
  touching shares mass between you, or **Versus**, ninety seconds of raining light.
- **Pool** — a sandbox with nothing to win: knead the gel with the pointer, pour oil, quicksilver,
  resin and foam, drop machines and neighbours, and watch one physics answer everything.

If you are ever reduced to almost nothing you become an **ember**: nothing can drink you, you move
faster, and every mote counts double until you are whole again.

## How it works

Everything is drawn on the CPU, on purpose: the game was built and play-tested on a machine with no
GPU behind a remote desktop, so it is designed to cost only what moves.

- **Matter** (`src/sim`) — a viscoelastic particle continuum: double-density relaxation (surface
  tension that never switches off — a two-particle droplet is still a pearl), plastic springs with
  yield and creep, per-material rheology, immiscible phases, blade severing, connected-component
  splitting and contextual re-fusion, signed-distance walls with slick tangential / tacky normal
  contact, kinematic machines, force zones.
- **Will** (`src/life`) — local actuation with global viscoelastic coupling; a crown of verlet feelers
  that trail, reach, fetch and startle; colonies of siblings with focus and rally; small legible
  brains for the other species (they judge you by silhouette, so a held breath can bluff them).
- **Playtesting** (`src/core/bot.js`, `tools/`) — a path-planning Bot uses the same verbs through the
  same input record as a player. It finishes all twenty chambers in landscape and portrait, sets the
  par times, and powers `?bot`.
- **Light** (`src/render`) — each room's backdrop is painted once, per pixel, like a photographic
  plate (bevelled lit glass, etched grid, shadows, a reflectance map). Per frame only dirty tiles are
  restored and re-uploaded. Gel is an implicit surface: particles splat a field → dome height →
  normals → refraction with dispersion, Beer–Lambert absorption, a sphere-mapped environment for
  reflections (no painted highlights), and a photon-splat lightmap that gives every body a true
  shadow and a focused caustic. An internal pixel budget is measured at start-up and re-tuned
  between chambers; long frames fall back to 30 fps pacing instead of slowing time.
- **Sound** (`src/core/audio.js`) — fully procedural WebAudio; every mote is a note and chains
  become melodies.

## Development

```
npm install          # esbuild only
npm run build        # bundles src/ into the single index.html
node tools/play.mjs out 1280 720 8 "2,5,8"       # headless playtest → PNG frames + CPU timings
node tools/solve.mjs 0 19 1280 720 1               # the Bot plays the real Odyssey: every chamber must end DONE
node tools/rooms.mjs out 1280 720 0 19 40         # render / bot-run every Odyssey chamber
node tools/abyss.mjs out 1280 720 6 40            # soak-test six Abyss depths
```

`dev.html` loads the ES modules directly (it must be served over http). URL switches: `?room=N`,
`?mode=abyss|daily|pool|duet|coop`, `?all` (unlock everything), `?bot` (autopilot), `?maxpx=N` (fix the
internal pixel budget). The first WebGL prototype is kept in `legacy/`.
