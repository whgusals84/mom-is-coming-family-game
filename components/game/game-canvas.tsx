'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Gamepad2, HelpCircle, MoreHorizontal, Trophy, UsersRound, Volume2, VolumeX } from 'lucide-react';
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
import { playGameTone, unlockGameAudio, type GameTone } from '@/lib/game/audio';
import { INTERACTION_TEMPLATES, ITEMS, LANDMARKS, LINES, LIVING_SOFA, MISSIONS, NPC_SPOTS, WORLD } from '@/lib/game/data';
import { HEALTH_RULES, restoreHealth, takeDamage } from '@/lib/game/health';
import { clamp, distance, findPath, moveCircle, pointInRect } from '@/lib/game/map';
import { drawCharacter, drawMap, drawMarker, drawSpeech, roundedRect } from '@/lib/game/renderer';
import { SpriteBank } from '@/lib/game/sprites';
import type { GameResult, HudState, Interaction, Mission, MomMood, Point } from '@/lib/game/types';

type GamePhase = 'explore' | 'chase';
type GameCanvasProps = {
  highScore: number;
  initialPhase: GamePhase;
  onGameOver: (result: GameResult) => void;
  onOpenHow: () => void;
  onOpenCharacters: () => void;
};

type Actor = Point & { r: number; moving: boolean; facing: 1 | -1 };
type Mom = Actor & {
  active: boolean; mood: MomMood; path: Point[]; pathAt: number; chaseAt: number;
  stunnedUntil: number; distractedUntil: number; extremeUntil: number; lostUntil: number;
  lastSeen: Point; nextLoseCheck: number;
};
type Npc = Point & { kind: 'brother' | 'dad'; until: number; good?: boolean; collected?: boolean; line: string };
type Bubble = { role: 'player' | 'mom' | 'brother' | 'dad'; text: string; until: number };
type Effect = Point & { text: string; color: string; until: number; born: number };
type Counters = { snacks: number; brotherMess: number; closeCall: number; dad: number };
type TouchControl = 'left' | 'right' | 'up' | 'down' | 'dash' | 'interact';

const PLAYER_MOVE_OPTIONS = { ignoreKinds: ['sofa'] } as const;
const SOFA_SPEED_MULTIPLIER = 1.38;

const INITIAL_HUD: HudState = {
  score: 0, elapsed: 0, rage: 0, rageLabel: '아직 모름', momMood: 'calm', momMoodLabel: '😐 평온',
  mission: { kind: 'survive', title: '엄마에게 60초 동안 잡히지 않기', target: 60, progress: 0, done: false },
  prompt: '집 안을 둘러보는 중…', itemText: '', dashReady: 1,
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

export function GameCanvas({ highScore, initialPhase, onGameOver, onOpenHow, onOpenCharacters }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef({ left: false, right: false, up: false, down: false, dash: false, interact: false });
  const soundRef = useRef(true);
  const phaseRef = useRef<GamePhase>(initialPhase);
  const [soundOn, setSoundOn] = useState(true);
  const [phase, setPhase] = useState<GamePhase>(initialPhase);
  const [hud, setHud] = useState(INITIAL_HUD);

  const beginChase = () => {
    unlockGameAudio();
    phaseRef.current = 'chase';
    setPhase('chase');
  };

  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);

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
      x: LANDMARKS.momSpawn.x, y: LANDMARKS.momSpawn.y, r: 23, moving: false, facing: -1, active: false, mood: 'calm', path: [], pathAt: 0,
      chaseAt: Infinity, stunnedUntil: 0, distractedUntil: 0, extremeUntil: 0, lostUntil: 0,
      lastSeen: { x: player.x, y: player.y }, nextLoseCheck: Infinity,
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
    let npc: Npc | null = null;
    let bubbles: Bubble[] = [];
    let effects: Effect[] = [];
    let resize = { width: stage.clientWidth, height: stage.clientHeight, dpr: Math.min(devicePixelRatio || 1, 2) };
    const beep = (kind: GameTone) => playGameTone(kind, soundRef.current);

    const addBubble = (role: Bubble['role'], text: string, now: number, duration = 2.4) => {
      bubbles = bubbles.filter((b) => b.role !== role);
      bubbles.push({ role, text, until: now + duration });
    };
    const addEffect = (x: number, y: number, text: string, color: string, now: number, duration = 1.1) => {
      effects.push({ x, y, text, color, born: now, until: now + duration });
    };
    const makeAngry = (amount: number, now: number) => {
      rage = clamp(rage + amount, 0, 100);
      if (rage >= 100) {
        mom.extremeUntil = Math.max(mom.extremeUntil, now + 6);
        alertText = '엄마 극대노 모드!'; alertUntil = now + 1.8; shakeUntil = now + .55; shakePower = 10;
      }
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
      score += available.points; accidents += 1; makeAngry(available.rage, now);
      if (available.metric) counters[available.metric] += 1;
      addEffect(available.x, available.y, available.effect, '#ed5b45', now, 1.4);
      addBubble('player', pick(LINES.player), now); shakeUntil = now + .28; shakePower = 5; beep('alert');
      if (!mom.active && mom.chaseAt > now + 1.6) mom.chaseAt = now + 1.6;
      updateMission(now);
    };

    const tryDash = (now: number) => {
      if (now < player.dashCooldownUntil || player.hiddenUntil > now) return;
      player.dashUntil = now + .2; player.dashCooldownUntil = now + 1.35; beep('dash');
      if (mom.active && distance(player, mom) < 112 && distance(player, mom) > 40) {
        score += 250; counters.closeCall += 1; addEffect(player.x, player.y, 'NICE!', '#ffdc4f', now, 1.2); beep('nice'); updateMission(now);
      }
    };

    const spawnBrother = (now: number) => {
      const point = pick(NPC_SPOTS.filter((p) => distance(p, player) > 180));
      const good = Math.random() < .57;
      npc = { ...point, kind: 'brother', until: now + 8, good, line: pick(good ? LINES.brotherGood : LINES.brotherBad) };
      addBubble('brother', npc.line, now, 3.5);
      if (good) helpUntil = now + 7;
      else { mom.lostUntil = 0; mom.lastSeen = { x: player.x, y: player.y }; mom.pathAt = 0; makeAngry(7, now); }
      nextBrother = now + 18 + Math.random() * 9;
    };

    const spawnDad = (now: number) => {
      const point = pick(NPC_SPOTS.filter((p) => distance(p, player) > 180));
      npc = { ...point, kind: 'dad', until: now + 11, line: pick(LINES.dad), collected: false };
      addBubble('dad', npc.line, now, 3.5); nextDad = now + 23 + Math.random() * 10;
    };

    const grantDadItem = (now: number) => {
      if (!npc || npc.kind !== 'dad' || npc.collected) return;
      npc.collected = true; counters.dad += 1; score += 150;
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
      addEffect(npc.x, npc.y, item.icon, '#fff36d', now, 1.3); addBubble('dad', '빨리 가!', now); beep('item'); updateMission(now);
    };

    const endGame = (now: number) => {
      if (!running || gameStartedAt === null) return;
      running = false; caughtAt = now; beep('caught'); alertText = '엄마에게 잡혔다!'; alertUntil = now + 2;
      if (!resultSent) {
        resultSent = true;
        onGameOver({ score: Math.floor(score), elapsed: now - gameStartedAt, accidents, closeCalls: counters.closeCall, missionDone: mission.done });
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

    const resizeCanvas = () => {
      const box = stage.getBoundingClientRect();
      resize = { width: Math.max(1, box.width), height: Math.max(1, box.height), dpr: Math.min(devicePixelRatio || 1, 2) };
      canvas.width = Math.floor(resize.width * resize.dpr); canvas.height = Math.floor(resize.height * resize.dpr);
      canvas.style.width = `${resize.width}px`; canvas.style.height = `${resize.height}px`;
    };
    const observer = new ResizeObserver(resizeCanvas); observer.observe(stage); resizeCanvas();
    window.visualViewport?.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', resizeCanvas);

    const onKeyDown = (event: KeyboardEvent) => {
      const code = event.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code)) event.preventDefault();
      keys.add(code);
      const now = clock();
      if (code === 'Space' && !event.repeat) tryDash(now);
      if (code === 'KeyE' && !event.repeat) doInteraction(now);
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
    const preventTouchScroll = (event: TouchEvent) => event.preventDefault();
    const preventContextMenu = (event: MouseEvent) => event.preventDefault();
    const releaseTouch = () => {
      touchRef.current.left = false; touchRef.current.right = false;
      touchRef.current.up = false; touchRef.current.down = false;
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
        mom.chaseAt = now + 4.2;
        mom.nextLoseCheck = now + 10;
        nextBrother = now + 10;
        nextDad = now + 15;
        nextMomLine = now + 8;
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
        let dx = Number(keys.has('KeyD') || keys.has('ArrowRight') || touch.right) - Number(keys.has('KeyA') || keys.has('ArrowLeft') || touch.left);
        let dy = Number(keys.has('KeyS') || keys.has('ArrowDown') || touch.down) - Number(keys.has('KeyW') || keys.has('ArrowUp') || touch.up);
        if (touch.dash) { touch.dash = false; tryDash(now); }
        if (touch.interact) { touch.interact = false; doInteraction(now); }
        const length = Math.hypot(dx, dy) || 1; dx /= length; dy /= length;
        const wantsMove = Math.abs(dx) + Math.abs(dy) > 0 && player.hiddenUntil <= now;
        if (dx < -.1) player.facing = -1;
        else if (dx > .1) player.facing = 1;
        player.moving = false;
        const sofaBoostAtFrameStart = pointInRect(player, LIVING_SOFA);
        const baseSpeed = player.dashUntil > now ? 470 : (player.speedUntil > now ? 275 : 205);
        const speed = baseSpeed * (sofaBoostAtFrameStart ? SOFA_SPEED_MULTIPLIER : 1);
        if (player.hiddenUntil <= now) {
          const movement = moveCircle(player, dx * speed * dt, dy * speed * dt, player.r, PLAYER_MOVE_OPTIONS);
          player.moving = wantsMove && movement.moved;
          if (wantsMove && movement.blocked && !movement.moved && now >= nextBumpEffect) {
            nextBumpEffect = now + .75;
            blockedHintUntil = now + 1.25;
            addEffect(player.x + dx * 25, player.y + dy * 25, '툭!', '#6d5142', now, .55);
          }
        }
        const nowOnSofa = pointInRect(player, LIVING_SOFA);
        if (nowOnSofa && !playerOnSofa) {
          itemText = '🛋️ 소파 위 스피드 UP!'; itemTextUntil = now + 2.2;
          addEffect(player.x, player.y - 18, 'SPEED UP!', '#45b9a8', now, 1.15);
          beep('nice');
        }
        playerOnSofa = nowOnSofa;

        if (isChase && mom.active) {
          if (now > mom.nextLoseCheck) {
            mom.nextLoseCheck = now + 5 + Math.random() * 3;
            if (distance(player, mom) > 360 && rage < 76 && player.hiddenUntil <= now && Math.random() < .36) {
              mom.lostUntil = now + 2.8; mom.lastSeen = { x: player.x, y: player.y }; mom.pathAt = 0;
            }
          }
          let target: Point;
          if (mom.distractedUntil > now) target = LANDMARKS.tv;
          else if (player.hiddenUntil > now || mom.lostUntil > now) target = mom.lastSeen;
          else { target = player; mom.lastSeen = { x: player.x, y: player.y }; }

          mom.mood = mom.extremeUntil > now ? 'extreme' : (mom.stunnedUntil > now || mom.lostUntil > now || player.hiddenUntil > now ? 'search' : 'chase');
          if (now >= mom.pathAt) { mom.path = findPath(mom, target, mom.r + 3); mom.pathAt = now + .42; }
          mom.moving = false;
          if (now >= mom.stunnedUntil && mom.path.length) {
            let waypoint = mom.path[0];
            if (distance(mom, waypoint) < 22) { mom.path.shift(); waypoint = mom.path[0] ?? target; }
            const vx = waypoint.x - mom.x; const vy = waypoint.y - mom.y; const vlen = Math.hypot(vx, vy) || 1;
            const momSpeed = 142 + elapsed * .52 + rage * .48 + (mom.extremeUntil > now ? 88 : 0);
            if (vx < -.1) mom.facing = -1;
            else if (vx > .1) mom.facing = 1;
            mom.moving = moveCircle(mom, vx / vlen * momSpeed * dt, vy / vlen * momSpeed * dt, mom.r).moved;
          }
          const gap = distance(player, mom);
          if (gap < 96) nearMom = true;
          if (nearMom && gap > 145) { nearMom = false; score += 180; counters.closeCall += 1; addEffect(player.x, player.y, 'NICE!', '#ffdc4f', now); updateMission(now); }
          if (gap < player.r + mom.r + 4 && player.hiddenUntil <= now && mom.stunnedUntil <= now && player.invulnerableUntil <= now) hitPlayer(now);
          if (now > nextMomLine) { addBubble('mom', pick(LINES.mom), now); nextMomLine = now + 5 + Math.random() * 3; }
        }

        if (isChase) {
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
          if (!npc && now > nextBrother && Math.random() < .025) spawnBrother(now);
          if (!npc && now > nextDad && Math.random() < .025) spawnDad(now);
          if (npc && now > npc.until) npc = null;
          if (npc?.kind === 'dad' && !npc.collected && distance(player, npc) < 80) grantDadItem(now);
          score += dt * 10;
          updateMission(now);
        }
        bubbles = bubbles.filter((bubble) => bubble.until > now);
        effects = effects.filter((effect) => effect.until > now);
      }

      const zoom = clamp(Math.min(resize.width / 930, resize.height / 620), .62, 1.18);
      const viewW = resize.width / zoom; const viewH = resize.height / zoom;
      const cameraX = clamp(player.x - viewW / 2, 0, Math.max(0, WORLD.width - viewW));
      const cameraY = clamp(player.y - viewH / 2, 0, Math.max(0, WORLD.height - viewH));
      const shakeX = shakeUntil > now ? (Math.random() - .5) * shakePower : 0;
      const shakeY = shakeUntil > now ? (Math.random() - .5) * shakePower : 0;
      ctx.setTransform(resize.dpr, 0, 0, resize.dpr, 0, 0); ctx.clearRect(0, 0, resize.width, resize.height);
      ctx.save(); ctx.translate(shakeX, shakeY); ctx.scale(zoom, zoom); ctx.translate(-cameraX, -cameraY);
      drawMap(ctx);

      if (isChase) {
        for (const interaction of interactions) {
          if (interaction.used) continue;
          const ready = now - interaction.lastUsed >= interaction.cooldown;
          if (distance(player, interaction) < 150) drawMarker(ctx, interaction, interaction.label, ready, now);
        }
      }
      if (helpUntil > now && mom.active) {
        ctx.save(); ctx.strokeStyle = '#ffd945'; ctx.lineWidth = 7; ctx.setLineDash([14, 12]);
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(mom.x, mom.y); ctx.stroke(); ctx.restore();
      }
      if (npc) drawCharacter(ctx, bank, npc.kind, npc.x, npc.y, false, now, 'calm');
      if (mom.active) {
        if (mom.mood === 'extreme') {
          ctx.save(); ctx.strokeStyle = '#ef533f'; ctx.lineWidth = 5;
          for (let i = 0; i < 5; i++) { const a = now * 4 + i * 1.25; ctx.beginPath(); ctx.moveTo(mom.x + Math.cos(a) * 40, mom.y + Math.sin(a) * 35 - 30); ctx.lineTo(mom.x + Math.cos(a) * 58, mom.y + Math.sin(a) * 52 - 35); ctx.stroke(); }
          ctx.restore();
        }
        drawCharacter(ctx, bank, 'mom', mom.x, mom.y, mom.moving, now, mom.mood, false, mom.facing, reducedMotion);
        ctx.fillStyle = '#fffdf4'; ctx.strokeStyle = '#3b2d27'; ctx.lineWidth = 3; roundedRect(ctx, mom.x - 45, mom.y - 125, 90, 25, 12); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#3b2d27'; ctx.font = '900 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText(moodLabel(mom.mood), mom.x, mom.y - 108);
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
      drawCharacter(ctx, bank, 'player', player.x, player.y, player.moving, now, 'calm', player.hiddenUntil > now || hitFlash, player.facing, reducedMotion);
      for (const effect of effects) {
        const life = (now - effect.born) / (effect.until - effect.born);
        ctx.save(); ctx.globalAlpha = 1 - life; ctx.translate(effect.x, effect.y - life * 45); ctx.rotate(-.08 + Math.sin(effect.born * 9) * .08);
        ctx.font = `1000 ${effect.text.length <= 2 ? 36 : 30}px system-ui`; ctx.textAlign = 'center'; ctx.lineWidth = 7; ctx.strokeStyle = '#fffdf4'; ctx.strokeText(effect.text, 0, 0); ctx.fillStyle = effect.color; ctx.fillText(effect.text, 0, 0); ctx.restore();
      }
      for (const bubble of bubbles) {
        const at = bubble.role === 'player' ? player : bubble.role === 'mom' ? mom : (npc && npc.kind === bubble.role ? npc : null);
        if (at && (bubble.role !== 'mom' || mom.active)) drawSpeech(ctx, at, bubble.text, bubble.role === 'mom' ? '#ffd7d0' : bubble.role === 'dad' ? '#fff0ad' : '#fffdf4');
      }
      ctx.restore();

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

      if (running && now - lastHud > .1) {
        lastHud = now;
        const nearby = isChase ? interactions.filter((i) => !i.used && distance(player, i) < 78).sort((a, b) => distance(player, a) - distance(player, b))[0] : undefined;
        setHud({
          score: Math.floor(score), elapsed, rage, rageLabel: rageLabel(rage), momMood: mom.active ? mom.mood : 'calm',
          momMoodLabel: mom.active ? moodLabel(mom.mood) : '😐 아직 안 옴', mission: { ...mission },
          prompt: blockedHintUntil > now
            ? '🚧 갈색 벽과 테두리 가구는 통과할 수 없어요'
            : playerOnSofa
              ? '🛋️ 소파 위 스피드 UP! 엄마는 소파를 돌아와요'
            : isChase
              ? (nearby ? `E · ${nearby.label}` : (npc?.kind === 'dad' && !npc.collected ? '아빠에게 가까이 가세요!' : '집 안의 반짝이는 장난거리를 찾아보세요'))
              : '집을 자유롭게 둘러보세요 · 민트색 문턱은 통과할 수 있어요',
          itemText: itemTextUntil > now ? itemText : '', dashReady: clamp(1 - (player.dashCooldownUntil - now) / 1.35, 0, 1),
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
      animation = requestAnimationFrame(frame);
    };
    animation = requestAnimationFrame(frame);
    return () => {
      running = false; cancelAnimationFrame(animation); observer.disconnect();
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
  }, [onGameOver]);

  const press = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const key = event.currentTarget.dataset.control as TouchControl | undefined;
    if (!key) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    unlockGameAudio();
    touchRef.current[key] = true;
  };
  const release = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const key = event.currentTarget.dataset.control as TouchControl | undefined;
    if (!key) return;
    event.preventDefault();
    touchRef.current[key] = false;
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
          <output className="item-toast" aria-live="polite" aria-atomic="true">{hud.itemText}</output>
        </>
      )}

      <div className="interaction-prompt">{hud.prompt}</div>
      <div className="dash-meter" aria-label="대시 충전"><span style={{ transform: `scaleX(${hud.dashReady})` }} /></div>

      <div className="mobile-controls" aria-label="터치 조작">
        <div className="dpad">
          <button className="up" data-control="up" onPointerDown={press} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>▲</button>
          <button className="left" data-control="left" onPointerDown={press} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>◀</button>
          <button className="right" data-control="right" onPointerDown={press} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>▶</button>
          <button className="down" data-control="down" onPointerDown={press} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>▼</button>
        </div>
        <div className="action-buttons">
          <button className="touch-dash" data-control="dash" onPointerDown={press}>DASH<small>대시</small></button>
          {phase === 'chase' && <button className="touch-e" data-control="interact" onPointerDown={press}>E<small>장난</small></button>}
        </div>
      </div>
    </div>
  );
}
