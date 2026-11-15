use game_core::{GameWorld, GridMap};
use game_core::components::Stance;
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

    pub fn update(&mut self, delta_seconds: f32) { self.world.update(delta_seconds, &self.map); }

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

    pub fn issue_attack(&mut self, attacker_id: u32, target_id: u32) -> bool {
        self.world.issue_attack(attacker_id, target_id, &self.map)
    }

    pub fn set_stance(&mut self, unit_ids: Vec<u32>, stance: u8) -> usize {
        let stance = match stance {
            0 => Stance::Aggressive,
            1 => Stance::Defensive,
            2 => Stance::Hold,
            _ => return 0,
        };
        self.world.set_stance_for_units(&unit_ids, stance)
    }

    pub fn retreat_units(&mut self, unit_ids: Vec<u32>) -> usize {
        self.world.retreat_units(&unit_ids, &self.map)
    }

    pub fn elapsed(&self) -> f64 { self.world.elapsed() }
}

impl Default for GameEngine {
    fn default() -> Self { Self::new() }
}
