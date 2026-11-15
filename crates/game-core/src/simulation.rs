use bevy_ecs::prelude::{Entity, World};
use serde::Serialize;

use crate::components::{Health, Position, Sprite};

#[derive(Serialize)]
pub struct EntitySnapshot {
    pub id: u32,
    pub position: Position,
    pub sprite: Sprite,
    pub health: Health,
}

pub struct GameWorld {
    world: World,
    elapsed: f64,
    next_id: u32,
}

impl Default for GameWorld {
    fn default() -> Self {
        Self::new()
    }
}

impl GameWorld {
    pub fn new() -> Self {
        let mut game = Self {
            world: World::new(),
            elapsed: 0.0,
            next_id: 1,
        };

        // A tiny deterministic test scene: keep these as primitive placeholders.
        game.spawn(
            Position { x: 0.0, y: 0.0, z: 0.0 },
            Sprite { kind: "castle".into(), color: [0.72, 0.68, 0.55] },
            Health::new(1000.0),
        );
        game.spawn(
            Position { x: 3.0, y: 0.0, z: 2.0 },
            Sprite { kind: "unit".into(), color: [0.25, 0.45, 0.85] },
            Health::new(100.0),
        );
        game
    }

    pub fn spawn(&mut self, position: Position, sprite: Sprite, health: Health) -> Entity {
        self.next_id += 1;
        self.world.spawn((position, sprite, health)).id()
    }

    pub fn update(&mut self, delta_seconds: f32) {
        // Simulation uses a bounded delta; fixed-tick scheduling will replace
        // this simple accumulator when movement/combat systems are introduced.
        self.elapsed += delta_seconds.clamp(0.0, 0.1) as f64;
    }

    pub fn elapsed(&self) -> f64 {
        self.elapsed
    }

    pub fn snapshot(&mut self) -> Vec<EntitySnapshot> {
        let mut query = self.world.query::<(&Position, &Sprite, &Health)>();
        query.iter(&self.world)
            .enumerate()
            .map(|(index, (position, sprite, health))| EntitySnapshot {
                id: index as u32,
                position: *position,
                sprite: sprite.clone(),
                health: *health,
            })
            .collect()
    }
}
