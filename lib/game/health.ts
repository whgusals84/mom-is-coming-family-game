export const HEALTH_RULES = {
  max: 100,
  hitDamage: 35,
  invulnerabilitySeconds: 2.5,
  momStunSeconds: .9,
  knockbackDistance: 80,
  safeDistance: 280,
  safeDelaySeconds: 8,
  passiveRecoveryPerSecond: 5,
  sinkHeal: 30,
  dadHeal: 40,
} as const;

export function takeDamage(health: number, damage = HEALTH_RULES.hitDamage) {
  return Math.max(0, health - damage);
}

export function restoreHealth(health: number, amount: number) {
  return Math.min(HEALTH_RULES.max, Math.max(0, health + amount));
}

export function healthPercent(health: number) {
  return Math.max(0, Math.min(100, health / HEALTH_RULES.max * 100));
}
