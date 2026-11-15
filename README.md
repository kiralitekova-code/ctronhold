# Ctronhold

An original browser-based RTS prototype. It uses familiar real-time strategy ideas while keeping all code, visual assets, names, factions, maps, and content original.

## Architecture

- `crates/game-core`: authoritative Rust simulation, ECS components, deterministic grid map, and A* navigation.
- `crates/wasm-bridge`: WebAssembly API exposed with `wasm-bindgen`.
- `web`: React + TypeScript + Vite interface and Three.js presentation layer.
- The browser owns the animation loop; Rust owns game-state and navigation decisions.

## Current prototype

- Three.js RTS camera with WASD/arrow movement, edge scrolling, zoom, and right-mouse drag.
- A 64x64 world grid with a generated stone ridge, a traversable gate, and a rock field.
- The starting force contains five blue soldiers (team 1) and a three-soldier red hostile patrol (team 2). Left-click selects friendly soldiers; Shift+left-click adds or removes soldiers from the selection. Drag a rectangle to select a group.
- Right-click on terrain issues movement orders to the selected squad. Right-click an enemy to issue an attack order; soldiers find a nearby approach cell, close to melee range, and attack on a cooldown. Friendly fire is rejected. The hostile patrol detects nearby friendly soldiers within 12 world units, selects the nearest target, and attacks autonomously. When its target dies, it can acquire another target.
- Three unit classes have distinct prototype balance profiles: swordsmen (100 HP, 12 damage, 1.6 range, 3.5 speed), spearmen (120 HP, 15 damage, 2.4 range, 3.0 speed), and archers (70 HP, 9 damage, 9.0 range, 3.2 speed). Archers fire simulated projectiles; melee classes apply damage at close range. The starting squads include all three classes. Formation keys `1`, `2`, and `3` choose line, column, and wedge respectively; the browser assigns distinct formation slots and Rust computes each unit's A* path and advances movement. A basic personal-space check prevents active movers from stepping into another moving soldier.
- Every soldier has a billboard-style health bar above the model; the bar changes from green to amber to red as health falls. Defeated units are removed from the simulation and renderer.
- Impassable cells are shown as stone blocks. Castle and soldiers are primitive development placeholders, not final art.

## Local development

Requirements: stable Rust, the `wasm32-unknown-unknown` target, `wasm-pack`, and Node.js.

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
cargo test --workspace
cd crates/wasm-bridge
wasm-pack build --target web --out-dir ../../web/src/wasm
cd ../../web
npm install
npm run dev
```

For a production build:

```bash
npm run build
```

## Design principles

- Simulation and game rules stay in Rust; Three.js is presentation only.
- WebAssembly receives compact commands and returns serializable snapshots.
- Gameplay code and visual assets are original; no proprietary Stronghold code or assets are used.
- The current A* implementation uses four-way movement and Manhattan distance. Formation destinations are assigned by the presentation/input layer, while each unit's pathfinding and movement remain authoritative in Rust. Rectangle selection, basic personal-space collision checks, hostile target-acquisition AI, melee combat, and unit health bars are implemented. Robust crowd navigation, construction placement, economy, class upgrades, and siege logistics remain planned.

## License

MIT
