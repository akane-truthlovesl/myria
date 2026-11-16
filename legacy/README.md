# MYRIA — a drop of living light

A soft-body game about a formless creature of luminous hydrogel. It reaches, probes, clings,
stretches into strands, splits into a myriad of siblings and fuses whole again — in a drowned
observatory of glass that it slowly relights.

## Play

- **Easiest:** open `dist/myria.html` in a modern browser (Chrome, Edge, Safari 17+, Firefox). It is a
  single self-contained file — no server, no install. Needs WebGL2.
- **From source:** `python3 -m http.server 8080` in this folder, then open <http://localhost:8080/>.
- **Rebuild the single file:** `npm install && npm run build` → `dist/myria.html`.

The opening is wordless: touch (or click, or press any key) the glass letters.

## Controls

| Intent | Touch | Mouse | Keyboard | Gamepad |
|---|---|---|---|---|
| **Flow** (move; gentle = probe with a tendril) | drag anywhere — a translucent anchor appears under your thumb | left-drag anywhere | WASD / arrows | left stick |
| **Dart** (burst — costs a little mass, shed as a jet you can fetch back) | flick and release | flick and release | Space | A |
| **Bud** (split off a sibling toward a point) | tap with a second finger | right-click (aims at cursor) | E / Shift | X |
| **Rally** (call all siblings home & fuse) | pinch | middle button | hold Q or R | B |
| **Focus** (pilot another droplet — any size) | tap it, or its edge bubble | click it | Tab | bumpers |
| **Pause** | ‖ button | ‖ button | Esc / P | Start |

Climbing is automatic on clingable surfaces: push *into* warm stone and you climb over it; push
*away* to peel off (a gel strand draws out and snaps). Cold mirror-glass cannot be gripped — unless
you are resin. Push hard against something that won't yield and the gel phase-softens to flow through
slots. Where watchers roam, hold still against a surface and the creature exhales into a near-invisible
veil. In mid-air you get two darts before you must touch something again. Tap the creature to tickle it.

## Modes (portals in the Atrium)

- **Odyssey** — thirteen chambers, each teaching one idea through physics alone: First Light · The Climb ·
  Leap · Two Hearts · The Comb · Shear · Amber · Quicksilver · Veil · Tidepool · Iron Bloom ·
  Event Horizon · The Heart. Three stars each (Light gathered, Prisms found, Grace under par time), named
  style moves (Thread the Needle, Wall Runner, Pearl Drop, Surgical Shear, Ghost Wall, Gathering Song…).
  Stars awaken new living pigments for the creature in the Atrium's wardrobe ring.
- **Bloom** — top-down petri-dish ecosystem: grow, devour, out-think rival organisms; daily mutated axioms.
- **Kneading Pool** — therapeutic sandbox: knead with your fingers, pour fluids, drop contraptions.
- **Duet** — two players, one screen.

## How it works

- **Engine** (`src/engine/physics.js`): a viscoelastic particle continuum — Clavet-style double-density
  relaxation (real surface tension at every scale: a 2-particle droplet is still a pearl), plastic springs
  with yield + creep (stretch thinner and thinner, then snap; always roll back into a pearl), XSPH
  silkiness, per-material rheology (`materials.js`: lumen hydrogel, quicksilver, resin, shear-thickening
  bastion, ferrofluid, oil, cryo, foam…), immiscible phases, contextual fusion (fresh-cut passivation,
  group rules), blade severing, connected-component splitting, SDF walls with hyper-slick tangential /
  micro-tacky normal contact, kinematic shapes, zones (gravity pockets, currents, wells, magnets, heat).
- **Will** (`src/game/organism.js`): local actuation, global viscoelastic coupling — a front-loaded
  pseudopod drive, a lead tendril on gentle input, curiosity feelers toward motes and your finger,
  area-conserving breathing waves, contextual tonus (pearl at rest, supple while reaching/squeezing),
  surface-aware crawling and climbing, darts with a mass jet, budding.
- **Optics** (`src/render/`): particles splat into multi-target density/colour fields → mip pyramid →
  multi-scale dome heights → composite with chromatic refraction, Beer–Lambert absorption, Fresnel,
  light-derived specular (no painted highlights), lens caustics + shadows on the world, volumetric
  in-scattered bioluminescence from a beating heart, suspended micro-bubbles riding the internal flow,
  HDR bloom and filmic tonemapping. Walls share the same SDF the physics collides with.
- **Sound** (`src/audio/audio.js`): fully procedural WebAudio — every mote is a note and chains become
  melodies; glide whispers, strand-tension hum, wet impacts, fusion thrums, reverb.

No external assets or dependencies at runtime.
