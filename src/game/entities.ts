import { ARENA, type EnemyKind } from './config';

export type GamePhase = 'start' | 'running' | 'paused' | 'wave-complete' | 'game-over';

export interface Enemy {
  active: boolean;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  score: number;
  radius: number;
  contactTimer: number;
  age: number;
  blinkTimer: number;
  wobble: number;
  hitFlash: number;
  zigzag: number;
}

export interface Bullet {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  life: number;
  pierce: boolean;
  lastHitEnemy: number;
  trailX: number;
  trailY: number;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: number;
}

export interface FloatingText {
  active: boolean;
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

export interface HealingPickup {
  active: boolean;
  x: number;
  y: number;
  age: number;
}

export interface GameSnapshot {
  phase: GamePhase;
  score: number;
  points: number;
  wave: number;
  hp: number;
  enemiesDefeated: number;
  enemiesAlive: number;
  enemiesRemaining: number;
  enemyTypeCounts: Record<EnemyKind, number>;
  weaponLevel: number;
  pulseCooldown: number;
  aimAssist: boolean;
  soundEnabled: boolean;
  voiceEnabled: boolean;
  reduceEffects: boolean;
  bestScore: number;
  healActive: boolean;
  bannerTimer: number;
  gameTime: number;
}

export function createEnemy(): Enemy {
  return {
    active: false, kind: 'cube', x: 0, y: 0, hp: 0, maxHp: 0, speed: 0, damage: 0,
    score: 0, radius: 0, contactTimer: 0, age: 0, blinkTimer: 0, wobble: 0, hitFlash: 0, zigzag: 0,
  };
}

export function createBullet(): Bullet {
  return {
    active: false, x: 0, y: 0, vx: 0, vy: 0, damage: 0, life: 0, pierce: false,
    lastHitEnemy: -1, trailX: 0, trailY: 0,
  };
}

export function createParticle(): Particle {
  return {
    active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 0, kind: 0,
  };
}

export function createFloatingText(): FloatingText {
  return { active: false, x: 0, y: 0, text: '', life: 0, color: '#ffffff' };
}

export function createHealingPickup(): HealingPickup {
  return { active: false, x: 0, y: 0, age: 0 };
}

export function isCollision(aX: number, aY: number, aRadius: number, bX: number, bY: number, bRadius: number): boolean {
  const dx = aX - bX;
  const dy = aY - bY;
  const combinedRadius = aRadius + bRadius;
  return dx * dx + dy * dy <= combinedRadius * combinedRadius;
}

export const HERO_START_X = ARENA.width / 2;
export const HERO_START_Y = ARENA.height / 2;
