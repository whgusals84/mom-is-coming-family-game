import type { Interaction, Mission, Point, Rect } from './types';

export const WORLD = { width: 1600, height: 1000 };

// 실제 평면도의 방향을 그대로 사용한다: 위쪽 중앙이 현관, 왼쪽은 거실,
// 오른쪽 중앙은 주방, 세 침실은 오른쪽 위/왼쪽 아래/오른쪽 아래에 있다.
export const ROOMS: Rect[] = [
  { x: 24, y: 24, w: 166, h: 952, label: '왼쪽 발코니', kind: 'balcony' },
  { x: 1400, y: 24, w: 176, h: 952, label: '오른쪽 발코니', kind: 'balcony' },
  { x: 190, y: 24, w: 690, h: 656, label: '거실', kind: 'living' },
  { x: 720, y: 24, w: 160, h: 150, label: '현관', kind: 'foyer' },
  { x: 880, y: 24, w: 520, h: 326, label: '형 방', kind: 'brotherRoom' },
  { x: 820, y: 350, w: 580, h: 280, label: '주방 · 식당', kind: 'kitchen' },
  { x: 190, y: 560, w: 370, h: 120, label: '욕실', kind: 'bathroom' },
  { x: 560, y: 560, w: 320, h: 210, label: '복도', kind: 'hall' },
  { x: 190, y: 680, w: 530, h: 296, label: '아빠 방', kind: 'dadRoom' },
  { x: 720, y: 770, w: 140, h: 150, label: '욕실', kind: 'bathroom' },
  { x: 860, y: 630, w: 540, h: 346, label: '내 방', kind: 'playerRoom' },
];

export const WALLS: Rect[] = [
  // 외벽
  { x: 0, y: 0, w: 1600, h: 24 },
  { x: 0, y: 976, w: 1600, h: 24 },
  { x: 0, y: 0, w: 24, h: 1000 },
  { x: 1576, y: 0, w: 24, h: 1000 },
  // 왼쪽 발코니 슬라이딩 문: 거실과 아빠 방 쪽에 넓은 출입구
  { x: 190, y: 0, w: 24, h: 135 },
  { x: 190, y: 445, w: 24, h: 285 },
  { x: 190, y: 920, w: 24, h: 80 },
  // 오른쪽 발코니 슬라이딩 문: 형 방/주방/내 방
  { x: 1380, y: 0, w: 24, h: 80 },
  { x: 1380, y: 290, w: 24, h: 155 },
  { x: 1380, y: 600, w: 24, h: 105 },
  { x: 1380, y: 910, w: 24, h: 90 },
  // 현관 돌출부와 현관 옆 형 방
  { x: 700, y: 0, w: 24, h: 165 },
  { x: 876, y: 0, w: 24, h: 165 },
  { x: 876, y: 335, w: 24, h: 15 },
  { x: 876, y: 346, w: 528, h: 24 },
  // 왼쪽 욕실
  { x: 190, y: 556, w: 370, h: 24 },
  // 욕실 옆벽은 대부분을 문으로 열어 좁은 병목을 없앤다.
  { x: 190, y: 676, w: 215, h: 24 },
  { x: 535, y: 676, w: 25, h: 24 },
  // 아빠 방과 중앙 복도
  { x: 716, y: 676, w: 24, h: 324 },
  // 내 방 윗벽은 완전히 막고, 방문은 왼쪽 세로 벽의 복도 구간에 둔다.
  { x: 856, y: 626, w: 548, h: 24 },
  { x: 856, y: 626, w: 24, h: 24 },
  { x: 856, y: 770, w: 24, h: 230 },
  // 중앙 아래 욕실
  { x: 716, y: 766, w: 12, h: 24 },
  { x: 848, y: 766, w: 12, h: 24 },
  // 중앙 욕실 아래쪽은 평면도상 외부/설비 공간이라 통과할 수 없다.
  { x: 716, y: 916, w: 144, h: 84 },
];

export const DOORS = [
  { x: 800, y: 24, angle: Math.PI / 2, label: '현관문', span: 72 },
  { x: 888, y: 165, angle: 0, label: '형 방 문', span: 84 },
  { x: 568, y: 580, angle: Math.PI, label: '욕실 문', span: 78 },
  { x: 405, y: 688, angle: Math.PI / 2, label: '욕실 문', span: 82 },
  { x: 560, y: 688, angle: Math.PI / 2, label: '아빠 방 문', span: 86 },
  { x: 868, y: 650, angle: 0, label: '내 방 문', span: 78 },
  { x: 728, y: 778, angle: Math.PI / 2, label: '욕실 문', span: 82 },
] as const;

// 벽이 실제로 끊겨 있는 곳과 같은 좌표를 사용한다. 민트색 문턱은 모두 통과 가능하다.
export const PASSAGES: Rect[] = [
  {
    x: 190,
    y: 135,
    w: 24,
    h: 310,
    label: '거실 · 왼쪽 발코니',
    kind: 'passage',
  },
  {
    x: 190,
    y: 730,
    w: 24,
    h: 190,
    label: '아빠 방 · 왼쪽 발코니',
    kind: 'passage',
  },
  {
    x: 1380,
    y: 80,
    w: 24,
    h: 210,
    label: '형 방 · 오른쪽 발코니',
    kind: 'passage',
  },
  {
    x: 1380,
    y: 445,
    w: 24,
    h: 155,
    label: '주방 · 오른쪽 발코니',
    kind: 'passage',
  },
  {
    x: 1380,
    y: 705,
    w: 24,
    h: 205,
    label: '내 방 · 오른쪽 발코니',
    kind: 'passage',
  },
  { x: 876, y: 165, w: 24, h: 170, label: '형 방 문', kind: 'passage' },
  { x: 556, y: 580, w: 24, h: 96, label: '욕실 문', kind: 'passage' },
  { x: 405, y: 676, w: 130, h: 24, label: '욕실 · 아빠 방', kind: 'passage' },
  { x: 560, y: 676, w: 156, h: 24, label: '복도 · 아빠 방', kind: 'passage' },
  { x: 856, y: 650, w: 24, h: 120, label: '내 방 문', kind: 'passage' },
  { x: 728, y: 766, w: 120, h: 24, label: '중앙 욕실 문', kind: 'passage' },
];

// 닫혔을 때 통로 전체를 잠시 막는 방문. 정적 지도에는 포함하지 않아
// 평소 경로 탐색 비용은 그대로 유지한다.
export const CLOSABLE_DOORS = [
  { id: 'brother', x: 876, y: 165, w: 24, h: 170, label: '형 방문' },
  { id: 'bath-left', x: 556, y: 580, w: 24, h: 96, label: '욕실 문' },
  { id: 'dad', x: 560, y: 676, w: 156, h: 24, label: '아빠 방문' },
  { id: 'player', x: 856, y: 650, w: 24, h: 120, label: '내 방문' },
  { id: 'bath-center', x: 728, y: 766, w: 120, h: 24, label: '중앙 욕실 문' },
] as const;

export const LIVING_SOFA: Rect = {
  x: 310,
  y: 50,
  w: 225,
  h: 82,
  label: '소파',
  kind: 'sofa',
};

export const LIVING_PIANO: Rect = {
  x: 206,
  y: 72,
  w: 48,
  h: 124,
  label: '피아노',
  kind: 'piano',
};

export const LIVING_TURTLE_HOME: Rect = {
  x: 235,
  y: 492,
  w: 70,
  h: 58,
  label: '거북이 집',
  kind: 'turtleHabitat',
};

export const LIVING_PLANT: Rect = {
  x: 465,
  y: 496,
  w: 50,
  h: 50,
  label: '화분',
  kind: 'plant',
};

// 사용자가 서 있던 내 방 오른쪽 발코니의 아래쪽 자리. 오른쪽 벽에 붙여
// 슬라이딩 문과 발코니의 세로 동선을 모두 남긴다.
export const BALCONY_WASHER: Rect = {
  x: 1505,
  y: 840,
  w: 58,
  h: 66,
  label: '세탁기',
  kind: 'washer',
};

export const FURNITURE: Rect[] = [
  // 거실
  LIVING_SOFA,
  { x: 325, y: 495, w: 120, h: 55, label: 'TV', kind: 'tv' },
  // 사용자가 최종 배치한 거실 피아노와 긴 식탁.
  LIVING_PIANO,
  { x: 310, y: 211, w: 265, h: 50, label: '식탁', kind: 'dining' },
  { x: 445, y: 350, w: 90, h: 60, label: '테이블', kind: 'table' },
  LIVING_TURTLE_HOME,
  LIVING_PLANT,
  // 현관
  { x: 740, y: 58, w: 38, h: 88, label: '신발장', kind: 'cabinet' },
  // 현관 바로 옆 형 방: 인형이 많고, 오른쪽 침대의 머리맡은 아래쪽을 향한다.
  {
    x: 1155,
    y: 82,
    w: 110,
    h: 165,
    label: '형 침대',
    kind: 'bed',
    visualRotation: 180,
  },
  { x: 940, y: 280, w: 110, h: 40, label: '책상', kind: 'desk' },
  { x: 940, y: 78, w: 185, h: 52, label: '인형 선반', kind: 'dollShelf' },
  // 주방/식당
  { x: 850, y: 430, w: 120, h: 65, label: '식탁', kind: 'dining' },
  { x: 1040, y: 385, w: 240, h: 55, label: '조리대 · 싱크대', kind: 'counter' },
  { x: 1150, y: 525, w: 70, h: 90, label: '냉장고', kind: 'fridge' },
  // 왼쪽 욕실
  { x: 232, y: 598, w: 50, h: 50, label: '변기', kind: 'toilet' },
  { x: 320, y: 598, w: 65, h: 48, label: '세면대', kind: 'sink' },
  // 왼쪽 아래 아빠 방: 빨간 표시 침대, 하늘색 표시 책상
  {
    x: 320,
    y: 870,
    w: 140,
    h: 72,
    label: '아빠 침대',
    kind: 'bed',
    visualRotation: 180,
  },
  { x: 245, y: 720, w: 150, h: 58, label: '책상', kind: 'desk' },
  { x: 632, y: 856, w: 55, h: 88, label: '옷장', kind: 'closet' },
  // 오른쪽 아래 내 방: 평면도 표시대로 오른쪽 침대, 왼쪽 책상
  { x: 1185, y: 715, w: 100, h: 165, label: '내 침대', kind: 'bed' },
  { x: 930, y: 790, w: 125, h: 58, label: '책상', kind: 'desk' },
  { x: 940, y: 865, w: 72, h: 82, label: '옷장', kind: 'closet' },
  // 중앙 욕실
  { x: 762, y: 862, w: 70, h: 30, label: '욕조', kind: 'tub' },
  // 발코니 소품
  { x: 64, y: 194, w: 58, h: 46, label: '화분대', kind: 'plant' },
  { x: 1504, y: 476, w: 40, h: 54, label: '화분대', kind: 'plant' },
  BALCONY_WASHER,
];

// 형 방에는 저작권 캐릭터가 아닌 오리지널 봉제인형을 많이 배치한다.
export const PLUSHIES = [
  {
    x: 955,
    y: 116,
    color: '#fff3df',
    accent: '#66b9a9',
    scale: 0.88,
    ears: 'rabbit',
  },
  {
    x: 1002,
    y: 116,
    color: '#ffd2d2',
    accent: '#e95f67',
    scale: 0.76,
    ears: 'bear',
  },
  {
    x: 1045,
    y: 115,
    color: '#f7dd7a',
    accent: '#d98a3d',
    scale: 0.84,
    ears: 'bear',
  },
  {
    x: 1092,
    y: 116,
    color: '#cfe4ff',
    accent: '#668bc7',
    scale: 0.72,
    ears: 'cat',
  },
  {
    x: 1190,
    y: 125,
    color: '#fff7ed',
    accent: '#f28c83',
    scale: 1.02,
    ears: 'rabbit',
  },
  {
    x: 1250,
    y: 145,
    color: '#d6edc5',
    accent: '#66a35d',
    scale: 0.9,
    ears: 'bear',
  },
  {
    x: 1205,
    y: 212,
    color: '#e2d5f7',
    accent: '#866ab6',
    scale: 0.8,
    ears: 'cat',
  },
  {
    x: 1245,
    y: 230,
    color: '#ffe0ad',
    accent: '#d77942',
    scale: 0.72,
    ears: 'bear',
  },
  {
    x: 1175,
    y: 120,
    color: '#ffd9e7',
    accent: '#db6c96',
    scale: 0.66,
    ears: 'cat',
  },
  {
    x: 1180,
    y: 190,
    color: '#d8f0ed',
    accent: '#4c9a91',
    scale: 0.82,
    ears: 'rabbit',
  },
  {
    x: 1185,
    y: 270,
    color: '#fff2b6',
    accent: '#e5a83e',
    scale: 0.7,
    ears: 'bear',
  },
  {
    x: 950,
    y: 116,
    color: '#f4d8c7',
    accent: '#a86e54',
    scale: 0.95,
    ears: 'bear',
  },
  {
    x: 1010,
    y: 116,
    color: '#f0e8ff',
    accent: '#8569b7',
    scale: 0.7,
    ears: 'rabbit',
  },
  {
    x: 1070,
    y: 116,
    color: '#cde8f7',
    accent: '#4e91b6',
    scale: 0.86,
    ears: 'cat',
  },
] as const;

export const SOLIDS = [...WALLS, ...FURNITURE];

export const LANDMARKS = {
  playerSpawn: { x: 610, y: 455 },
  momSpawn: { x: 575, y: 170 },
  entrance: { x: 800, y: 165 },
  tv: { x: 390, y: 445 },
  introAccident: { x: 650, y: 465 },
} as const;

export const FAMILY_RESTING_POSITIONS = {
  mom: { x: 422, y: 91, rotation: Math.PI / 2 },
  brother: { x: 1210, y: 165, rotation: 0 },
  dad: { x: 390, y: 906, rotation: Math.PI / 2 },
} as const;

export const FAMILY_WAKE_POSITIONS = {
  mom: LANDMARKS.momSpawn,
  brother: { x: 1080, y: 200 },
  dad: { x: 570, y: 920 },
} as const;

// 가족에게 부탁한 집안일의 실제 목적지다. 캐릭터 로직과 가구 렌더링을
// 분리하되, 가구 배치가 바뀌면 이 접근 지점만 함께 옮기면 된다.
export const FAMILY_TASK_TARGETS = {
  dishes: { x: 1110, y: 475 },
  clean: { x: 650, y: 465 },
  tv: { x: 390, y: 455 },
  turtles: { x: 270, y: 450 },
} as const;

export const INTERACTION_TEMPLATES: Omit<Interaction, 'lastUsed'>[] = [
  {
    id: 'plant',
    x: 490,
    y: 520,
    label: '화분 건드리기',
    effect: '와장창!',
    points: 500,
    rage: 20,
    cooldown: 999,
    oneShot: true,
  },
  {
    id: 'heal-sink',
    x: 430,
    y: 620,
    label: '세면대에서 물 마시기',
    effect: '꿀꺽! +30',
    points: 0,
    rage: 0,
    cooldown: 20,
    heal: 30,
  },
  {
    id: 'fridge',
    x: 1260,
    y: 570,
    label: '냉장고 몰래 열기',
    effect: '냠냠!',
    points: 200,
    rage: 5,
    cooldown: 7,
    metric: 'snacks',
  },
  {
    id: 'dad-mess',
    x: 530,
    y: 855,
    label: '아빠 방 어지럽히기',
    effect: '우당탕!',
    points: 400,
    rage: 15,
    cooldown: 8,
  },
  {
    id: 'brother-mess',
    x: 1145,
    y: 275,
    label: '형 방 인형 산 무너뜨리기',
    effect: '데굴데굴!',
    points: 450,
    rage: 16,
    cooldown: 9,
    metric: 'brotherMess',
  },
  {
    id: 'ball',
    x: 650,
    y: 465,
    label: '거실에서 공 차기',
    effect: '쾅!',
    points: 300,
    rage: 10,
    cooldown: 6,
  },
  {
    id: 'sofa',
    x: 420,
    y: 185,
    label: '소파에서 점프하기',
    effect: '쿵! 쿵!',
    points: 250,
    rage: 8,
    cooldown: 8,
  },
  {
    id: 'crumbs',
    x: 925,
    y: 530,
    label: '과자 부스러기 흘리기',
    effect: '사각사각!',
    points: 220,
    rage: 7,
    cooldown: 7,
  },
  {
    id: 'hide-player',
    x: 1110,
    y: 850,
    label: '침대 옆에 숨기',
    effect: '쉿…',
    points: 0,
    rage: 0,
    cooldown: 9,
    hide: true,
  },
  {
    id: 'hide-dad',
    x: 560,
    y: 900,
    label: '아빠 옷장 뒤에 숨기',
    effect: '안 보이지?',
    points: 0,
    rage: 0,
    cooldown: 9,
    hide: true,
  },
  {
    id: 'hide-brother',
    x: 1080,
    y: 190,
    label: '인형 더미 뒤에 숨기',
    effect: '인형인 척…',
    points: 0,
    rage: 0,
    cooldown: 9,
    hide: true,
  },
  {
    id: 'hide-bathroom',
    x: 490,
    y: 625,
    label: '욕실 문 뒤에 숨기',
    effect: '조용히…',
    points: 0,
    rage: 0,
    cooldown: 9,
    hide: true,
  },
];

export const NPC_SPOTS: Point[] = [
  { x: 350, y: 340 },
  { x: 755, y: 450 },
  { x: 1080, y: 200 },
  { x: 980, y: 565 },
  { x: 570, y: 920 },
  { x: 1080, y: 890 },
  { x: 1480, y: 620 },
];

// 자동 연결성 검사와 향후 맵 편집에 사용하는 각 공간의 안전한 보행 지점.
export const ROOM_ANCHORS = [
  { x: 350, y: 340, label: '거실' },
  { x: 820, y: 150, label: '현관' },
  { x: 1080, y: 200, label: '형 방' },
  { x: 980, y: 565, label: '주방 · 식당' },
  { x: 470, y: 620, label: '왼쪽 욕실' },
  { x: 650, y: 620, label: '복도' },
  { x: 570, y: 920, label: '아빠 방' },
  { x: 800, y: 780, label: '중앙 욕실' },
  { x: 1080, y: 890, label: '내 방' },
  { x: 100, y: 400, label: '왼쪽 발코니' },
  { x: 1480, y: 620, label: '오른쪽 발코니' },
] as const;

export const MISSIONS: Omit<Mission, 'progress' | 'done'>[] = [
  { kind: 'survive', title: '엄마에게 60초 동안 잡히지 않기', target: 60 },
  { kind: 'snacks', title: '냉장고에서 간식 3번 훔치기', target: 3 },
  { kind: 'brotherMess', title: '형 방에서 장난 3번 치기', target: 3 },
  { kind: 'closeCall', title: '엄마 바로 앞에서 대시로 탈출하기', target: 1 },
  { kind: 'dad', title: '아빠를 두 번 만나기', target: 2 },
];

export const LINES = {
  mom: ['너희 또 뭐 했어?', '거기 안 서?!', '누가 이랬어!', '잡히기만 해봐!'],
  brotherGood: ['ㅋㅋㅋㅋ 빨리 도망가!', '엄마 온다!', '야! 이쪽으로 도망가!'],
  brotherBad: ['엄마! 얘 여기 있어!', '난 모르는 일이다.', '여기요! 여기!'],
  dad: [
    '난 아무것도 못 봤다.',
    '빨리 가!',
    '아빠가 시간을 벌어줄게.',
    '오늘도 평화롭구나…',
  ],
  player: ['큰일났다.', '튀어!', '형 때문이야!', '이번엔 진짜 내가 아님!'],
};

export const ITEMS = [
  { id: 'shoes', icon: '👟', name: '운동화', text: '5초 동안 이동속도 UP!' },
  { id: 'snack', icon: '🍪', name: '과자', text: '보너스 500점!' },
  { id: 'juice', icon: '🧃', name: '비타민 주스', text: '체력 40 회복!' },
  { id: 'lock', icon: '🔒', name: '방문 잠금', text: '엄마가 잠깐 멈칫!' },
  { id: 'remote', icon: '📺', name: '리모컨', text: '엄마의 시선을 TV로!' },
  {
    id: 'dadChance',
    icon: '🕶️',
    name: '아빠 찬스',
    text: '엄마를 3초 동안 멈춤!',
  },
] as const;
