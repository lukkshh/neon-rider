# AGENTS.md — Neon Rider Developer & Agent Guidelines

This document provides context, architecture rules, and development guidelines for AI coding agents and human contributors working on the **Neon Rider** codebase.

---

## 1. Project Overview

**Neon Rider** is a browser-based 3D arcade driving game set on an endless retro-futuristic synthwave highway. The player navigates traffic, avoids hazardous obstacles, grabs energy orbs, and activates nitro boosts while accumulating score and distance.

---

## 2. Current Technology Stack

The project relies strictly on a minimal, modern web stack without heavy frameworks:

* **Language**: JavaScript (ES Modules, standard `import` / `export`)
* **3D Graphics Engine**: [Three.js](https://threejs.org/) (`three` v0.160+)
* **Build Tool & Dev Server**: [Vite](https://vitejs.dev/) (`vite` v8+)
* **Styling**: Vanilla CSS3 (`style.css`) using responsive layouts and custom CSS properties
* **Markup**: HTML5 (`index.html`) containing HUD elements and screen overlay modals
* **Audio**: Native Web Audio API (procedural dual-oscillator engine synthesis, procedural synthwave music sequencer, and algorithmic sound effects — zero external audio files required)

> [!NOTE]
> Do not claim or assume the project uses backend technologies (e.g., Supabase, Node server, database) or TypeScript until they are explicitly installed and integrated.

---

## 3. Project Architecture & Directory Layout

The codebase has been modularized into domain-specific subsystems under `src/`:

```text
neon-rider/
├── index.html              # Main HTML page and canvas container
├── style.css               # Styling for HUD, overlays, and animations
├── package.json            # Package configuration, dependencies, and Vite scripts
├── AGENTS.md               # Instructions for AI agents and developers
├── src/
│   ├── main.js             # Application entry point; boots the game on load
│   ├── core/
│   │   └── Input.js        # Keyboard and touch input abstraction & callbacks
│   ├── player/
│   │   └── Player.js       # Player state, physics (speed, steer, nitro), car mesh & animations
│   ├── world/
│   │   ├── Models.js       # Procedural Three.js 3D meshes (cars, barriers, rocks, scenery)
│   │   └── World.js        # Highway segments, roadside decor, distant horizon, entity spawning
│   ├── systems/
│   │   ├── Audio.js        # Web Audio API engine rumble, procedural synth music, SFX
│   │   ├── Particles.js    # Speed lines, exhaust sparks, tire smoke, crash debris, coin bursts
│   │   └── CollisionSystem.js # AABB crash checks, near-miss detection, collectible pickups
│   ├── ui/
│   │   └── UI.js           # HUD display updates, score alerts, screen overlays, button listeners
│   └── game/
│       └── Game.js         # Core orchestrator: Three.js setup, camera, lights, state machine, main loop
```

### Module Responsibilities

1. **`src/core/Input.js`**: Captures keyboard (`A/D`, arrows, `W/S`, `Space`, `P`, `M`) and touch screen events. Exposes input states and action callbacks without mutating game logic directly.
2. **`src/player/Player.js`**: Encapsulates player speed curve, steering lerp, nitro consumption/recharge, boundaries, and vehicle mesh transforms (roll, pitch, yaw, wheels, exhaust).
3. **`src/world/Models.js`**: Procedural Three.js geometry builders for vehicles, highway props, and scenery using canvas textures and primitive geometries.
4. **`src/world/World.js`**: Manages infinite highway segment pooling, road recycling, horizon elements, and entity spawning (traffic, obstacles, collectibles).
5. **`src/systems/Audio.js`**: Self-contained Web Audio synthesis for procedural sound effects, engine pitch modulation, and 16-step synthwave music sequencer.
6. **`src/systems/Particles.js`**: Manages line segments for speed lines and mesh particles for exhaust, smoke, crash explosions, and coin sparkles.
7. **`src/systems/CollisionSystem.js`**: Dedicated AABB bounding box collision and proximity detector decoupled from the render loop.
8. **`src/systems/UI.js`**: Queries and updates DOM HUD elements (score, distance, speed, nitro bar), floating popups, and modal screens.
9. **`src/game/Game.js`**: Coordinates the Three.js scene, camera, lights, subsystems, and the primary `requestAnimationFrame` game loop.

---

## 4. Development Principles for Future Agents

When modifying or expanding Neon Rider, adhere to these principles:

1. **Inspect Before Changing**: Always read and understand the existing code before proposing or making changes.
2. **Preserve Working Gameplay**: The game must remain playable at every step. Do not break controls, camera follow, audio, or collision detection.
3. **Make Incremental Changes**: Focus on one feature or refinement at a time. Avoid sweeping multi-subsystem rewrites.
4. **Avoid Large Rewrites**: Build upon existing classes and patterns rather than replacing entire files.
5. **Keep Dependencies Minimal**: The project only needs `three` and `vite`. Do not install bloated libraries or physics engines unless strictly required.
6. **Prefer Simple, Understandable Code**: Keep math, state transitions, and DOM interactions clean and readable.
7. **Avoid Premature Abstractions**: Do not create empty interfaces, factory factories, or complex dependency injection containers.
8. **Keep Gameplay and UI Separated**: Gameplay calculations belong in `Player`, `World`, `CollisionSystem`, or `Game`. DOM queries and visual overlays belong in `UI`.
9. **Consider Browser Performance**: Maintain 60 FPS. Reuse geometries and materials; avoid allocating large objects inside the per-frame loop (`loop`/`update`).
10. **Test After Meaningful Changes**: Always run `npm run build` to verify module resolution, syntax, and assets.
11. **Keep Steering Continuous**: The three road lanes define markings, spawn positions, and useful reference points. Player steering should remain smooth and continuous across the road; do not snap the car between lane centers unless a task explicitly requests lane-based movement.

---

## 5. Long-Term Roadmap

The vision for Neon Rider is to evolve incrementally along these milestones:

1. **Player Movement & Game Feel**: Enhanced steering inertia, drifting mechanics, tactile camera feedback, and controller/gamepad support.
2. **Endless Road & World Generation**: Curved highways, elevation changes, tunnels, branching paths, and neon cyber cities.
3. **Obstacle Variety**: Moving hazards, road construction, oil slicks, dynamic traffic lane changes.
4. **Collision System Polish**: Accurate multi-box bounds, impact sparks, and near-miss combo multipliers.
5. **Score & Progression**: Score multiplier streaks, combo counters, distance milestones, and difficulty scaling over time.
6. **Game-Over & Restart Flow**: Interactive score recap, replay button animations, audio stings.
7. **Visual & Audio Polish**: Post-processing (bloom, chromatic aberration via Three.js postprocessing), audio tracks, custom engine samples.
8. **Online Leaderboard**: Global high-score submission and rank retrieval.
9. **Accounts & Authentication**: Optional player profiles to track career stats.
10. **Ghost & Multiplayer Features**: Asynchronous ghost racer replays, real-time multiplayer races.

> [!IMPORTANT]
> The above list is a roadmap. Do not implement these features all at once. Address them in discrete, isolated tasks when prompted.

---

## 6. Hosting & Deployment Strategy

* **Production Target**: [Vercel](https://vercel.com/) (configured via standard Vite build output `dist/`).
* **Build Command**: `npm run build`
* **Output Directory**: `dist`
* **Backend Services**: When online leaderboards or player authentication are needed in the future, prefer lightweight serverless functions or managed services (such as Supabase free tier). Do not add backend code until the feature is actively being developed.

---

## 7. TypeScript Migration Plan

The project currently uses modern ES Modules JavaScript. When migrating to TypeScript:
* Rename files from `.js` to `.ts` incrementally (Vite natively compiles TypeScript out of the box).
* Add `typescript` and `@types/three` as devDependencies.
* Add a `tsconfig.json` with `"strict": true` and `"moduleResolution": "bundler"`.
* Do not rewrite game logic during the type migration.
