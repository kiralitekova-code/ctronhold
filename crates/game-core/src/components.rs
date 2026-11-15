use bevy_ecs::prelude::Component;
use serde::Serialize;

#[derive(Component, Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UnitClass { Swordsman, Spearman, Archer }

impl UnitClass {
    pub fn max_health(self) -> f32 { match self { Self::Swordsman => 100.0, Self::Spearman => 120.0, Self::Archer => 70.0 } }
    pub fn move_speed(self) -> f32 { match self { Self::Swordsman => 3.5, Self::Spearman => 3.0, Self::Archer => 3.2 } }
    pub fn combat_stats(self) -> CombatStats { match self {
        Self::Swordsman => CombatStats { damage: 12.0, range: 1.6, attack_interval: 1.0 },
        Self::Spearman => CombatStats { damage: 15.0, range: 2.4, attack_interval: 1.2 },
        Self::Archer => CombatStats { damage: 9.0, range: 9.0, attack_interval: 1.6 },
    } }
}

#[derive(Component, Clone, Copy, Debug, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Stance { #[default] Aggressive, Defensive, Hold }

#[derive(Component, Clone, Copy, Debug)]
pub struct Projectile { pub target_id: u32, pub damage: f32, pub speed: f32 }

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
    pub fn new(max: f32) -> Self { Self { current: max, max } }

    pub fn damage(&mut self, amount: f32) {
        self.current = (self.current - amount.max(0.0)).max(0.0);
    }
}

#[derive(Component, Clone, Copy, Debug, Serialize)]
pub struct Team(pub u8);

#[derive(Component, Clone, Copy, Debug, Serialize)]
pub struct CombatStats {
    pub damage: f32,
    pub range: f32,
    pub attack_interval: f32,
}

impl Default for CombatStats {
    fn default() -> Self {
        Self { damage: 12.0, range: 1.6, attack_interval: 1.0 }
    }
}

#[derive(Component, Clone, Copy, Debug)]
pub struct AttackOrder {
    pub target_id: u32,
    pub cooldown: f32,
}

/// A path-following order. The first cell is the unit's current cell.
#[derive(Component, Clone, Debug, Default)]
pub struct MoveOrder {
    pub path: Vec<[i32; 2]>,
    pub next_step: usize,
}
