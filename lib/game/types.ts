export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number; label?: string; kind?: string; visualRotation?: 0 | 180 };

export type CharacterRole = 'player' | 'mom' | 'brother' | 'dad';
export type MomMood = 'calm' | 'suspicious' | 'chase' | 'search' | 'extreme';
export type PlayerOutfit = 'basic' | 'cap' | 'bunny' | 'cape';
export type HouseEventKind = 'doorbell' | 'blackout' | 'turtles' | 'vacuum' | 'crumbs' | 'remote';

export type Interaction = {
  id: string;
  x: number;
  y: number;
  label: string;
  effect: string;
  points: number;
  rage: number;
  cooldown: number;
  lastUsed: number;
  oneShot?: boolean;
  used?: boolean;
  metric?: 'snacks' | 'brotherMess';
  hide?: boolean;
  heal?: number;
};

export type MissionKind = 'survive' | 'snacks' | 'brotherMess' | 'closeCall' | 'dad';
export type Mission = {
  kind: MissionKind;
  title: string;
  target: number;
  progress: number;
  done: boolean;
};

export type HudState = {
  score: number;
  elapsed: number;
  rage: number;
  rageLabel: string;
  momMood: MomMood;
  momMoodLabel: string;
  mission: Mission;
  prompt: string;
  itemText: string;
  dashReady: number;
  combo: number;
  comboSeconds: number;
  decoyCharges: number;
  health: number;
  maxHealth: number;
  recoveryLabel: string;
  recovering: boolean;
};

export type GameResult = {
  score: number;
  elapsed: number;
  accidents: number;
  closeCalls: number;
  missionDone: boolean;
  maxCombo: number;
  decoysUsed: number;
  familyTitle: string;
};
