import type {
  FurniturePlanKind,
  FurniturePlanMarker,
  FurniturePlanRotation,
  Point,
} from './types';

export const FURNITURE_PLAN_STORAGE_KEY = 'mom-is-coming-furniture-markers-v1';
export const FURNITURE_PLAN_SCHEMA_VERSION = 1;
export const FURNITURE_PLAN_MAP_REVISION = 'wide-doors-v11';
export const MAX_FURNITURE_PLAN_MARKERS = 100;
export const MIN_FURNITURE_PLAN_SIZE = 28;
export const MAX_FURNITURE_PLAN_SIZE = 320;

export const FURNITURE_PLAN_CATALOG: ReadonlyArray<{
  kind: FurniturePlanKind;
  label: string;
  icon: string;
  color: string;
  w: number;
  h: number;
}> = [
  { kind: 'sofa', label: '소파', icon: '🛋️', color: '#ef7f6d', w: 225, h: 82 },
  { kind: 'tv', label: 'TV', icon: '📺', color: '#596779', w: 120, h: 55 },
  { kind: 'table', label: '테이블', icon: '🪵', color: '#bd8254', w: 100, h: 65 },
  { kind: 'plant', label: '화분', icon: '🪴', color: '#73a665', w: 55, h: 55 },
  { kind: 'cabinet', label: '수납장', icon: '🗄️', color: '#d4a067', w: 70, h: 105 },
  { kind: 'bed', label: '침대', icon: '🛏️', color: '#7faee0', w: 110, h: 170 },
  { kind: 'desk', label: '책상', icon: '✏️', color: '#a8734b', w: 125, h: 58 },
  { kind: 'dollShelf', label: '인형 선반', icon: '🧸', color: '#ec9fb1', w: 170, h: 55 },
  { kind: 'dining', label: '식탁', icon: '🍽️', color: '#cc9158', w: 130, h: 70 },
  { kind: 'counter', label: '조리대', icon: '🍳', color: '#b4a07e', w: 240, h: 60 },
  { kind: 'fridge', label: '냉장고', icon: '🧊', color: '#9fbfc0', w: 75, h: 105 },
  { kind: 'toilet', label: '변기', icon: '🚽', color: '#a9c6c8', w: 55, h: 55 },
  { kind: 'sink', label: '세면대', icon: '🚰', color: '#77b9b2', w: 70, h: 52 },
  { kind: 'closet', label: '옷장', icon: '👕', color: '#8b69ba', w: 75, h: 95 },
  { kind: 'tub', label: '욕조', icon: '🛁', color: '#83b8c6', w: 100, h: 70 },
  { kind: 'other', label: '기타 가구', icon: '📍', color: '#9a72d0', w: 100, h: 70 },
];

const CATALOG_BY_KIND = new Map(FURNITURE_PLAN_CATALOG.map((item) => [item.kind, item]));
const ROTATIONS = new Set<FurniturePlanRotation>([0, 90, 180, 270]);

export function getFurniturePlanDefinition(kind: FurniturePlanKind) {
  return CATALOG_BY_KIND.get(kind) ?? FURNITURE_PLAN_CATALOG.at(-1)!;
}

export function getFurniturePlanFootprint(marker: FurniturePlanMarker) {
  const sideways = marker.rotation === 90 || marker.rotation === 270;
  return { w: sideways ? marker.h : marker.w, h: sideways ? marker.w : marker.h };
}

export function setFurniturePlanFootprintSize(
  marker: FurniturePlanMarker,
  axis: 'width' | 'height',
  value: number,
): FurniturePlanMarker {
  const size = clamp(value, MIN_FURNITURE_PLAN_SIZE, MAX_FURNITURE_PLAN_SIZE);
  const sideways = marker.rotation === 90 || marker.rotation === 270;
  if (axis === 'width') return sideways ? { ...marker, h: size } : { ...marker, w: size };
  return sideways ? { ...marker, w: size } : { ...marker, h: size };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function clampFurniturePlanMarker(
  marker: FurniturePlanMarker,
  world = { width: 1600, height: 1000 },
): FurniturePlanMarker {
  const footprint = getFurniturePlanFootprint(marker);
  return {
    ...marker,
    x: clamp(marker.x, footprint.w / 2, world.width - footprint.w / 2),
    y: clamp(marker.y, footprint.h / 2, world.height - footprint.h / 2),
  };
}

export function createFurniturePlanMarker(
  kind: FurniturePlanKind,
  point: Point,
  id: string,
): FurniturePlanMarker {
  const definition = getFurniturePlanDefinition(kind);
  return clampFurniturePlanMarker({
    id,
    kind,
    label: definition.label,
    x: point.x,
    y: point.y,
    w: definition.w,
    h: definition.h,
    rotation: 0,
  });
}

export function pointHitsFurniturePlanMarker(
  point: Point,
  marker: FurniturePlanMarker,
  padding = 0,
) {
  const footprint = getFurniturePlanFootprint(marker);
  return (
    Math.abs(point.x - marker.x) <= footprint.w / 2 + padding &&
    Math.abs(point.y - marker.y) <= footprint.h / 2 + padding
  );
}

export function getFurniturePlanResizeHandle(marker: FurniturePlanMarker): Point {
  const footprint = getFurniturePlanFootprint(marker);
  return { x: marker.x + footprint.w / 2, y: marker.y + footprint.h / 2 };
}

export function pointHitsFurniturePlanResizeHandle(
  point: Point,
  marker: FurniturePlanMarker,
  radius = 18,
) {
  const handle = getFurniturePlanResizeHandle(marker);
  return Math.hypot(point.x - handle.x, point.y - handle.y) <= radius;
}

export function resizeFurniturePlanMarkerFromHandle(
  marker: FurniturePlanMarker,
  point: Point,
  world = { width: 1600, height: 1000 },
): FurniturePlanMarker {
  const footprint = getFurniturePlanFootprint(marker);
  const left = marker.x - footprint.w / 2;
  const top = marker.y - footprint.h / 2;
  const width = clamp(point.x - left, MIN_FURNITURE_PLAN_SIZE, MAX_FURNITURE_PLAN_SIZE);
  const height = clamp(point.y - top, MIN_FURNITURE_PLAN_SIZE, MAX_FURNITURE_PLAN_SIZE);
  const resizedWidth = setFurniturePlanFootprintSize(marker, 'width', width);
  const resized = setFurniturePlanFootprintSize(resizedWidth, 'height', height);
  return clampFurniturePlanMarker(
    { ...resized, x: left + width / 2, y: top + height / 2 },
    world,
  );
}

type ViewTransform = {
  cameraX: number;
  cameraY: number;
  zoom: number;
  shakeX?: number;
  shakeY?: number;
};

export function screenToFurniturePlanWorld(point: Point, transform: ViewTransform): Point {
  return {
    x: (point.x - (transform.shakeX ?? 0)) / transform.zoom + transform.cameraX,
    y: (point.y - (transform.shakeY ?? 0)) / transform.zoom + transform.cameraY,
  };
}

export function furniturePlanWorldToScreen(point: Point, transform: ViewTransform): Point {
  return {
    x: (point.x - transform.cameraX) * transform.zoom + (transform.shakeX ?? 0),
    y: (point.y - transform.cameraY) * transform.zoom + (transform.shakeY ?? 0),
  };
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function sanitizeFurniturePlan(value: unknown): FurniturePlanMarker[] {
  const root = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  const candidates = Array.isArray(value)
    ? value
    : root?.version === FURNITURE_PLAN_SCHEMA_VERSION && Array.isArray(root.items)
      ? root.items
      : [];
  const result: FurniturePlanMarker[] = [];
  const ids = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const item = candidate as Record<string, unknown>;
    const kind = item.kind as FurniturePlanKind;
    const rotation = item.rotation as FurniturePlanRotation;
    if (!CATALOG_BY_KIND.has(kind) || !ROTATIONS.has(rotation)) continue;
    if (!finiteNumber(item.x) || !finiteNumber(item.y)) continue;
    const definition = getFurniturePlanDefinition(kind);
    const w = finiteNumber(item.w)
      ? clamp(item.w as number, MIN_FURNITURE_PLAN_SIZE, MAX_FURNITURE_PLAN_SIZE)
      : definition.w;
    const h = finiteNumber(item.h)
      ? clamp(item.h as number, MIN_FURNITURE_PLAN_SIZE, MAX_FURNITURE_PLAN_SIZE)
      : definition.h;
    const rawId = typeof item.id === 'string' ? item.id.slice(0, 80) : '';
    if (!rawId || ids.has(rawId)) continue;
    ids.add(rawId);
    const label =
      typeof item.label === 'string' && item.label.trim()
        ? item.label.trim().slice(0, 24)
        : definition.label;
    result.push(
      clampFurniturePlanMarker({
        id: rawId,
        kind,
        label,
        x: item.x as number,
        y: item.y as number,
        w,
        h,
        rotation,
      }),
    );
    if (result.length >= MAX_FURNITURE_PLAN_MARKERS) break;
  }
  return result;
}

export function parseFurniturePlan(raw: string | null) {
  if (!raw) return [];
  try {
    return sanitizeFurniturePlan(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function serializeFurniturePlan(items: readonly FurniturePlanMarker[]) {
  return JSON.stringify({
    version: FURNITURE_PLAN_SCHEMA_VERSION,
    mapRevision: FURNITURE_PLAN_MAP_REVISION,
    items: sanitizeFurniturePlan({ version: FURNITURE_PLAN_SCHEMA_VERSION, items }),
  });
}
