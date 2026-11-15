use bevy_ecs::prelude::{Entity, World};
use serde::Serialize;

use crate::components::{Health, MoveOrder, Position, Sprite, StableId};
use crate::navigation::GridMap;

#[derive(Serialize)]
pub struct EntitySnapshot {
    pub id: u32,
    pub position: Position,
    pub sprite: Sprite,
    pub health: Health,
    pub moving: bool,
}

pub struct GameWorld {
    world: World,
    elapsed: f64,
    next_id: u32,
}

impl Default for GameWorld {
    fn default() -> Self { Self::new() }
}

impl GameWorld {
    pub fn new() -> Self {
        let mut game = Self { world: World::new(), elapsed: 0.0, next_id: 1 };
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
        let id = self.next_id;
        self.next_id += 1;
        let mut entity = self.world.spawn((StableId(id), position, sprite, health));
        if id != 1 {
            entity.insert(MoveOrder::default());
        }
        entity.id()
    }

    /// Issue a path-following move order to an entity with a stable game ID.
    pub fn move_unit(&mut self, id: u32, goal: (i32, i32), map: &GridMap) -> bool {
        let entity = {
            let mut query = self.world.query::<(Entity, &StableId)>();
            query.iter(&self.world)
                .find(|(_, stable)| stable.0 == id)
                .map(|(entity, _)| entity)
        };
        let Some(entity) = entity else { return false; };

        let start = {
            let Ok(position) = self.world.get::<Position>(entity) else { return false; };
            (position.x.floor() as i32, position.z.floor() as i32)
        };
        let path = map.find_path(start, goal);
        if path.is_empty() { return false; }

        let Ok(mut order) = self.world.get_mut::<MoveOrder>(entity) else { return false; };
        order.path = path;
        order.next_step = if order.path.len() > 1 { 1 } else { 0 };
        true
    }

    pub fn update(&mut self, delta_seconds: f32) {
        let dt = delta_seconds.clamp(0.0, 0.1);
        self.elapsed += dt as f64;

        let mut query = self.world.query::<(&mut Position, &mut MoveOrder)>();
        for (mut position, mut order) in query.iter_mut(&mut self.world) {
            if order.path.is_empty() || order.next_step >= order.path.len() { continue; }

            let [cell_x, cell_z] = order.path[order.next_step];
            let target_x = cell_x as f32 + 0.5;
            let target_z = cell_z as f32 + 0.5;
            let dx = target_x - position.x;
            let dz = target_z - position.z;
            let distance = (dx * dx + dz * dz).sqrt();
            let step = 3.5 * dt;

            if distance <= step.max(0.0001) {
                position.x = target_x;
                position.z = target_z;
                order.next_step += 1;
                if order.next_step >= order.path.len() {
                    order.path.clear();
                    order.next_step = 0;
                }
            } else if distance > 0.0 {
                position.x += dx / distance * step;
                position.z += dz / distance * step;
            }
        }
    }

    pub fn elapsed(&self) -> f64 { self.elapsed }

    pub fn snapshot(&mut self) -> Vec<EntitySnapshot> {
        let mut query = self.world.query::<(&StableId, &Position, &Sprite, &Health, Option<&MoveOrder>)>();
        query.iter(&self.world)
            .map(|(id, position, sprite, health, order)| EntitySnapshot {
                id: id.0,
                position: *position,
                sprite: sprite.clone(),
                health: *health,
                moving: order.map(|o| !o.path.is_empty()).unwrap_or(false),
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unit_moves_along_valid_path_and_stops() {
        let mut game = GameWorld::new();
        let map = GridMap;
        assert!(game.move_unit(2, (6, 2), &map));
        for _ in 0..100 { game.update(0.1); }
        let unit = game.snapshot().into_iter().find(|e| e.id == 2).unwrap();
        assert!((unit.position.x - 6.5).abs() < 0.01);
        assert!((unit.position.z - 2.5).abs() < 0.01);
        assert!(!unit.moving);
    }

    #[test]
    fn blocked_move_order_is_rejected() {
        let mut game = GameWorld::new();
        assert!(!game.move_unit(2, (-14, 10), &GridMap));
    }
}
