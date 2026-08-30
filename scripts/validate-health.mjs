import assert from 'node:assert/strict';
import { INTERACTION_TEMPLATES } from '../lib/game/data.ts';
import { HEALTH_RULES, healthPercent, restoreHealth, takeDamage } from '../lib/game/health.ts';

let health = HEALTH_RULES.max;
health = takeDamage(health);
assert.equal(health, 65, '첫 번째 접촉 뒤 체력은 65여야 합니다.');
health = takeDamage(health);
assert.equal(health, 30, '두 번째 접촉 뒤 체력은 30이어야 합니다.');
health = takeDamage(health);
assert.equal(health, 0, '세 번째 접촉에서만 체력이 0이 되어야 합니다.');
assert.equal(takeDamage(0), 0, '체력은 음수가 되면 안 됩니다.');
assert.equal(restoreHealth(65, HEALTH_RULES.dadHeal), 100, '회복은 최대 체력을 넘으면 안 됩니다.');
assert.equal(restoreHealth(30, HEALTH_RULES.sinkHeal), 60, '세면대 회복량이 적용되어야 합니다.');
assert.equal(INTERACTION_TEMPLATES.find((item) => item.id === 'heal-sink')?.heal, HEALTH_RULES.sinkHeal, '실제 세면대 회복량은 체력 규칙과 같아야 합니다.');
assert.equal(healthPercent(50), 50, '체력 백분율이 정확해야 합니다.');

console.log('체력 검사 통과: 피해, 게임오버 임계값과 회복 상한이 정상입니다.');
