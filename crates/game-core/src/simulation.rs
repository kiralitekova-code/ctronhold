use bevy_ecs::prelude::{Entity, World};
use serde::Serialize;

use crate::components::{
    AttackOrder, CombatStats, Health, MoveOrder, Position, Sprite, StableId, Team,
};
use crate::navigation::GridMap;

#[derive(Serialize)]
pub struct EntitySnapshot {
    pub id: u32,
    pub position: Position,
    pub sprite: Sprite,
    pub health: Health,
    pub team: u8,
    pub moving: bool,
    pub attacking: bool,
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

        for (x, z) in [(3.0, 2.0), (4.0, 2.0), (3.0, 3.0), (4.0, 3.0), (5.0, 2.0)] {
            let entity = game.spawn(
                Position { x, y: 0.0, z },
                Sprite { kind: "unit".into(), color: [0.25, 0.45, 0.85] },
                Health::new(100.0),
            );
            game.world.entity_mut(entity).insert((
                Team(1), CombatStats::default(), MoveOrder::default(),
            ));
        }

        // A small hostile patrol in open ground west of the starting squad.
        for (x, z) in [(-5.0, 2.0), (-6.0, 2.0), (-5.0, 3.0)] {
            let entity = game.spawn(
                Position { x, y: 0.0, z },
                Sprite { kind: "unit".into(), color: [0.82, 0.25, 0.18] },
                Health::new(100.0),
            );
            game.world.entity_mut(entity).insert((
                Team(2), CombatStats::default(), MoveOrder::default(),
            ));
        }
        game
    }

    pub fn spawn(&mut self, position: Position, sprite: Sprite, health: Health) -> Entity {
        let id = self.next_id;
        self.next_id += 1;
        self.world.spawn((StableId(id), position, sprite, health)).id()
    }

    fn entity_by_id(&mut self, id: u32) -> Option<Entity> {
        let mut query = self.world.query::<(Entity, &StableId)>();
        query.iter(&self.world).find(|(_, stable)| stable.0 == id).map(|(entity, _)| entity)
    }

    pub fn move_unit(&mut self, id: u32, goal: (i32, i32), map: &GridMap) -> bool {
        let Some(entity) = self.entity_by_id(id) else { return false; };
        if self.world.get::<Sprite>(entity).map(|s| s.kind.as_str()) != Some("unit") {
            return false;
        }
        let start = {
            let Some(position) = self.world.get::<Position>(entity) else { return false; };
            (position.x.floor() as i32, position.z.floor() as i32)
        };
        let path = map.find_path(start, goal);
        if path.is_empty() { return false; }
        let Some(mut order) = self.world.get_mut::<MoveOrder>(entity) else { return false; };
        order.path = path;
        order.next_step = if order.path.len() > 1 { 1 } else { 0 };
        drop(order);
        if let Some(mut attack) = self.world.get_mut::<AttackOrder>(entity) {
            *attack = AttackOrder { target_id: 0, cooldown: 0.0 };
        }
        true
    }

    /// Orders a unit to close to melee range, then attack an enemy unit.
    pub fn issue_attack(&mut self, attacker_id: u32, target_id: u32, map: &GridMap) -> bool {
        if attacker_id == target_id { return false; }
        let (Some(attacker), Some(target)) =
            (self.entity_by_id(attacker_id), self.entity_by_id(target_id)) else { return false; };

        let valid = {
            let (Some(attacker_team), Some(target_team), Some(attacker_sprite), Some(target_sprite)) = (
                self.world.get::<Team>(attacker),
                self.world.get::<Team>(target),
                self.world.get::<Sprite>(attacker),
                self.world.get::<Sprite>(target),
            ) else { return false; };
            attacker_sprite.kind == "unit"
                && target_sprite.kind == "unit"
                && attacker_team.0 != target_team.0
                && self.world.get::<Health>(target).map(|h| h.current > 0.0).unwrap_or(false)
        };
        if !valid { return false; }

        let (ax, az, tx, tz, range) = {
            let Some(a) = self.world.get::<Position>(attacker) else { return false; };
            let Some(t) = self.world.get::<Position>(target) else { return false; };
            let range = self.world.get::<CombatStats>(attacker).map(|s| s.range).unwrap_or(1.6);
            (a.x, a.z, t.x, t.z, range)
        };

        let distance_sq = (ax - tx).powi(2) + (az - tz).powi(2);
        if distance_sq > range * range {
            let start = (ax.floor() as i32, az.floor() as i32);
            let target_cell = (tx.floor() as i32, tz.floor() as i32);
            // Reserve distinct approach cells when several soldiers focus the same target.
            let reserved_goals: Vec<[i32; 2]> = {
                let mut query = self.world.query::<(&AttackOrder, &MoveOrder)>();
                query.iter(&self.world)
                    .filter(|(order, _)| order.target_id == target_id)
                    .filter_map(|(_, movement)| movement.path.last().copied())
                    .collect()
            };
            let mut candidates: Vec<(usize, usize, Vec<[i32; 2]>)> = Vec::new();
            for (dx, dz) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
                let goal = (target_cell.0 + dx, target_cell.1 + dz);
                let path = map.find_path(start, goal);
                if !path.is_empty() {
                    let occupied = reserved_goals.iter()
                        .filter(|cell| **cell == [goal.0, goal.1]).count();
                    candidates.push((path.len() + occupied * 4, path.len(), path));
                }
            }
            candidates.sort_by_key(|(score, length, _)| (*score, *length));
            let Some((_, _, path)) = candidates.into_iter().next() else { return false; };
            if let Some(mut order) = self.world.get_mut::<MoveOrder>(attacker) {
                order.path = path;
                order.next_step = if order.path.len() > 1 { 1 } else { 0 };
            }
        } else if let Some(mut order) = self.world.get_mut::<MoveOrder>(attacker) {
            order.path.clear();
            order.next_step = 0;
        }

        self.world.entity_mut(attacker).insert(AttackOrder { target_id, cooldown: 0.0 });
        true
    }

    pub fn update(&mut self, delta_seconds: f32) {
        let dt = delta_seconds.clamp(0.0, 0.1);
        self.elapsed += dt as f64;

        let unit_positions: Vec<(u32, f32, f32)> = {
            let mut query = self.world.query::<(&StableId, &Position, &Sprite, &MoveOrder)>();
            query.iter(&self.world)
                .filter(|(_, _, sprite, order)| sprite.kind == "unit" && !order.path.is_empty())
                .map(|(id, p, _, _)| (id.0, p.x, p.z))
                .collect()
        };

        let mut query = self.world.query::<(&StableId, &mut Position, &mut MoveOrder)>();
        for (id, mut position, mut order) in query.iter_mut(&mut self.world) {
            if order.path.is_empty() || order.next_step >= order.path.len() { continue; }
            let [cell_x, cell_z] = order.path[order.next_step];
            let target_x = cell_x as f32 + 0.5;
            let target_z = cell_z as f32 + 0.5;
            let dx = target_x - position.x;
            let dz = target_z - position.z;
            let distance = (dx * dx + dz * dz).sqrt();
            let step = 3.5 * dt;
            let (next_x, next_z) = if distance <= step.max(0.0001) {
                (target_x, target_z)
            } else if distance > 0.0 {
                (position.x + dx / distance * step, position.z + dz / distance * step)
            } else { (position.x, position.z) };

            let collision = unit_positions.iter()
                .filter(|(other_id, _, _)| *other_id != id.0)
                .any(|(_, ox, oz)| (next_x - ox).powi(2) + (next_z - oz).powi(2) < 0.49);
            if collision { continue; }

            position.x = next_x;
            position.z = next_z;
            if distance <= step.max(0.0001) {
                order.next_step += 1;
                if order.next_step >= order.path.len() {
                    order.path.clear();
                    order.next_step = 0;
                }
            }
        }

        self.update_combat(dt);
    }

    fn update_combat(&mut self, dt: f32) {
        let actors: Vec<(Entity, u32, u32, f32, f32, u8, f32, f32, f32)> = {
            let mut query = self.world.query::<(
                Entity, &StableId, &Position, &Team, &CombatStats, &AttackOrder,
            )>();
            query.iter(&self.world).map(|(entity, id, p, team, stats, order)| (
                entity, id.0, order.target_id, p.x, p.z, team.0,
                stats.damage, stats.range, stats.attack_interval,
            )).collect()
        };

        let mut hits: Vec<(u32, f32)> = Vec::new();
        for (attacker, _id, target_id, ax, az, team, damage, range, attack_interval) in actors {
            let Some(target) = self.entity_by_id(target_id) else { continue; };
            let target_data = {
                let (Some(position), Some(target_team), Some(health)) = (
                    self.world.get::<Position>(target),
                    self.world.get::<Team>(target),
                    self.world.get::<Health>(target),
                ) else { continue; };
                (position.x, position.z, target_team.0, health.current)
            };
            if target_data.2 == team || target_data.3 <= 0.0 { continue; }
            let in_range = (ax - target_data.0).powi(2) + (az - target_data.1).powi(2) <= range * range;
            let Some(mut order) = self.world.get_mut::<AttackOrder>(attacker) else { continue; };
            order.cooldown = (order.cooldown - dt).max(0.0);
            if in_range && order.cooldown <= 0.0 {
                order.cooldown = attack_interval;
                hits.push((target_id, damage));
            }
        }

        for (target_id, damage) in hits {
            if let Some(target) = self.entity_by_id(target_id) {
                if let Some(mut health) = self.world.get_mut::<Health>(target) {
                    health.damage(damage);
                }
            }
        }

        let dead: Vec<Entity> = {
            let mut query = self.world.query::<(Entity, &Health)>();
            query.iter(&self.world).filter(|(_, health)| health.current <= 0.0)
                .map(|(entity, _)| entity).collect()
        };
        for entity in dead { self.world.despawn(entity); }
    }

    pub fn elapsed(&self) -> f64 { self.elapsed }

    pub fn snapshot(&mut self) -> Vec<EntitySnapshot> {
        let mut query = self.world.query::<(
            &StableId, &Position, &Sprite, &Health, Option<&Team>,
            Option<&MoveOrder>, Option<&AttackOrder>,
        )>();
        query.iter(&self.world).map(|(id, position, sprite, health, team, movement, attack)| {
            EntitySnapshot {
                id: id.0,
                position: *position,
                sprite: sprite.clone(),
                health: *health,
                team: team.map(|t| t.0).unwrap_or(0),
                moving: movement.map(|o| !o.path.is_empty()).unwrap_or(false),
                attacking: attack.map(|order| order.target_id != 0).unwrap_or(false),
            }
        }).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starting_squads_have_stable_ids_and_opposing_teams() {
        let mut game = GameWorld::new();
        let entities = game.snapshot();
        let friendly: Vec<_> = entities.iter().filter(|e| e.team == 1).map(|e| e.id).collect();
        let hostile: Vec<_> = entities.iter().filter(|e| e.team == 2).map(|e| e.id).collect();
        assert_eq!(friendly, vec![2, 3, 4, 5, 6]);
        assert_eq!(hostile, vec![7, 8, 9]);
    }

    #[test]
    fn friendly_fire_is_rejected() {
        let mut game = GameWorld::new();
        assert!(!game.issue_attack(2, 3, &GridMap));
    }

    #[test]
    fn attack_order_moves_into_range_and_deals_damage() {
        let mut game = GameWorld::new();
        assert!(game.issue_attack(2, 7, &GridMap));
        for _ in 0..100 { game.update(0.1); }
        let enemy = game.snapshot().into_iter().find(|e| e.id == 7).unwrap();
        assert!(enemy.health.current < 100.0);
    }

    #[test]
    fn lethal_damage_removes_unit_from_snapshot() {
        let mut game = GameWorld::new();
        assert!(game.issue_attack(2, 7, &GridMap));
        for _ in 0..1000 { game.update(0.1); }
        assert!(!game.snapshot().iter().any(|e| e.id == 7));
    }

    #[test]
    fn blocked_move_order_is_rejected() {
        let mut game = GameWorld::new();
        assert!(!game.move_unit(2, (-14, 10), &GridMap));
    }

    #[test]
    fn castle_cannot_receive_a_unit_move_order() {
        assert!(!GameWorld::new().move_unit(1, (2, 2), &GridMap));
    }
}
