use bevy_ecs::prelude::Component;
use serde::Serialize;

#[derive(Component, Clone, Copy, Debug, Default, Serialize)]
pub struct Position {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

#[derive(Component, Clone, Copy, Debug)]
pub struct StableId(pub u32);

#[derive(Component, Clone, Debug, Serialize)]
pub struct Sprite {
    /// Renderer-facing primitive/material key, not a texture asset.
    pub kind: String,
    pub color: [f32; 3],
}

#[derive(Component, Clone, Copy, Debug, Serialize)]
pub struct Health {
    pub current: f32,
    pub max: f32,
}

impl Health {
    pub fn new(max: f32) -> Self {
        Self { current: max, max }
    }

    pub fn damage(&mut self, amount: f32) {
        self.current = (self.current - amount.max(0.0)).max(0.0);
    }
}

/// A path-following order. The first cell is the unit's current cell.
#[derive(Component, Clone, Debug, Default)]
pub struct MoveOrder {
    pub path: Vec<[i32; 2]>,
    pub next_step: usize,
}
