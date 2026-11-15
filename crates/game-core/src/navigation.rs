use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap};

/// Deterministic 64x64 world grid. Coordinates are centred around world origin.
pub const MAP_MIN: i32 = -32;
pub const MAP_MAX: i32 = 31;

#[derive(Clone, Copy, Debug, Default)]
pub struct GridMap;

impl GridMap {
    pub fn in_bounds(&self, x: i32, z: i32) -> bool {
        (MAP_MIN..=MAP_MAX).contains(&x) && (MAP_MIN..=MAP_MAX).contains(&z)
    }

    pub fn is_walkable(&self, x: i32, z: i32) -> bool {
        if !self.in_bounds(x, z) {
            return false;
        }

        // A stone ridge with a deliberate gate. The opening makes the map
        // navigable while creating a meaningful choke point for later combat.
        let ridge = x == -14 && (-23..=23).contains(&z) && !(z >= -3 && z <= 3);

        // A compact rock field in the north-east quadrant.
        let rock_field = (20..=24).contains(&x) && (10..=14).contains(&z);

        !ridge && !rock_field
    }

    pub fn blocked_cells(&self) -> Vec<[i32; 2]> {
        let mut cells = Vec::new();
        for x in MAP_MIN..=MAP_MAX {
            for z in MAP_MIN..=MAP_MAX {
                if !self.is_walkable(x, z) {
                    cells.push([x, z]);
                }
            }
        }
        cells
    }

    /// Four-direction A* with Manhattan distance and deterministic tie-breaking.
    pub fn find_path(&self, start: (i32, i32), goal: (i32, i32)) -> Vec<[i32; 2]> {
        if !self.is_walkable(start.0, start.1) || !self.is_walkable(goal.0, goal.1) {
            return Vec::new();
        }
        if start == goal {
            return vec![[start.0, start.1]];
        }

        let mut open = BinaryHeap::new();
        let mut came_from: HashMap<(i32, i32), (i32, i32)> = HashMap::new();
        let mut cost: HashMap<(i32, i32), u32> = HashMap::new();
        cost.insert(start, 0);
        open.push((Reverse(Self::heuristic(start, goal)), start.0, start.1));

        const DIRECTIONS: [(i32, i32); 4] = [(1, 0), (-1, 0), (0, 1), (0, -1)];

        while let Some((_, x, z)) = open.pop() {
            let current = (x, z);
            if current == goal {
                let mut path = vec![[goal.0, goal.1]];
                let mut cursor = goal;
                while let Some(previous) = came_from.get(&cursor).copied() {
                    path.push([previous.0, previous.1]);
                    cursor = previous;
                }
                path.reverse();
                return path;
            }

            let current_cost = *cost.get(&current).unwrap_or(&u32::MAX);
            for (dx, dz) in DIRECTIONS {
                let next = (x + dx, z + dz);
                if !self.is_walkable(next.0, next.1) {
                    continue;
                }
                let next_cost = current_cost + 1;
                if next_cost < *cost.get(&next).unwrap_or(&u32::MAX) {
                    cost.insert(next, next_cost);
                    came_from.insert(next, current);
                    let priority = next_cost + Self::heuristic(next, goal);
                    open.push((Reverse(priority), next.0, next.1));
                }
            }
        }

        Vec::new()
    }

    fn heuristic(a: (i32, i32), b: (i32, i32)) -> u32 {
        (a.0 - b.0).unsigned_abs() + (a.1 - b.1).unsigned_abs()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_route_around_ridge_through_gate() {
        let map = GridMap;
        let path = map.find_path((-20, 0), (0, 0));
        assert!(!path.is_empty());
        assert_eq!(path.first(), Some(&[-20, 0]));
        assert_eq!(path.last(), Some(&[0, 0]));
        assert!(path.iter().all(|p| map.is_walkable(p[0], p[1])));
    }

    #[test]
    fn rejects_blocked_destination() {
        let map = GridMap;
        assert!(map.find_path((0, 0), (-14, 10)).is_empty());
    }

    #[test]
    fn start_equals_goal_returns_single_cell() {
        assert_eq!(GridMap.find_path((0, 0), (0, 0)), vec![[0, 0]]);
    }
}
