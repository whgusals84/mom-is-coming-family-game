import { SOLIDS, WORLD } from './data';
import type { Point, Rect } from './types';

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function circleHitsRect(x: number, y: number, radius: number, rect: Rect) {
  const px = clamp(x, rect.x, rect.x + rect.w);
  const py = clamp(y, rect.y, rect.y + rect.h);
  return (x - px) ** 2 + (y - py) ** 2 < radius ** 2;
}

export function isBlocked(x: number, y: number, radius: number) {
  if (x - radius < 0 || y - radius < 0 || x + radius > WORLD.width || y + radius > WORLD.height) return true;
  return SOLIDS.some((rect) => circleHitsRect(x, y, radius, rect));
}

export function moveCircle(entity: Point, dx: number, dy: number, radius: number) {
  const nextX = entity.x + dx;
  if (!isBlocked(nextX, entity.y, radius)) entity.x = nextX;
  const nextY = entity.y + dy;
  if (!isBlocked(entity.x, nextY, radius)) entity.y = nextY;
}

const CELL = 50;
const COLS = Math.ceil(WORLD.width / CELL);
const ROWS = Math.ceil(WORLD.height / CELL);

function key(x: number, y: number) { return `${x},${y}`; }
function center(x: number, y: number): Point { return { x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 }; }

function nearestOpen(cellX: number, cellY: number, radius: number) {
  if (!isBlocked(center(cellX, cellY).x, center(cellX, cellY).y, radius)) return { x: cellX, y: cellY };
  for (let ring = 1; ring <= 4; ring += 1) {
    for (let oy = -ring; oy <= ring; oy += 1) {
      for (let ox = -ring; ox <= ring; ox += 1) {
        const x = clamp(cellX + ox, 0, COLS - 1);
        const y = clamp(cellY + oy, 0, ROWS - 1);
        const p = center(x, y);
        if (!isBlocked(p.x, p.y, radius)) return { x, y };
      }
    }
  }
  return { x: cellX, y: cellY };
}

export function findPath(from: Point, to: Point, radius = 24): Point[] {
  const rawStart = { x: clamp(Math.floor(from.x / CELL), 0, COLS - 1), y: clamp(Math.floor(from.y / CELL), 0, ROWS - 1) };
  const rawGoal = { x: clamp(Math.floor(to.x / CELL), 0, COLS - 1), y: clamp(Math.floor(to.y / CELL), 0, ROWS - 1) };
  const start = nearestOpen(rawStart.x, rawStart.y, radius);
  const goal = nearestOpen(rawGoal.x, rawGoal.y, radius);
  const open = [{ ...start, g: 0, f: Math.abs(goal.x - start.x) + Math.abs(goal.y - start.y) }];
  const came = new Map<string, string>();
  const costs = new Map<string, number>([[key(start.x, start.y), 0]]);
  const closed = new Set<string>();
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    const currentKey = key(current.x, current.y);
    if (current.x === goal.x && current.y === goal.y) {
      const result: Point[] = [center(goal.x, goal.y)];
      let cursor = currentKey;
      while (came.has(cursor)) {
        cursor = came.get(cursor)!;
        const [x, y] = cursor.split(',').map(Number);
        result.push(center(x, y));
      }
      result.reverse();
      result.shift();
      result.push({ ...to });
      return result;
    }
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);

    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const nextKey = key(nx, ny);
      const p = center(nx, ny);
      if (closed.has(nextKey) || isBlocked(p.x, p.y, radius)) continue;
      const newCost = current.g + 1;
      if (newCost < (costs.get(nextKey) ?? Infinity)) {
        costs.set(nextKey, newCost);
        came.set(nextKey, currentKey);
        const heuristic = Math.abs(goal.x - nx) + Math.abs(goal.y - ny);
        open.push({ x: nx, y: ny, g: newCost, f: newCost + heuristic });
      }
    }
  }
  return [{ ...to }];
}

export function pointInView(point: Point, camera: Point, width: number, height: number, margin = 100) {
  return point.x >= camera.x - margin && point.x <= camera.x + width + margin && point.y >= camera.y - margin && point.y <= camera.y + height + margin;
}
