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
  const speechActiveRef = useRef(false);
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

  const announce = useCallback((key: string, englishText: string) => {
    if (!voiceEnabledRef.current || isSpeaking()) return;
    const now = Date.now();
    if (lastAnnouncementRef.current.name === key && now - lastAnnouncementRef.current.at < 5000) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const activeLanguage = languageRef.current;
    const prefix = activeLanguage === 'en' ? 'en' : `${activeLanguage}-`;
    const hasLocalVoice = window.speechSynthesis.getVoices().some((voice) =>
      voice.lang.toLowerCase().replace(/_/g, '-').startsWith(prefix)
    );
    if (!hasLocalVoice) return;
    lastAnnouncementRef.current = { name: key, at: now };
    const started = speakText(englishText, activeLanguage, () => { speechActiveRef.current = true; }, () => { speechActiveRef.current = false; });
    if (!started) speechActiveRef.current = false;
  }, []);

  useEffect(() => {
    const engine = new GameEngine(process.env.NEXT_PUBLIC_E2E === 'true' ? 1337 : undefined);
    const audio = new GameAudio();
    engineRef.current = engine;
    audioRef.current = audio;
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
      const frameDelta = Math.min(ARENA.maxFrameDelta, (time - previous) / 1000);
      previous = time;
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
        if (engine.hp < 25) announce('critical-health', 'Health critical');
      } else if (engine.hp > counts.hp) {
        audio.play('heal');
        announce('healed', 'Healing activated');
      }
      if (engine.wave > counts.wave) {
        audio.play('wave');
        announce('wave-complete', 'Wave completed');
      }
      if (engine.phase === 'game-over' && counts.phase !== 'game-over') {
        audio.play('game-over');
        announce('game-over', 'Game over');
        engine.bestScore = writeBestScore(window.localStorage, engine.score);
      }
      counts.shots = engine.totalShots;
      counts.hits = engine.totalHits;
      counts.defeated = engine.enemiesDefeated;
      counts.hp = engine.hp;
      counts.wave = engine.wave;
      counts.phase = engine.phase;
      renderer.render(engine, engine.elapsed, frameDelta);
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
      if (speechActiveRef.current) stopSpeaking();
      audio.dispose();
      engineRef.current = null;
      rendererRef.current = null;
      audioRef.current = null;
      if (window.__tfbGame) delete window.__tfbGame;
    };
  }, [announce]);

  const currentPhase = snapshot?.phase || 'start';

  useEffect(() => {
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const playing = currentPhase === 'running';
    if (playing && window.matchMedia('(max-width: 640px)').matches) body.style.overflow = 'hidden';
    return () => {
      if (playing) body.style.overflow = previousOverflow;
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
    announce('approaching', 'Enemies approaching');
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
    engine.pause();
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
    engine.reduceEffects = !engine.reduceEffects;
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
  const upgradeDisabled = phase !== 'running' || (snapshot?.points ?? 0) < cost || (snapshot?.weaponLevel ?? 1) >= ARENA.weaponMaxLevel;

  return (
    <div
      className={styles.game}
      data-game-phase={phase}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="Buddy Defender game controls"
    >
      <div className={styles.topHud}>
        <div className={styles.brand}>
          <BuddyMascot size={42} />
          <div>
            <h2>Buddy Defender</h2>
            <span>Protect your forms from scam monsters</span>
          </div>
        </div>
        <div className={styles.stats}>
          <div><span>Score</span><strong>{snapshot?.score ?? 0}</strong></div>
          <div><span>Wave</span><strong>{snapshot?.wave ?? 1}</strong></div>
          <div className={styles.health}>
            <span>HP <b>{hp}/100</b></span>
            <div className={styles.healthTrack} role="progressbar" aria-label="Health" aria-valuemin={0} aria-valuemax={100} aria-valuenow={hp}>
              <span style={{ width: `${hpPercent}%` }} />
            </div>
          </div>
          <div><span>Defeated</span><strong>{snapshot?.enemiesDefeated ?? 0}</strong></div>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.controlButton} onClick={togglePause} disabled={phase === 'start' || phase === 'game-over'}>
            {phase === 'paused' ? 'Resume' : 'Pause'}
          </button>
          <button type="button" className={styles.controlButton} onClick={toggleSound} aria-pressed={snapshot?.soundEnabled ?? true}>
            Sound {snapshot?.soundEnabled === false ? 'Off' : 'On'}
          </button>
          <button type="button" className={styles.controlButton} onClick={toggleVoice} aria-pressed={snapshot?.voiceEnabled ?? false}>
            Voice {snapshot?.voiceEnabled ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      <div className={styles.canvasFrame}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          tabIndex={0}
          aria-label="Buddy Defender arena: Buddy robot fights geometric form monsters. Use pointer or touch to aim, Space for Pulse."
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
            <p>Keep fake forms away. Protect your information.</p>
            <button type="button" className={styles.primaryButton} onClick={startGame}>Start Game</button>
            <small>Move or drag to aim · Space for Pulse · P to pause</small>
          </div>
        )}
        {phase === 'paused' && (
          <div className={styles.overlay}>
            <h2>Paused</h2>
            <p>Your arena is safe while you take a break.</p>
            <button type="button" className={styles.primaryButton} onClick={togglePause}>Resume Game</button>
          </div>
        )}
        {phase === 'game-over' && (
          <div className={styles.overlay}>
            <h2 className={styles.gameOver}>GAME OVER</h2>
            <p>Score {snapshot?.score ?? 0} · Wave {snapshot?.wave ?? 1}</p>
            <p>Best score {snapshot?.bestScore ?? 0}</p>
            <button type="button" className={styles.primaryButton} onClick={restart}>Restart</button>
          </div>
        )}
        {phase === 'wave-complete' && (
          <div className={styles.waveTip}>
            <strong>Wave {snapshot?.wave} complete</strong>
            <span>Safety tip: Never share your OTP or password.</span>
          </div>
        )}
        {levelFlash && <div className={styles.levelUp} role="status">Weapon upgraded · Level {snapshot?.weaponLevel}</div>}
      </div>

      <div className={styles.bottomHud}>
        <div className={styles.weapon}>
          <span>Weapon level</span>
          <strong>{snapshot?.weaponLevel ?? 1}<small> / 5</small></strong>
        </div>
        <button type="button" className={styles.primaryButton} onClick={upgrade} disabled={upgradeDisabled} title={upgradeDisabled ? `Need ${cost} points to upgrade` : `Upgrade for ${cost} points`}>
          Upgrade · {cost} pts
        </button>
        <button type="button" className={styles.pulseButton} onClick={activatePulse} disabled={phase !== 'running' || (snapshot?.pulseCooldown ?? 0) > 0} aria-label={`Pulse ${Math.ceil(snapshot?.pulseCooldown ?? 0)} seconds`}>
          Pulse {snapshot?.pulseCooldown ? `${Math.ceil(snapshot.pulseCooldown)}s` : 'Ready'}
        </button>
        <span className={styles.healStatus} aria-live="polite">{snapshot?.healActive ? 'Healing pickup active' : 'Healing pickup: none'}</span>
        <button type="button" className={styles.minorButton} onClick={toggleAimAssist} aria-pressed={snapshot?.aimAssist ?? true}>Aim assist {snapshot?.aimAssist === false ? 'Off' : 'On'}</button>
        <button type="button" className={styles.minorButton} onClick={toggleEffects} aria-pressed={snapshot?.reduceEffects ?? false}>Reduce effects {snapshot?.reduceEffects ? 'On' : 'Off'}</button>
        <span className={styles.instructions}>Move the pointer or drag to aim · Space for Pulse · P to pause</span>
      </div>
      <div className={styles.srOnly} aria-live="polite">
        {snapshot?.wave !== undefined ? `Wave ${snapshot.wave}. ${snapshot.hp < 25 ? 'Health critical.' : `Health ${snapshot.hp}.`}` : ''}
      </div>
    </div>
  );
}
