use game_core::{GameWorld, GridMap};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct GameEngine {
    world: GameWorld,
    map: GridMap,
}

#[wasm_bindgen]
impl GameEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> GameEngine {
        console_error_panic_hook::set_once();
        GameEngine { world: GameWorld::new(), map: GridMap }
    }

    /// Advance authoritative simulation by delta time in seconds.
    pub fn update(&mut self, delta_seconds: f32) {
        self.world.update(delta_seconds);
    }

    /// Return a serializable view for the presentation layer.
    pub fn snapshot(&mut self) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(&self.world.snapshot())
            .map_err(|error| JsValue::from_str(&error.to_string()))
    }

    /// Find a walkable route between integer world-grid coordinates.
    pub fn find_path(&self, start_x: i32, start_z: i32, goal_x: i32, goal_z: i32) -> Result<JsValue, JsValue> {
        let path = self.map.find_path((start_x, start_z), (goal_x, goal_z));
        serde_wasm_bindgen::to_value(&path)
            .map_err(|error| JsValue::from_str(&error.to_string()))
    }

    /// Return blocked cells for rendering/debugging.
    pub fn blocked_cells(&self) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(&self.map.blocked_cells())
            .map_err(|error| JsValue::from_str(&error.to_string()))
    }

    pub fn elapsed(&self) -> f64 {
        self.world.elapsed()
    }
}

impl Default for GameEngine {
    fn default() -> Self {
        Self::new()
    }
}
