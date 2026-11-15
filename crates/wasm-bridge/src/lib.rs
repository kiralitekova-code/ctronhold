use game_core::GameWorld;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct GameEngine {
    world: GameWorld,
}

#[wasm_bindgen]
impl GameEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> GameEngine {
        console_error_panic_hook::set_once();
        GameEngine { world: GameWorld::new() }
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

    pub fn elapsed(&self) -> f64 {
        self.world.elapsed()
    }
}

impl Default for GameEngine {
    fn default() -> Self {
        Self::new()
    }
}
