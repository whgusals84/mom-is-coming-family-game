import {
  DOORS,
  FURNITURE,
  LANDMARKS,
  PASSAGES,
  PLUSHIES,
  ROOMS,
  WALLS,
} from './data';
import type { CharacterRole, MomMood, Point } from './types';
import { SpriteBank } from './sprites';

const COLORS: Record<string, string> = {
  living: '#eecb98',
  kitchen: '#cce9df',
  playerRoom: '#cfe2f6',
  brotherRoom: '#dfd5f3',
  dadRoom: '#fff0c9',
  hall: '#f4e7c9',
  foyer: '#c98f7f',
  bathroom: '#e3d6d9',
  balcony: '#e6e0d2',
};

export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawMap(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#e9c58e';
  ctx.fillRect(0, 0, 1600, 1000);
  for (const room of ROOMS) {
    ctx.fillStyle = COLORS[room.kind ?? ''] ?? '#f7e8c7';
    ctx.fillRect(room.x, room.y, room.w, room.h);
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#775c42';
    ctx.lineWidth = 2;
    for (let x = room.x + 24; x < room.x + room.w; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, room.y);
      ctx.lineTo(x, room.y + room.h);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(67,48,38,.22)';
    ctx.font = '900 26px system-ui';
    ctx.fillText(room.label ?? '', room.x + 32, room.y + 52);
  }

  for (const passage of PASSAGES) drawPassage(ctx, passage);

  for (const wall of WALLS) {
    ctx.fillStyle = '#6d5142';
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.fillStyle = '#9b765e';
    ctx.fillRect(
      wall.x + 4,
      wall.y + 4,
      Math.max(0, wall.w - 8),
      Math.max(0, wall.h - 8),
    );
  }

  for (const item of FURNITURE) drawFurniture(ctx, item);
  for (const door of DOORS)
    drawDoor(
      ctx,
      door.x,
      door.y,
      door.angle,
      door.label !== '현관문',
      door.span,
    );
  for (const plush of PLUSHIES) drawPlush(ctx, plush);
  drawDoorMat(ctx, LANDMARKS.entrance.x, LANDMARKS.entrance.y + 28);
}

function drawFurniture(
  ctx: CanvasRenderingContext2D,
  item: (typeof FURNITURE)[number],
) {
  const palettes: Record<string, [string, string]> = {
    sofa: ['#ea806b', '#a9453f'],
    tv: ['#444853', '#25272d'],
    table: ['#b47d4d', '#7d4f31'],
    piano: ['#8761bd', '#583389'],
    plant: ['#79aa67', '#b85b4b'],
    fridge: ['#e9f3f2', '#96aaa9'],
    dining: ['#d39a5f', '#8f5c35'],
    bed: ['#98bfe8', '#587ea8'],
    desk: ['#ba8151', '#784b2f'],
    closet: ['#8e6bc0', '#60448c'],
    cabinet: ['#d9ad72', '#9a6a3e'],
    dollShelf: ['#f2b9c5', '#a85b72'],
    counter: ['#f1e4c5', '#9a8064'],
    toilet: ['#f7fbfb', '#93aaa9'],
    sink: ['#d8efed', '#77a6a0'],
    tub: ['#d2e9ef', '#6a9aaa'],
  };
  const [fill, edge] = palettes[item.kind ?? ''] ?? ['#c99462', '#805836'];
  ctx.save();
  ctx.shadowColor = 'rgba(63,44,34,.22)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 7;
  roundedRect(ctx, item.x, item.y, item.w, item.h, Math.min(18, item.h / 4));
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 5;
  ctx.strokeStyle = edge;
  ctx.stroke();
  if (item.kind === 'tv') {
    roundedRect(ctx, item.x + 14, item.y + 10, item.w - 28, item.h - 20, 8);
    ctx.fillStyle = '#87d4dd';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.65)';
    ctx.fillRect(item.x + 28, item.y + 17, 34, 6);
  } else if (item.kind === 'sofa') {
    ctx.strokeStyle = edge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(item.x + item.w / 2, item.y + 8);
    ctx.lineTo(item.x + item.w / 2, item.y + item.h - 8);
    ctx.stroke();
  } else if (item.kind === 'piano') {
    ctx.fillStyle = '#4d2b75';
    roundedRect(ctx, item.x + 7, item.y + 8, item.w - 14, item.h * 0.34, 7);
    ctx.fill();
    const keyboardY = item.y + item.h * 0.55;
    ctx.fillStyle = '#fffaf0';
    roundedRect(ctx, item.x + 6, keyboardY, item.w - 12, item.h * 0.32, 5);
    ctx.fill();
    ctx.strokeStyle = '#5a3c6f';
    ctx.lineWidth = 1.5;
    for (let key = 1; key < 6; key += 1) {
      const keyX = item.x + 6 + ((item.w - 12) * key) / 6;
      ctx.beginPath();
      ctx.moveTo(keyX, keyboardY);
      ctx.lineTo(keyX, keyboardY + item.h * 0.32);
      ctx.stroke();
    }
  } else if (item.kind === 'fridge') {
    ctx.fillStyle = edge;
    ctx.fillRect(item.x + item.w - 22, item.y + 18, 6, item.h - 36);
  } else if (item.kind === 'plant') {
    ctx.fillStyle = '#a65b43';
    roundedRect(ctx, item.x + 10, item.y + 32, item.w - 20, item.h - 28, 10);
    ctx.fill();
    ctx.fillStyle = '#4f954f';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(
        item.x + 15 + i * 10,
        item.y + 24 - (i % 2) * 12,
        10,
        22,
        i - 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  } else if (item.kind === 'bed') {
    ctx.save();
    ctx.translate(item.x + item.w / 2, item.y + item.h / 2);
    ctx.rotate(((item.visualRotation ?? 0) * Math.PI) / 180);
    ctx.translate(-(item.x + item.w / 2), -(item.y + item.h / 2));
    ctx.fillStyle = '#fff4df';
    roundedRect(
      ctx,
      item.x + 10,
      item.y + 10,
      item.w - 20,
      Math.min(42, item.h * 0.28),
      11,
    );
    ctx.fill();
    ctx.fillStyle = '#eb7d72';
    roundedRect(
      ctx,
      item.x + 9,
      item.y + Math.min(48, item.h * 0.32),
      item.w - 18,
      item.h - Math.min(58, item.h * 0.38),
      10,
    );
    ctx.fill();
    ctx.restore();
  } else if (item.kind === 'desk') {
    ctx.fillStyle = '#b8e1ef';
    roundedRect(ctx, item.x + 8, item.y + 8, item.w - 16, item.h - 16, 8);
    ctx.fill();
    ctx.fillStyle = '#4f7786';
    ctx.fillRect(item.x + item.w * 0.68, item.y + 16, item.w * 0.2, 8);
  } else if (item.kind === 'dollShelf') {
    ctx.strokeStyle = edge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(item.x + item.w / 2, item.y + 4);
    ctx.lineTo(item.x + item.w / 2, item.y + item.h - 4);
    ctx.stroke();
  } else if (item.kind === 'counter') {
    ctx.fillStyle = '#b9d8d3';
    ctx.beginPath();
    ctx.arc(item.x + item.w * 0.5, item.y + item.h / 2, 16, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.kind === 'toilet') {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(
      item.x + item.w / 2,
      item.y + item.h / 2,
      item.w * 0.27,
      item.h * 0.35,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  } else if (item.kind === 'sink') {
    ctx.strokeStyle = edge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(item.x + item.w / 2, item.y + item.h / 2, 16, 0, Math.PI * 2);
    ctx.stroke();
  } else if (item.kind === 'tub') {
    roundedRect(ctx, item.x + 9, item.y + 9, item.w - 18, item.h - 18, 22);
    ctx.fillStyle = '#f8ffff';
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(49,37,31,.75)';
  ctx.font = '800 13px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(item.label ?? '', item.x + item.w / 2, item.y + item.h / 2 + 5);
  // 이 점선 사각형이 실제 충돌 판정과 완전히 같은 가구의 바닥 면적이다.
  ctx.setLineDash([7, 5]);
  ctx.strokeStyle = 'rgba(57,43,36,.72)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(item.x + 1.5, item.y + 1.5, item.w - 3, item.h - 3);
  ctx.restore();
}

function drawPassage(
  ctx: CanvasRenderingContext2D,
  passage: (typeof PASSAGES)[number],
) {
  ctx.save();
  ctx.fillStyle = 'rgba(91, 201, 178, .4)';
  ctx.fillRect(passage.x, passage.y, passage.w, passage.h);
  ctx.strokeStyle = '#2f8e7c';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 7]);
  ctx.strokeRect(
    passage.x + 1.5,
    passage.y + 1.5,
    Math.max(0, passage.w - 3),
    Math.max(0, passage.h - 3),
  );
  ctx.restore();
}

function drawDoor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  passable: boolean,
  span: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = passable ? '#2f8e7c' : '#8a4f43';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(span, 0);
  ctx.stroke();
  ctx.setLineDash([5, 5]);
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.arc(0, 0, span, 0, Math.PI / 2);
  ctx.stroke();
  if (!passable) {
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff0b0';
    ctx.font = '900 15px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('잠김', 28, 18);
  }
  ctx.restore();
}

function drawPlush(
  ctx: CanvasRenderingContext2D,
  plush: (typeof PLUSHIES)[number],
) {
  const s = plush.scale;
  ctx.save();
  ctx.translate(plush.x, plush.y);
  ctx.scale(s, s);
  ctx.strokeStyle = '#59483f';
  ctx.lineWidth = 2.5;
  ctx.fillStyle = plush.color;
  if (plush.ears === 'rabbit') {
    ctx.beginPath();
    ctx.ellipse(-7, -18, 6, 15, -0.18, 0, Math.PI * 2);
    ctx.ellipse(7, -18, 6, 15, 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (plush.ears === 'cat') {
    ctx.beginPath();
    ctx.moveTo(-18, -12);
    ctx.lineTo(-12, -29);
    ctx.lineTo(-2, -14);
    ctx.moveTo(18, -12);
    ctx.lineTo(12, -29);
    ctx.lineTo(2, -14);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(-13, -13, 8, 0, Math.PI * 2);
    ctx.arc(13, -13, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#4a3932';
  ctx.beginPath();
  ctx.arc(-7, -3, 2.2, 0, Math.PI * 2);
  ctx.arc(7, -3, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = plush.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 4, 6, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.fillStyle = plush.accent;
  roundedRect(ctx, -16, 16, 32, 8, 4);
  ctx.fill();
  ctx.restore();
}

function drawDoorMat(ctx: CanvasRenderingContext2D, x: number, y: number) {
  roundedRect(ctx, x - 75, y - 28, 150, 56, 15);
  ctx.fillStyle = '#65b9a8';
  ctx.fill();
  ctx.strokeStyle = '#2d786c';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#fff7df';
  ctx.font = '900 17px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('어서 와!', x, y + 6);
}

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  bank: SpriteBank,
  role: CharacterRole,
  x: number,
  y: number,
  moving: boolean,
  time: number,
  mood: MomMood = 'calm',
  hidden = false,
  facing: 1 | -1 = 1,
  reducedMotion = false,
) {
  const motion = moving && !reducedMotion ? 1 : 0;
  const phase = motion ? time * 12 : 0;
  const step = Math.sin(phase);
  const lift = -Math.abs(step) * 2.4 * motion;
  const lean = step * 0.028 * motion;
  const squash = Math.abs(step) * 0.012 * motion;
  const idleBob = !moving && !reducedMotion ? Math.sin(time * 3) * 1.2 : 0;

  ctx.save();
  ctx.globalAlpha = hidden ? 0.42 : 1;
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(53,38,30,.22)';
  ctx.beginPath();
  ctx.ellipse(0, 18, role === 'brother' ? 28 : 24, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Keep the collision point and shadow planted while the art rocks around its feet.
  ctx.translate(0, 21 + lift + idleBob);
  ctx.rotate(lean);
  ctx.scale(facing * (1 + squash), 1 - squash);
  ctx.translate(0, -21);
  const sprite = bank.get(role, moving ? 'run' : 'idle', mood);
  if (sprite) {
    const height = role === 'brother' ? 106 : role === 'mom' ? 103 : 92;
    const width = height * (sprite.naturalWidth / sprite.naturalHeight);
    ctx.drawImage(sprite, -width / 2, 21 - height, width, height);
  } else {
    drawFallbackCharacter(ctx, role, moving, time, mood);
  }
  ctx.restore();
}

function drawFallbackCharacter(
  ctx: CanvasRenderingContext2D,
  role: CharacterRole,
  moving: boolean,
  time: number,
  mood: MomMood,
) {
  const tall = role === 'brother';
  const angry = role === 'mom' && (mood === 'chase' || mood === 'extreme');
  const bodyColor =
    role === 'player'
      ? '#47b5ad'
      : role === 'mom'
        ? '#f37d6e'
        : role === 'brother'
          ? '#5d6fab'
          : '#d9b266';
  const hair = role === 'mom' ? '#5b352c' : '#342821';
  const leg = moving ? Math.sin(time * 14) * 7 : 0;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#342820';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-8, 3);
  ctx.lineTo(-10 + leg, 20);
  ctx.moveTo(8, 3);
  ctx.lineTo(10 - leg, 20);
  ctx.stroke();
  roundedRect(ctx, -19, tall ? -43 : -37, 38, tall ? 50 : 44, 14);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.strokeStyle = '#342820';
  ctx.lineWidth = 4;
  ctx.stroke();
  if (role === 'mom') {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.ellipse(0, -57, 31, 38, 0, 0, Math.PI * 2);
    ctx.fill();
    if (angry) {
      ctx.beginPath();
      ctx.ellipse(
        -24 + Math.sin(time * 18) * 5,
        -45,
        13,
        30,
        -0.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  ctx.fillStyle = '#ffd5bd';
  ctx.beginPath();
  ctx.arc(0, tall ? -58 : -53, 27, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#342820';
  ctx.lineWidth = 4;
  ctx.stroke();
  if (role !== 'mom') {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(0, tall ? -64 : -59, 27, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillStyle = '#342820';
  if (angry) {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-15, -62);
    ctx.lineTo(-5, -58);
    ctx.moveTo(15, -62);
    ctx.lineTo(5, -58);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(-9, tall ? -56 : -51, 3, 0, Math.PI * 2);
  ctx.arc(9, tall ? -56 : -51, 3, 0, Math.PI * 2);
  ctx.fill();
  if (role === 'dad') drawGlasses(ctx, tall ? -56 : -51);
  ctx.strokeStyle = '#8e4b43';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, tall ? -48 : -43, 6, 0, Math.PI);
  ctx.stroke();
  if (role === 'brother') drawRabbit(ctx, -29, -18);
}

function drawGlasses(ctx: CanvasRenderingContext2D, y: number) {
  ctx.strokeStyle = '#282629';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(-9, y, 8, 0, Math.PI * 2);
  ctx.arc(9, y, 8, 0, Math.PI * 2);
  ctx.moveTo(-1, y);
  ctx.lineTo(1, y);
  ctx.stroke();
}

function drawRabbit(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#fffdf4';
  ctx.strokeStyle = '#604c42';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-5, -13, 4, 11, -0.15, 0, Math.PI * 2);
  ctx.ellipse(5, -13, 4, 11, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#604c42';
  ctx.beginPath();
  ctx.arc(-4, -2, 1.5, 0, Math.PI * 2);
  ctx.arc(4, -2, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#63b9a8';
  ctx.fillRect(-10, 7, 20, 5);
  ctx.restore();
}

export function drawSpeech(
  ctx: CanvasRenderingContext2D,
  at: Point,
  text: string,
  color = '#fffdf4',
) {
  ctx.save();
  ctx.font = '900 15px system-ui';
  const width = Math.min(230, ctx.measureText(text).width + 30);
  const x = at.x - width / 2;
  const y = at.y - 108;
  roundedRect(ctx, x, y, width, 38, 13);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#3b2d27';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(at.x - 7, y + 37);
  ctx.lineTo(at.x, y + 48);
  ctx.lineTo(at.x + 8, y + 36);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#382a24';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, at.x, y + 19, width - 16);
  ctx.restore();
}

export function drawMarker(
  ctx: CanvasRenderingContext2D,
  at: Point,
  label: string,
  ready: boolean,
  pulse: number,
) {
  ctx.save();
  ctx.translate(at.x, at.y - 20 - Math.sin(pulse * 5) * 4);
  ctx.globalAlpha = ready ? 1 : 0.35;
  ctx.fillStyle = ready ? '#fff36d' : '#fffdf4';
  ctx.strokeStyle = '#3b2d27';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3b2d27';
  ctx.font = '1000 18px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('E', 0, 1);
  ctx.font = '800 13px system-ui';
  ctx.fillStyle = '#493831';
  ctx.fillText(label, 0, 31);
  ctx.restore();
}
