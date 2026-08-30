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
  { x: 560, y: 560, w: 320, h: 140, label: '복도', kind: 'hall' },
  { x: 190, y: 680, w: 530, h: 296, label: '아빠 방', kind: 'dadRoom' },
  { x: 720, y: 700, w: 160, h: 220, label: '욕실', kind: 'bathroom' },
  { x: 880, y: 630, w: 520, h: 346, label: '내 방', kind: 'playerRoom' },
];

export const WALLS: Rect[] = [
  // 외벽
  { x: 0, y: 0, w: 1600, h: 24 }, { x: 0, y: 976, w: 1600, h: 24 },
  { x: 0, y: 0, w: 24, h: 1000 }, { x: 1576, y: 0, w: 24, h: 1000 },
  // 왼쪽 발코니 슬라이딩 문: 거실과 아빠 방 쪽에 넓은 출입구
  { x: 190, y: 0, w: 24, h: 135 }, { x: 190, y: 445, w: 24, h: 285 },
  { x: 190, y: 920, w: 24, h: 80 },
  // 오른쪽 발코니 슬라이딩 문: 형 방/주방/내 방
  { x: 1380, y: 0, w: 24, h: 80 }, { x: 1380, y: 290, w: 24, h: 155 },
  { x: 1380, y: 600, w: 24, h: 105 }, { x: 1380, y: 910, w: 24, h: 90 },
  // 현관 돌출부와 현관 옆 형 방
  { x: 700, y: 0, w: 24, h: 165 },
  { x: 876, y: 0, w: 24, h: 195 }, { x: 876, y: 315, w: 24, h: 35 },
  { x: 876, y: 346, w: 528, h: 24 },
  // 왼쪽 욕실
  { x: 190, y: 556, w: 370, h: 24 },
  { x: 556, y: 556, w: 24, h: 38 }, { x: 556, y: 654, w: 24, h: 50 },
  { x: 190, y: 676, w: 250, h: 24 }, { x: 520, y: 676, w: 60, h: 24 },
  { x: 680, y: 676, w: 40, h: 24 },
  // 아빠 방과 중앙 복도
  { x: 716, y: 676, w: 24, h: 324 },
  // 내 방 윗벽: 가구와 겹치지 않는 넓은 출입문
  { x: 876, y: 626, w: 44, h: 24 }, { x: 1040, y: 626, w: 364, h: 24 },
  { x: 876, y: 626, w: 24, h: 374 },
  // 중앙 아래 욕실
  { x: 716, y: 696, w: 42, h: 24 }, { x: 842, y: 696, w: 38, h: 24 },
  // 중앙 욕실 아래쪽은 평면도상 외부/설비 공간이라 통과할 수 없다.
  { x: 716, y: 916, w: 164, h: 84 },
];

export const DOORS = [
  { x: 800, y: 24, angle: Math.PI / 2, label: '현관문' },
  { x: 888, y: 255, angle: 0, label: '형 방 문' },
  { x: 568, y: 624, angle: Math.PI, label: '욕실 문' },
  { x: 480, y: 688, angle: Math.PI / 2, label: '욕실 문' },
  { x: 620, y: 688, angle: Math.PI / 2, label: '아빠 방 문' },
  { x: 970, y: 638, angle: Math.PI / 2, label: '내 방 문' },
  { x: 800, y: 708, angle: Math.PI / 2, label: '욕실 문' },
] as const;

// 벽이 실제로 끊겨 있는 곳과 같은 좌표를 사용한다. 민트색 문턱은 모두 통과 가능하다.
export const PASSAGES: Rect[] = [
  { x: 190, y: 135, w: 24, h: 310, label: '거실 · 왼쪽 발코니', kind: 'passage' },
  { x: 190, y: 730, w: 24, h: 190, label: '아빠 방 · 왼쪽 발코니', kind: 'passage' },
  { x: 1380, y: 80, w: 24, h: 210, label: '형 방 · 오른쪽 발코니', kind: 'passage' },
  { x: 1380, y: 445, w: 24, h: 155, label: '주방 · 오른쪽 발코니', kind: 'passage' },
  { x: 1380, y: 705, w: 24, h: 205, label: '내 방 · 오른쪽 발코니', kind: 'passage' },
  { x: 876, y: 195, w: 24, h: 120, label: '형 방 문', kind: 'passage' },
  { x: 556, y: 594, w: 24, h: 60, label: '욕실 문', kind: 'passage' },
  { x: 440, y: 676, w: 80, h: 24, label: '욕실 · 아빠 방', kind: 'passage' },
  { x: 580, y: 676, w: 100, h: 24, label: '복도 · 아빠 방', kind: 'passage' },
  { x: 920, y: 626, w: 120, h: 24, label: '내 방 문', kind: 'passage' },
  { x: 758, y: 696, w: 84, h: 24, label: '중앙 욕실 문', kind: 'passage' },
];

export const FURNITURE: Rect[] = [
  // 거실
  { x: 285, y: 150, w: 270, h: 100, label: '소파', kind: 'sofa' },
  { x: 650, y: 180, w: 70, h: 150, label: 'TV', kind: 'tv' },
  { x: 430, y: 350, w: 120, h: 80, label: '테이블', kind: 'table' },
  { x: 230, y: 485, w: 65, h: 65, label: '화분', kind: 'plant' },
  // 현관
  { x: 735, y: 55, w: 48, h: 105, label: '신발장', kind: 'cabinet' },
  // 현관 바로 옆 형 방: 인형이 많고, 오른쪽 침대의 머리맡은 아래쪽을 향한다.
  { x: 1125, y: 75, w: 145, h: 225, label: '형 침대', kind: 'bed', visualRotation: 180 },
  { x: 950, y: 260, w: 160, h: 55, label: '책상', kind: 'desk' },
  { x: 930, y: 75, w: 210, h: 65, label: '인형 선반', kind: 'dollShelf' },
  // 주방/식당
  { x: 845, y: 405, w: 90, h: 120, label: '냉장고', kind: 'fridge' },
  { x: 1030, y: 390, w: 300, h: 72, label: '조리대', kind: 'counter' },
  { x: 1030, y: 462, w: 75, h: 110, label: '싱크대', kind: 'counter' },
  { x: 1130, y: 505, w: 160, h: 90, label: '식탁', kind: 'dining' },
  // 왼쪽 욕실
  { x: 225, y: 592, w: 62, h: 62, label: '변기', kind: 'toilet' },
  { x: 315, y: 592, w: 78, h: 58, label: '세면대', kind: 'sink' },
  // 왼쪽 아래 아빠 방: 빨간 표시 침대, 하늘색 표시 책상
  { x: 300, y: 805, w: 175, h: 135, label: '아빠 침대', kind: 'bed', visualRotation: 180 },
  { x: 240, y: 715, w: 185, h: 70, label: '책상', kind: 'desk' },
  { x: 620, y: 845, w: 72, h: 105, label: '옷장', kind: 'closet' },
  // 오른쪽 아래 내 방: 평면도 표시대로 오른쪽 침대, 왼쪽 책상
  { x: 1160, y: 700, w: 145, h: 205, label: '내 침대', kind: 'bed' },
  { x: 920, y: 780, w: 150, h: 70, label: '책상', kind: 'desk' },
  { x: 930, y: 850, w: 90, h: 100, label: '옷장', kind: 'closet' },
  // 중앙 욕실
  { x: 745, y: 815, w: 105, h: 76, label: '욕조', kind: 'tub' },
  // 발코니 소품
  { x: 58, y: 190, w: 70, h: 55, label: '화분대', kind: 'plant' },
  { x: 1500, y: 470, w: 48, h: 65, label: '화분대', kind: 'plant' },
];

// 형 방에는 저작권 캐릭터가 아닌 오리지널 봉제인형을 많이 배치한다.
export const PLUSHIES = [
  { x: 955, y: 116, color: '#fff3df', accent: '#66b9a9', scale: .88, ears: 'rabbit' },
  { x: 1002, y: 116, color: '#ffd2d2', accent: '#e95f67', scale: .76, ears: 'bear' },
  { x: 1045, y: 115, color: '#f7dd7a', accent: '#d98a3d', scale: .84, ears: 'bear' },
  { x: 1092, y: 116, color: '#cfe4ff', accent: '#668bc7', scale: .72, ears: 'cat' },
  { x: 1190, y: 125, color: '#fff7ed', accent: '#f28c83', scale: 1.02, ears: 'rabbit' },
  { x: 1250, y: 145, color: '#d6edc5', accent: '#66a35d', scale: .9, ears: 'bear' },
  { x: 1205, y: 212, color: '#e2d5f7', accent: '#866ab6', scale: .8, ears: 'cat' },
  { x: 1245, y: 230, color: '#ffe0ad', accent: '#d77942', scale: .72, ears: 'bear' },
  { x: 1175, y: 120, color: '#ffd9e7', accent: '#db6c96', scale: .66, ears: 'cat' },
  { x: 1180, y: 190, color: '#d8f0ed', accent: '#4c9a91', scale: .82, ears: 'rabbit' },
  { x: 1185, y: 270, color: '#fff2b6', accent: '#e5a83e', scale: .7, ears: 'bear' },
  { x: 950, y: 116, color: '#f4d8c7', accent: '#a86e54', scale: .95, ears: 'bear' },
  { x: 1010, y: 116, color: '#f0e8ff', accent: '#8569b7', scale: .7, ears: 'rabbit' },
  { x: 1070, y: 116, color: '#cde8f7', accent: '#4e91b6', scale: .86, ears: 'cat' },
] as const;

export const SOLIDS = [...WALLS, ...FURNITURE];

export const LANDMARKS = {
  playerSpawn: { x: 610, y: 455 },
  momSpawn: { x: 800, y: 215 },
  entrance: { x: 800, y: 165 },
  tv: { x: 610, y: 250 },
  introAccident: { x: 650, y: 465 },
} as const;

export const INTERACTION_TEMPLATES: Omit<Interaction, 'lastUsed'>[] = [
  { id: 'plant', x: 260, y: 520, label: '화분 건드리기', effect: '와장창!', points: 500, rage: 20, cooldown: 999, oneShot: true },
  { id: 'fridge', x: 900, y: 545, label: '냉장고 몰래 열기', effect: '냠냠!', points: 200, rage: 5, cooldown: 7, metric: 'snacks' },
  { id: 'dad-mess', x: 530, y: 855, label: '아빠 방 어지럽히기', effect: '우당탕!', points: 400, rage: 15, cooldown: 8 },
  { id: 'brother-mess', x: 1145, y: 275, label: '형 방 인형 산 무너뜨리기', effect: '데굴데굴!', points: 450, rage: 16, cooldown: 9, metric: 'brotherMess' },
  { id: 'ball', x: 650, y: 465, label: '거실에서 공 차기', effect: '쾅!', points: 300, rage: 10, cooldown: 6 },
  { id: 'sofa', x: 420, y: 285, label: '소파에서 점프하기', effect: '쿵! 쿵!', points: 250, rage: 8, cooldown: 8 },
  { id: 'crumbs', x: 1160, y: 605, label: '과자 부스러기 흘리기', effect: '사각사각!', points: 220, rage: 7, cooldown: 7 },
  { id: 'hide-player', x: 1110, y: 850, label: '침대 옆에 숨기', effect: '쉿…', points: 0, rage: 0, cooldown: 9, hide: true },
  { id: 'hide-dad', x: 560, y: 900, label: '아빠 옷장 뒤에 숨기', effect: '안 보이지?', points: 0, rage: 0, cooldown: 9, hide: true },
];

export const NPC_SPOTS: Point[] = [
  { x: 350, y: 340 }, { x: 755, y: 450 }, { x: 1080, y: 200 },
  { x: 980, y: 565 }, { x: 570, y: 920 }, { x: 1080, y: 890 },
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
  dad: ['난 아무것도 못 봤다.', '빨리 가!', '아빠가 시간을 벌어줄게.', '오늘도 평화롭구나…'],
  player: ['큰일났다.', '튀어!', '형 때문이야!', '이번엔 진짜 내가 아님!'],
};

export const ITEMS = [
  { id: 'shoes', icon: '👟', name: '운동화', text: '5초 동안 이동속도 UP!' },
  { id: 'snack', icon: '🍪', name: '과자', text: '보너스 500점!' },
  { id: 'lock', icon: '🔒', name: '방문 잠금', text: '엄마가 잠깐 멈칫!' },
  { id: 'remote', icon: '📺', name: '리모컨', text: '엄마의 시선을 TV로!' },
  { id: 'dadChance', icon: '🕶️', name: '아빠 찬스', text: '엄마를 3초 동안 멈춤!' },
] as const;
