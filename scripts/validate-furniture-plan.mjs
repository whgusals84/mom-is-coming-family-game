import assert from 'node:assert/strict';
import {
  clampFurniturePlanMarker,
  createFurniturePlanMarker,
  furniturePlanWorldToScreen,
  getFurniturePlanFootprint,
  getFurniturePlanResizeHandle,
  parseFurniturePlan,
  pointHitsFurniturePlanMarker,
  pointHitsFurniturePlanResizeHandle,
  resizeFurniturePlanMarkerFromHandle,
  sanitizeFurniturePlan,
  screenToFurniturePlanWorld,
  setFurniturePlanFootprintSize,
  serializeFurniturePlan,
} from '../lib/game/furniture-plan.ts';

const marker = createFurniturePlanMarker('bed', { x: 20, y: 20 }, 'bed-1');
assert.equal(marker.x, 55, '침대는 지도 왼쪽 밖으로 나가면 안 됩니다.');
assert.equal(marker.y, 85, '침대는 지도 위쪽 밖으로 나가면 안 됩니다.');
assert.deepEqual(getFurniturePlanFootprint(marker), { w: 110, h: 170 });

const rotated = clampFurniturePlanMarker({ ...marker, id: 'bed-2', rotation: 90, x: 20, y: 20 });
assert.deepEqual(getFurniturePlanFootprint(rotated), { w: 170, h: 110 });
assert.equal(rotated.x, 85);
assert.equal(rotated.y, 55);
assert.equal(pointHitsFurniturePlanMarker({ x: rotated.x + 85, y: rotated.y }, rotated), true);
assert.equal(pointHitsFurniturePlanMarker({ x: rotated.x + 86, y: rotated.y }, rotated), false);

const resized = setFurniturePlanFootprintSize(rotated, 'width', 220);
assert.deepEqual(getFurniturePlanFootprint(resized), { w: 220, h: 110 }, '회전 후에도 지도 기준 가로 크기를 조절해야 합니다.');
const resizedAgain = setFurniturePlanFootprintSize(resized, 'height', 80);
assert.deepEqual(getFurniturePlanFootprint(resizedAgain), { w: 220, h: 80 }, '지도 기준 세로 크기를 조절해야 합니다.');
assert.deepEqual(getFurniturePlanFootprint(setFurniturePlanFootprintSize(marker, 'width', 999)), { w: 320, h: 170 });
assert.deepEqual(getFurniturePlanFootprint(setFurniturePlanFootprintSize(marker, 'height', 1)), { w: 110, h: 28 });

const resizeHandle = getFurniturePlanResizeHandle(rotated);
assert.equal(pointHitsFurniturePlanResizeHandle(resizeHandle, rotated), true);
assert.equal(pointHitsFurniturePlanResizeHandle({ x: resizeHandle.x + 19, y: resizeHandle.y }, rotated), false);
const draggedResize = resizeFurniturePlanMarkerFromHandle(rotated, {
  x: rotated.x - 85 + 230,
  y: rotated.y - 55 + 90,
});
assert.deepEqual(getFurniturePlanFootprint(draggedResize), { w: 230, h: 90 });
assert.equal(draggedResize.x, rotated.x - 85 + 115, '크기를 바꿀 때 왼쪽 모서리가 고정되어야 합니다.');
assert.equal(draggedResize.y, rotated.y - 55 + 45, '크기를 바꿀 때 위쪽 모서리가 고정되어야 합니다.');

const saved = serializeFurniturePlan([marker, rotated]);
const loaded = parseFurniturePlan(saved);
assert.equal(loaded.length, 2, '저장한 가구 표시가 다시 불러와져야 합니다.');
assert.deepEqual(loaded[0], marker);
assert.deepEqual(parseFurniturePlan('{broken'), [], '손상된 저장값은 빈 배치로 복구해야 합니다.');

const invalid = sanitizeFurniturePlan({
  version: 1,
  items: [
    marker,
    { ...marker, label: 'duplicate' },
    { ...marker, id: 'bad-kind', kind: 'spaceship' },
    { ...marker, id: 'bad-number', x: Number.NaN },
  ],
});
assert.equal(invalid.length, 1, '중복 ID와 잘못된 가구 데이터는 제외해야 합니다.');

for (const zoom of [0.62, 1, 1.18]) {
  for (const transform of [
    { cameraX: 0, cameraY: 0, zoom },
    { cameraX: 430, cameraY: 210, zoom, shakeX: 4, shakeY: -3 },
    { cameraX: 900, cameraY: 380, zoom },
  ]) {
    const world = { x: 740, y: 615 };
    const screen = furniturePlanWorldToScreen(world, transform);
    const roundTrip = screenToFurniturePlanWorld(screen, transform);
    assert.ok(Math.abs(roundTrip.x - world.x) < 1e-9);
    assert.ok(Math.abs(roundTrip.y - world.y) < 1e-9);
  }
}

console.log('가구 배치 표시 검사 통과: 저장, 직접 이동·크기 조절, 회전, 경계와 화면 좌표가 정상입니다.');
