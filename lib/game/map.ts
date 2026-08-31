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

type MoveOptions = {
  ignoreKinds?: readonly string[];
};

function isBlockedForMove(x: number, y: number, radius: number, options: MoveOptions) {
  if (x - radius < 0 || y - radius < 0 || x + radius > WORLD.width || y + radius > WORLD.height) return true;
  return SOLIDS.some((rect) => {
    if (rect.kind && options.ignoreKinds?.includes(rect.kind)) return false;
    return circleHitsRect(x, y, radius, rect);
  });
}

export function moveCircle(entity: Point, dx: number, dy: number, radius: number, options: MoveOptions = {}) {
  const nextX = entity.x + dx;
  const blockedX = dx !== 0 && isBlockedForMove(nextX, entity.y, radius, options);
  if (!blockedX) entity.x = nextX;
  const nextY = entity.y + dy;
  const blockedY = dy !== 0 && isBlockedForMove(entity.x, nextY, radius, options);
  if (!blockedY) entity.y = nextY;
  return {
    moved: (dx !== 0 && !blockedX) || (dy !== 0 && !blockedY),
    blocked: blockedX || blockedY,
  };
}

export function pointInRect(point: Point, rect: Rect, inset = 0) {
  return point.x >= rect.x + inset && point.x <= rect.x + rect.w - inset
    && point.y >= rect.y + inset && point.y <= rect.y + rect.h - inset;
}

// 좁은 문에서도 엄마의 원형 충돌 범위를 정확히 반영하도록 세밀한 격자를 쓴다.
const CELL = 25;
const COLS = Math.ceil(WORLD.width / CELL);
const ROWS = Math.ceil(WORLD.height / CELL);

function center(x: number, y: number): Point { return { x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 }; }

const GRID_SIZE = COLS * ROWS;
const blockedGridCache = new Map<number, Uint8Array>();

function cellIndex(x: number, y: number) { return y * COLS + x; }

function blockedGrid(radius: number) {
  const cacheKey = Math.round(radius * 10) / 10;
  const cached = blockedGridCache.get(cacheKey);
  if (cached) return cached;
  const grid = new Uint8Array(GRID_SIZE);
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const point = center(x, y);
      grid[cellIndex(x, y)] = isBlocked(point.x, point.y, radius) ? 1 : 0;
    }
  }
  blockedGridCache.set(cacheKey, grid);
  return grid;
}

function nearestOpen(cellX: number, cellY: number, grid: Uint8Array) {
  if (!grid[cellIndex(cellX, cellY)]) return { x: cellX, y: cellY };
  for (let ring = 1; ring <= 8; ring += 1) {
    for (let oy = -ring; oy <= ring; oy += 1) {
      for (let ox = -ring; ox <= ring; ox += 1) {
        if (Math.abs(ox) !== ring && Math.abs(oy) !== ring) continue;
        const x = clamp(cellX + ox, 0, COLS - 1);
        const y = clamp(cellY + oy, 0, ROWS - 1);
        if (!grid[cellIndex(x, y)]) return { x, y };
      }
    }
  }
  return { x: cellX, y: cellY };
}

type OpenCell = { index: number; x: number; y: number; g: number; f: number };

function heapPush(heap: OpenCell[], cell: OpenCell) {
  heap.push(cell);
  let index = heap.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (heap[parent].f <= cell.f) break;
    heap[index] = heap[parent];
    index = parent;
  }
  heap[index] = cell;
}

function heapPop(heap: OpenCell[]) {
  const first = heap[0];
  const last = heap.pop();
  if (!last || heap.length === 0) return first;
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    const right = left + 1;
    if (left >= heap.length) break;
    const child = right < heap.length && heap[right].f < heap[left].f ? right : left;
    if (heap[child].f >= last.f) break;
    heap[index] = heap[child];
    index = child;
  }
  heap[index] = last;
  return first;
}

export function findPath(from: Point, to: Point, radius = 24): Point[] {
  const grid = blockedGrid(radius);
  const rawStart = { x: clamp(Math.floor(from.x / CELL), 0, COLS - 1), y: clamp(Math.floor(from.y / CELL), 0, ROWS - 1) };
  const rawGoal = { x: clamp(Math.floor(to.x / CELL), 0, COLS - 1), y: clamp(Math.floor(to.y / CELL), 0, ROWS - 1) };
  const start = nearestOpen(rawStart.x, rawStart.y, grid);
  const goal = nearestOpen(rawGoal.x, rawGoal.y, grid);
  const startIndex = cellIndex(start.x, start.y);
  const goalIndex = cellIndex(goal.x, goal.y);
  const open: OpenCell[] = [];
  heapPush(open, { ...start, index: startIndex, g: 0, f: Math.abs(goal.x - start.x) + Math.abs(goal.y - start.y) });
  const came = new Int32Array(GRID_SIZE); came.fill(-1);
  const costs = new Float32Array(GRID_SIZE); costs.fill(Infinity); costs[startIndex] = 0;
  const closed = new Uint8Array(GRID_SIZE);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (open.length) {
    const current = heapPop(open)!;
    if (current.index === goalIndex) {
      const result: Point[] = [];
      let cursor = goalIndex;
      while (cursor >= 0) {
        result.push(center(cursor % COLS, Math.floor(cursor / COLS)));
        if (cursor === startIndex) break;
        cursor = came[cursor];
      }
      result.reverse();
      result.shift();
      result.push({ ...to });
      return result;
    }
    if (closed[current.index]) continue;
    closed[current.index] = 1;

    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const nextIndex = cellIndex(nx, ny);
      if (closed[nextIndex] || grid[nextIndex]) continue;
      const newCost = current.g + 1;
      if (newCost < costs[nextIndex]) {
        costs[nextIndex] = newCost;
        came[nextIndex] = current.index;
        const heuristic = Math.abs(goal.x - nx) + Math.abs(goal.y - ny);
        heapPush(open, { index: nextIndex, x: nx, y: ny, g: newCost, f: newCost + heuristic });
      }
    }
  }
  return [];
}

export function pointInView(point: Point, camera: Point, width: number, height: number, margin = 100) {
  return point.x >= camera.x - margin && point.x <= camera.x + width + margin && point.y >= camera.y - margin && point.y <= camera.y + height + margin;
}
