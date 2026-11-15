# Ctronhold

An original, free and open-source browser RTS prototype. The project uses Rust for deterministic simulation and ECS, WebAssembly for the browser boundary, and Three.js for rendering.

## Stack

- Rust workspace: `game-core` and `wasm-bridge`
- ECS: `bevy_ecs`
- Browser bridge: `wasm-bindgen`
- Rendering and camera: Three.js + TypeScript
- UI: React + TypeScript + Vite

## Requirements

- Rust stable and `wasm32-unknown-unknown`
- `wasm-pack`
- Node.js 20+

## Run locally

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
cd crates/wasm-bridge
wasm-pack build --target web --out-dir ../../web/src/wasm
cd ../../web
npm install
npm run dev
```

Open the Vite URL printed in the terminal.

## Architecture

`game-core` owns simulation state and ECS components. `wasm-bridge` exposes a small API to JavaScript. The TypeScript presentation layer owns Three.js objects, input, camera controls and React HUD. Rendering never owns authoritative game state.

## Project scope

A sandbox/skirmish RTS with original placeholder geometry and original code. No proprietary game assets or copied source code are included. The long-term content catalogue is implemented as data-driven definitions, not hard-coded renderer branches.

## License

MIT.
