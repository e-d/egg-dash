# 🥚 Egg Dash

**A 3D browser egg-heist & training simulator.** Sneak into guarded vaults, steal eggs, sprint them home, train on 20 tiers of treadmills, collect glowing trails, and hatch pets. A night falls every 3 minutes, and on 1 night in 30 a **DIVINE** event brings a Divine Egg down onto the altar.

It's built with **Three.js** and plain JavaScript ES modules, bundled by **Vite**. There are no image, model or audio files: every mesh, texture, particle and sound is generated in code at runtime.

---

## ▶️ Running it locally

**Requirements:** [Node.js](https://nodejs.org) 18 or newer, plus a WebGL2-capable browser (Chrome, Edge, Firefox or Safari).

```bash
git clone https://github.com/e-d/egg-dash.git
cd egg-dash
npm install
npm run dev
```

Vite opens **http://localhost:5173**. Click **PLAY** (or press Enter).

### Production build

```bash
npm run build      # outputs a static site to dist/
npm run preview    # serves dist/ at http://localhost:4173
```

`dist/` uses relative paths, so you can drop it on any static host (GitHub Pages, Netlify, an S3 bucket, `python3 -m http.server`, and so on).

> Opening `index.html` straight from disk (`file://`) won't work, because browsers block ES-module imports there. Use `npm run dev` or serve the folder.

### Play it online with GitHub Pages (optional)

The repo includes `.github/workflows/pages.yml`. To publish:

1. In the repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
2. Go to **Actions → Deploy to GitHub Pages → Run workflow**.

The game will be served at `https://<user>.github.io/egg-dash/`. To redeploy on every commit, add a `push:` trigger to the workflow.

---

## 🎮 Controls

| Action | Keys |
| --- | --- |
| Move | **W A S D** (or arrow up/down) |
| Jump (hop over lasers!) | **Space** |
| Steal / buy / hatch / open shop | **E** |
| Orbit camera | **Drag** with any mouse button · **Q** / **←** / **→** |
| Zoom | **Mouse wheel** |
| Close menu | **Esc** |
| Touch devices | Left half of the screen is a virtual joystick, the right half drags the camera, and there are on-screen Jump and **E** buttons |

---

## 🧭 How to play

1. **Train.** Head west to the **Training Grounds**. Stand still on a treadmill you own and you'll start running in place, gaining **Speed ⚡** and a trickle of cash. Speed raises your walk speed (with diminishing returns).
2. **Steal.** Head north to the **Heist Zone**. Each vault holds a ring of nests. Walk up to an egg and press **E**. Carrying an egg slows you down, and a HUGE egg slows you down more.
3. **Escape.** Guards patrol with **vision cones** (yellow on the ground, red when they're chasing you). Laser sweepers spin at ankle height, so **jump** over them. Laser gates at vault entrances blink on and off. If you're caught you get sent back to base and the egg returns to its nest.
4. **Deposit.** Bring the egg to the green **Deposit pad** in the plaza for cash. Eggs pay **1.5×** at night.
5. **Upgrade.** Spend cash on better treadmills, trails (training multipliers) and pet eggs at the **Hatchery**. Pets multiply both training and heist cash.

### Vaults

| Vault | Egg value | Guards | Hazards |
| --- | --- | --- | --- |
| Farm Coop | $30 | 1 (slow) | none |
| Crystal Cavern | $220 | 2 | laser sweeper |
| Golden Vault | $1.6K | 2 | sweeper + laser gate |
| Lava Fortress | $13K | 3 | 2 sweepers + gate |
| Neon Citadel | $110K | 4 (very fast) | 2 fast sweepers + gate |

Faster vaults have faster guards, so you'll need Speed to outrun them. Sneaking around their vision cones always works.

---

## ✨ Feature checklist (vs. the design brief)

| Brief | Implementation |
| --- | --- |
| **Night every 3 minutes** | 180 s cycle: 120 s of day and 60 s of night, with dusk and dawn blends. The HUD pill counts down to the next phase. |
| **Divine event, 1/30 per night** | Rolled each time night falls (`CYCLE.divineChance = 1/30`). The sky turns to a gold and violet aurora, a light pillar and Divine Egg appear on the plaza altar, and a banner and toast announce it. The Divine Egg (and the Eggs menu entry) exists only during that night and gives a 30% chance of one of 4 **DIVINE** pets (x12 boost, halo, golden wings, particle aura). Otherwise you get a Legendary. |
| **HUGE eggs, 1/10** | Each spawned egg independently rolls `HUGE_EGG_CHANCE = 1/10`. HUGE eggs are 2.1× size with a pulsing emissive shell, a glow halo, a spinning ground ring and sparkles. They pay **10×** cash plus a **free pet hatch**, and announce their spawn with a toast and a minimap marker. |
| **Caught → reset** | Guards (patrol, spot, chase, give up) and lasers send you back to base, the egg goes back to its nest, and you get a BUSTED screen with a shake. |
| **20 treadmill tiers** | Each has a unique procedural model: Wooden Plank → Rustic Barn → Cobblestone → Bamboo → Iron → Steel → Copper → Gold → Ruby → Sapphire → Emerald → Amethyst → Crystal → Magma (embers) → Frostbite (ice spikes, snow) → Neon Bloom → Neon Pulse → Hologram (spinning holo rings) → Cyber Laser (laser rails, scanning sheet) → Quantum Cosmos (orbiting planets, starfield belt). Prices rise smoothly by about 1.86× per tier. |
| **Passive training** | Standing still on an owned treadmill auto-runs. Speed/s = tier rate × trail × pets. |
| **Functional trails** | 9 particle trails (Sparkle, Flame, Ocean, Toxic, Rainbow, Galaxy, Plasma, Void, Celestial), each a direct training multiplier from x1.25 up to x15. |
| **Pets & eggs** | 15 regular pets across Common → Legendary plus 4 Divine pets. All are procedurally modeled, follow you, and hop or fly. There are 5 shop eggs with visible odds, a 3D hatch cinematic, up to 3 equipped, Equip Best, and Delete. |
| **Visuals** | Stylized low-poly world with PBR materials, soft PCF shadows that follow the player, **GTAO ambient occlusion**, **Unreal bloom**, SMAA, ACES tone mapping, a gradient sky with sun, moon, twinkling stars and aurora, fog transitions, and neon that switches on at night (lamps, signs, vault trims). |
| **UI** | Arcade HUD: cycle timer, Cash, Speed (+rate), walk speed, multiplier, equipped pets and trail, rotating minimap, prompts, toasts, floating +cash/+speed numbers, an alarm vignette while chased, and sleek shop modals. |

Also included: a synthesized soundtrack and SFX (WebAudio, nothing to download), autosave to `localStorage`, a first-run tutorial, **Auto / Low / Medium / High (GTAO) / Ultra** graphics with automatic downgrade on slow machines, touch controls, and a stats page.

---

## 🗂️ Project structure

```
egg-dash/
├── index.html              # HUD markup, title screen, overlays
├── vite.config.js
├── package.json
└── src/
    ├── main.js             # Game class: loop, camera, interactions, heists, hatching, events
    ├── config.js           # ALL balance & content: cycle, treadmills, trails, pets, eggs, vaults
    ├── state.js            # Save/load (localStorage), economy, multipliers, pet inventory
    ├── util.js             # Materials, canvas text textures, egg geometry, helpers
    ├── styles.css          # Arcade UI styling (self-hosted Lilita One + Fredoka fonts)
    ├── engine/
    │   ├── renderer.js     # WebGL renderer + post-processing (GTAO, bloom, SMAA) + adaptive quality
    │   ├── input.js        # Keyboard, mouse orbit, touch joystick
    │   └── audio.js        # Procedural SFX + generative music
    ├── fx/
    │   └── particles.js    # Pooled additive GPU particle system + glow sprites
    ├── world/
    │   ├── world.js        # Terrain, paths, instanced trees/rocks, lamps, pond, clouds, signs
    │   ├── sky.js          # Gradient sky shader: sun, moon, stars, divine aurora
    │   ├── daynight.js     # 3-minute cycle, lighting/fog/bloom keyframes, divine roll
    │   ├── colliders.js    # 2.5D box/circle collision, step-up, line of sight
    │   ├── treadmills.js   # 20 unique treadmill models + training floor
    │   ├── vaults.js       # Vault compounds, nests, eggs, guards (AI), lasers
    │   └── hub.js          # Deposit pad, Divine altar, Hatchery, Trail shop
    ├── entities/
    │   ├── avatar.js       # Blocky animated character (player & guards)
    │   ├── player.js       # Player controller, carry arrow
    │   ├── pets.js         # Procedural pet builder + followers
    │   └── trails.js       # Trail particle emitter
    └── ui/
        ├── hud.js          # HUD, toasts, floaters, banners, minimap
        ├── menus.js        # Treadmill / Trail / Pet / Egg / Settings modals
        └── preview.js      # Offscreen pet thumbnails + 3D hatch cinematic
```

### Tuning the game

Every number lives in `src/config.js`: cycle length, divine odds, huge-egg odds, treadmill price curve, trail multipliers, pet rarities and powers, egg pools, vault values, guard speeds, and laser speeds.

### Debug mode

Open **http://localhost:5173/?debug** to unlock these keys:

| Key | Effect |
| --- | --- |
| **N** | Skip to dusk (night in 3 s) |
| **B** | Skip to dawn |
| **V** | Force a **Divine** event at the next nightfall (and skip to dusk) |
| **M** | +$1,000,000 |
| **K** | +5,000 Speed |
| **H** | Turn every egg in every nest HUGE |

`window.game` is exposed in the console for poking around.

---

## License

MIT
