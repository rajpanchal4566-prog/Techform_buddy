export const ARENA = {
  width: 960,
  height: 540,
  heroRadius: 28,
  heroMaxHp: 100,
  lowHealthWarning: 25,
  aimRange: 260,
  bulletSpeed: 520,
  bulletLifetime: 1.2,
  pulseDamage: 30,
  pulseRadius: 160,
  pulseCooldown: 12,
  weaponMaxLevel: 5,
  upgradeCostPerLevel: 100,
  baseDamage: 10,
  baseFireRate: 3.3,
  bulletPoolSize: 96,
  enemyPoolSize: 80,
  particlePoolSize: 180,
  contactInterval: 0.8,
  hitInvulnerability: 0.3,
  heroDamageFlash: 0.3,
  waveIntermission: 3,
  healRestore: 20,
  healLifetime: 10,
  healMinInterval: 20,
  healMaxInterval: 30,
  healGuaranteeHp: 30,
  healGuaranteeInterval: 15,
  shadowWave: 3,
  shadowGuaranteedEvery: 5,
  shadowChance: 0.05,
  shadowTeleportDistance: 120,
  shadowTeleportInterval: 3,
  enemyHpPerWave: 0.08,
  enemySpeedPerWave: 0.03,
  enemySpeedCap: 0.6,
  spawnIntervalStart: 1.4,
  spawnIntervalStep: 0.08,
  spawnIntervalMin: 0.45,
  fixedStep: 1 / 60,
  maxFrameDelta: 0.1,
  maxShake: 8,
} as const;

export type EnemyKind = 'cube' | 'triangle' | 'circle' | 'hexagon' | 'shadow';

export interface EnemyConfig {
  hp: number;
  speed: number;
  damage: number;
  score: number;
  radius: number;
}

export const ENEMIES: Record<EnemyKind, EnemyConfig> = {
  cube: { hp: 20, speed: 70, damage: 8, score: 10, radius: 17 },
  triangle: { hp: 12, speed: 130, damage: 5, score: 15, radius: 15 },
  circle: { hp: 60, speed: 55, damage: 6, score: 25, radius: 19 },
  hexagon: { hp: 45, speed: 50, damage: 15, score: 30, radius: 20 },
  shadow: { hp: 140, speed: 80, damage: 20, score: 100, radius: 22 },
};

export const WEAPON_DAMAGE: readonly number[] = [
  ARENA.baseDamage,
  ARENA.baseDamage * 1.25,
  ARENA.baseDamage * 1.25,
  ARENA.baseDamage * 1.25,
  ARENA.baseDamage * 1.25,
];
export const WEAPON_FIRE_RATE: readonly number[] = [
  ARENA.baseFireRate,
  ARENA.baseFireRate,
  ARENA.baseFireRate,
  ARENA.baseFireRate * 1.3,
  ARENA.baseFireRate * 1.3,
];

export function getWaveEnemyCount(wave: number): number {
  return 6 + 4 * Math.max(1, Math.floor(wave));
}

export function getWaveSpawnInterval(wave: number): number {
  return Math.max(ARENA.spawnIntervalMin, ARENA.spawnIntervalStart - (wave - 1) * ARENA.spawnIntervalStep);
}

export function getEnemyScale(wave: number): { hp: number; speed: number } {
  return {
    hp: Math.pow(1 + ARENA.enemyHpPerWave, Math.max(0, wave - 1)),
    speed: 1 + Math.min(ARENA.enemySpeedCap, Math.max(0, wave - 1) * ARENA.enemySpeedPerWave),
  };
}

export function getUpgradeCost(currentLevel: number): number {
  return ARENA.upgradeCostPerLevel * currentLevel;
}
