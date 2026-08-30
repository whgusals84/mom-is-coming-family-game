import {
  INTERACTION_TEMPLATES,
  LANDMARKS,
  NPC_SPOTS,
  PASSAGES,
  ROOM_ANCHORS,
  SOLIDS,
  WORLD,
} from '../lib/game/data.ts';

const STEP = 5;
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const key = (x, y) => `${x},${y}`;

function circleHitsRect(x, y, radius, rect) {
  const px = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const py = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  return (x - px) ** 2 + (y - py) ** 2 < radius ** 2;
}

function isBlocked(x, y, radius) {
  if (x - radius < 0 || y - radius < 0 || x + radius > WORLD.width || y + radius > WORLD.height) return true;
  return SOLIDS.some((rect) => circleHitsRect(x, y, radius, rect));
}

function flood(radius) {
  const startX = Math.round(LANDMARKS.playerSpawn.x / STEP);
  const startY = Math.round(LANDMARKS.playerSpawn.y / STEP);
  const queue = [[startX, startY]];
  const seen = new Set([key(startX, startY)]);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const [x, y] = queue[cursor];
    for (const [dx, dy] of DIRECTIONS) {
      const nextX = x + dx;
      const nextY = y + dy;
      const nextKey = key(nextX, nextY);
      if (nextX < 0 || nextY < 0 || nextX * STEP > WORLD.width || nextY * STEP > WORLD.height) continue;
      if (seen.has(nextKey) || isBlocked(nextX * STEP, nextY * STEP, radius)) continue;
      seen.add(nextKey);
      queue.push([nextX, nextY]);
    }
  }
  return seen;
}

function reachable(seen, point) {
  return seen.has(key(Math.round(point.x / STEP), Math.round(point.y / STEP)));
}

function canApproach(seen, point, range) {
  const minX = Math.floor((point.x - range) / STEP);
  const maxX = Math.ceil((point.x + range) / STEP);
  const minY = Math.floor((point.y - range) / STEP);
  const maxY = Math.ceil((point.y + range) / STEP);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (seen.has(key(x, y)) && Math.hypot(x * STEP - point.x, y * STEP - point.y) < range) return true;
    }
  }
  return false;
}

const failures = [];
for (const radius of [19, 26]) {
  const seen = flood(radius);
  const targets = [
    { kind: '랜드마크', label: 'TV 앞', point: LANDMARKS.tv },
    ...ROOM_ANCHORS.map((point) => ({ kind: '방', label: point.label, point })),
    ...NPC_SPOTS.map((point, index) => ({ kind: 'NPC', label: String(index + 1), point })),
    ...PASSAGES.map((passage) => ({
      kind: '문턱',
      label: passage.label,
      point: { x: passage.x + passage.w / 2, y: passage.y + passage.h / 2 },
    })),
  ];

  for (const target of targets) {
    if (isBlocked(target.point.x, target.point.y, radius) || !reachable(seen, target.point)) {
      failures.push(`${radius}px ${target.kind} '${target.label}'에 접근할 수 없음`);
    }
  }

  if (radius === 19) {
    for (const interaction of INTERACTION_TEMPLATES) {
      if (!canApproach(seen, interaction, 78)) failures.push(`상호작용 '${interaction.label}'에 접근할 수 없음`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('지도 검사 통과: 모든 방, 문턱, NPC 위치와 장난 지점이 연결되어 있습니다.');
