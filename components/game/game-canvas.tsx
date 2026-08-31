'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Gamepad2, HelpCircle, MoreHorizontal, Sparkles, Trophy, UsersRound, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { playGameTone, startNocturne, stopNocturne, unlockGameAudio, type GameTone } from '@/lib/game/audio';
import {
  CLOSABLE_DOORS,
  FAMILY_RESTING_POSITIONS,
  FAMILY_TASK_TARGETS,
  FAMILY_WAKE_POSITIONS,
  INTERACTION_TEMPLATES,
  ITEMS,
  LANDMARKS,
  LINES,
  LIVING_PIANO,
  LIVING_SOFA,
  MISSIONS,
  NPC_SPOTS,
  WORLD,
} from '@/lib/game/data';
import { HEALTH_RULES, restoreHealth, takeDamage } from '@/lib/game/health';
import { circleHitsRect, clamp, distance, findPath, moveCircle, pointInRect } from '@/lib/game/map';
import { drawCharacter, drawMap, drawMapAnimations, drawMarker, drawRestingCharacter, drawSpeech, roundedRect } from '@/lib/game/renderer';
import { SpriteBank } from '@/lib/game/sprites';
import type { GameResult, HouseEventKind, HudState, Interaction, Mission, MomMood, PlayerOutfit, Point } from '@/lib/game/types';

type GamePhase = 'explore' | 'chase';
type GameCanvasProps = {
  highScore: number;
  initialPhase: GamePhase;
  playerOutfit: PlayerOutfit;
  onGameOver: (result: GameResult) => void;
  onOpenHow: () => void;
  onOpenCharacters: () => void;
  onOpenCollection: () => void;
};

type Actor = Point & { r: number; moving: boolean; facing: 1 | -1 };
type Mom = Actor & {
  active: boolean; mood: MomMood; path: Point[]; pathAt: number; chaseAt: number;
  stunnedUntil: number; distractedUntil: number; extremeUntil: number; lostUntil: number;
  lastSeen: Point; nextLoseCheck: number;
};
type Npc = Actor & {
  kind: 'brother' | 'dad';
  path: Point[];
  pathAt: number;
  targetAt: number;
  good: boolean;
  collected: boolean;
  line: string;
  bumpCooldownUntil: number;
};
type Bubble = { role: 'player' | 'mom' | 'brother' | 'dad'; text: string; until: number };
type Effect = Point & { text: string; color: string; until: number; born: number };
type Counters = { snacks: number; brotherMess: number; closeCall: number; dad: number };
type TouchControl = 'dash' | 'interact';
type FamilyRole = 'mom' | 'brother' | 'dad';
type FamilyTaskKind = keyof typeof FAMILY_TASK_TARGETS;
type FamilyTaskCommand = { role: FamilyRole; kind: FamilyTaskKind };
type FamilyTaskState = {
  kind: FamilyTaskKind;
  phase: 'walking' | 'working';
  workUntil: number;
  nextEffectAt: number;
  repathAt: number;
};
type NearbyFamily = { role: FamilyRole; name: string; busyLabel: string | null };
type DoorState = { id: string; closedUntil: number };
type HouseEventState = { kind: HouseEventKind; startedAt: number; until: number };
type FootprintDecoy = Point & { until: number };

const PLAYER_MOVE_OPTIONS = { ignoreKinds: ['sofa'] } as const;
const SOFA_SPEED_MULTIPLIER = 1.38;

const FAMILY_NAMES: Record<FamilyRole, string> = { mom: '엄마', brother: '형', dad: '아빠' };
const FAMILY_TASKS: Record<FamilyTaskKind, { label: string; icon: string; effect: string; duration: number }> = {
  dishes: { label: '설거지', icon: '🫧', effect: '뽀득뽀득!', duration: 5.5 },
  clean: { label: '청소', icon: '🧹', effect: '쓱싹쓱싹!', duration: 5.5 },
  tv: { label: 'TV 보기', icon: '📺', effect: '재밌다!', duration: 6.5 },
  turtles: { label: '거북이 밥주기', icon: '🐢', effect: '냠냠!', duration: 5 },
};

const HOUSE_EVENTS: Record<HouseEventKind, { title: string; icon: string; duration: number }> = {
  doorbell: { title: '초인종이 울렸다!', icon: '🔔', duration: 6 },
  blackout: { title: '갑자기 정전!', icon: '💡', duration: 6 },
  turtles: { title: '거북이가 탈출했다!', icon: '🐢', duration: 9 },
  vacuum: { title: '로봇청소기 출동!', icon: '🤖', duration: 8 },
  crumbs: { title: '형이 과자를 흘렸다!', icon: '🍪', duration: 5 },
  remote: { title: '아빠가 리모컨을 잃어버렸다!', icon: '📺', duration: 6 },
};
const HOUSE_EVENT_KINDS = Object.keys(HOUSE_EVENTS) as HouseEventKind[];

const INITIAL_HUD: HudState = {
  score: 0, elapsed: 0, rage: 0, rageLabel: '아직 모름', momMood: 'calm', momMoodLabel: '😐 평온',
  mission: { kind: 'survive', title: '엄마에게 60초 동안 잡히지 않기', target: 60, progress: 0, done: false },
  prompt: '집 안을 둘러보는 중…', itemText: '', dashReady: 1,
  combo: 0, comboSeconds: 0, decoyCharges: 0,
  health: HEALTH_RULES.max, maxHealth: HEALTH_RULES.max, recoveryLabel: '체력 가득', recovering: false,
};

function pick<T>(values: readonly T[]): T { return values[Math.floor(Math.random() * values.length)]; }
function rageLabel(rage: number) {
  if (rage >= 100) return '엄마 극대노 모드';
  if (rage >= 75) return '거기 서!';
  if (rage >= 50) return '너희 또 뭐 했어?';
  if (rage >= 25) return '뭔가 이상한데?';
  return '아직 모름';
}
function moodLabel(mood: MomMood) {
  return ({ calm: '😐 평온', suspicious: '🤨 의심', chase: '😠 추격', search: '🔎 탐색', extreme: '🔥 극대노' } as const)[mood];
}
function formatTime(value: number) {
  const min = Math.floor(value / 60).toString().padStart(2, '0');
  const sec = Math.floor(value % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
}

function familyTitle(accidents: number, closeCalls: number, maxCombo: number, decoysUsed: number, missionDone: boolean, elapsed: number) {
  if (maxCombo >= 6) return '전설의 연속 장난왕';
  if (decoysUsed >= 3) return '양말 미끼 작전 사령관';
  if (closeCalls >= 5) return '엄마 레이더 회피왕';
  if (accidents >= 10) return '우리 집 사고 제조기';
  if (missionDone) return '오늘의 비밀 미션 요원';
  if (elapsed >= 120) return '거실 마라톤 국가대표';
  return '발 빠른 집안 탐험가';
}

export function GameCanvas({ highScore, initialPhase, playerOutfit, onGameOver, onOpenHow, onOpenCharacters, onOpenCollection }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef({ moveX: 0, moveY: 0, dash: false, interact: false });
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);
  const joystickPointerRef = useRef<number | null>(null);
  const joystickBoundsRef = useRef<{ centerX: number; centerY: number; maxTravel: number } | null>(null);
  const soundRef = useRef(true);
  const phaseRef = useRef<GamePhase>(initialPhase);
  const familyTaskCommandRef = useRef<FamilyTaskCommand | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [phase, setPhase] = useState<GamePhase>(initialPhase);
  const [hud, setHud] = useState(INITIAL_HUD);
  const [nearbyFamily, setNearbyFamily] = useState<NearbyFamily | null>(null);

  const beginChase = () => {
    unlockGameAudio();
    phaseRef.current = 'chase';
    setPhase('chase');
  };

  const requestFamilyTask = (kind: FamilyTaskKind) => {
    if (!nearbyFamily || nearbyFamily.busyLabel) return;
    unlockGameAudio();
    familyTaskCommandRef.current = { role: nearbyFamily.role, kind };
  };

  useEffect(() => {
    soundRef.current = soundOn;
    if (!soundOn) stopNocturne();
  }, [soundOn]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = reducedMotionQuery.matches;
    const onReducedMotionChange = (event: MediaQueryListEvent) => { reducedMotion = event.matches; };
    reducedMotionQuery.addEventListener('change', onReducedMotionChange);

    const bank = new SpriteBank();
    // 집과 가구는 2배 해상도로 한 번만 그린다. 매 프레임 벡터를 다시
    // 그리지 않으면서 확대 화면에서도 벽과 글자가 또렷하게 유지된다.
    const staticMapScale = 2;
    const staticMap = document.createElement('canvas');
    staticMap.width = WORLD.width * staticMapScale;
    staticMap.height = WORLD.height * staticMapScale;
    const staticMapContext = staticMap.getContext('2d');
    if (staticMapContext) {
      staticMapContext.setTransform(staticMapScale, 0, 0, staticMapScale, 0, 0);
      staticMapContext.imageSmoothingEnabled = true;
      staticMapContext.imageSmoothingQuality = 'high';
      drawMap(staticMapContext, 0, false);
    }
    const keys = new Set<string>();
    let pausedDuration = 0;
    let pausedRealAt = 0;
    const clock = () => performance.now() / 1000 - pausedDuration;
    const bootAt = clock();
    let gameStartedAt: number | null = null;
    const player: Actor & { dashUntil: number; dashCooldownUntil: number; speedUntil: number; hiddenUntil: number; invulnerableUntil: number } = {
      x: LANDMARKS.playerSpawn.x, y: LANDMARKS.playerSpawn.y, r: 19, moving: false, facing: 1, dashUntil: 0, dashCooldownUntil: 0, speedUntil: 0, hiddenUntil: 0, invulnerableUntil: 0,
    };
    const mom: Mom = {
      x: FAMILY_WAKE_POSITIONS.mom.x, y: FAMILY_WAKE_POSITIONS.mom.y, r: 23, moving: false, facing: -1, active: false, mood: 'calm', path: [], pathAt: 0,
      chaseAt: Infinity, stunnedUntil: 0, distractedUntil: 0, extremeUntil: 0, lostUntil: 0,
      lastSeen: { x: player.x, y: player.y }, nextLoseCheck: Infinity,
    };
    const brother: Npc = {
      ...FAMILY_WAKE_POSITIONS.brother, r: 22, moving: false, facing: -1, kind: 'brother', path: [], pathAt: 0,
      targetAt: 0, good: true, collected: true, line: '', bumpCooldownUntil: 0,
    };
    const dad: Npc = {
      ...FAMILY_WAKE_POSITIONS.dad, r: 21, moving: false, facing: 1, kind: 'dad', path: [], pathAt: 0,
      targetAt: 0, good: true, collected: true, line: '', bumpCooldownUntil: 0,
    };
    const interactions: Interaction[] = INTERACTION_TEMPLATES.map((item) => ({ ...item, lastUsed: -999 }));
    const missionSeed = pick(MISSIONS);
    const mission: Mission = { ...missionSeed, progress: 0, done: false };
    const counters: Counters = { snacks: 0, brotherMess: 0, closeCall: 0, dad: 0 };
    let score = 0;
    let accidents = 0;
    let rage = 0;
    let health: number = HEALTH_RULES.max;
    let safeSince: number | null = null;
    let passiveRecoveryActive = false;
    let nextBrother = Infinity;
    let nextDad = Infinity;
    let nextMomLine = Infinity;
    let lastFrame = bootAt;
    let lastHud = 0;
    let introDone = false;
    let running = true;
    let resultSent = false;
    let caughtAt = 0;
    let nearMom = false;
    let helpUntil = 0;
    let itemText = '';
    let itemTextUntil = 0;
    let alertText = '';
    let alertUntil = 0;
    let shakeUntil = 0;
    let shakePower = 0;
    let blockedHintUntil = 0;
    let nextBumpEffect = 0;
    let playerOnSofa = false;
    let playerNearPiano = false;
    let nearbyRestingRole: 'mom' | 'brother' | 'dad' | null = null;
    const awakeInExplore: Record<FamilyRole, boolean> = { mom: false, brother: false, dad: false };
    const familyTasks: Record<FamilyRole, FamilyTaskState | null> = { mom: null, brother: null, dad: null };
    const doorStates = new Map<string, DoorState>(CLOSABLE_DOORS.map((door) => [door.id, { id: door.id, closedUntil: 0 }]));
    let houseEvent: HouseEventState | null = null;
    let nextHouseEvent = Infinity;
    let comboCount = 0;
    let comboUntil = 0;
    let maxCombo = 0;
    let decoyCharges = 0;
    let decoysUsed = 0;
    let footprintDecoy: FootprintDecoy | null = null;
    let nearbyFamilyKey = '';
    let bubbles: Bubble[] = [];
    let effects: Effect[] = [];
    let resize = { width: stage.clientWidth, height: stage.clientHeight, dpr: 1, desiredDpr: 1, minDpr: 1 };
    let qualitySampleAt = bootAt;
    let qualityFrames = 0;
    let fastQualitySamples = 0;
    const beep = (kind: GameTone) => playGameTone(kind, soundRef.current);

    const addBubble = (role: Bubble['role'], text: string, now: number, duration = 2.4) => {
      bubbles = bubbles.filter((b) => b.role !== role);
      bubbles.push({ role, text, until: now + duration });
    };
    const addEffect = (x: number, y: number, text: string, color: string, now: number, duration = 1.1) => {
      effects.push({ x, y, text, color, born: now, until: now + duration });
      if (effects.length > 36) effects.splice(0, effects.length - 36);
    };
    const makeAngry = (amount: number, now: number) => {
      rage = clamp(rage + amount, 0, 100);
      if (rage >= 100) {
        mom.extremeUntil = Math.max(mom.extremeUntil, now + 6);
        alertText = '엄마 극대노 모드!'; alertUntil = now + 1.8; shakeUntil = now + .55; shakePower = 10;
      }
    };

    const closedDoorAt = (point: Point, radius: number, now: number) => CLOSABLE_DOORS.find((door) => {
      const state = doorStates.get(door.id);
      return Boolean(state && state.closedUntil > now && circleHitsRect(point.x, point.y, radius, door));
    });
    const closestDoor = () => CLOSABLE_DOORS
      .map((door) => ({ door, gap: distance(player, { x: door.x + door.w / 2, y: door.y + door.h / 2 }) }))
      .filter(({ gap }) => gap < 82)
      .sort((a, b) => a.gap - b.gap)[0]?.door;
    const toggleNearbyDoor = (now: number) => {
      const door = closestDoor();
      if (!door) return false;
      const state = doorStates.get(door.id)!;
      const wasClosed = state.closedUntil > now;
      state.closedUntil = wasClosed ? 0 : now + 4.5;
      if (!wasClosed) { mom.path = []; mom.pathAt = 0; }
      addEffect(door.x + door.w / 2, door.y + door.h / 2, wasClosed ? '벌컥!' : '쾅!', wasClosed ? '#45a996' : '#ef8b45', now, 1);
      itemText = wasClosed ? `🚪 ${door.label}을 열었어요` : `🚪 ${door.label}을 4.5초 동안 닫았어요`;
      itemTextUntil = now + 2.5; beep('item');
      return true;
    };

    const updateMission = (now: number) => {
      if (mission.done || gameStartedAt === null) return;
      const elapsed = now - gameStartedAt;
      mission.progress = mission.kind === 'survive' ? Math.min(mission.target, Math.floor(elapsed)) : Math.min(mission.target, counters[mission.kind]);
      if (mission.progress >= mission.target) {
        mission.done = true; score += 1500; alertText = '미션 완료! +1,500'; alertUntil = now + 2.2;
        addEffect(player.x, player.y - 20, 'MISSION!', '#ffd84d', now, 1.6); beep('nice');
      }
    };

    const triggerIntro = (now: number) => {
      introDone = true; rage = 20; alertText = '엄마가 눈치챘다!'; alertUntil = now + 2.3; shakeUntil = now + .65; shakePower = 12;
      addEffect(LANDMARKS.introAccident.x, LANDMARKS.introAccident.y, '와장창!', '#ed5b45', now, 1.5); addBubble('player', '큰일났다.', now);
      beep('alert');
    };

    const doInteraction = (now: number) => {
      if (phaseRef.current !== 'chase') return;
      if (toggleNearbyDoor(now)) return;
      const available = interactions
        .filter((i) => distance(player, i) < 78 && !i.used && now - i.lastUsed >= i.cooldown)
        .sort((a, b) => distance(player, a) - distance(player, b))[0];
      if (!available) return;
      if (available.heal) {
        if (health >= HEALTH_RULES.max) {
          itemText = '💚 체력이 이미 가득해요!'; itemTextUntil = now + 2.2; return;
        }
        available.lastUsed = now;
        const before = health;
        health = restoreHealth(health, available.heal);
        const healed = Math.ceil(health - before);
        itemText = `💧 물 마시고 체력 +${healed}`; itemTextUntil = now + 3;
        addEffect(available.x, available.y, available.effect, '#36a878', now, 1.4);
        addBubble('player', '살 것 같다!', now); beep('item'); return;
      }
      available.lastUsed = now;
      if (available.oneShot) available.used = true;
      if (available.hide) {
        player.hiddenUntil = now + 3.8; mom.lastSeen = { x: player.x, y: player.y };
        mom.lostUntil = Math.max(mom.lostUntil, now + 3.8); addEffect(player.x, player.y, available.effect, '#5d76bf', now);
        addBubble('player', '숨만 잘 쉬자…', now); return;
      }
      comboCount = now <= comboUntil ? comboCount + 1 : 1;
      comboUntil = now + 7;
      maxCombo = Math.max(maxCombo, comboCount);
      const comboMultiplier = Math.min(3, 1 + (comboCount - 1) * .5);
      const comboPoints = Math.round(available.points * comboMultiplier);
      score += comboPoints; accidents += 1; makeAngry(available.rage, now);
      if (available.metric) counters[available.metric] += 1;
      addEffect(available.x, available.y, available.effect, '#ed5b45', now, 1.4);
      if (comboCount >= 2) addEffect(player.x, player.y - 42, `${comboCount} COMBO ×${comboMultiplier.toFixed(1)}`, '#ffb72d', now, 1.25);
      if (comboCount % 3 === 0 && decoyCharges < 2) {
        decoyCharges += 1;
        itemText = '🧦 가짜 발자국 미끼 충전! 다음 대시에 자동 설치'; itemTextUntil = now + 3.2;
        addEffect(player.x, player.y - 66, '미끼 +1', '#7556b5', now, 1.35);
      }
      addBubble('player', pick(LINES.player), now); shakeUntil = now + .28; shakePower = 5; beep('alert');
      if (!mom.active && mom.chaseAt > now + 1.6) mom.chaseAt = now + 1.6;
      updateMission(now);
    };

    const tryDash = (now: number) => {
      if (now < player.dashCooldownUntil || player.hiddenUntil > now) return;
      player.dashUntil = now + .2; player.dashCooldownUntil = now + 1.35; beep('dash');
      if (decoyCharges > 0 && mom.active) {
        decoyCharges -= 1; decoysUsed += 1;
        footprintDecoy = { x: player.x, y: player.y, until: now + 4.2 };
        mom.path = []; mom.pathAt = 0;
        addEffect(player.x, player.y, '가짜 발자국!', '#7556b5', now, 1.25);
        itemText = '👣 엄마가 가짜 발자국을 따라가는 중!'; itemTextUntil = now + 2.6;
      }
      if (mom.active && distance(player, mom) < 112 && distance(player, mom) > 40) {
        score += 250; counters.closeCall += 1; addEffect(player.x, player.y, 'NICE!', '#ffdc4f', now, 1.2); beep('nice'); updateMission(now);
      }
    };

    const triggerBrother = (now: number) => {
      const good = Math.random() < .57;
      brother.good = good;
      brother.line = pick(good ? LINES.brotherGood : LINES.brotherBad);
      addBubble('brother', brother.line, now, 3.5);
      if (good) helpUntil = now + 7;
      else { mom.lostUntil = 0; mom.lastSeen = { x: player.x, y: player.y }; mom.pathAt = 0; makeAngry(7, now); }
      nextBrother = now + 18 + Math.random() * 9;
    };

    const offerDadItem = (now: number) => {
      dad.collected = false;
      dad.line = pick(LINES.dad);
      addBubble('dad', `${dad.line} 이리 와!`, now, 3.5);
      nextDad = now + 23 + Math.random() * 10;
    };

    const grantDadItem = (now: number) => {
      if (dad.collected) return;
      dad.collected = true; counters.dad += 1; score += 150;
      const juice = ITEMS.find((item) => item.id === 'juice')!;
      const regularItems = ITEMS.filter((item) => item.id !== 'juice');
      const item = HEALTH_RULES.max - health >= 1 && Math.random() < .45 ? juice : pick(regularItems);
      itemText = `${item.icon} ${item.name} — ${item.text}`; itemTextUntil = now + 4;
      if (item.id === 'shoes') player.speedUntil = now + 5;
      if (item.id === 'snack') score += 500;
      if (item.id === 'juice') {
        const before = health;
        health = restoreHealth(health, HEALTH_RULES.dadHeal);
        const healed = Math.ceil(health - before);
        itemText = `🧃 아빠표 비타민 주스 — 체력 +${healed}`;
      }
      if (item.id === 'lock') mom.stunnedUntil = Math.max(mom.stunnedUntil, now + 2.2);
      if (item.id === 'remote') { mom.distractedUntil = now + 4.2; mom.pathAt = 0; }
      if (item.id === 'dadChance') mom.stunnedUntil = Math.max(mom.stunnedUntil, now + 3);
      addEffect(dad.x, dad.y, item.icon, '#fff36d', now, 1.3); addBubble('dad', '빨리 가!', now); beep('item'); updateMission(now);
    };

    const rememberHouseEvent = (kind: HouseEventKind) => {
      try {
        const saved = JSON.parse(localStorage.getItem('mom-is-coming-events') ?? '[]') as HouseEventKind[];
        if (!saved.includes(kind)) localStorage.setItem('mom-is-coming-events', JSON.stringify([...saved, kind]));
      } catch { /* 도감 저장이 막혀도 게임은 계속 진행한다. */ }
    };
    const triggerHouseEvent = (kind: HouseEventKind, now: number) => {
      const definition = HOUSE_EVENTS[kind];
      houseEvent = { kind, startedAt: now, until: now + definition.duration };
      nextHouseEvent = houseEvent.until + 18 + Math.random() * 10;
      rememberHouseEvent(kind);
      alertText = `${definition.icon} ${definition.title}`; alertUntil = now + 2.2;
      itemText = `랜덤 집안 사건 · ${definition.title}`; itemTextUntil = now + 3;
      if (kind === 'doorbell') {
        mom.distractedUntil = Math.max(mom.distractedUntil, now + 5.5); mom.pathAt = 0;
        addBubble('mom', '누구세요?', now, 2.8);
      } else if (kind === 'blackout') {
        mom.lostUntil = Math.max(mom.lostUntil, now + 5.5); mom.pathAt = 0;
        addBubble('player', '불이 꺼졌다! 살금살금…', now, 2.8);
      } else if (kind === 'crumbs') {
        makeAngry(6, now); addBubble('brother', '어라? 과자가 쏟아졌네 ㅋㅋ', now, 3);
      } else if (kind === 'remote') {
        dad.collected = false; nextDad = now + 7;
        addBubble('dad', '리모컨이 어디 갔지?', now, 3);
      } else if (kind === 'turtles') {
        addBubble('player', '거북이 두 마리가 탈출했다!', now, 3);
      } else {
        addBubble('dad', '로봇청소기 지나간다!', now, 2.6);
      }
      beep('alert');
    };

    const handleFamilyBump = (family: Npc, now: number) => {
      if (now < family.bumpCooldownUntil) return;
      family.bumpCooldownUntil = now + 1.3;
      addEffect((player.x + family.x) / 2, (player.y + family.y) / 2, '쿵!', '#f29b54', now, .8);
      addBubble(family.kind, family.kind === 'brother' ? '앞 좀 봐! ㅋㅋ' : '어이쿠, 조심!', now, 1.8);
      addBubble('player', '앗, 부딪혔다!', now, 1.6);
      beep('alert');
    };

    const moveRoamingNpc = (family: Npc, other: Npc, speed: number, now: number, dt: number) => {
      if (now >= family.targetAt || family.path.length === 0) {
        const candidates = NPC_SPOTS.filter((point) => distance(point, family) > 160);
        const target = pick(candidates.length ? candidates : NPC_SPOTS);
        family.path = findPath(family, target, family.r + 3);
        family.targetAt = now + 6 + Math.random() * 4;
      }
      family.moving = false;
      if (!family.path.length) return;
      let waypoint = family.path[0];
      if (distance(family, waypoint) < 20) {
        family.path.shift();
        waypoint = family.path[0];
      }
      if (!waypoint) return;
      const vx = waypoint.x - family.x;
      const vy = waypoint.y - family.y;
      const length = Math.hypot(vx, vy) || 1;
      const before = { x: family.x, y: family.y };
      if (vx < -.1) family.facing = -1;
      else if (vx > .1) family.facing = 1;
      const movement = moveCircle(family, vx / length * speed * dt, vy / length * speed * dt, family.r);
      family.moving = movement.moved;
      const hitPlayer = distance(family, player) < family.r + player.r + 3;
      const hitOther = distance(family, other) < family.r + other.r + 3;
      if (hitPlayer || hitOther) {
        family.x = before.x; family.y = before.y; family.moving = false;
        family.path = []; family.targetAt = now + .7;
        if (hitPlayer) handleFamilyBump(family, now);
      }
    };

    const actorFor = (role: FamilyRole): Mom | Npc => role === 'mom' ? mom : role === 'brother' ? brother : dad;

    const startFamilyTask = (command: FamilyTaskCommand, now: number) => {
      const actor = actorFor(command.role);
      const task = FAMILY_TASKS[command.kind];
      if (phaseRef.current === 'explore' && !awakeInExplore[command.role]) {
        const wake = FAMILY_WAKE_POSITIONS[command.role];
        actor.x = wake.x; actor.y = wake.y;
        awakeInExplore[command.role] = true;
      }
      actor.path = findPath(actor, FAMILY_TASK_TARGETS[command.kind], actor.r + 3);
      actor.moving = false;
      familyTasks[command.role] = { kind: command.kind, phase: 'walking', workUntil: 0, nextEffectAt: 0, repathAt: now + 1.2 };
      if (command.role === 'mom') {
        mom.active = gameStartedAt !== null;
        mom.mood = 'calm'; mom.pathAt = Infinity;
      } else if ('targetAt' in actor) {
        actor.targetAt = Infinity;
      }
      const replies: Record<FamilyRole, string> = {
        mom: `알았어, ${task.label} 하고 올게.`,
        dad: `아빠에게 맡겨! ${task.label} 시작!`,
        brother: `내가? 알겠어, ${task.label}!`,
      };
      addBubble(command.role, replies[command.role], now, 3);
      addEffect(actor.x, actor.y - 20, `${task.icon} 출발!`, '#45a996', now, 1.2);
      itemText = `${FAMILY_NAMES[command.role]}에게 ${task.label} 부탁 완료`; itemTextUntil = now + 2.5;
      beep('item');
    };

    const updateFamilyTask = (role: FamilyRole, now: number, dt: number) => {
      const activeTask = familyTasks[role];
      if (!activeTask) return false;
      const actor = actorFor(role);
      const task = FAMILY_TASKS[activeTask.kind];
      const target = FAMILY_TASK_TARGETS[activeTask.kind];

      if (activeTask.phase === 'walking') {
        if (distance(actor, target) < 34) {
          activeTask.phase = 'working';
          activeTask.workUntil = now + task.duration * (role === 'brother' ? .72 : 1);
          activeTask.nextEffectAt = now;
          actor.path = []; actor.moving = false;
          addBubble(role, `${task.label} 하는 중!`, now, 2.2);
        } else {
          if (now >= activeTask.repathAt || actor.path.length === 0) {
            actor.path = findPath(actor, target, actor.r + 3);
            activeTask.repathAt = now + 1.2;
          }
          actor.moving = false;
          let waypoint = actor.path[0];
          if (waypoint && distance(actor, waypoint) < 20) { actor.path.shift(); waypoint = actor.path[0]; }
          if (waypoint) {
            const vx = waypoint.x - actor.x; const vy = waypoint.y - actor.y;
            const length = Math.hypot(vx, vy) || 1;
            if (vx < -.1) actor.facing = -1;
            else if (vx > .1) actor.facing = 1;
            const taskSpeed = role === 'brother' ? 112 : role === 'mom' ? 105 : 96;
            actor.moving = moveCircle(actor, vx / length * taskSpeed * dt, vy / length * taskSpeed * dt, actor.r).moved;
          }
        }
      } else {
        actor.moving = false;
        if (now >= activeTask.nextEffectAt) {
          activeTask.nextEffectAt = now + .78;
          addEffect(actor.x, actor.y - 24, `${task.icon} ${task.effect}`, activeTask.kind === 'clean' ? '#7556b5' : '#45a996', now, .72);
        }
        if (now >= activeTask.workUntil) {
          familyTasks[role] = null;
          actor.path = [];
          if (role === 'mom') {
            mom.pathAt = 0;
            if (gameStartedAt !== null) { mom.active = true; mom.mood = 'chase'; }
          } else if ('targetAt' in actor) {
            actor.targetAt = now + .8;
          }
          const earnedScore = gameStartedAt !== null;
          if (earnedScore) score += 120;
          if (role === 'mom') {
            rage = clamp(rage - 12, 0, 100);
            itemText = `엄마가 기분이 풀렸다 · 분노도 -12`;
          } else if (role === 'dad') {
            const beforeHealth = health;
            health = restoreHealth(health, 18);
            itemText = `아빠의 비타민 주스 · 체력 +${Math.ceil(health - beforeHealth)}`;
          } else {
            player.speedUntil = Math.max(player.speedUntil, now + 4);
            if (Math.random() < .25) { makeAngry(4, now); itemText = '형이 빨리 끝냈지만 또 장난쳤다!'; }
            else itemText = '형의 지름길 힌트 · 4초 스피드 UP';
          }
          addEffect(actor.x, actor.y - 26, earnedScore ? '완료! +120' : '완료!', '#ef8b45', now, 1.25);
          addBubble(role, `${task.label} 끝!`, now, 2.4);
          itemTextUntil = now + 3.2;
          beep('nice');
        }
      }
      return true;
    };

    const endGame = (now: number) => {
      if (!running || gameStartedAt === null) return;
      running = false; stopNocturne(); caughtAt = now; beep('caught'); alertText = '엄마에게 잡혔다!'; alertUntil = now + 2;
      if (!resultSent) {
        resultSent = true;
        const elapsed = now - gameStartedAt;
        onGameOver({
          score: Math.floor(score), elapsed, accidents, closeCalls: counters.closeCall, missionDone: mission.done,
          maxCombo, decoysUsed, familyTitle: familyTitle(accidents, counters.closeCall, maxCombo, decoysUsed, mission.done, elapsed),
        });
      }
    };

    const hitPlayer = (now: number) => {
      if (!running || gameStartedAt === null || player.invulnerableUntil > now) return;
      health = takeDamage(health);
      safeSince = null; passiveRecoveryActive = false; nearMom = false;
      setHud((current) => ({ ...current, health: Math.floor(health), recoveryLabel: health > 0 ? '엄마와 거리를 벌리면 회복' : '체력 소진', recovering: false }));
      if (health <= 0) { endGame(now); return; }

      player.invulnerableUntil = now + HEALTH_RULES.invulnerabilitySeconds;
      player.speedUntil = Math.max(player.speedUntil, now + 1.1);
      mom.stunnedUntil = Math.max(mom.stunnedUntil, now + HEALTH_RULES.momStunSeconds);
      mom.path = []; mom.pathAt = now + .25;
      let vx = player.x - mom.x;
      let vy = player.y - mom.y;
      let length = Math.hypot(vx, vy);
      if (length < .001) { vx = player.facing; vy = 0; length = 1; }
      const step = 8;
      for (let moved = 0; moved < HEALTH_RULES.knockbackDistance; moved += step) {
        moveCircle(player, vx / length * step, vy / length * step, player.r, PLAYER_MOVE_OPTIONS);
      }
      alertText = `앗! 체력 ${Math.floor(health)}/${HEALTH_RULES.max}`; alertUntil = now + 1.5;
      itemText = `💔 체력 -${HEALTH_RULES.hitDamage} · 남은 체력 ${Math.floor(health)}/${HEALTH_RULES.max} · 잠깐 무적!`; itemTextUntil = now + 3;
      shakeUntil = now + .42; shakePower = 9;
      addEffect(player.x, player.y, `-${HEALTH_RULES.hitDamage}`, '#ef5b5b', now, 1.2);
      addBubble('player', '아직 안 끝났어!', now); beep('hurt');
    };

    const applyCanvasDpr = (nextDpr: number) => {
      resize.dpr = nextDpr;
      canvas.width = Math.floor(resize.width * resize.dpr);
      canvas.height = Math.floor(resize.height * resize.dpr);
      canvas.style.width = `${resize.width}px`;
      canvas.style.height = `${resize.height}px`;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    };
    const resizeCanvas = () => {
      const box = stage.getBoundingClientRect();
      const width = Math.max(1, box.width);
      const height = Math.max(1, box.height);
      const mobile = width <= 980 || window.matchMedia('(pointer: coarse)').matches;
      // Phones target 2.5x and standard PC monitors use mild supersampling. The pixel
      // budget prevents a large tablet or 4K monitor from allocating an oversized canvas.
      const pixelBudget = mobile ? 3_000_000 : 5_500_000;
      const budgetDpr = Math.sqrt(pixelBudget / (width * height));
      const preferredDpr = mobile
        ? Math.max(devicePixelRatio || 1, 2.25)
        : Math.max(devicePixelRatio || 1, 1.5);
      const desiredDpr = Math.max(1, Math.min(2.5, preferredDpr, budgetDpr));
      const minDpr = Math.min(desiredDpr, mobile ? 1.5 : 1.25);
      resize = { width, height, dpr: desiredDpr, desiredDpr, minDpr };
      applyCanvasDpr(desiredDpr);
      qualitySampleAt = clock(); qualityFrames = 0; fastQualitySamples = 0;
    };
    const adaptRenderQuality = (now: number) => {
      qualityFrames += 1;
      const sampleSeconds = now - qualitySampleAt;
      if (sampleSeconds < 1.5) return;
      const fps = qualityFrames / sampleSeconds;
      if (fps < 49 && resize.dpr > resize.minDpr + .01) {
        applyCanvasDpr(Math.max(resize.minDpr, resize.dpr - .25));
        fastQualitySamples = 0;
      } else if (fps > 57 && resize.dpr < resize.desiredDpr - .01) {
        fastQualitySamples += 1;
        if (fastQualitySamples >= 2) {
          applyCanvasDpr(Math.min(resize.desiredDpr, resize.dpr + .125));
          fastQualitySamples = 0;
        }
      } else {
        fastQualitySamples = 0;
      }
      qualitySampleAt = now;
      qualityFrames = 0;
    };
    const observer = new ResizeObserver(resizeCanvas); observer.observe(stage); resizeCanvas();
    window.visualViewport?.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', resizeCanvas);

    const onKeyDown = (event: KeyboardEvent) => {
      const code = event.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE'].includes(code)) event.preventDefault();
      unlockGameAudio();
      keys.add(code);
      const now = clock();
      if (code === 'Space' && !event.repeat) tryDash(now);
      if (code === 'KeyE' && !event.repeat) doInteraction(now);
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
    const preventTouchScroll = (event: TouchEvent) => event.preventDefault();
    const preventContextMenu = (event: MouseEvent) => event.preventDefault();
    const releaseTouch = () => {
      joystickPointerRef.current = null;
      joystickBoundsRef.current = null;
      touchRef.current.moveX = 0; touchRef.current.moveY = 0;
      if (joystickKnobRef.current) joystickKnobRef.current.style.transform = 'translate3d(0,0,0)';
    };
    window.addEventListener('keydown', onKeyDown, { passive: false }); window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseTouch);
    window.addEventListener('pagehide', releaseTouch);
    stage.addEventListener('touchmove', preventTouchScroll, { passive: false });
    stage.addEventListener('contextmenu', preventContextMenu);
    const onVisibilityChange = () => {
      const realNow = performance.now() / 1000;
      if (document.hidden) {
        pausedRealAt ||= realNow;
        stopNocturne();
        keys.clear(); releaseTouch();
      } else if (pausedRealAt) {
        pausedDuration += realNow - pausedRealAt;
        pausedRealAt = 0;
        lastFrame = clock();
        unlockGameAudio(); resizeCanvas();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    let animation = 0;
    const frame = (stamp: number) => {
      const now = stamp / 1000 - pausedDuration;
      const dt = Math.min(.033, Math.max(0, now - lastFrame)); lastFrame = now;

      if (running && phaseRef.current === 'chase' && gameStartedAt === null) {
        gameStartedAt = now;
        for (const role of ['mom', 'brother', 'dad'] as const) {
          awakeInExplore[role] = true;
          familyTasks[role] = null;
        }
        mom.x = FAMILY_WAKE_POSITIONS.mom.x; mom.y = FAMILY_WAKE_POSITIONS.mom.y; mom.mood = 'suspicious';
        brother.x = FAMILY_WAKE_POSITIONS.brother.x; brother.y = FAMILY_WAKE_POSITIONS.brother.y; brother.targetAt = now;
        dad.x = FAMILY_WAKE_POSITIONS.dad.x; dad.y = FAMILY_WAKE_POSITIONS.dad.y; dad.targetAt = now;
        mom.chaseAt = now + 4.2;
        mom.nextLoseCheck = now + 10;
        nextBrother = now + 10;
        nextDad = now + 9;
        nextMomLine = now + 8;
        nextHouseEvent = now + 12 + Math.random() * 7;
        player.dashUntil = 0;
        player.dashCooldownUntil = 0;
        bubbles = [];
        effects = [];
        alertText = '게임 시작!';
        alertUntil = now + 1.2;
        addBubble('player', '좋아, 시작이다!', now, 1.8);
        beep('nice');
      }
      const isChase = gameStartedAt !== null;
      const elapsed = gameStartedAt === null ? 0 : now - gameStartedAt;

      if (running) {
        if (isChase && !introDone && elapsed > 1.6) triggerIntro(now);
        if (isChase && !mom.active && now >= mom.chaseAt) {
          mom.active = true; mom.mood = 'chase'; alertText = '엄마가 온다!'; alertUntil = now + 2; shakeUntil = now + .8; shakePower = 14;
          addBubble('mom', '너 거기 안 서?!', now, 3); beep('alert');
        }

        const touch = touchRef.current;
        let dx = Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft')) + touch.moveX;
        let dy = Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp')) + touch.moveY;
        if (touch.dash) { touch.dash = false; tryDash(now); }
        if (touch.interact) { touch.interact = false; doInteraction(now); }
        const length = Math.hypot(dx, dy);
        if (length > 1) { dx /= length; dy /= length; }
        const wantsMove = length > .02 && player.hiddenUntil <= now;
        if (dx < -.1) player.facing = -1;
        else if (dx > .1) player.facing = 1;
        player.moving = false;
        const playerBeforeMove = { x: player.x, y: player.y };
        const sofaBoostAtFrameStart = pointInRect(player, LIVING_SOFA);
        const baseSpeed = player.dashUntil > now ? 470 : (player.speedUntil > now ? 275 : 205);
        const speed = baseSpeed * (sofaBoostAtFrameStart ? SOFA_SPEED_MULTIPLIER : 1);
        if (player.hiddenUntil <= now) {
          const movement = moveCircle(player, dx * speed * dt, dy * speed * dt, player.r, PLAYER_MOVE_OPTIONS);
          player.moving = wantsMove && movement.moved;
          const blockedByDoor = closedDoorAt(player, player.r, now);
          if (blockedByDoor) {
            player.x = playerBeforeMove.x; player.y = playerBeforeMove.y; player.moving = false;
          }
          if (wantsMove && ((movement.blocked && !movement.moved) || blockedByDoor) && now >= nextBumpEffect) {
            nextBumpEffect = now + .75;
            blockedHintUntil = now + 1.25;
            addEffect(player.x + dx * 25, player.y + dy * 25, blockedByDoor ? '문이 닫혔다!' : '툭!', '#6d5142', now, .55);
          }
        }
        if (isChase) {
          const bumpedFamily = [brother, dad].find((family) => distance(player, family) < player.r + family.r + 3);
          if (bumpedFamily) {
            player.x = playerBeforeMove.x; player.y = playerBeforeMove.y; player.moving = false;
            handleFamilyBump(bumpedFamily, now);
          }
        }
        const nowOnSofa = pointInRect(player, LIVING_SOFA);
        if (nowOnSofa && !playerOnSofa) {
          itemText = '🛋️ 소파 위 스피드 UP!'; itemTextUntil = now + 2.2;
          addEffect(player.x, player.y - 18, 'SPEED UP!', '#45b9a8', now, 1.15);
          beep('nice');
        }
        playerOnSofa = nowOnSofa;

        const pianoCenter = { x: LIVING_PIANO.x + LIVING_PIANO.w / 2, y: LIVING_PIANO.y + LIVING_PIANO.h / 2 };
        const nowNearPiano = distance(player, pianoCenter) < 135;
        if (nowNearPiano && !playerNearPiano) {
          addEffect(pianoCenter.x, pianoCenter.y - 20, '♪ 녹턴 ♪', '#7556b5', now, 1.6);
        }
        if (nowNearPiano && soundRef.current) startNocturne(true);
        else stopNocturne();
        playerNearPiano = nowNearPiano;

        const pendingTask = familyTaskCommandRef.current;
        if (pendingTask) {
          familyTaskCommandRef.current = null;
          if (!familyTasks[pendingTask.role]) startFamilyTask(pendingTask, now);
        }
        const momTasking = updateFamilyTask('mom', now, dt);
        const brotherTasking = updateFamilyTask('brother', now, dt);
        const dadTasking = updateFamilyTask('dad', now, dt);

        if (!isChase) {
          const restingFamily = [
            { role: 'mom' as const, point: FAMILY_RESTING_POSITIONS.mom, line: '저리 가…' },
            { role: 'dad' as const, point: FAMILY_RESTING_POSITIONS.dad, line: '아빠가 지켜줄게.' },
            { role: 'brother' as const, point: FAMILY_RESTING_POSITIONS.brother, line: '응양응양…' },
          ];
          const closest = restingFamily
            .filter((family) => !awakeInExplore[family.role])
            .filter((family) => distance(player, family.point) < 110)
            .sort((a, b) => distance(player, a.point) - distance(player, b.point))[0];
          if (closest && closest.role !== nearbyRestingRole) {
            nearbyRestingRole = closest.role;
            addBubble(closest.role, closest.line, now, 2.8);
          } else if (!closest) {
            nearbyRestingRole = null;
          }
        }

        if (isChase && mom.active && !momTasking) {
          if (now > mom.nextLoseCheck) {
            mom.nextLoseCheck = now + 5 + Math.random() * 3;
            if (distance(player, mom) > 360 && rage < 76 && player.hiddenUntil <= now && Math.random() < .36) {
              mom.lostUntil = now + 2.8; mom.lastSeen = { x: player.x, y: player.y }; mom.pathAt = 0;
            }
          }
          let target: Point;
          if (houseEvent?.kind === 'doorbell' && houseEvent.until > now) target = LANDMARKS.entrance;
          else if (mom.distractedUntil > now) target = LANDMARKS.tv;
          else if (footprintDecoy && footprintDecoy.until > now) target = footprintDecoy;
          else if (player.hiddenUntil > now || mom.lostUntil > now) target = mom.lastSeen;
          else { target = player; mom.lastSeen = { x: player.x, y: player.y }; }

          mom.mood = mom.extremeUntil > now ? 'extreme' : (mom.stunnedUntil > now || mom.lostUntil > now || player.hiddenUntil > now ? 'search' : 'chase');
          if (now >= mom.pathAt) {
            mom.path = findPath(mom, target, mom.r + 3);
            mom.pathAt = now + (resize.width <= 980 ? .7 : .5);
          }
          mom.moving = false;
          if (now >= mom.stunnedUntil && mom.path.length) {
            let waypoint = mom.path[0];
            if (distance(mom, waypoint) < 22) { mom.path.shift(); waypoint = mom.path[0] ?? target; }
            const vx = waypoint.x - mom.x; const vy = waypoint.y - mom.y; const vlen = Math.hypot(vx, vy) || 1;
            const momSpeed = 142 + elapsed * .52 + rage * .48 + (mom.extremeUntil > now ? 88 : 0);
            if (vx < -.1) mom.facing = -1;
            else if (vx > .1) mom.facing = 1;
            const beforeMomMove = { x: mom.x, y: mom.y };
            mom.moving = moveCircle(mom, vx / vlen * momSpeed * dt, vy / vlen * momSpeed * dt, mom.r).moved;
            if (closedDoorAt(mom, mom.r, now)) {
              mom.x = beforeMomMove.x; mom.y = beforeMomMove.y; mom.moving = false;
            }
          }
          if (footprintDecoy && footprintDecoy.until > now && distance(mom, footprintDecoy) < 40) {
            const fooledAt = footprintDecoy;
            footprintDecoy = null; mom.lostUntil = Math.max(mom.lostUntil, now + 1.8); mom.path = []; mom.pathAt = 0;
            addEffect(fooledAt.x, fooledAt.y, '엄마가 속았다!', '#7556b5', now, 1.4); addBubble('mom', '어라? 발자국만 있네?', now, 2.5); beep('nice');
          }
          const gap = distance(player, mom);
          if (gap < 96) nearMom = true;
          if (nearMom && gap > 145) { nearMom = false; score += 180; counters.closeCall += 1; addEffect(player.x, player.y, 'NICE!', '#ffdc4f', now); updateMission(now); }
          if (gap < player.r + mom.r + 4 && player.hiddenUntil <= now && mom.stunnedUntil <= now && player.invulnerableUntil <= now) hitPlayer(now);
          if (now > nextMomLine) { addBubble('mom', pick(LINES.mom), now); nextMomLine = now + 5 + Math.random() * 3; }
        }

        if (isChase) {
          if (comboCount > 0 && now > comboUntil) comboCount = 0;
          if (footprintDecoy && now > footprintDecoy.until) footprintDecoy = null;
          if (houseEvent && now >= houseEvent.until) houseEvent = null;
          if (!houseEvent && now >= nextHouseEvent) triggerHouseEvent(pick(HOUSE_EVENT_KINDS), now);
          if (!brotherTasking) moveRoamingNpc(brother, dad, 108, now, dt);
          if (!dadTasking) moveRoamingNpc(dad, brother, 92, now, dt);
          const safeForRecovery = mom.active && distance(player, mom) >= HEALTH_RULES.safeDistance && player.invulnerableUntil <= now;
          if (health < HEALTH_RULES.max && safeForRecovery) {
            safeSince ??= now;
            if (now - safeSince >= HEALTH_RULES.safeDelaySeconds) {
              if (!passiveRecoveryActive) {
                passiveRecoveryActive = true;
                itemText = '💚 안전 회복 시작! 계속 거리를 유지하세요'; itemTextUntil = now + 3; beep('item');
              }
              const before = health;
              health = restoreHealth(health, HEALTH_RULES.passiveRecoveryPerSecond * dt);
              if (before < HEALTH_RULES.max && health >= HEALTH_RULES.max) {
                itemText = '💚 체력 완전 회복!'; itemTextUntil = now + 3; addEffect(player.x, player.y, 'FULL!', '#36a878', now); beep('nice');
                safeSince = null; passiveRecoveryActive = false;
              }
            }
          } else if (health < HEALTH_RULES.max) {
            safeSince = null; passiveRecoveryActive = false;
          } else {
            safeSince = null; passiveRecoveryActive = false;
          }
          if (now > nextBrother) triggerBrother(now);
          if (now > nextDad) {
            if (dad.collected) offerDadItem(now);
            else nextDad = now + 6;
          }
          if (!dad.collected && distance(player, dad) < 80) grantDadItem(now);
          score += dt * 10;
          updateMission(now);
        }
        bubbles = bubbles.filter((bubble) => bubble.until > now);
        effects = effects.filter((effect) => effect.until > now);
      }

      const zoom = clamp(Math.min(resize.width / 930, resize.height / 620), .62, 1.18);
      const viewW = resize.width / zoom; const viewH = resize.height / zoom;
      const rawCameraX = clamp(player.x - viewW / 2, 0, Math.max(0, WORLD.width - viewW));
      const rawCameraY = clamp(player.y - viewH / 2, 0, Math.max(0, WORLD.height - viewH));
      const cameraPixelScale = zoom * resize.dpr;
      const cameraX = Math.round(rawCameraX * cameraPixelScale) / cameraPixelScale;
      const cameraY = Math.round(rawCameraY * cameraPixelScale) / cameraPixelScale;
      const shakeX = shakeUntil > now ? (Math.random() - .5) * shakePower : 0;
      const shakeY = shakeUntil > now ? (Math.random() - .5) * shakePower : 0;
      ctx.setTransform(resize.dpr, 0, 0, resize.dpr, 0, 0); ctx.clearRect(0, 0, resize.width, resize.height);
      ctx.save(); ctx.translate(shakeX, shakeY); ctx.scale(zoom, zoom); ctx.translate(-cameraX, -cameraY);
      if (staticMapContext) ctx.drawImage(staticMap, 0, 0, WORLD.width, WORLD.height);
      else drawMap(ctx, 0, false);
      drawMapAnimations(ctx, now);

      for (const door of CLOSABLE_DOORS) {
        const state = doorStates.get(door.id);
        if (!state || state.closedUntil <= now) continue;
        ctx.save();
        ctx.fillStyle = '#d69a64'; ctx.strokeStyle = '#5b3c2d'; ctx.lineWidth = 4;
        roundedRect(ctx, door.x, door.y, door.w, door.h, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffe17b';
        ctx.beginPath(); ctx.arc(door.x + door.w * .68, door.y + door.h * .55, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      if (houseEvent && houseEvent.until > now) {
        const eventAge = now - houseEvent.startedAt;
        ctx.save();
        if (houseEvent.kind === 'turtles') {
          for (let turtle = 0; turtle < 2; turtle += 1) {
            const turtleX = 348 + turtle * 48 + Math.sin(eventAge * 1.5 + turtle) * 22;
            const turtleY = 560 + turtle * 28 + Math.cos(eventAge * 1.25 + turtle) * 16;
            ctx.fillStyle = '#669e52'; ctx.beginPath(); ctx.ellipse(turtleX, turtleY, 13, 9, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#9fc96f'; ctx.beginPath(); ctx.arc(turtleX + 13, turtleY, 5, 0, Math.PI * 2); ctx.fill();
          }
        } else if (houseEvent.kind === 'vacuum') {
          const vacuumX = 650 + Math.sin(eventAge * 1.7) * 155;
          const vacuumY = 430 + Math.cos(eventAge * 1.2) * 65;
          ctx.fillStyle = '#6d6679'; ctx.strokeStyle = '#392b24'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(vacuumX, vacuumY, 19, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#ff6b55'; ctx.beginPath(); ctx.arc(vacuumX, vacuumY, 4, 0, Math.PI * 2); ctx.fill();
        } else if (houseEvent.kind === 'crumbs') {
          ctx.fillStyle = '#9c6134';
          for (let crumb = 0; crumb < 7; crumb += 1) {
            ctx.beginPath(); ctx.arc(915 + crumb * 13, 515 + (crumb % 3) * 8, 3 + (crumb % 2), 0, Math.PI * 2); ctx.fill();
          }
        } else if (houseEvent.kind === 'doorbell') {
          ctx.strokeStyle = '#ffd548'; ctx.lineWidth = 5; ctx.globalAlpha = .8;
          for (let ring = 0; ring < 2; ring += 1) {
            ctx.beginPath(); ctx.arc(LANDMARKS.entrance.x, LANDMARKS.entrance.y, 24 + ring * 20 + (eventAge * 18) % 18, -.9, .9); ctx.stroke();
          }
        }
        ctx.restore();
      }

      if (footprintDecoy && footprintDecoy.until > now) {
        ctx.save(); ctx.fillStyle = '#7556b5'; ctx.globalAlpha = .64 + Math.sin(now * 7) * .12;
        for (let step = 0; step < 4; step += 1) {
          const side = step % 2 === 0 ? -1 : 1;
          ctx.beginPath();
          ctx.ellipse(footprintDecoy.x + side * 8, footprintDecoy.y + 22 - step * 15, 6, 10, side * .18, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#fff3a8'; ctx.strokeStyle = '#4d386f'; ctx.lineWidth = 2;
        roundedRect(ctx, footprintDecoy.x - 16, footprintDecoy.y - 56, 32, 22, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#4d386f'; ctx.font = '900 15px system-ui'; ctx.textAlign = 'center'; ctx.fillText('🧦', footprintDecoy.x, footprintDecoy.y - 40);
        ctx.restore();
      }

      if (isChase) {
        for (const interaction of interactions) {
          if (interaction.used) continue;
          const ready = now - interaction.lastUsed >= interaction.cooldown;
          if (distance(player, interaction) < 150) drawMarker(ctx, interaction, interaction.label, ready, now);
        }
        const door = closestDoor();
        if (door) {
          const isClosed = doorStates.get(door.id)!.closedUntil > now;
          drawMarker(ctx, { x: door.x + door.w / 2, y: door.y + door.h / 2 }, isClosed ? '문 열기' : '문 닫기', true, now);
        }
      }
      if (helpUntil > now && mom.active) {
        ctx.save(); ctx.strokeStyle = '#ffd945'; ctx.lineWidth = 7; ctx.setLineDash([14, 12]);
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(mom.x, mom.y); ctx.stroke(); ctx.restore();
      }
      if (!isChase) {
        if (!awakeInExplore.mom) drawRestingCharacter(ctx, bank, 'mom', FAMILY_RESTING_POSITIONS.mom.x, FAMILY_RESTING_POSITIONS.mom.y, FAMILY_RESTING_POSITIONS.mom.rotation, now);
        if (awakeInExplore.brother) drawCharacter(ctx, bank, 'brother', brother.x, brother.y, brother.moving, now, 'calm', false, brother.facing, reducedMotion);
        else drawRestingCharacter(ctx, bank, 'brother', FAMILY_RESTING_POSITIONS.brother.x, FAMILY_RESTING_POSITIONS.brother.y, FAMILY_RESTING_POSITIONS.brother.rotation, now);
        if (awakeInExplore.dad) drawCharacter(ctx, bank, 'dad', dad.x, dad.y, dad.moving, now, 'calm', false, dad.facing, reducedMotion);
        else drawRestingCharacter(ctx, bank, 'dad', FAMILY_RESTING_POSITIONS.dad.x, FAMILY_RESTING_POSITIONS.dad.y, FAMILY_RESTING_POSITIONS.dad.rotation, now);
      } else {
        drawCharacter(ctx, bank, 'brother', brother.x, brother.y, brother.moving, now, 'calm', false, brother.facing, reducedMotion);
        drawCharacter(ctx, bank, 'dad', dad.x, dad.y, dad.moving, now, 'calm', false, dad.facing, reducedMotion);
      }
      if (isChase || awakeInExplore.mom) {
        if (isChase && mom.mood === 'extreme') {
          ctx.save(); ctx.strokeStyle = '#ef533f'; ctx.lineWidth = 5;
          for (let i = 0; i < 5; i++) { const a = now * 4 + i * 1.25; ctx.beginPath(); ctx.moveTo(mom.x + Math.cos(a) * 40, mom.y + Math.sin(a) * 35 - 30); ctx.lineTo(mom.x + Math.cos(a) * 58, mom.y + Math.sin(a) * 52 - 35); ctx.stroke(); }
          ctx.restore();
        }
        drawCharacter(ctx, bank, 'mom', mom.x, mom.y, mom.moving, now, mom.mood, false, mom.facing, reducedMotion);
        if (isChase) {
          ctx.fillStyle = '#fffdf4'; ctx.strokeStyle = '#3b2d27'; ctx.lineWidth = 3; roundedRect(ctx, mom.x - 45, mom.y - 125, 90, 25, 12); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#3b2d27'; ctx.font = '900 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText(moodLabel(mom.mood), mom.x, mom.y - 108);
        }
      }
      for (const role of ['mom', 'brother', 'dad'] as const) {
        const taskState = familyTasks[role];
        if (!taskState) continue;
        const actor = actorFor(role);
        const task = FAMILY_TASKS[taskState.kind];
        const label = taskState.phase === 'walking' ? `${task.icon} 이동 중` : `${task.icon} ${task.label} 중`;
        ctx.save(); ctx.fillStyle = '#fff8cf'; ctx.strokeStyle = '#392b24'; ctx.lineWidth = 2;
        roundedRect(ctx, actor.x - 50, actor.y - 112, 100, 24, 11); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#392b24'; ctx.font = '900 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(label, actor.x, actor.y - 96); ctx.restore();
      }
      if (player.invulnerableUntil > now) {
        ctx.save(); ctx.globalAlpha = .55 + Math.sin(now * 16) * .18; ctx.strokeStyle = '#fff06a'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(player.x, player.y - 8, 34, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      if (playerOnSofa && player.moving && !reducedMotion) {
        ctx.save();
        ctx.strokeStyle = '#fff6a8'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        const trailDirection = player.facing > 0 ? -1 : 1;
        for (let trail = 0; trail < 3; trail += 1) {
          const trailY = player.y - 21 + trail * 13;
          ctx.beginPath();
          ctx.moveTo(player.x + trailDirection * (26 + trail * 5), trailY);
          ctx.lineTo(player.x + trailDirection * (48 + trail * 7), trailY);
          ctx.stroke();
        }
        ctx.restore();
      }
      const hitFlash = !reducedMotion && player.invulnerableUntil > now && Math.floor(now * 10) % 2 === 0;
      if (playerOutfit === 'cape') {
        ctx.save(); ctx.globalAlpha = player.hiddenUntil > now || hitFlash ? .42 : 1;
        ctx.translate(player.x, player.y); ctx.scale(player.facing, 1);
        ctx.fillStyle = '#e84f49'; ctx.strokeStyle = '#792f35'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-15, -57); ctx.lineTo(15, -57); ctx.lineTo(24, -7); ctx.lineTo(-25, -13); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      drawCharacter(ctx, bank, 'player', player.x, player.y, player.moving, now, 'calm', player.hiddenUntil > now || hitFlash, player.facing, reducedMotion);
      if (playerOutfit !== 'basic') {
        ctx.save(); ctx.globalAlpha = player.hiddenUntil > now || hitFlash ? .42 : 1;
        ctx.translate(player.x, player.y);
        if (playerOutfit === 'cap') {
          ctx.fillStyle = '#3a8dc4'; ctx.strokeStyle = '#244b6d'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(0, -72, 19, Math.PI, 0); ctx.lineTo(19, -67); ctx.lineTo(-19, -67); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.ellipse(player.facing * 15, -66, 17, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else if (playerOutfit === 'bunny') {
          ctx.fillStyle = '#fffdf6'; ctx.strokeStyle = '#6e5260'; ctx.lineWidth = 3;
          roundedRect(ctx, -19, -104, 13, 34, 7); ctx.fill(); ctx.stroke();
          roundedRect(ctx, 6, -104, 13, 34, 7); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#f3a9bd'; roundedRect(ctx, -15, -98, 5, 22, 3); ctx.fill(); roundedRect(ctx, 10, -98, 5, 22, 3); ctx.fill();
        } else if (playerOutfit === 'cape') {
          ctx.fillStyle = '#ffd94f'; ctx.strokeStyle = '#5e3f2c'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-4, -47); ctx.lineTo(7, -47); ctx.lineTo(0, -36); ctx.lineTo(8, -36); ctx.lineTo(-6, -19); ctx.lineTo(-1, -32); ctx.lineTo(-9, -32); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
      }
      for (const effect of effects) {
        const life = (now - effect.born) / (effect.until - effect.born);
        ctx.save(); ctx.globalAlpha = 1 - life; ctx.translate(effect.x, effect.y - life * 45); ctx.rotate(-.08 + Math.sin(effect.born * 9) * .08);
        ctx.font = `1000 ${effect.text.length <= 2 ? 36 : 30}px system-ui`; ctx.textAlign = 'center'; ctx.lineWidth = 7; ctx.strokeStyle = '#fffdf4'; ctx.strokeText(effect.text, 0, 0); ctx.fillStyle = effect.color; ctx.fillText(effect.text, 0, 0); ctx.restore();
      }
      for (const bubble of bubbles) {
        const at = bubble.role === 'player'
          ? player
          : !isChase
            ? awakeInExplore[bubble.role]
              ? bubble.role === 'mom'
                ? mom
                : bubble.role === 'brother'
                  ? brother
                  : dad
              : FAMILY_RESTING_POSITIONS[bubble.role]
            : bubble.role === 'mom'
              ? mom
              : bubble.role === 'brother'
                ? brother
                : dad;
        if (bubble.role !== 'mom' || mom.active || !isChase) drawSpeech(ctx, at, bubble.text, bubble.role === 'mom' ? '#ffd7d0' : bubble.role === 'dad' ? '#fff0ad' : '#fffdf4');
      }
      ctx.restore();

      if (houseEvent?.kind === 'blackout' && houseEvent.until > now) {
        ctx.fillStyle = 'rgba(15,21,33,.34)'; ctx.fillRect(0, 0, resize.width, resize.height);
      }

      if (!running && caughtAt) {
        ctx.fillStyle = `rgba(43,31,28,${Math.min(.7, (now - caughtAt) * 1.5)})`;
        ctx.fillRect(0, 0, resize.width, resize.height);
      }
      if (alertUntil > now) {
        const pulse = 1 + Math.sin(now * 14) * .035;
        ctx.save(); ctx.translate(resize.width / 2, resize.height * .28); ctx.scale(pulse, pulse);
        ctx.font = `1000 ${resize.width < 600 ? 34 : 52}px system-ui`; ctx.textAlign = 'center'; ctx.lineWidth = 10; ctx.strokeStyle = '#3a2822'; ctx.strokeText(alertText, 0, 0); ctx.fillStyle = '#ff684e'; ctx.fillText(alertText, 0, 0); ctx.restore();
      }
      if (player.hiddenUntil > now) {
        ctx.fillStyle = 'rgba(38,43,60,.18)'; ctx.fillRect(0, 0, resize.width, resize.height);
        ctx.fillStyle = '#fffdf4'; ctx.font = '900 18px system-ui'; ctx.textAlign = 'center'; ctx.fillText('숨는 중… 움직이지 말자!', resize.width / 2, resize.height - 120);
      }

      if (running && now - lastHud > (resize.width <= 980 ? .18 : .12)) {
        lastHud = now;
        const nearby = isChase ? interactions.filter((i) => !i.used && distance(player, i) < 78).sort((a, b) => distance(player, a) - distance(player, b))[0] : undefined;
        const nearbyDoor = isChase ? closestDoor() : undefined;
        const familyCandidates = (['mom', 'brother', 'dad'] as const).map((role) => {
          const point = !isChase && !awakeInExplore[role] ? FAMILY_RESTING_POSITIONS[role] : actorFor(role);
          return { role, point, gap: distance(player, point) };
        });
        const closestFamily = familyCandidates.filter((family) => family.gap < 118).sort((a, b) => a.gap - b.gap)[0];
        const nextNearby = closestFamily
          ? {
              role: closestFamily.role,
              name: FAMILY_NAMES[closestFamily.role],
              busyLabel: familyTasks[closestFamily.role] ? FAMILY_TASKS[familyTasks[closestFamily.role]!.kind].label : null,
            }
          : null;
        const nextNearbyKey = nextNearby ? `${nextNearby.role}:${nextNearby.busyLabel ?? 'ready'}` : '';
        if (nearbyFamilyKey !== nextNearbyKey) {
          nearbyFamilyKey = nextNearbyKey;
          setNearbyFamily(nextNearby);
        }
        setHud({
          score: Math.floor(score), elapsed, rage, rageLabel: rageLabel(rage), momMood: mom.active ? mom.mood : (isChase ? 'suspicious' : 'calm'),
          momMoodLabel: mom.active ? moodLabel(mom.mood) : (isChase ? '🤨 소파에서 일어나는 중' : '😐 쉬는 중'), mission: { ...mission },
          prompt: blockedHintUntil > now
            ? '🚧 갈색 벽과 테두리 가구는 통과할 수 없어요'
            : playerOnSofa
              ? '🛋️ 소파 위 스피드 UP! 엄마는 소파를 돌아와요'
            : playerNearPiano
              ? (soundRef.current ? '🎹 쇼팽 녹턴 Op. 9 No. 2 · 피아노에서 멀어지면 멈춰요' : '🔇 소리를 켜면 쇼팽의 녹턴이 연주돼요')
            : nextNearby
              ? nextNearby.busyLabel
                ? `${nextNearby.name}: ${nextNearby.busyLabel} 하는 중…`
                : `${nextNearby.name}에게 부탁할 일을 골라보세요`
            : isChase
              ? (nearbyDoor
                  ? `E · ${nearbyDoor.label} ${doorStates.get(nearbyDoor.id)!.closedUntil > now ? '열기' : '4.5초 닫기'}`
                  : nearby ? `E · ${nearby.label}` : (!dad.collected ? '집을 돌아다니는 아빠에게 가까이 가세요!' : '아빠와 형도 집 안을 돌아다니고 있어요'))
              : nearbyRestingRole
                ? '💤 자는 가족이 잠꼬대하는 중…'
                : '집을 자유롭게 둘러보세요 · 자는 가족에게 가까이 가보세요',
          itemText: itemTextUntil > now ? itemText : '', dashReady: clamp(1 - (player.dashCooldownUntil - now) / 1.35, 0, 1),
          combo: comboCount, comboSeconds: comboCount > 0 ? Math.max(0, comboUntil - now) : 0, decoyCharges,
          health: Math.floor(health), maxHealth: HEALTH_RULES.max, recovering: passiveRecoveryActive,
          recoveryLabel: health >= HEALTH_RULES.max
            ? '체력 가득'
            : passiveRecoveryActive
              ? `자동 회복 +${HEALTH_RULES.passiveRecoveryPerSecond}/초`
              : safeSince !== null
                ? `${Math.max(1, Math.ceil(HEALTH_RULES.safeDelaySeconds - (now - safeSince)))}초 후 자동 회복`
                : '엄마와 거리를 벌리면 회복',
        });
      }
      adaptRenderQuality(now);
      animation = requestAnimationFrame(frame);
    };
    animation = requestAnimationFrame(frame);
    return () => {
      running = false; stopNocturne(); cancelAnimationFrame(animation); observer.disconnect();
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', releaseTouch);
      window.removeEventListener('pagehide', releaseTouch);
      window.visualViewport?.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('orientationchange', resizeCanvas);
      stage.removeEventListener('touchmove', preventTouchScroll);
      stage.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reducedMotionQuery.removeEventListener('change', onReducedMotionChange);
    };
  }, [onGameOver, playerOutfit]);

  const press = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const key = event.currentTarget.dataset.control as TouchControl | undefined;
    if (!key) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    unlockGameAudio();
    touchRef.current[key] = true;
  };

  const moveJoystick = (clientX: number, clientY: number) => {
    const knob = joystickKnobRef.current;
    const bounds = joystickBoundsRef.current;
    if (!bounds || !knob) return;
    const { centerX, centerY, maxTravel } = bounds;
    const rawX = clientX - centerX;
    const rawY = clientY - centerY;
    const rawLength = Math.hypot(rawX, rawY);
    const scale = rawLength > maxTravel ? maxTravel / rawLength : 1;
    const offsetX = rawX * scale;
    const offsetY = rawY * scale;
    const normalizedX = offsetX / maxTravel;
    const normalizedY = offsetY / maxTravel;
    const strength = Math.hypot(normalizedX, normalizedY);
    touchRef.current.moveX = strength < .12 ? 0 : normalizedX;
    touchRef.current.moveY = strength < .12 ? 0 : normalizedY;
    knob.style.transform = `translate3d(${offsetX.toFixed(1)}px,${offsetY.toFixed(1)}px,0)`;
  };
  const startJoystick = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    unlockGameAudio();
    joystickPointerRef.current = event.pointerId;
    const rect = event.currentTarget.getBoundingClientRect();
    joystickBoundsRef.current = { centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2, maxTravel: rect.width * .29 };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    moveJoystick(event.clientX, event.clientY);
  };
  const dragJoystick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointerRef.current !== event.pointerId) return;
    event.preventDefault();
    moveJoystick(event.clientX, event.clientY);
  };
  const stopJoystick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointerRef.current !== event.pointerId) return;
    event.preventDefault();
    joystickPointerRef.current = null;
    joystickBoundsRef.current = null;
    touchRef.current.moveX = 0; touchRef.current.moveY = 0;
    if (joystickKnobRef.current) joystickKnobRef.current.style.transform = 'translate3d(0,0,0)';
  };

  return (
    <div ref={stageRef} className="game-stage">
      <canvas ref={canvasRef} aria-label="집 자유 탐험 및 엄마가 온다 게임 화면" />

      {phase === 'explore' && (
        <header className="explore-toolbar">
          <span className="explore-mode">자유 탐험</span>
          <Button className="explore-start" onClick={beginChase}><Gamepad2 /> 게임 시작</Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button className="explore-menu-trigger" size="icon" aria-label="탐험 메뉴" title="탐험 메뉴" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="explore-popover">
              <DropdownMenuItem onClick={onOpenHow}><HelpCircle /> 게임 방법</DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenCharacters}><UsersRound /> 가족 소개</DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenCollection}><Sparkles /> 의상 · 사건 도감</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSoundOn((value) => { if (!value) unlockGameAudio(); return !value; })}>
                {soundOn ? <Volume2 /> : <VolumeX />} {soundOn ? '소리 끄기' : '소리 켜기'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="explore-record"><Trophy /> 최고 기록 {highScore.toLocaleString()}점</DropdownMenuLabel>
                <div className="explore-menu-legend">
                  <span><i className="walkable-swatch" /> 바닥·민트 문턱: 통과 가능</span>
                  <span><i className="blocked-swatch" /> 벽·점선 가구: 통과 불가</span>
                </div>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
      )}

      {phase === 'chase' && (
        <>
          <header className="game-hud">
            <section className="hud-rage">
              <div className="hud-label"><span>엄마 분노도</span><strong>{Math.round(hud.rage)}%</strong></div>
              <div className="rage-track"><span style={{ width: `${hud.rage}%` }} /></div>
              <div className="rage-caption">{hud.rageLabel}</div>
            </section>
            <section className="hud-score" aria-label="점수와 시간">
              <span>점수 <strong>{hud.score.toLocaleString()}</strong></span>
              <span>생존 <strong>{formatTime(hud.elapsed)}</strong></span>
            </section>
            <Button className="sound-toggle" variant="secondary" size="icon" onClick={() => setSoundOn((value) => { if (!value) unlockGameAudio(); return !value; })} aria-label={soundOn ? '소리 끄기' : '소리 켜기'}>
              {soundOn ? <Volume2 /> : <VolumeX />}
            </Button>
          </header>
          <section className={`hud-health ${hud.health <= 35 ? 'is-low' : hud.health <= 70 ? 'is-mid' : ''}`}>
            <div className="health-label"><span id="player-health-label">내 체력</span><strong>{hud.health}/{hud.maxHealth}</strong></div>
            <meter className="health-track" aria-labelledby="player-health-label" min={0} max={hud.maxHealth} value={hud.health}>{hud.health}/{hud.maxHealth}</meter>
            <small className={hud.recovering ? 'is-recovering' : ''}>{hud.recoveryLabel}</small>
          </section>
          <aside className="mission-card">
            <span className="mission-badge">오늘의 미션</span>
            <strong className={hud.mission.done ? 'mission-done' : ''}>{hud.mission.done ? '✓ ' : ''}{hud.mission.title}</strong>
            <div className="mission-progress"><span style={{ width: `${(hud.mission.progress / hud.mission.target) * 100}%` }} /></div>
            <small>{Math.floor(hud.mission.progress)} / {hud.mission.target}</small>
          </aside>
          <div className="mom-status">{hud.momMoodLabel}</div>
          {(hud.combo >= 2 || hud.decoyCharges > 0) && (
            <div className="trick-status" aria-label="장난 콤보와 가짜 발자국 미끼">
              {hud.combo >= 2 && <strong>🔥 {hud.combo} 콤보 <small>{hud.comboSeconds.toFixed(1)}초</small></strong>}
              {hud.decoyCharges > 0 && <span>🧦 미끼 ×{hud.decoyCharges} · 다음 DASH</span>}
            </div>
          )}
          <output className="item-toast" aria-live="polite" aria-atomic="true">{hud.itemText}</output>
        </>
      )}

      {nearbyFamily && (
        <section className="family-request-panel" aria-label={`${nearbyFamily.name}에게 부탁하기`}>
          <div className="family-request-heading">
            <span>가까운 가족</span>
            <strong>{nearbyFamily.name}에게 부탁하기</strong>
            {nearbyFamily.busyLabel && <small>{nearbyFamily.busyLabel} 하는 중이라 잠시 기다려 주세요</small>}
          </div>
          <div className="family-request-actions">
            {(['dishes', 'clean', 'tv', 'turtles'] as const).map((kind) => {
              const task = FAMILY_TASKS[kind];
              return (
                <button key={kind} type="button" disabled={Boolean(nearbyFamily.busyLabel)} onClick={() => requestFamilyTask(kind)}>
                  <span>{task.icon}</span>{task.label}
                </button>
              );
            })}
          </div>
        </section>
      )}
      <div className={`interaction-prompt ${nearbyFamily ? 'with-family-request' : ''}`}>{hud.prompt}</div>
      <div className="dash-meter" aria-label="대시 충전"><span style={{ transform: `scaleX(${hud.dashReady})` }} /></div>

      <div className="mobile-controls" aria-label="터치 조작">
        <div
          ref={joystickBaseRef}
          className="joystick-base"
          role="application"
          aria-label="360도 이동 조이스틱"
          onPointerDown={startJoystick}
          onPointerMove={dragJoystick}
          onPointerUp={stopJoystick}
          onPointerCancel={stopJoystick}
          onLostPointerCapture={stopJoystick}
        >
          <span className="joystick-guide" aria-hidden="true">360°</span>
          <div ref={joystickKnobRef} className="joystick-knob" aria-hidden="true"><span /></div>
        </div>
        <div className="action-buttons">
          <button className="touch-dash" data-control="dash" onPointerDown={press}>DASH<small>대시</small></button>
          {phase === 'chase' && <button className="touch-e" data-control="interact" onPointerDown={press}>E<small>장난</small></button>}
        </div>
      </div>
    </div>
  );
}
