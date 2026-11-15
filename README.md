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
- Left-click a ground cell to highlight it. Right-click issues a move order to the test soldier; Rust computes A* and advances the unit along the path.
- The route is rendered as a temporary line; the soldier moves at a fixed world speed and stops at the destination. Impassable cells are shown as stone blocks.
- Castle and unit are still primitive development placeholders, not final art.

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
- The current A* implementation uses four-way movement and Manhattan distance. It is a foundation for later unit orders, formations, construction placement, and siege logistics.

## License

MIT
