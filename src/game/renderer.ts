import { ARENA, type EnemyKind } from './config';
import type { GameEngine } from './systems';
import type { ArenaCopy } from './i18n';

const COLORS: Record<EnemyKind, string> = {
  cube: '#ef4444',
  triangle: '#a855f7',
  circle: '#22c55e',
  hexagon: '#f59e0b',
  shadow: '#64748b',
};

export class GameRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly starsX = new Float32Array(68);
  private readonly starsY = new Float32Array(68);
  private dpr = 1;

  constructor(private readonly canvas: HTMLCanvasElement, seed = 32767) {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas 2D context is unavailable.');
    this.context = context;
    let value = seed;
    for (let i = 0; i < this.starsX.length; i++) {
      value = (value * 1664525 + 1013904223) >>> 0;
      this.starsX[i] = (value / 0x100000000) * ARENA.width;
      value = (value * 1664525 + 1013904223) >>> 0;
      this.starsY[i] = (value / 0x100000000) * ARENA.height;
    }
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
  }

  render(engine: GameEngine, time: number, copy: ArenaCopy): void {
    const ctx = this.context;
    const scaleX = this.canvas.width / ARENA.width;
    const scaleY = this.canvas.height / ARENA.height;
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);

    const shakeX = engine.reduceEffects ? 0 : Math.sin(time * 52) * engine.shake;
    const shakeY = engine.reduceEffects ? 0 : Math.cos(time * 48) * engine.shake;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    this.drawBackground(time);
    this.drawPickup(engine, time);
    this.drawBullets(engine);
    this.drawEnemies(engine, time);
    this.drawHero(engine, time);
    this.drawEffects(engine, copy);
    ctx.restore();

  }

  private drawBackground(time: number): void {
    const ctx = this.context;
    ctx.strokeStyle = 'rgba(59,130,246,0.07)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= ARENA.width; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ARENA.height);
      ctx.stroke();
    }
    for (let y = 0; y <= ARENA.height; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ARENA.width, y);
      ctx.stroke();
    }
    for (let i = 0; i < this.starsX.length; i++) {
      const y = (this.starsY[i] + time * (8 + (i % 5) * 2)) % ARENA.height;
      ctx.globalAlpha = 0.25 + (i % 4) * 0.12;
      ctx.fillStyle = i % 7 === 0 ? '#38bdf8' : '#cbd5e1';
      ctx.fillRect(this.starsX[i], y, i % 6 === 0 ? 2 : 1, i % 6 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;
  }

  private drawHero(engine: GameEngine, time: number): void {
    const ctx = this.context;
    const low = engine.hp < ARENA.lowHealthWarning;
    const bob = engine.phase === 'start' || engine.phase === 'paused' ? Math.sin(time * 2.2) * 3 : Math.sin(time * 4) * 1.5;
    const x = engine.heroX;
    const y = engine.heroY + bob;
    const flash = engine.heroFlash > 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(engine.heroAngle);
    ctx.shadowColor = low ? '#ef4444' : '#8b5cf6';
    ctx.shadowBlur = low ? 25 + Math.sin(time * 8) * 8 : 22;
    ctx.fillStyle = flash ? '#fca5a5' : '#6366f1';
    ctx.strokeStyle = '#c4b5fd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-22 - engine.heroRecoil * 2, -22, 44, 44, 13);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-14, -11, 28, 22, 7);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.ellipse(-5, -2, 3.2, 4.3, 0, 0, Math.PI * 2);
    ctx.ellipse(6, -2, 3.2, 4.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, 7);
    ctx.quadraticCurveTo(0, 10, 4, 7);
    ctx.stroke();
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(0, -29);
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, -31, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(-24, 0, 5, 0, Math.PI * 2);
    ctx.arc(24, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawEnemies(engine: GameEngine, time: number): void {
    const ctx = this.context;
    for (let i = 0; i < engine.enemies.length; i++) {
      const enemy = engine.enemies[i];
      if (!enemy.active) continue;
      const color = enemy.hitFlash > 0 ? '#ffffff' : COLORS[enemy.kind];
      const wobble = Math.sin(enemy.wobble) * 0.08;
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(wobble);
      ctx.globalAlpha = enemy.kind === 'shadow' && enemy.blinkTimer > 2.65 ? 0.4 : 1;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      this.enemyPath(ctx, enemy.kind, enemy.radius);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(-enemy.radius * 0.28, -2, 2.2, 0, Math.PI * 2);
      ctx.arc(enemy.radius * 0.28, -2, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-4, enemy.radius * 0.3);
      ctx.lineTo(0, enemy.radius * 0.38 + Math.sin(time * 3 + enemy.age) * 1.5);
      ctx.lineTo(4, enemy.radius * 0.3);
      ctx.stroke();
      if (enemy.kind === 'hexagon') {
        ctx.strokeStyle = '#fff7ed';
        ctx.beginPath();
        ctx.moveTo(-enemy.radius * 0.55, -enemy.radius * 0.65);
        ctx.lineTo(-enemy.radius * 0.9, -enemy.radius * 1.1);
        ctx.moveTo(enemy.radius * 0.55, -enemy.radius * 0.65);
        ctx.lineTo(enemy.radius * 0.9, -enemy.radius * 1.1);
        ctx.stroke();
      }
      ctx.restore();
      if (enemy.hp < enemy.maxHp) {
        ctx.fillStyle = 'rgba(15,23,42,.8)';
        ctx.fillRect(enemy.x - 15, enemy.y - enemy.radius - 9, 30, 3);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(enemy.x - 15, enemy.y - enemy.radius - 9, 30 * Math.max(0, enemy.hp / enemy.maxHp), 3);
      }
    }
  }

  private enemyPath(ctx: CanvasRenderingContext2D, kind: EnemyKind, radius: number): void {
    if (kind === 'cube') {
      ctx.roundRect(-radius, -radius, radius * 2, radius * 2, 4);
    } else if (kind === 'triangle') {
      ctx.moveTo(0, -radius);
      ctx.lineTo(radius, radius * 0.82);
      ctx.lineTo(-radius, radius * 0.82);
      ctx.closePath();
    } else if (kind === 'circle') {
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
    } else if (kind === 'hexagon') {
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else {
      ctx.moveTo(0, -radius);
      ctx.lineTo(radius * 0.8, -radius * 0.25);
      ctx.lineTo(radius * 0.55, radius);
      ctx.lineTo(-radius * 0.7, radius * 0.65);
      ctx.lineTo(-radius, -radius * 0.15);
      ctx.closePath();
    }
  }

  private drawBullets(engine: GameEngine): void {
    const ctx = this.context;
    for (let i = 0; i < engine.bullets.length; i++) {
      const bullet = engine.bullets[i];
      if (!bullet.active) continue;
      ctx.strokeStyle = 'rgba(147,197,253,.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bullet.trailX, bullet.trailY);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
      ctx.fillStyle = '#bfdbfe';
      ctx.shadowColor = '#60a5fa';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  private drawPickup(engine: GameEngine, time: number): void {
    if (!engine.pickup.active) return;
    const ctx = this.context;
    ctx.save();
    ctx.translate(engine.pickup.x, engine.pickup.y);
    ctx.rotate(time);
    ctx.strokeStyle = '#4ade80';
    ctx.fillStyle = 'rgba(34,197,94,.22)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, 13 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#dcfce7';
    ctx.fillRect(-2, -7, 4, 14);
    ctx.fillRect(-7, -2, 14, 4);
    ctx.restore();
  }

  private drawEffects(engine: GameEngine, copy: ArenaCopy): void {
    const ctx = this.context;
    for (let i = 0; i < engine.particles.length; i++) {
      const particle = engine.particles[i];
      if (!particle.active) continue;
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.kind === 1 ? '#4ade80' : '#fca5a5';
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < engine.floatingTexts.length; i++) {
      const item = engine.floatingTexts[i];
      if (!item.active) continue;
      ctx.globalAlpha = Math.min(1, item.life * 2);
      ctx.fillStyle = item.color;
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.text, item.x, item.y);
    }
    ctx.globalAlpha = 1;
    if (engine.phase === 'wave-complete') {
      ctx.fillStyle = 'rgba(15,23,42,.68)';
      ctx.fillRect(0, 0, ARENA.width, ARENA.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 32px Inter, sans-serif';
      ctx.fillText(copy.waveComplete.replace('{n}', String(engine.wave)), ARENA.width / 2, ARENA.height / 2 - 15);
      ctx.font = '500 15px Inter, sans-serif';
      ctx.fillStyle = '#bfdbfe';
      ctx.fillText(copy.nextWaveIn.replace('{n}', String(Math.max(1, Math.ceil(engine.waveBanner)))), ARENA.width / 2, ARENA.height / 2 + 18);
    }
  }
}
