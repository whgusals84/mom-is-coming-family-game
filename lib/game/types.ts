export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number; label?: string; kind?: string; visualRotation?: 0 | 180 };

export type CharacterRole = 'player' | 'mom' | 'brother' | 'dad';
export type MomMood = 'calm' | 'suspicious' | 'chase' | 'search' | 'extreme';

export type FurniturePlanKind =
  | 'sofa'
  | 'tv'
  | 'table'
  | 'plant'
  | 'cabinet'
  | 'bed'
  | 'desk'
  | 'dollShelf'
  | 'dining'
  | 'counter'
  | 'fridge'
  | 'toilet'
  | 'sink'
  | 'closet'
  | 'tub'
  | 'other';
export type FurniturePlanRotation = 0 | 90 | 180 | 270;
export type FurniturePlanMarker = Point & {
  id: string;
  kind: FurniturePlanKind;
  label: string;
  w: number;
  h: number;
  rotation: FurniturePlanRotation;
};

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
};
