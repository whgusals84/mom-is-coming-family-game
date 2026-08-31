import {
  INTERACTION_TEMPLATES,
  FURNITURE,
  LANDMARKS,
  NPC_SPOTS,
  PASSAGES,
  ROOM_ANCHORS,
  SOLIDS,
  WORLD,
} from '../lib/game/data.ts';

const STEP = 5;
const AI_CELL = 25;
const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const MOM_PATH_RADIUS = 26;
const COMFORT_RADIUS = 30;
const MIN_COMFORTABLE_PASSAGE = 120;
const WORLD_BOUNDS = {
  minX: 0,
  maxX: WORLD.width,
  minY: 0,
  maxY: WORLD.height,
};
const key = (x, y) => `${x},${y}`;

function circleHitsRect(x, y, radius, rect) {
  const px = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const py = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  return (x - px) ** 2 + (y - py) ** 2 < radius ** 2;
}

function isBlocked(x, y, radius) {
  if (
    x - radius < 0 ||
    y - radius < 0 ||
    x + radius > WORLD.width ||
    y + radius > WORLD.height
  )
    return true;
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
      if (
        nextX < 0 ||
        nextY < 0 ||
        nextX * STEP > WORLD.width ||
        nextY * STEP > WORLD.height
      )
        continue;
      if (seen.has(nextKey) || isBlocked(nextX * STEP, nextY * STEP, radius))
        continue;
      seen.add(nextKey);
      queue.push([nextX, nextY]);
    }
  }
  return seen;
}

function hasPathWithin(radius, start, end, bounds) {
  const startX = Math.round(start.x / STEP);
  const startY = Math.round(start.y / STEP);
  const endKey = key(Math.round(end.x / STEP), Math.round(end.y / STEP));
  if (isBlocked(start.x, start.y, radius) || isBlocked(end.x, end.y, radius))
    return false;

  const queue = [[startX, startY]];
  const seen = new Set([key(startX, startY)]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const [x, y] = queue[cursor];
    if (key(x, y) === endKey) return true;
    for (const [dx, dy] of DIRECTIONS) {
      const nextX = x + dx;
      const nextY = y + dy;
      const px = nextX * STEP;
      const py = nextY * STEP;
      const nextKey = key(nextX, nextY);
      if (
        px < bounds.minX ||
        px > bounds.maxX ||
        py < bounds.minY ||
        py > bounds.maxY
      )
        continue;
      if (seen.has(nextKey) || isBlocked(px, py, radius)) continue;
      seen.add(nextKey);
      queue.push([nextX, nextY]);
    }
  }
  return false;
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
      if (
        seen.has(key(x, y)) &&
        Math.hypot(x * STEP - point.x, y * STEP - point.y) < range
      )
        return true;
    }
  }
  return false;
}

function passageCenter(passage) {
  return { x: passage.x + passage.w / 2, y: passage.y + passage.h / 2 };
}

function passageApproaches(passage, radius) {
  const center = passageCenter(passage);
  const offset = radius + 24;
  if (passage.h > passage.w) {
    return [
      { x: center.x - offset, y: center.y },
      { x: center.x + offset, y: center.y },
    ];
  }
  return [
    { x: center.x, y: center.y - offset },
    { x: center.x, y: center.y + offset },
  ];
}

function aiCellCenter(x, y) {
  return { x: x * AI_CELL + AI_CELL / 2, y: y * AI_CELL + AI_CELL / 2 };
}

function pointWithin(point, bounds) {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}

function nearestAiOpen(cellX, cellY, radius, bounds) {
  const cols = Math.ceil(WORLD.width / AI_CELL);
  const rows = Math.ceil(WORLD.height / AI_CELL);
  const first = aiCellCenter(cellX, cellY);
  if (pointWithin(first, bounds) && !isBlocked(first.x, first.y, radius))
    return { x: cellX, y: cellY };
  for (let ring = 1; ring <= 8; ring += 1) {
    for (let oy = -ring; oy <= ring; oy += 1) {
      for (let ox = -ring; ox <= ring; ox += 1) {
        const x = Math.max(0, Math.min(cols - 1, cellX + ox));
        const y = Math.max(0, Math.min(rows - 1, cellY + oy));
        const point = aiCellCenter(x, y);
        if (pointWithin(point, bounds) && !isBlocked(point.x, point.y, radius))
          return { x, y };
      }
    }
  }
  return null;
}

// 게임의 25px 엄마 AI 격자와 같은 조건으로 실제 이동 경로를 확인한다.
function hasAiGridPath(from, to, radius, bounds = WORLD_BOUNDS) {
  const cols = Math.ceil(WORLD.width / AI_CELL);
  const rows = Math.ceil(WORLD.height / AI_CELL);
  const rawStart = {
    x: Math.max(0, Math.min(cols - 1, Math.floor(from.x / AI_CELL))),
    y: Math.max(0, Math.min(rows - 1, Math.floor(from.y / AI_CELL))),
  };
  const rawGoal = {
    x: Math.max(0, Math.min(cols - 1, Math.floor(to.x / AI_CELL))),
    y: Math.max(0, Math.min(rows - 1, Math.floor(to.y / AI_CELL))),
  };
  const start = nearestAiOpen(rawStart.x, rawStart.y, radius, bounds);
  const goal = nearestAiOpen(rawGoal.x, rawGoal.y, radius, bounds);
  if (!start || !goal) return false;
  const goalKey = key(goal.x, goal.y);
  const queue = [[start.x, start.y]];
  const seen = new Set([key(start.x, start.y)]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const [x, y] = queue[cursor];
    if (key(x, y) === goalKey) return true;
    for (const [dx, dy] of DIRECTIONS) {
      const nextX = x + dx;
      const nextY = y + dy;
      const nextKey = key(nextX, nextY);
      if (
        nextX < 0 ||
        nextY < 0 ||
        nextX >= cols ||
        nextY >= rows ||
        seen.has(nextKey)
      )
        continue;
      const point = aiCellCenter(nextX, nextY);
      if (!pointWithin(point, bounds) || isBlocked(point.x, point.y, radius))
        continue;
      seen.add(nextKey);
      queue.push([nextX, nextY]);
    }
  }
  return false;
}

const escapeRoutes = [
  {
    room: '형 방',
    anchor: ROOM_ANCHORS.find((point) => point.label === '형 방'),
    exits: ['형 방 문', '형 방 · 오른쪽 발코니'],
    bounds: { minX: 875, maxX: 1405, minY: 24, maxY: 350 },
  },
  {
    room: '아빠 방',
    anchor: ROOM_ANCHORS.find((point) => point.label === '아빠 방'),
    exits: ['복도 · 아빠 방', '아빠 방 · 왼쪽 발코니'],
    bounds: { minX: 190, maxX: 720, minY: 676, maxY: 976 },
  },
  {
    room: '내 방',
    anchor: ROOM_ANCHORS.find((point) => point.label === '내 방'),
    exits: ['내 방 문', '내 방 · 오른쪽 발코니'],
    bounds: { minX: 875, maxX: 1405, minY: 626, maxY: 976 },
  },
  {
    room: '왼쪽 욕실',
    anchor: ROOM_ANCHORS.find((point) => point.label === '왼쪽 욕실'),
    exits: ['욕실 문', '욕실 · 아빠 방'],
    bounds: { minX: 190, maxX: 580, minY: 556, maxY: 700 },
  },
  {
    room: '중앙 욕실',
    anchor: ROOM_ANCHORS.find((point) => point.label === '중앙 욕실'),
    exits: ['중앙 욕실 문'],
    bounds: { minX: 716, maxX: 880, minY: 696, maxY: 916 },
  },
];

const failures = [];
const finalPiano = FURNITURE.find((item) => item.label === '피아노');
const livingDining = FURNITURE.find(
  (item) => item.label === '식탁' && item.x < 600,
);
if (!finalPiano || finalPiano.x !== 206 || finalPiano.y !== 72 || finalPiano.w !== 48 || finalPiano.h !== 124)
  failures.push('최종 거실 피아노 배치가 저장된 배치도와 다름');
if (!livingDining || livingDining.x !== 279 || livingDining.y !== 211 || livingDining.w !== 265 || livingDining.h !== 50)
  failures.push('최종 거실 식탁 배치가 저장된 배치도와 다름');
for (const passage of PASSAGES) {
  const span = Math.max(passage.w, passage.h);
  const minimum = passage.label === '욕실 문' ? 96 : MIN_COMFORTABLE_PASSAGE;
  if (span < minimum) {
    failures.push(
      `문턱 '${passage.label}' 폭이 ${span}px라 편안한 기준 ${minimum}px보다 좁음`,
    );
  }
  for (const approach of passageApproaches(passage, MOM_PATH_RADIUS)) {
    if (isBlocked(approach.x, approach.y, MOM_PATH_RADIUS)) {
      failures.push(`문턱 '${passage.label}' 앞뒤 대기 공간이 막힘`);
      break;
    }
  }
}

const actualMomPathTargets = [
  ...ROOM_ANCHORS.map((point) => ({ label: point.label, point })),
  ...PASSAGES.map((passage) => ({
    label: passage.label,
    point: passageCenter(passage),
  })),
];
for (const target of actualMomPathTargets) {
  if (!hasAiGridPath(LANDMARKS.momSpawn, target.point, MOM_PATH_RADIUS)) {
    failures.push(`실제 엄마 AI 격자로 '${target.label}'에 갈 수 없음`);
  }
}

for (const radius of [19, MOM_PATH_RADIUS, COMFORT_RADIUS]) {
  const seen = flood(radius);
  const targets = [
    { kind: '랜드마크', label: 'TV 앞', point: LANDMARKS.tv },
    ...ROOM_ANCHORS.map((point) => ({ kind: '방', label: point.label, point })),
    ...NPC_SPOTS.map((point, index) => ({
      kind: 'NPC',
      label: String(index + 1),
      point,
    })),
    ...PASSAGES.map((passage) => ({
      kind: '문턱',
      label: passage.label,
      point: { x: passage.x + passage.w / 2, y: passage.y + passage.h / 2 },
    })),
  ];

  for (const target of targets) {
    if (
      isBlocked(target.point.x, target.point.y, radius) ||
      !reachable(seen, target.point)
    ) {
      failures.push(
        `${radius}px ${target.kind} '${target.label}'에 접근할 수 없음`,
      );
    }
  }

  const dadRoomRouteOpen = hasPathWithin(
    radius,
    { x: 260, y: 850 },
    { x: 570, y: 850 },
    { minX: 215, maxX: 715, minY: 700, maxY: 975 },
  );
  if (!dadRoomRouteOpen)
    failures.push(`${radius}px 아빠 침대와 책상 사이 통로가 막힘`);

  for (const route of escapeRoutes) {
    if (!route.anchor) {
      failures.push(`${route.room} 기준점이 없음`);
      continue;
    }
    for (const exitLabel of route.exits) {
      const passage = PASSAGES.find((item) => item.label === exitLabel);
      if (
        !passage ||
        !hasPathWithin(
          radius,
          route.anchor,
          passageCenter(passage),
          route.bounds,
        )
      ) {
        failures.push(
          `${radius}px ${route.room}에서 '${exitLabel}' 탈출 경로가 막힘`,
        );
      } else if (
        radius === MOM_PATH_RADIUS &&
        !hasAiGridPath(
          route.anchor,
          passageCenter(passage),
          radius,
          route.bounds,
        )
      ) {
        failures.push(
          `실제 엄마 AI 격자로 ${route.room}에서 '${exitLabel}' 탈출 경로가 막힘`,
        );
      }
    }
  }

  if (radius === 19) {
    for (const interaction of INTERACTION_TEMPLATES) {
      if (!canApproach(seen, interaction, 78))
        failures.push(`상호작용 '${interaction.label}'에 접근할 수 없음`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(
  '지도 검사 통과: 넓은 문, 여유 동선, 엄마 AI와 침실별 탈출 경로가 모두 연결되어 있습니다.',
);
