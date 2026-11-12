# 🥚 Egg Dash

**A 3D browser egg-heist & training simulator.** Train Speed on 20 tiers of treadmills, then sneak down the long **Egg Lane** through **10 themed lands**. Every land's **Guardians** sleep until you grab an egg they protect; then they wake up and chase you home. Placed eggs hatch into pets that earn cash every second. Every land also has a permanent golden **DIVINE egg** whose pets earn $25K–$5M per second. Earn **D Coins** (10 every 3 minutes, or from codes) to spend in the **SHOP**.

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
| SLOW MODE | 🐢 side button: walk at exactly 10 studs/s; click again to go back to your normal speed |
| Touch devices | Left half of the screen is a virtual joystick, the right half drags the camera, and there are on-screen Jump and **E** buttons |

---

## 🧭 How to play

1. **Train.** Head west to the **Training Grounds**. Stand still on a treadmill you own and you'll run in place, gaining **Speed ⚡**. Treadmills give Speed only, never cash. Walk speed is **linear** in Speed: `walk = 12 + Speed / 500` studs/s, so 100K Speed gives twice the bonus of 50K (112 → 212 studs/s). The physics cap is 400 studs/s.
2. **Steal.** Head north into the **Egg Lane**, one long walled runway through 10 lands. Eggs sit in two lines on pedestals, and every land further from home has better eggs and faster Guardians. The Guardians are **asleep** (watch the floating *Z z z*). Press **E** next to an egg to grab it: the Guardian protecting that egg wakes up and chases you. The others keep snoozing.
3. **Outrun.** It's a race: if you're faster than the Guardian (carrying an egg slows you a little), you can bring the egg all the way home. A Guardian whose egg you're holding never gives up until you reach the safe plaza; then it walks back to its post and falls asleep again. If you're caught, you go back to base and the egg returns to its pedestal.
4. **Hatch.** Step onto an empty pad at **your base** (12 pads in the plaza) and the egg is placed there. It incubates, hatches into a pet, and the pet earns cash every second. When the base is full, press **E** on a pet's pad while carrying an egg to sell that pet and swap the egg in.
5. **Divine eggs.** Each land has one **Divine egg** on a golden pedestal at its far end, all the time. It hatches one of that land's two Divine pets, and the deeper the land, the stronger the pet: from $25K/s in the Forest to $5M/s on the Alien Planet. Once taken, it respawns after 90–180 s (a countdown floats over the pedestal).
6. **Upgrade.** Spend pet income on better treadmills and trails (training multipliers), and spend 🪙 **D Coins** in the **🛒 SHOP**.

### The Egg Lane

| Land | Distance | Guardians (speed) | Outrun at | Hatch | Pets (income/s) | ✦ Divine pets |
| --- | --- | --- | --- | --- | --- | --- |
| 1. 🌲 Forest | 36–86 m | 1 (9) | 👟12 (no training needed) | 8 s | Squirrel $3, Bunny $5, Fox $8, Owl $13 | Ancient Treant $25K, Sylvan Stag $35K |
| 2. 🏜️ Desert | 100–156 m | 1 (16) | 👟20 (⚡4K) | 14 s | Camel $10, Scorpion $17, Fennec Fox $28, Cactus Buddy $45 | Pharaoh Cat $45K, Sun Scarab $60K |
| 3. 🚜 Farm | 170–234 m | 2 (24) | 👟30 (⚡9K) | 22 s | Chick $30, Doggy $40, Kitty $50, Piggy $85, Cow $135 | Golden Goose $80K, Holy Cow $110K |
| 4. ❄️ Ice | 248–322 m | 2 (35) | 👟44 (⚡16K) | 32 s | Penguin $80, Seal $135, Polar Bear $225, Arctic Fox $360 | Aurora Penguin $150K, Glacier Yeti $200K |
| 5. 🔥 Fire | 336–422 m | 2 (50) | 👟62 (⚡25K) | 45 s | Salamander $200, Magma Pup $340, Dragon $560, Phoenix $900 | Inferno Phoenix $270K, Magma Dragon $360K |
| 6. 🌊 Ocean | 436–536 m | 3 (68) | 👟85 (⚡36.5K) | 60 s | Crab $450, Dolphin $765, Octopus $1.26K, Shark $2K | Pearl Narwhal $480K, Kraken King $650K |
| 7. 🦖 Dino Land | 550–666 m | 3 (92) | 👟115 (⚡51.5K) | 75 s | Triceratops $1K, Stegosaurus $1.7K, Raptor $2.8K, T-Rex $4.5K | Primal T-Rex $850K, Amber Pterodactyl $1.1M |
| 8. 🌌 Cosmic Rift | 680–814 m | 3 (124) | 👟155 (⚡71.5K) | 90 s | Star Kitty $2.2K, Nebula Jelly $3.7K, Comet Fox $6.2K, Unicorn $10K | Galaxy Unicorn $1.5M, Void Dragon $2M |
| 9. 🤖 To the Future | 828–982 m | 4 (164) | 👟205 (⚡96.5K) | 110 s | Robo Pup $4.8K, Drone Owl $8.2K, Mecha Cat $13.4K, Cyber Dragon $21.6K | Quantum Mech-Cat $2.6M, Chrono Dragon $3.3M |
| 10. 👽 Alien Planet | 996–1172 m | 4 (216) | 👟270 (⚡129K) | 130 s | Blobby $10K, Zorp $17K, Saucer Squid $28K, Xeno Dragon $45K | Xeno Overlord $4M, Star-Eater Squid $5M |

Each land has its own scenery, Guardian costume, egg pattern and pets: pine trees and fireflies in the Forest, cacti and pyramids in the Desert, barns and corn on the Farm, snowmen and falling snow on Ice, lava rivers and volcanoes in Fire, coral and bubbles in the Ocean, ferns, bones and a smoking volcano in Dino Land, floating planets in the Cosmic Rift, a neon skyline with hover-cars in To the Future, and glowing alien plants under hovering UFOs on the Alien Planet.

HUGE pets (1 in 10 regular eggs) earn **5×** and take 1.5× longer to hatch. Divine eggs are never HUGE, so Divine pets always stay in the $25K–$5M/s range. A pet sells for 30 seconds of its income.

### 🪙 D Coins, the SHOP and codes

- **Time rewards:** +10 D Coins for every 3 minutes you play. The countdown sits under the D Coin counter.
- **Codes:** open **🎟️ Codes**, type a code and press **Redeem**. Codes ignore capitals and spaces, and each one works **once per player** (resetting progress keeps your D Coins and the list of used codes). Working codes: `DILL67` (999,999 D Coins) and `FREE D COINS` (500 D Coins).
- **🛒 SHOP** (prices 200–700 D Coins; stronger items cost more):
  - **✦ Divine Eggs** for all 10 lands (250 → 700), placed straight onto a free base pad
  - **Boosts:** Turbo Sneakers (2× training), Money Magnet (2× cash), Sleepy Dust (Guardians wake 3 s slower), Lucky Clover (HUGE odds 1 in 3), Sticky Goo (Guardians 25% slower), Diamond Vault (3× cash)
  - **Upgrades (permanent):** Feather Backpack (no carry slowdown), Pro Treadmill Oil (+50% training), Golden Food Bowl (+50% pet income), Divine Compass (Divine eggs respawn 2× faster)
  - **Instant packs:** Hatch-o-Matic, Speed Crate (+25K), Cash Bag (15 min of income), Mega Speed Crate (+150K)
  - **Exclusive trails:** Golden Comet (×12) and Divine Aura (×20)

---

## ✨ Feature checklist (vs. the design brief)

| Brief | Implementation |
| --- | --- |
| **Night every 3 minutes** | 180 s cycle: 120 s of day and 60 s of night, with dusk and dawn blends. The HUD pill counts down to the next phase. |
| **Permanent Divines** | Every land has a Divine egg on a golden pedestal with a light beam, always. It hatches one of that land's two Divine pets ($25K–$5M/s) with land-coloured halo, wings and aura. |
| **HUGE eggs, 1/10** | Each spawned regular egg rolls `HUGE_EGG_CHANCE = 1/10` (1/3 with Lucky Clover). HUGE eggs are 2.1× size with a pulsing shell, glow halo, spinning ring and light beam. They hatch HUGE pets that earn **5×**. |
| **Sleeping Guardians** | Guardians doze at their posts until you grab an egg they protect. Only that Guardian wakes up and chases you; if it catches you, you go back to base, the egg goes back to its pedestal, and you get a BUSTED screen with a shake. |
| **20 treadmill tiers** | Each has a unique procedural model: Wooden Plank → Rustic Barn → Cobblestone → Bamboo → Iron → Steel → Copper → Gold → Ruby → Sapphire → Emerald → Amethyst → Crystal → Magma (embers) → Frostbite (ice spikes, snow) → Neon Bloom → Neon Pulse → Hologram (spinning holo rings) → Cyber Laser (laser rails, scanning sheet) → Quantum Cosmos (orbiting planets, starfield belt). Prices rise smoothly by about 1.86× per tier. |
| **Passive training** | Standing still on an owned treadmill auto-runs. Speed/s = tier rate × trail. Speed only, no cash. |
| **Functional trails** | 9 particle trails (Sparkle, Flame, Ocean, Toxic, Rainbow, Galaxy, Plasma, Void, Celestial), each a direct training multiplier from x1.25 up to x15. |
| **Pets & eggs** | 41 regular pets and 20 Divine pets, all procedurally modeled and themed to their land, plus a unique shell pattern per land. They live on your 12 base pads, hop or hover there, and earn cash per second. The Base menu shows every pad, the odds for each land, and sell buttons. |
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
    │   ├── daynight.js     # 3-minute cycle, lighting/fog/bloom keyframes, night events
    │   ├── colliders.js    # 2.5D box/circle collision, step-up, line of sight
    │   ├── treadmills.js   # 20 unique treadmill models + training floor
    │   ├── lane.js         # The Egg Lane: 10 lands, scenery, pedestals, eggs, sleeping Guardians, Divine eggs
    │   ├── base.js         # Your 12 base pads: incubating eggs, hatched pets, labels
    │   └── hub.js          # Home arch, Divine altar, Trail shop
    ├── entities/
    │   ├── avatar.js       # Blocky animated character (player & Guardians), sleep pose
    │   ├── guardians.js    # Themed Guardian costumes for the 10 lands
    │   ├── player.js       # Player controller, carry arrow
    │   ├── pets.js         # Procedural pet builder
    │   └── trails.js       # Trail particle emitter
    └── ui/
        ├── hud.js          # HUD, toasts, floaters, banners, minimap
        ├── menus.js        # Treadmill / Trail / Base / SHOP / Codes / Settings modals
        └── preview.js      # Offscreen pet & egg thumbnails
```

### Tuning the game

Every number lives in `src/config.js`: cycle length, huge-egg odds, D Coin rewards, codes, shop items, the Speed → walk curve, treadmill rates and prices, trail multipliers, pet incomes, and each land's distance, Guardians, egg pool, Divine pool and hatch time.

### Debug mode

Open **http://localhost:5173/?debug** to unlock these keys:

| Key | Effect |
| --- | --- |
| **N** | Skip to dusk (night in 3 s) |
| **B** | Skip to dawn |
| **V** | Respawn every taken Divine egg now |
| **C** | +1,000 D Coins |
| **T** | Time reward in 2 seconds |
| **M** | +$1,000,000 |
| **K** | +25,000 Speed |
| **H** | Turn every egg in the lane HUGE |
| **J** | Finish hatching every incubating egg |

`window.game` is exposed in the console for poking around.

---

## License

MIT
