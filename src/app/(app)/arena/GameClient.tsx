'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import BuddyMascot from '@/components/BuddyMascot';
import { getDefaultLanguage, isSpeaking, speakText, stopSpeaking } from '@/lib/speech';
import { ARENA, getUpgradeCost } from '@/game/config';
import type { GameSnapshot } from '@/game/entities';
import { GameAudio } from '@/game/audio';
import { GameRenderer } from '@/game/renderer';
import { GameEngine } from '@/game/systems';
import { readBestScore, writeBestScore } from '@/game/storage';
import { formatArenaText, getArenaCopy, getSafetyTip } from '@/game/i18n';
import type { GameTestHook } from '@/game/test-hook';
import styles from './arena.module.css';

const EMPTY_INPUT = { aimX: ARENA.width / 2, aimY: ARENA.height / 2, hasManualAim: false, pulsePressed: false };

declare global {
  interface Window {
    __tfbGame?: GameTestHook;
  }
}

export default function GameClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const audioRef = useRef<GameAudio | null>(null);
  const inputRef = useRef({ ...EMPTY_INPUT });
  const gameUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const performanceRef = useRef({
    frames: 0,
    elapsed: 0,
    frameTimeEma: 1 / 60,
    slowDuration: 0,
    healthyDuration: 0,
    systemReduced: false,
    manualReduced: false,
    automaticReduced: false,
  });
  const gameSpeechActiveRef = useRef(false);
  const voiceEnabledRef = useRef(false);
  const levelFlashTimerRef = useRef<number | null>(null);
  const lastAnnouncementRef = useRef({ name: '', at: 0 });
  const eventCountsRef = useRef<{ shots: number; hits: number; defeated: number; hp: number; wave: number; phase: string }>({
    shots: 0, hits: 0, defeated: 0, hp: ARENA.heroMaxHp, wave: 1, phase: 'start',
  });
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [language, setLanguage] = useState(() => {
    try {
      return getDefaultLanguage();
    } catch (error) {
      console.warn('[Buddy Defender] Could not read the selected language:', error);
      return 'en';
    }
  });
  const languageRef = useRef(language);
  const [levelFlash, setLevelFlash] = useState(false);

  const announce = useCallback((key: string, copyKey: 'enemiesApproaching' | 'waveCompleted' | 'healthCritical' | 'healingActivated' | 'gameOverAnnouncement') => {
    if (!voiceEnabledRef.current || isSpeaking()) return;
    const now = Date.now();
    if (lastAnnouncementRef.current.name === key && now - lastAnnouncementRef.current.at < 5000) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const activeLanguage = languageRef.current;
    const text = getArenaCopy(activeLanguage)[copyKey];
    const prefix = activeLanguage === 'en' ? 'en' : `${activeLanguage}-`;
    const hasLocalVoice = window.speechSynthesis.getVoices().some((voice) =>
      voice.lang.toLowerCase().replace(/_/g, '-').startsWith(prefix)
    );
    if (!hasLocalVoice) return;
    lastAnnouncementRef.current = { name: key, at: now };
    gameSpeechActiveRef.current = true;
    const started = speakText(text, activeLanguage, undefined, () => {
      gameSpeechActiveRef.current = false;
      gameUtteranceRef.current = null;
    });
    if (started) {
      const speechState = window as Window & { __currentUtterance?: SpeechSynthesisUtterance | null };
      gameUtteranceRef.current = speechState.__currentUtterance ?? null;
    } else {
      gameSpeechActiveRef.current = false;
    }
  }, []);

  const cancelGameSpeech = useCallback(() => {
    const gameUtterance = gameUtteranceRef.current;
    if (gameUtterance && typeof window !== 'undefined') {
      const speechState = window as Window & { __currentUtterance?: SpeechSynthesisUtterance | null };
      if (speechState.__currentUtterance === gameUtterance) stopSpeaking();
    }
    gameUtteranceRef.current = null;
    gameSpeechActiveRef.current = false;
  }, []);

  useEffect(() => {
    const engine = new GameEngine(process.env.NEXT_PUBLIC_E2E === 'true' ? 1337 : undefined);
    const audio = new GameAudio();
    engineRef.current = engine;
    audioRef.current = audio;
    performanceRef.current.systemReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    engine.reduceEffects = performanceRef.current.systemReduced;
    try {
      engine.bestScore = readBestScore(window.localStorage);
      engine.soundEnabled = window.localStorage.getItem('tfb_buddy_defender_sound') !== 'false';
    } catch (error) {
      console.warn('[Buddy Defender] Could not restore local game preferences:', error);
    }
    voiceEnabledRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new GameRenderer(canvas);
    rendererRef.current = renderer;
    renderer.resize();

    let frameId = 0;
    let previous = 0;
    let accumulator = 0;
    let uiTime = 0;
    let inputPulse = false;
    const resizeObserver = new ResizeObserver(() => renderer.resize());
    resizeObserver.observe(canvas);

    const frame = (time: number) => {
      if (!previous) previous = time;
      const actualFrameDelta = Math.max(0, (time - previous) / 1000);
      const frameDelta = Math.min(ARENA.maxFrameDelta, actualFrameDelta);
      previous = time;
      const performance = performanceRef.current;
      if (actualFrameDelta > 0 && actualFrameDelta < 1) {
        performance.frames++;
        performance.elapsed += actualFrameDelta;
        if (engine.phase === 'running') {
          performance.frameTimeEma = performance.frameTimeEma * 0.95 + actualFrameDelta * 0.05;
          if (performance.frameTimeEma > 1 / 55) {
            performance.slowDuration += actualFrameDelta;
            performance.healthyDuration = 0;
            if (performance.slowDuration >= 1) performance.automaticReduced = true;
          } else if (performance.frameTimeEma < 1 / 58) {
            performance.healthyDuration += actualFrameDelta;
            performance.slowDuration = 0;
            if (performance.healthyDuration >= 3) performance.automaticReduced = false;
          } else {
            performance.slowDuration = 0;
            performance.healthyDuration = 0;
          }
          engine.reduceEffects = performance.systemReduced || performance.manualReduced || performance.automaticReduced;
        }
      }
      accumulator += frameDelta;
      while (accumulator >= ARENA.fixedStep) {
        inputRef.current.pulsePressed = inputPulse;
        engine.step(ARENA.fixedStep, inputRef.current);
        inputPulse = false;
        accumulator -= ARENA.fixedStep;
      }

      const counts = eventCountsRef.current;
      if (engine.totalShots > counts.shots) audio.play('shoot');
      if (engine.totalHits > counts.hits) audio.play('hit');
      if (engine.enemiesDefeated > counts.defeated) audio.play('death');
      if (engine.hp < counts.hp) {
        audio.play('damage');
        if (engine.hp < ARENA.lowHealthWarning) announce('critical-health', 'healthCritical');
      } else if (engine.hp > counts.hp) {
        audio.play('heal');
        announce('healed', 'healingActivated');
      }
      if (engine.wave > counts.wave) {
        audio.play('wave');
        announce('wave-complete', 'waveCompleted');
      }
      if (engine.phase === 'game-over' && counts.phase !== 'game-over') {
        audio.play('game-over');
        announce('game-over', 'gameOverAnnouncement');
        engine.bestScore = writeBestScore(window.localStorage, engine.score);
      }
      counts.shots = engine.totalShots;
      counts.hits = engine.totalHits;
      counts.defeated = engine.enemiesDefeated;
      counts.hp = engine.hp;
      counts.wave = engine.wave;
      counts.phase = engine.phase;
      renderer.render(engine, engine.elapsed, getArenaCopy(languageRef.current));
      uiTime += frameDelta;
      if (uiTime >= 0.1) {
        setSnapshot(engine.snapshot());
        uiTime = 0;
      }
      frameId = requestAnimationFrame(frame);
    };

    frameId = requestAnimationFrame(frame);
    const onVisibilityChange = () => {
      if (document.hidden && engine.phase === 'running') {
        engine.pause();
        cancelGameSpeech();
        setSnapshot(engine.snapshot());
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    const onLanguageChange = (event: Event) => {
      const custom = event as CustomEvent<{ language?: string }>;
      if (custom.detail?.language) {
        languageRef.current = custom.detail.language;
        setLanguage(custom.detail.language);
      }
    };
    window.addEventListener('tfb-language-changed', onLanguageChange);

    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('tfb-language-changed', onLanguageChange);
      resizeObserver.disconnect();
      if (levelFlashTimerRef.current !== null) window.clearTimeout(levelFlashTimerRef.current);
      cancelGameSpeech();
      audio.dispose();
      engineRef.current = null;
      rendererRef.current = null;
      audioRef.current = null;
      if (window.__tfbGame) delete window.__tfbGame;
    };
  }, [announce, cancelGameSpeech]);

  const currentPhase = snapshot?.phase || 'start';
  const copy = getArenaCopy(language);

  useEffect(() => {
    const body = document.body;
    const previousOverflow = body.style.overflow;
    if (currentPhase !== 'running') return;
    const media = window.matchMedia('(max-width: 640px)');
    const updateOverflow = () => {
      body.style.overflow = media.matches ? 'hidden' : previousOverflow;
    };
    updateOverflow();
    media.addEventListener('change', updateOverflow);
    return () => {
      media.removeEventListener('change', updateOverflow);
      body.style.overflow = previousOverflow;
    };
  }, [currentPhase]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E !== 'true') return;
    const engine = engineRef.current;
    if (!engine) return;
    window.__tfbGame = {
      getState: () => engine.snapshot(),
      spawnEnemy: (kind, x, y) => { engine.spawnEnemy(kind, x, y); },
      spawnHeal: (x, y) => engine.spawnHeal(x, y),
      getActiveBulletCount: () => {
        let count = 0;
        for (let i = 0; i < engine.bullets.length; i++) if (engine.bullets[i].active) count++;
        return count;
      },
      getPerformance: () => ({
        averageFps: performanceRef.current.elapsed > 0
          ? performanceRef.current.frames / performanceRef.current.elapsed
          : 0,
        effectsReduced: engine.reduceEffects,
      }),
      resetPerformance: () => {
        const performance = performanceRef.current;
        performance.frames = 0;
        performance.elapsed = 0;
        performance.frameTimeEma = 1 / 60;
        performance.slowDuration = 0;
        performance.healthyDuration = 0;
        performance.automaticReduced = false;
        engine.reduceEffects = performance.systemReduced || performance.manualReduced;
      },
    };
    return () => { if (window.__tfbGame) delete window.__tfbGame; };
  }, []);

  const startGame = () => {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      audioRef.current?.unlock(engine.soundEnabled);
    } catch (error) {
      console.warn('[Buddy Defender] Browser audio is unavailable:', error);
    }
    engine.start();
    setSnapshot(engine.snapshot());
    announce('approaching', 'enemiesApproaching');
    canvasRef.current?.focus();
  };

  const restart = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.restart(process.env.NEXT_PUBLIC_E2E === 'true' ? 1337 : undefined);
    eventCountsRef.current = { shots: 0, hits: 0, defeated: 0, hp: ARENA.heroMaxHp, wave: 1, phase: 'start' };
    setSnapshot(engine.snapshot());
  };

  const togglePause = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const pausing = engine.phase === 'running';
    engine.pause();
    if (pausing) cancelGameSpeech();
    setSnapshot(engine.snapshot());
  };

  const activatePulse = () => {
    if (engineRef.current?.activatePulse()) setSnapshot(engineRef.current.snapshot());
  };

  const upgrade = () => {
    const engine = engineRef.current;
    if (!engine?.upgradeWeapon()) return;
    setLevelFlash(true);
    if (levelFlashTimerRef.current !== null) window.clearTimeout(levelFlashTimerRef.current);
    levelFlashTimerRef.current = window.setTimeout(() => {
      levelFlashTimerRef.current = null;
      setLevelFlash(false);
    }, 500);
    setSnapshot(engine.snapshot());
  };

  const toggleSound = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.soundEnabled = !engine.soundEnabled;
    if (engine.soundEnabled) audioRef.current?.unlock(true);
    else audioRef.current?.setEnabled(false);
    try {
      window.localStorage.setItem('tfb_buddy_defender_sound', String(engine.soundEnabled));
    } catch (error) {
      console.warn('[Buddy Defender] Could not save sound preference:', error);
    }
    setSnapshot(engine.snapshot());
  };

  const toggleVoice = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.voiceEnabled = !engine.voiceEnabled;
    voiceEnabledRef.current = engine.voiceEnabled;
    if (!engine.voiceEnabled) cancelGameSpeech();
    setSnapshot(engine.snapshot());
  };

  const toggleAimAssist = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.aimAssist = !engine.aimAssist;
    setSnapshot(engine.snapshot());
  };

  const toggleEffects = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const performance = performanceRef.current;
    performance.manualReduced = !performance.manualReduced;
    engine.reduceEffects = performance.systemReduced || performance.manualReduced || performance.automaticReduced;
    setSnapshot(engine.snapshot());
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault();
      inputRef.current.pulsePressed = true;
      activatePulse();
    } else if (event.key.toLowerCase() === 'p' || event.key === 'Escape') {
      event.preventDefault();
      togglePause();
    } else if (event.key.toLowerCase() === 'u') {
      event.preventDefault();
      upgrade();
    } else if (event.key.toLowerCase() === 'm') {
      event.preventDefault();
      toggleSound();
    }
  };

  const updateAim = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    inputRef.current.aimX = ((event.clientX - rect.left) / rect.width) * ARENA.width;
    inputRef.current.aimY = ((event.clientY - rect.top) / rect.height) * ARENA.height;
  };

  const phase = currentPhase;
  const hp = snapshot?.hp ?? ARENA.heroMaxHp;
  const hpPercent = Math.max(0, Math.min(100, hp));
  const cost = getUpgradeCost(snapshot?.weaponLevel ?? 1);
  const pulseDescription = snapshot?.pulseCooldown
    ? formatArenaText(copy.seconds, { n: Math.ceil(snapshot.pulseCooldown) })
    : copy.ready;
  const pulseProgressDegrees = ((ARENA.pulseCooldown - Math.min(ARENA.pulseCooldown, snapshot?.pulseCooldown ?? 0)) /
    ARENA.pulseCooldown) * 360;
  const upgradeDisabled = phase !== 'running' || (snapshot?.points ?? 0) < cost || (snapshot?.weaponLevel ?? 1) >= ARENA.weaponMaxLevel;

  return (
    <div
      className={styles.game}
      data-game-phase={phase}
      lang={language}
      dir={language === 'ur' ? 'rtl' : 'ltr'}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label={copy.instructions}
    >
      <div className={styles.topHud}>
        <div className={styles.brand}>
          <BuddyMascot size={42} />
          <div>
            <h2>Buddy Defender</h2>
            <span>{copy.tagline}</span>
          </div>
        </div>
        <div className={styles.stats}>
          <div><span>{copy.score}</span><strong>{snapshot?.score ?? 0}</strong></div>
          <div><span>{copy.wave}</span><strong>{snapshot?.wave ?? 1}</strong></div>
          <div className={styles.health}>
            <span>{copy.hp} <b>{hp}/100</b></span>
            <div className={styles.healthTrack} role="progressbar" aria-label={copy.hp} aria-valuemin={0} aria-valuemax={100} aria-valuenow={hp}>
              <span style={{ width: `${hpPercent}%` }} />
            </div>
          </div>
          <div><span>{copy.defeated}</span><strong>{snapshot?.enemiesDefeated ?? 0}</strong></div>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.controlButton} onClick={togglePause} disabled={phase === 'start' || phase === 'game-over'}>
            {phase === 'paused' ? copy.resume : copy.pause}
          </button>
          <button type="button" className={styles.controlButton} onClick={toggleSound} aria-pressed={snapshot?.soundEnabled ?? true}>
            {copy.sound} {snapshot?.soundEnabled === false ? copy.off : copy.on}
          </button>
          <button type="button" className={styles.controlButton} onClick={toggleVoice} aria-pressed={snapshot?.voiceEnabled ?? false}>
            {copy.voice} {snapshot?.voiceEnabled ? copy.on : copy.off}
          </button>
        </div>
      </div>

      <div className={styles.canvasFrame}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          tabIndex={0}
          aria-label={copy.canvasAlt}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            inputRef.current.hasManualAim = true;
            updateAim(event);
          }}
          onPointerMove={(event) => {
            if (event.buttons !== 0 || event.pointerType === 'touch') {
              inputRef.current.hasManualAim = true;
              updateAim(event);
            }
          }}
          onPointerUp={() => { inputRef.current.hasManualAim = false; }}
          onPointerCancel={() => { inputRef.current.hasManualAim = false; }}
        />
        {phase === 'start' && (
          <div className={styles.overlay}>
            <BuddyMascot size={78} />
            <h1>Buddy Defender</h1>
            <p>{copy.introduction}</p>
            <button type="button" className={styles.primaryButton} onClick={startGame}>{copy.start}</button>
            <small>{copy.startInstructions}</small>
          </div>
        )}
        {phase === 'paused' && (
          <div className={styles.overlay}>
            <h2>{copy.paused}</h2>
            <p>{copy.pausedDescription}</p>
            <button type="button" className={styles.primaryButton} onClick={togglePause}>{copy.resumeGame}</button>
          </div>
        )}
        {phase === 'game-over' && (
          <div className={styles.overlay}>
            <h2 className={styles.gameOver}>{copy.gameOver}</h2>
            <p>{formatArenaText(copy.scoreAndWave, { score: snapshot?.score ?? 0, wave: snapshot?.wave ?? 1 })}</p>
            <p>{formatArenaText(copy.bestScore, { score: snapshot?.bestScore ?? 0 })}</p>
            <button type="button" className={styles.primaryButton} onClick={restart}>{copy.restart}</button>
          </div>
        )}
        {phase === 'wave-complete' && (
          <div className={styles.waveTip}>
            <strong>{formatArenaText(copy.waveComplete, { n: snapshot?.wave ?? 1 })}</strong>
            <span>{getSafetyTip(language, snapshot?.wave ?? 1)}</span>
          </div>
        )}
        {levelFlash && <div className={styles.levelUp} role="status">{formatArenaText(copy.levelUp, { n: snapshot?.weaponLevel ?? 1 })}</div>}
      </div>

      <div className={styles.bottomHud}>
        <div className={styles.weapon}>
          <span>{copy.weaponLevel}</span>
          <strong>{snapshot?.weaponLevel ?? 1}<small> / 5</small></strong>
        </div>
        <button type="button" className={styles.primaryButton} onClick={upgrade} disabled={upgradeDisabled} title={upgradeDisabled ? formatArenaText(copy.needPoints, { n: cost }) : `${copy.upgrade} · ${cost} ${copy.points}`}>
          {copy.upgrade} · {cost} {copy.points}
        </button>
        <button type="button" className={styles.pulseButton} onClick={activatePulse} disabled={phase !== 'running' || (snapshot?.pulseCooldown ?? 0) > 0} aria-label={`${copy.pulse} ${pulseDescription}`}>
          <span className={styles.pulseRing} aria-hidden="true" style={{ background: `conic-gradient(#93c5fd ${pulseProgressDegrees}deg, #334155 0deg)` }} />
          {copy.pulse} {pulseDescription}
        </button>
        <span className={styles.healStatus} aria-live="polite">{snapshot?.healActive ? copy.healingActive : copy.healingNone}</span>
        <button type="button" className={styles.minorButton} onClick={toggleAimAssist} aria-pressed={snapshot?.aimAssist ?? true}>{copy.aimAssist} {snapshot?.aimAssist === false ? copy.off : copy.on}</button>
        <button type="button" className={styles.minorButton} onClick={toggleEffects} aria-pressed={snapshot?.reduceEffects ?? false}>{copy.reduceEffects} {snapshot?.reduceEffects ? copy.on : copy.off}</button>
        <span className={styles.instructions}>{copy.instructions}</span>
      </div>
      <div className={styles.srOnly} aria-live="polite">
        {snapshot?.wave !== undefined ? `${formatArenaText(copy.liveWave, { n: snapshot.wave })} ${snapshot.hp < ARENA.lowHealthWarning ? copy.liveHealthCritical : formatArenaText(copy.liveHealth, { n: snapshot.hp })}` : ''}
      </div>
    </div>
  );
}
