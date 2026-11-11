# 🥚 Egg Dash

**A 3D browser egg-heist & training simulator.** Train Speed on 20 tiers of treadmills, run down the long **Egg Lane**, grab an egg and outrun the guards back to your base. Placed eggs hatch into pets that earn cash every second. A night falls every 3 minutes, and on 1 night in 30 a **DIVINE** event drops a Divine Egg into every zone of the lane.

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
| Jump | **Space** |
| Steal / buy / sell / open shop | **E** (eggs are placed automatically when you step on an empty pad) |
| Orbit camera | **Drag** with any mouse button · **Q** / **←** / **→** |
| Zoom | **Mouse wheel** |
| Close menu | **Esc** |
| Touch devices | Left half of the screen is a virtual joystick, the right half drags the camera, and there are on-screen Jump and **E** buttons |

---

## 🧭 How to play

1. **Train.** Head west to the **Training Grounds**. Stand still on a treadmill you own and you'll run in place, gaining **Speed ⚡**. Treadmills give Speed only, never cash. Walk speed is **linear** in Speed: `walk = 12 + Speed / 500` studs/s, so 100K Speed gives twice the bonus of 50K (112 → 212 studs/s). The physics cap is 400 studs/s.
2. **Steal.** Head north into the **Egg Lane**, one long walled runway. Eggs sit in two lines on pedestals, and every zone further from home has better eggs and faster guards. Press **E** next to an egg to grab it. That sets off the zone's alarm, and its guards chase you.
3. **Outrun.** There are no lasers. It's a race: if you're faster than the guards (carrying an egg slows you a little), you can bring the egg all the way home. A guard whose egg you're holding never gives up until you reach the safe plaza. If you're caught, you go back to base and the egg returns to its pedestal.
4. **Hatch.** Step onto an empty pad at **your base** (12 pads in the plaza) and the egg is placed there. It incubates, hatches into a pet, and the pet earns cash every second (a Doggy makes $5/s). When the base is full, press **E** on a pet's pad while carrying an egg to sell that pet and swap the egg in.
5. **Upgrade.** Spend pet income on better treadmills and trails (training multipliers), then go deeper down the lane.

### The Egg Lane

| Zone | Distance | Guards (speed) | Outrun at | Hatch | Pets (income/s) |
| --- | --- | --- | --- | --- | --- |
| Farm Coop | 36–86 m | 1 (9) | 👟12 (no training needed) | 8 s | Chick $2, Kitty $3, Doggy $5, Bunny $10 |
| Crystal Cavern | 98–168 m | 2 (18) | 👟22 (⚡5K) | 15 s | Bunny $10, Piggy $15, Mousey $20, Fox $40 |
| Golden Vault | 182–282 m | 2 (32) | 👟40 (⚡14K) | 25 s | Fox $40, Penguin $60, Panda $80, Owl $150 |
| Lava Fortress | 298–448 m | 3 (55) | 👟68 (⚡28K) | 40 s | Owl $150, Polar Bear $220, Deer $300, Dragon $700 |
| Neon Citadel | 466–706 m | 3 (95) | 👟115 (⚡52K) | 60 s | Deer $300, Dragon $700, Unicorn $1K, Phoenix $1.5K |
| Cosmic Rift | 726–1086 m | 4 (160) | 👟195 (⚡92K) | 90 s | Dragon $700, Unicorn $1K, Phoenix $1.5K |
| ✦ Divine Egg | 1 per zone, DIVINE nights only | that zone's guards | | 120 s | Divine pets, $5K–$15K |

HUGE pets earn **5×** and take 1.5× longer to hatch. A pet sells for 30 seconds of its income.

---

## ✨ Feature checklist (vs. the design brief)

| Brief | Implementation |
| --- | --- |
| **Night every 3 minutes** | 180 s cycle: 120 s of day and 60 s of night, with dusk and dawn blends. The HUD pill counts down to the next phase. |
| **Divine event, 1/30 per night** | Rolled each time night falls (`CYCLE.divineChance = 1/30`). The sky turns to a gold and violet aurora, a light pillar rises from the plaza altar, and a **Divine Egg** appears in every zone of the Egg Lane with a golden beam. Steal one before dawn; it always hatches one of 4 **DIVINE** pets ($5K–$15K/s, halo, golden wings, particle aura). Unclaimed Divine eggs fade at sunrise. |
| **HUGE eggs, 1/10 (Divine 1/50)** | Each spawned egg rolls `HUGE_EGG_CHANCE = 1/10`; Divine eggs roll `HUGE_DIVINE_CHANCE = 1/50`. HUGE eggs are 2.1× size with a pulsing shell, glow halo, spinning ring and light beam, and announce their spawn with a toast and a minimap marker. They hatch HUGE pets that earn **5×**. |
| **Caught → reset** | Guards patrol and spot you with vision cones; stealing sets off the zone's alarm. If a guard catches you, you go back to base, the egg goes back to its pedestal, and you get a BUSTED screen with a shake. |
| **20 treadmill tiers** | Each has a unique procedural model: Wooden Plank → Rustic Barn → Cobblestone → Bamboo → Iron → Steel → Copper → Gold → Ruby → Sapphire → Emerald → Amethyst → Crystal → Magma (embers) → Frostbite (ice spikes, snow) → Neon Bloom → Neon Pulse → Hologram (spinning holo rings) → Cyber Laser (laser rails, scanning sheet) → Quantum Cosmos (orbiting planets, starfield belt). Prices rise smoothly by about 1.86× per tier. |
| **Passive training** | Standing still on an owned treadmill auto-runs. Speed/s = tier rate × trail. Speed only, no cash. |
| **Functional trails** | 9 particle trails (Sparkle, Flame, Ocean, Toxic, Rainbow, Galaxy, Plasma, Void, Celestial), each a direct training multiplier from x1.25 up to x15. |
| **Pets & eggs** | Eggs are only stolen, never bought. 15 regular pets across Common → Legendary plus 4 Divine pets, all procedurally modeled. They live on your 12 base pads, hop or hover there, and earn cash per second. The Base menu shows every pad, the odds for each zone, and sell buttons. |
| **Visuals** | Stylized low-poly world with PBR materials, soft PCF shadows that follow the player, **GTAO ambient occlusion**, **Unreal bloom**, SMAA, ACES tone mapping, a gradient sky with sun, moon, twinkling stars and aurora, fog transitions, and neon that switches on at night (lamps, signs, vault trims). |
| **UI** | Arcade HUD: cycle timer, Cash, Speed (+rate), walk speed, pet income/s, top earners and trail, a lane progress bar, a rotating minimap that zooms out as you get faster, prompts, toasts, floating +cash/+speed numbers, an alarm vignette while chased, and shop modals. |

Also included: a synthesized soundtrack and SFX (WebAudio, nothing to download), autosave to `localStorage` (older saves are migrated, and your best pets move onto base pads), a first-run tutorial, **Auto / Low / Medium / High (GTAO) / Ultra** graphics with automatic downgrade on slow machines, touch controls, and a stats page.

---

## 🗂️ Project structure

```
egg-dash/
├── index.html              # HUD markup, title screen, overlays
├── vite.config.js
├── package.json
└── src/
    ├── main.js             # Game class: loop, camera, interactions, heists, placing/hatching, income
    ├── config.js           # ALL balance & content: cycle, speed curve, treadmills, trails, pets, lane zones
    ├── state.js            # Save/load (localStorage, migrates v1 saves), economy, base plots
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
    │   ├── lane.js         # The Egg Lane: zones, pedestals, eggs, guards (AI), Divine eggs
    │   ├── base.js         # Your 12 base pads: incubating eggs, hatched pets, labels
    │   └── hub.js          # Home arch, Divine altar, Trail shop
    ├── entities/
    │   ├── avatar.js       # Blocky animated character (player & guards)
    │   ├── player.js       # Player controller, carry arrow
    │   ├── pets.js         # Procedural pet builder
    │   └── trails.js       # Trail particle emitter
    └── ui/
        ├── hud.js          # HUD, toasts, floaters, banners, minimap
        ├── menus.js        # Treadmill / Trail / Base / Settings modals
        └── preview.js      # Offscreen pet & egg thumbnails
```

### Tuning the game

Every number lives in `src/config.js`: cycle length, divine odds, huge-egg odds, the Speed → walk curve, treadmill rates and prices, trail multipliers, pet incomes, and each lane zone's distance, guards, egg pool and hatch time.

### Debug mode

Open **http://localhost:5173/?debug** to unlock these keys:

| Key | Effect |
| --- | --- |
| **N** | Skip to dusk (night in 3 s) |
| **B** | Skip to dawn |
| **V** | Force a **Divine** event at the next nightfall (and skip to dusk) |
| **M** | +$1,000,000 |
| **K** | +25,000 Speed |
| **H** | Turn every egg in the lane HUGE |
| **J** | Finish hatching every incubating egg |

`window.game` is exposed in the console for poking around.

---

## License

MIT
