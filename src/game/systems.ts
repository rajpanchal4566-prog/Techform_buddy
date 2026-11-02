import {
  ARENA, ENEMIES, WEAPON_DAMAGE, WEAPON_FIRE_RATE, getEnemyScale, getUpgradeCost, getWaveEnemyCount,
  getWaveSpawnInterval, type EnemyKind,
} from './config';
import {
  createBullet, createEnemy, createFloatingText, createHealingPickup, createParticle,
  HERO_START_X, HERO_START_Y, isCollision, type Bullet, type Enemy, type FloatingText,
  type GamePhase, type GameSnapshot, type HealingPickup, type Particle,
} from './entities';
import { SeededRandom } from './rng';

export interface GameInput {
  aimX: number;
  aimY: number;
  hasManualAim: boolean;
  pulsePressed: boolean;
}

export class GameEngine {
  readonly enemies: Enemy[] = Array.from({ length: ARENA.enemyPoolSize }, createEnemy);
  readonly bullets: Bullet[] = Array.from({ length: ARENA.bulletPoolSize }, createBullet);
  readonly particles: Particle[] = Array.from({ length: ARENA.particlePoolSize }, createParticle);
  readonly floatingTexts: FloatingText[] = Array.from({ length: 32 }, createFloatingText);
  readonly pickup: HealingPickup = createHealingPickup();
  random: SeededRandom;

  phase: GamePhase = 'start';
  score: number = 0;
  points: number = 0;
  wave: number = 1;
  hp: number = ARENA.heroMaxHp;
  enemiesDefeated: number = 0;
  weaponLevel: number = 1;
  pulseCooldown: number = 0;
  aimAssist = true;
  soundEnabled = true;
  voiceEnabled = false;
  reduceEffects = false;
  bestScore: number = 0;
  heroX: number = HERO_START_X;
  heroY: number = HERO_START_Y;
  heroAngle: number = -Math.PI / 2;
  heroRecoil: number = 0;
  heroFlash: number = 0;
  heroInvulnerability: number = 0;
  heroLowPulse: number = 0;
  elapsed: number = 0;
  waveElapsed: number = 0;
  spawnTimer: number = 0;
  spawnedThisWave: number = 0;
  spawnTarget: number = getWaveEnemyCount(1);
  waveBanner: number = 0;
  shake: number = 0;
  healSpawnTimer: number = ARENA.healMinInterval;
  timeSinceHealSeen: number = ARENA.healGuaranteeInterval;
  totalShots: number = 0;
  totalHits: number = 0;
  private fireTimer: number = 0;

  constructor(seed?: number) {
    this.random = new SeededRandom(seed);
  }

  start(): void {
    if (this.phase !== 'start') return;
    this.phase = 'running';
    this.wave = 1;
    this.spawnTarget = getWaveEnemyCount(this.wave);
    this.spawnedThisWave = 0;
    this.spawnTimer = 0;
  }

  pause(): void {
    if (this.phase === 'running') this.phase = 'paused';
    else if (this.phase === 'paused') this.phase = 'running';
  }

  restart(seed?: number): void {
    this.phase = 'start';
    this.score = 0;
    this.points = 0;
    this.wave = 1;
    this.hp = ARENA.heroMaxHp;
    this.enemiesDefeated = 0;
    this.weaponLevel = 1;
    this.pulseCooldown = 0;
    this.heroX = HERO_START_X;
    this.heroY = HERO_START_Y;
    this.heroAngle = -Math.PI / 2;
    this.heroRecoil = 0;
    this.heroFlash = 0;
    this.heroInvulnerability = 0;
    this.heroLowPulse = 0;
    this.elapsed = 0;
    this.waveElapsed = 0;
    this.spawnTimer = 0;
    this.spawnedThisWave = 0;
    this.spawnTarget = getWaveEnemyCount(1);
    this.waveBanner = 0;
    this.shake = 0;
    this.healSpawnTimer = ARENA.healMinInterval;
    this.timeSinceHealSeen = ARENA.healGuaranteeInterval;
    this.totalShots = 0;
    this.totalHits = 0;
    this.fireTimer = 0;
    this.random = new SeededRandom(seed);
    this.clearPooledEntities();
  }

  setAim(x: number, y: number): void {
    const dx = x - this.heroX;
    const dy = y - this.heroY;
    if (dx * dx + dy * dy > 16) this.heroAngle = Math.atan2(dy, dx);
  }

  spawnEnemy(kind: EnemyKind, x?: number, y?: number): Enemy | null {
    const enemy = this.firstInactive(this.enemies);
    if (!enemy) return null;
    const stats = ENEMIES[kind];
    const scale = getEnemyScale(this.wave);
    enemy.active = true;
    enemy.kind = kind;
    enemy.x = x ?? this.random.range(30, ARENA.width - 30);
    enemy.y = y ?? this.random.range(30, ARENA.height - 30);
    enemy.hp = stats.hp * scale.hp;
    enemy.maxHp = enemy.hp;
    enemy.speed = stats.speed * scale.speed;
    enemy.damage = stats.damage;
    enemy.score = stats.score;
    enemy.radius = stats.radius;
    enemy.contactTimer = 0;
    enemy.age = 0;
    enemy.blinkTimer = this.random.range(ARENA.shadowTeleportInterval - 0.5, ARENA.shadowTeleportInterval);
    enemy.wobble = this.random.range(0, Math.PI * 2);
    enemy.hitFlash = 0;
    enemy.zigzag = this.random.range(0, Math.PI * 2);
    return enemy;
  }

  spawnHeal(x = this.random.range(100, ARENA.width - 100), y = this.random.range(80, ARENA.height - 80)): void {
    this.pickup.active = true;
    this.pickup.x = x;
    this.pickup.y = y;
    this.pickup.age = 0;
    this.timeSinceHealSeen = 0;
  }

  damageHero(amount: number): boolean {
    if (this.heroInvulnerability > 0 || this.phase !== 'running') return false;
    this.hp = Math.max(0, this.hp - amount);
    this.heroInvulnerability = ARENA.hitInvulnerability;
    this.heroFlash = ARENA.heroDamageFlash;
    if (!this.reduceEffects) this.shake = Math.min(ARENA.maxShake, this.shake + 4);
    if (this.hp === 0) {
      this.phase = 'game-over';
      this.bestScore = Math.max(this.bestScore, this.score);
      this.clearProjectiles();
    }
    return true;
  }

  upgradeWeapon(): boolean {
    const cost = getUpgradeCost(this.weaponLevel);
    if (this.weaponLevel >= ARENA.weaponMaxLevel || this.points < cost) return false;
    this.points -= cost;
    this.weaponLevel += 1;
    return true;
  }

  activatePulse(): boolean {
    if (this.phase !== 'running' || this.pulseCooldown > 0) return false;
    this.pulseCooldown = ARENA.pulseCooldown;
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      if (enemy.active && isCollision(this.heroX, this.heroY, ARENA.pulseRadius, enemy.x, enemy.y, 0)) {
        this.damageEnemy(enemy, ARENA.pulseDamage);
      }
    }
    return true;
  }

  step(dt: number, input: GameInput): void {
    if (this.phase === 'paused') return;
    this.elapsed += dt;
    this.heroLowPulse += dt;
    this.heroRecoil = Math.max(0, this.heroRecoil - dt * 5);
    this.heroFlash = Math.max(0, this.heroFlash - dt);
    this.heroInvulnerability = Math.max(0, this.heroInvulnerability - dt);
    this.waveBanner = Math.max(0, this.waveBanner - dt);
    this.shake = Math.max(0, this.shake - dt * 24);

    if (this.phase === 'wave-complete') {
      this.updateAmbientParticles(dt);
      if (this.waveBanner <= 0) this.finishIntermission();
      return;
    }

    if (this.phase !== 'running') {
      this.updateAmbientParticles(dt);
      return;
    }

    this.waveElapsed += dt;
    this.timeSinceHealSeen += dt;
    this.pulseCooldown = Math.max(0, this.pulseCooldown - dt);
    this.fireTimer -= dt;
    if (input.hasManualAim) this.setAim(input.aimX, input.aimY);
    else this.updateAutoAim();
    if (input.pulsePressed) this.activatePulse();
    this.updateSpawns(dt);
    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updateHealing(dt);
    this.updateParticles(dt);
    this.updateFloatingTexts(dt);
    this.updateFiring(input.hasManualAim);
    this.completeWaveIfReady();
  }

  snapshot(): GameSnapshot {
    let alive = 0;
    let healMessage = '';
    const enemyTypeCounts: Record<EnemyKind, number> = { cube: 0, triangle: 0, circle: 0, hexagon: 0, shadow: 0 };
    for (let i = 0; i < this.enemies.length; i++) {
      if (!this.enemies[i].active) continue;
      alive++;
      enemyTypeCounts[this.enemies[i].kind]++;
    }
    for (let i = 0; i < this.floatingTexts.length; i++) {
      if (this.floatingTexts[i].active && this.floatingTexts[i].text === '+20 HP') {
        healMessage = this.floatingTexts[i].text;
        break;
      }
    }
    return {
      phase: this.phase,
      score: this.score,
      points: this.points,
      wave: this.wave,
      hp: this.hp,
      enemiesDefeated: this.enemiesDefeated,
      enemiesAlive: alive,
      enemiesRemaining: Math.max(0, this.spawnTarget - this.spawnedThisWave + alive),
      enemyTypeCounts,
      weaponLevel: this.weaponLevel,
      pulseCooldown: this.pulseCooldown,
      aimAssist: this.aimAssist,
      soundEnabled: this.soundEnabled,
      voiceEnabled: this.voiceEnabled,
      reduceEffects: this.reduceEffects,
      bestScore: this.bestScore,
      healActive: this.pickup.active,
      healMessage,
      bannerTimer: this.waveBanner,
      gameTime: this.elapsed,
    };
  }

  private updateAutoAim(): void {
    if (!this.aimAssist) return;
    let nearest: Enemy | null = null;
    let nearestDistance = ARENA.aimRange * ARENA.aimRange;
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      if (!enemy.active) continue;
      const dx = enemy.x - this.heroX;
      const dy = enemy.y - this.heroY;
      const distance = dx * dx + dy * dy;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = enemy;
      }
    }
    if (nearest) this.heroAngle = Math.atan2(nearest.y - this.heroY, nearest.x - this.heroX);
  }

  private updateSpawns(dt: number): void {
    if (this.spawnedThisWave >= this.spawnTarget) return;
    this.spawnTimer += dt;
    if (this.spawnTimer < getWaveSpawnInterval(this.wave)) return;
    this.spawnTimer = 0;
    const kind = this.chooseEnemyKind();
    const edge = this.random.int(4);
    let x = edge === 0 ? -24 : edge === 1 ? ARENA.width + 24 : this.random.range(0, ARENA.width);
    let y = edge === 2 ? -24 : edge === 3 ? ARENA.height + 24 : this.random.range(0, ARENA.height);
    if (x >= 0 && x <= ARENA.width && y >= 0 && y <= ARENA.height) {
      if (edge < 2) y = this.random.int(2) === 0 ? -24 : ARENA.height + 24;
      else x = this.random.int(2) === 0 ? -24 : ARENA.width + 24;
    }
    const enemy = this.spawnEnemy(kind, x, y);
    if (enemy) this.spawnedThisWave++;
    else this.spawnTimer = getWaveSpawnInterval(this.wave) * 0.5;
  }

  private chooseEnemyKind(): EnemyKind {
    const roll = this.random.next();
    if (this.wave >= ARENA.shadowWave && this.wave % ARENA.shadowGuaranteedEvery === 0 &&
      this.spawnedThisWave === this.spawnTarget - 1) return 'shadow';
    if (this.wave >= ARENA.shadowWave && roll < ARENA.shadowChance) return 'shadow';
    if (this.wave >= 4 && roll < 0.24) return 'hexagon';
    if (this.wave >= 3 && roll < 0.46) return 'circle';
    if (this.wave >= 2 && roll < 0.68) return 'triangle';
    return 'cube';
  }

  private updateFiring(hasManualAim: boolean): void {
    if (this.fireTimer > 0 || this.phase !== 'running') return;
    let target: Enemy | null = null;
    let targetDistance = ARENA.aimRange * ARENA.aimRange;
    let targetX = this.heroX + Math.cos(this.heroAngle) * ARENA.aimRange;
    let targetY = this.heroY + Math.sin(this.heroAngle) * ARENA.aimRange;
    if (!hasManualAim) {
      for (let i = 0; i < this.enemies.length; i++) {
        const enemy = this.enemies[i];
        if (!enemy.active) continue;
        const dx = enemy.x - this.heroX;
        const dy = enemy.y - this.heroY;
        const distance = dx * dx + dy * dy;
        if (distance < targetDistance) {
          targetDistance = distance;
          target = enemy;
          targetX = enemy.x;
          targetY = enemy.y;
        }
      }
    }
    if (!target && !hasManualAim) return;
    const dx = targetX - this.heroX;
    const dy = targetY - this.heroY;
    const shotCount = this.weaponLevel >= 3 ? 2 : 1;
    const spread = shotCount === 2 ? 0.075 : 0;
    for (let shot = 0; shot < shotCount; shot++) {
      const angle = Math.atan2(dy, dx) + (shot === 0 ? -spread : spread);
      this.fireBullet(angle);
    }
    this.totalShots += shotCount;
    this.heroRecoil = 1;
    this.fireTimer = 1 / WEAPON_FIRE_RATE[this.weaponLevel - 1];
  }

  private fireBullet(angle: number): void {
    const bullet = this.firstInactive(this.bullets);
    if (!bullet) return;
    const originDistance = ARENA.heroRadius - 2;
    bullet.active = true;
    bullet.x = this.heroX + Math.cos(angle) * originDistance;
    bullet.y = this.heroY + Math.sin(angle) * originDistance;
    bullet.vx = Math.cos(angle) * ARENA.bulletSpeed;
    bullet.vy = Math.sin(angle) * ARENA.bulletSpeed;
    bullet.damage = WEAPON_DAMAGE[this.weaponLevel - 1];
    bullet.life = ARENA.bulletLifetime;
    bullet.pierce = this.weaponLevel >= 5;
    bullet.lastHitEnemy = -1;
    bullet.trailX = bullet.x;
    bullet.trailY = bullet.y;
  }

  private updateBullets(dt: number): void {
    for (let i = 0; i < this.bullets.length; i++) {
      const bullet = this.bullets[i];
      if (!bullet.active) continue;
      bullet.trailX = bullet.x;
      bullet.trailY = bullet.y;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0 || bullet.x < -30 || bullet.x > ARENA.width + 30 || bullet.y < -30 || bullet.y > ARENA.height + 30) {
        bullet.active = false;
        continue;
      }
      if (bullet.lastHitEnemy >= 0) {
        const lastEnemy = this.enemies[bullet.lastHitEnemy];
        if (!lastEnemy.active || !isCollision(bullet.x, bullet.y, 4, lastEnemy.x, lastEnemy.y, lastEnemy.radius)) {
          bullet.lastHitEnemy = -1;
        }
      }
      for (let j = 0; j < this.enemies.length; j++) {
        const enemy = this.enemies[j];
        if (!enemy.active || bullet.lastHitEnemy === j) continue;
        if (isCollision(bullet.x, bullet.y, 4, enemy.x, enemy.y, enemy.radius)) {
          this.damageEnemy(enemy, bullet.damage);
          this.totalHits++;
          bullet.lastHitEnemy = j;
          if (!bullet.pierce) {
            bullet.active = false;
            break;
          }
        }
      }
    }
  }

  private updateEnemies(dt: number): void {
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      if (!enemy.active) continue;
      enemy.age += dt;
      enemy.contactTimer = Math.max(0, enemy.contactTimer - dt);
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.wobble += dt * (enemy.kind === 'triangle' ? 7 : 3);
      if (enemy.kind === 'circle') enemy.hp = Math.min(enemy.maxHp, enemy.hp + dt * 0.7);
      if (enemy.kind === 'shadow') {
        enemy.blinkTimer -= dt;
        if (enemy.blinkTimer <= 0) {
          enemy.blinkTimer = ARENA.shadowTeleportInterval;
          const angle = Math.atan2(this.heroY - enemy.y, this.heroX - enemy.x);
          enemy.x += Math.cos(angle) * ARENA.shadowTeleportDistance;
          enemy.y += Math.sin(angle) * ARENA.shadowTeleportDistance;
          enemy.x = Math.max(16, Math.min(ARENA.width - 16, enemy.x));
          enemy.y = Math.max(16, Math.min(ARENA.height - 16, enemy.y));
        }
      }

      const dx = this.heroX - enemy.x;
      const dy = this.heroY - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      if (distance > ARENA.heroRadius + enemy.radius) {
        const zigzag = enemy.kind === 'triangle' ? Math.sin(enemy.wobble + enemy.zigzag) * 0.34 : 0;
        const angle = Math.atan2(dy, dx) + zigzag;
        enemy.x += Math.cos(angle) * enemy.speed * dt;
        enemy.y += Math.sin(angle) * enemy.speed * dt;
      } else if (enemy.contactTimer <= 0) {
        enemy.contactTimer = ARENA.contactInterval;
        this.damageHero(enemy.damage);
      }
    }
  }

  private updateHealing(dt: number): void {
    if (this.pickup.active) {
      this.pickup.age += dt;
      if (isCollision(this.heroX, this.heroY, ARENA.heroRadius, this.pickup.x, this.pickup.y, 12)) {
        this.pickup.active = false;
        this.hp = Math.min(ARENA.heroMaxHp, this.hp + ARENA.healRestore);
        this.addFloatingText(this.heroX, this.heroY - 38, '+20 HP', '#4ade80');
        this.emitParticles(this.heroX, this.heroY, 20, 1);
      } else if (this.pickup.age >= ARENA.healLifetime) {
        this.pickup.active = false;
      }
      return;
    }
    this.healSpawnTimer -= dt;
    if (this.hp < ARENA.healGuaranteeHp && this.timeSinceHealSeen >= ARENA.healGuaranteeInterval) {
      this.spawnHeal();
      this.healSpawnTimer = this.random.range(ARENA.healMinInterval, ARENA.healMaxInterval);
    } else if (this.healSpawnTimer <= 0) {
      this.spawnHeal();
      this.healSpawnTimer = this.random.range(ARENA.healMinInterval, ARENA.healMaxInterval);
    }
  }

  private damageEnemy(enemy: Enemy, amount: number): void {
    enemy.hp -= amount;
    enemy.hitFlash = 0.12;
    if (enemy.hp > 0) {
      this.addFloatingText(enemy.x, enemy.y - enemy.radius, String(Math.round(amount)), '#ffffff');
      return;
    }
    enemy.active = false;
    this.enemiesDefeated++;
    this.score += enemy.score;
    this.points += enemy.score;
    this.emitParticles(enemy.x, enemy.y, 9, 0);
  }

  private completeWaveIfReady(): void {
    if (this.spawnedThisWave !== this.spawnTarget) return;
    for (let i = 0; i < this.enemies.length; i++) if (this.enemies[i].active) return;
    this.phase = 'wave-complete';
    this.waveBanner = ARENA.waveIntermission;
  }

  finishIntermission(): void {
    if (this.phase !== 'wave-complete') return;
    this.wave++;
    this.spawnTarget = getWaveEnemyCount(this.wave);
    this.spawnedThisWave = 0;
    this.spawnTimer = 0;
    this.waveElapsed = 0;
    this.phase = 'running';
  }

  private emitParticles(x: number, y: number, count: number, kind: number): void {
    if (this.reduceEffects) count = Math.min(2, count);
    for (let n = 0; n < count; n++) {
      const particle = this.firstInactive(this.particles);
      if (!particle) return;
      const angle = this.random.range(0, Math.PI * 2);
      const speed = this.random.range(35, kind === 1 ? 105 : 140);
      particle.active = true;
      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;
      particle.maxLife = particle.life = this.random.range(0.2, 0.55);
      particle.size = this.random.range(2, 5);
      particle.kind = kind;
    }
  }

  private updateParticles(dt: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) particle.active = false;
      else {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 0.985;
        particle.vy *= 0.985;
      }
    }
  }

  private updateAmbientParticles(dt: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) particle.active = false;
      else {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
      }
    }
    this.updateFloatingTexts(dt);
  }

  private updateFloatingTexts(dt: number): void {
    for (let i = 0; i < this.floatingTexts.length; i++) {
      const text = this.floatingTexts[i];
      if (!text.active) continue;
      text.life -= dt;
      text.y -= 25 * dt;
      if (text.life <= 0) text.active = false;
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string): void {
    const item = this.firstInactive(this.floatingTexts);
    if (!item) return;
    item.active = true;
    item.x = x;
    item.y = y;
    item.text = text;
    item.life = 0.75;
    item.color = color;
  }

  private clearProjectiles(): void {
    for (let i = 0; i < this.bullets.length; i++) this.bullets[i].active = false;
  }

  private clearPooledEntities(): void {
    for (let i = 0; i < this.enemies.length; i++) this.enemies[i].active = false;
    this.clearProjectiles();
    for (let i = 0; i < this.particles.length; i++) this.particles[i].active = false;
    for (let i = 0; i < this.floatingTexts.length; i++) this.floatingTexts[i].active = false;
    this.pickup.active = false;
  }

  private firstInactive<T extends { active: boolean }>(items: T[]): T | null {
    for (let i = 0; i < items.length; i++) if (!items[i].active) return items[i];
    return null;
  }
}
