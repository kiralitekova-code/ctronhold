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

    pub fn update(&mut self, delta_seconds: f32) { self.world.update(delta_seconds); }

    pub fn snapshot(&mut self) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(&self.world.snapshot())
            .map_err(|error| JsValue::from_str(&error.to_string()))
    }

    pub fn find_path(&self, start_x: i32, start_z: i32, goal_x: i32, goal_z: i32) -> Result<JsValue, JsValue> {
        let path = self.map.find_path((start_x, start_z), (goal_x, goal_z));
        serde_wasm_bindgen::to_value(&path)
            .map_err(|error| JsValue::from_str(&error.to_string()))
    }

    pub fn blocked_cells(&self) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(&self.map.blocked_cells())
            .map_err(|error| JsValue::from_str(&error.to_string()))
    }

    pub fn issue_move(&mut self, unit_id: u32, goal_x: i32, goal_z: i32) -> bool {
        self.world.move_unit(unit_id, (goal_x, goal_z), &self.map)
    }

    pub fn elapsed(&self) -> f64 { self.world.elapsed() }
}

impl Default for GameEngine {
    fn default() -> Self { Self::new() }
}
