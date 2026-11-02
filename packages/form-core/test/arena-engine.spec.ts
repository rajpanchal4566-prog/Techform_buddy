import { expect, test } from '@playwright/test';
import { ARENA, ENEMIES, WEAPON_DAMAGE, WEAPON_FIRE_RATE, getEnemyScale, getUpgradeCost, getWaveEnemyCount, getWaveSpawnInterval } from '../../../src/game/config';
import { isCollision } from '../../../src/game/entities';
import { formatArenaText, getArenaCopy, getSafetyTip } from '../../../src/game/i18n';
import { GameEngine } from '../../../src/game/systems';
import { BEST_SCORE_KEY, readBestScore, writeBestScore, type StringStorage } from '../../../src/game/storage';
import { SUPPORTED_LANGUAGES } from '../../../src/lib/languages';

const storage = (): StringStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
};

test('collision uses inclusive circle radii', () => {
  expect(isCollision(0, 0, 5, 10, 0, 5)).toBe(true);
  expect(isCollision(0, 0, 5, 10.1, 0, 5)).toBe(false);
});

test('bullets damage enemies and a killed enemy awards score', () => {
  const game = new GameEngine(123);
  game.start();
  const enemy = game.spawnEnemy('cube', game.heroX + 90, game.heroY);
  expect(enemy).not.toBeNull();
  const before = enemy!.hp;
  const input = { aimX: game.heroX + 100, aimY: game.heroY, hasManualAim: true, pulsePressed: false };
  for (let i = 0; i < 50; i++) game.step(ARENA.fixedStep, input);
  expect(enemy!.hp).toBeLessThan(before);

  const pulseGame = new GameEngine(321);
  pulseGame.start();
  pulseGame.spawnEnemy('cube', pulseGame.heroX + 50, pulseGame.heroY);
  expect(pulseGame.activatePulse()).toBe(true);
  expect(pulseGame.score).toBe(10);
  expect(pulseGame.enemiesDefeated).toBe(1);
});

test('contact damage respects its cooldown and hero invulnerability', () => {
  const game = new GameEngine(1);
  game.start();
  game.spawnEnemy('cube', game.heroX, game.heroY);
  const input = { aimX: game.heroX, aimY: game.heroY, hasManualAim: false, pulsePressed: false };
  game.step(ARENA.fixedStep, input);
  expect(game.hp).toBe(92);
  for (let i = 0; i < 20; i++) game.step(ARENA.fixedStep, input);
  expect(game.hp).toBe(92);
  for (let i = 0; i < 30; i++) game.step(ARENA.fixedStep, input);
  expect(game.hp).toBe(84);
});

test('pause freezes enemy movement and simulation time; cleared waves intermit for three seconds', () => {
  const game = new GameEngine(101);
  game.start();
  const enemy = game.spawnEnemy('cube', game.heroX + 200, game.heroY);
  const input = { aimX: game.heroX, aimY: game.heroY, hasManualAim: false, pulsePressed: false };
  game.step(ARENA.fixedStep, input);
  game.pause();
  const x = enemy!.x;
  const time = game.elapsed;
  for (let i = 0; i < 60; i++) game.step(ARENA.fixedStep, input);
  expect(enemy!.x).toBe(x);
  expect(game.elapsed).toBe(time);
  game.pause();
  enemy!.active = false;
  game.spawnedThisWave = game.spawnTarget;
  game.step(ARENA.fixedStep, input);
  expect(game.phase).toBe('wave-complete');
  for (let i = 0; i <= 3 * 60; i++) game.step(ARENA.fixedStep, input);
  expect(game.wave).toBe(2);
  expect(game.phase).toBe('running');
});

test('wave counts, spawn timing, mix unlocks and scaling follow the configured rules', () => {
  expect(getWaveEnemyCount(1)).toBe(10);
  expect(getWaveEnemyCount(3)).toBe(18);
  expect(getWaveEnemyCount(10)).toBe(46);
  expect(getWaveSpawnInterval(1)).toBe(1.4);
  expect(getWaveSpawnInterval(20)).toBe(ARENA.spawnIntervalMin);
  expect(getEnemyScale(2)).toEqual({ hp: 1.08, speed: 1.03 });
  expect(getEnemyScale(30).speed).toBe(1.6);
  expect(ENEMIES.shadow.hp).toBe(140);
});

test('scoring and weapon upgrades consume the expected points and apply weapon levels', () => {
  const game = new GameEngine(5);
  game.start();
  expect(getUpgradeCost(1)).toBe(100);
  expect(getUpgradeCost(3)).toBe(300);
  expect(game.upgradeWeapon()).toBe(false);
  game.points = 100;
  expect(game.upgradeWeapon()).toBe(true);
  expect(game.weaponLevel).toBe(2);
  expect(game.points).toBe(0);
  game.points = 1000;
  expect(game.upgradeWeapon()).toBe(true);
  expect(game.weaponLevel).toBe(3);
  expect(game.points).toBe(800);
});

test('weapon damage, double shot, fire rate and piercing follow the level upgrades', () => {
  const levelTwo = new GameEngine(12);
  levelTwo.start();
  levelTwo.weaponLevel = 2;
  levelTwo.spawnEnemy('cube', levelTwo.heroX + 180, levelTwo.heroY);
  levelTwo.step(ARENA.fixedStep, { aimX: levelTwo.heroX + 200, aimY: levelTwo.heroY, hasManualAim: true, pulsePressed: false });
  expect(levelTwo.bullets.find((bullet) => bullet.active)?.damage).toBe(WEAPON_DAMAGE[1]);

  const levelThree = new GameEngine(14);
  levelThree.start();
  levelThree.weaponLevel = 3;
  levelThree.spawnEnemy('cube', levelThree.heroX + 180, levelThree.heroY);
  levelThree.step(ARENA.fixedStep, { aimX: levelThree.heroX + 200, aimY: levelThree.heroY, hasManualAim: true, pulsePressed: false });
  expect(levelThree.totalShots).toBe(2);
  expect(WEAPON_FIRE_RATE[3]).toBeGreaterThan(WEAPON_FIRE_RATE[0]);

  const piercing = new GameEngine(15);
  piercing.start();
  piercing.weaponLevel = 5;
  const first = piercing.spawnEnemy('cube', piercing.heroX + 78, piercing.heroY);
  const second = piercing.spawnEnemy('cube', piercing.heroX + 130, piercing.heroY);
  const aim = { aimX: piercing.heroX + 160, aimY: piercing.heroY, hasManualAim: true, pulsePressed: false };
  for (let i = 0; i < 20; i++) piercing.step(ARENA.fixedStep, aim);
  expect(first!.hp).toBeLessThan(first!.maxHp);
  expect(second!.hp).toBeLessThan(second!.maxHp);
});

test('Pulse damages only enemies in range and observes its 12-second cooldown', () => {
  const game = new GameEngine(21);
  game.start();
  const near = game.spawnEnemy('cube', game.heroX + 100, game.heroY);
  const far = game.spawnEnemy('cube', game.heroX + 180, game.heroY);
  expect(game.activatePulse()).toBe(true);
  expect(near!.active).toBe(false);
  expect(far!.hp).toBe(far!.maxHp);
  expect(game.pulseCooldown).toBe(ARENA.pulseCooldown);
  expect(game.activatePulse()).toBe(false);
});

test('healing pickup restores health without exceeding 100 HP', () => {
  const game = new GameEngine(2);
  game.start();
  game.hp = 90;
  game.spawnHeal(game.heroX, game.heroY);
  game.step(ARENA.fixedStep, { aimX: 0, aimY: 0, hasManualAim: false, pulsePressed: false });
  expect(game.hp).toBe(100);
  expect(game.pickup.active).toBe(false);
  expect(game.snapshot().healMessage).toBe('+20 HP');
});

test('hero reaching zero health triggers game over and tracks the final score', () => {
  const game = new GameEngine(2);
  game.start();
  game.score = 45;
  expect(game.damageHero(100)).toBe(true);
  expect(game.hp).toBe(0);
  expect(game.phase).toBe('game-over');
  expect(game.bestScore).toBe(45);
});

test('best-score persistence keeps the highest valid score and tolerates storage failures', () => {
  const saved = storage();
  expect(readBestScore(saved)).toBe(0);
  expect(writeBestScore(saved, 50)).toBe(50);
  expect(writeBestScore(saved, 20)).toBe(50);
  expect(saved.getItem(BEST_SCORE_KEY)).toBe('50');
  expect(writeBestScore(saved, 73)).toBe(73);

  const blockedStorage: StringStorage = {
    getItem: () => { throw new Error('Storage disabled'); },
    setItem: () => { throw new Error('Storage disabled'); },
  };
  expect(readBestScore(blockedStorage)).toBe(0);
  expect(writeBestScore(blockedStorage, 10)).toBe(10);
});

test('all supported app languages have localized game copy and safety tips', () => {
  for (const language of SUPPORTED_LANGUAGES) {
    const copy = getArenaCopy(language.code);
    expect(copy.tagline.length).toBeGreaterThan(0);
    expect(copy.safetyTips).toHaveLength(3);
    expect(getSafetyTip(language.code, 1)).toBe(copy.safetyTips[0]);
    expect(getSafetyTip(language.code, 4)).toBe(copy.safetyTips[0]);
  }
  expect(formatArenaText(getArenaCopy('hi').waveComplete, { n: 3 })).toContain('3');
  expect(getArenaCopy('unsupported').tagline).toBe(getArenaCopy('en').tagline);
});
