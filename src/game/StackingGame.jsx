import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createAudioBus } from './audio.js';
import { StackingEngine } from './StackingEngine.js';

const INITIAL_STATE = {
  status: 'menu',
  score: 0,
  best: 0,
  perfectStreak: 0,
  cameraY: 0,
};
const SETTINGS_STORAGE_KEY = 'cargo-stacker.settings';
const DEFAULT_SETTINGS = {
  muted: false,
};

function readSettings() {
  try {
    const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!rawSettings) {
      return { ...DEFAULT_SETTINGS };
    }

    const settings = JSON.parse(rawSettings);
    return {
      ...DEFAULT_SETTINGS,
      muted: Boolean(settings?.muted),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(settings) {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      muted: Boolean(settings.muted),
    }));
  } catch {
    // Local storage can be unavailable in private or embedded contexts.
  }
}

function formatNumber(value) {
  return value.toLocaleString('en-US');
}

function SoundIcon({ muted }) {
  return (
    <svg className="sound-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path className="sound-icon__body" d="M4.5 13.2h5.6l8.1-6.2v18l-8.1-6.2H4.5z" />
      {muted ? (
        <>
          <path className="sound-icon__slash" d="M25.5 8.2 6.5 27" />
          <path className="sound-icon__wave" d="m23 13.2 4.5 4.5m0-4.5L23 17.7" />
        </>
      ) : (
        <>
          <path className="sound-icon__wave" d="M21.6 11.2a7 7 0 0 1 0 9.6" />
          <path className="sound-icon__wave" d="M24.9 8.1a11.2 11.2 0 0 1 0 15.8" />
        </>
      )}
    </svg>
  );
}

function ScoreHud({ score, best, theme, muted, testMode, onSettings, onMuteToggle, onPerfectStep }) {
  return (
    <>
      <button className="settings-button" data-ui-control type="button" aria-label="Settings" onClick={onSettings}>
        <img src={theme.ui.settings} alt="" />
      </button>
      <section className="record-pill" aria-label="Record">
        <span>Record</span>
        <strong>{formatNumber(best)}</strong>
      </section>
      <img className="title-logo" src={theme.ui.logo} alt="Cargo Stacker" />
      <section className="score-readout" aria-label="Score">
        <div className="score-label">
          <span>Score</span>
        </div>
        <strong>{formatNumber(score)}</strong>
      </section>
      {testMode && (
        <button
          className="test-stack-button"
          data-ui-control
          type="button"
          aria-label="Place one perfectly aligned container"
          onClick={onPerfectStep}
        >
          Test
        </button>
      )}
      <button
        className="mute-button"
        data-ui-control
        type="button"
        aria-label={muted ? 'Unmute sound' : 'Mute sound'}
        aria-pressed={muted}
        onClick={onMuteToggle}
      >
        <SoundIcon muted={muted} />
      </button>
    </>
  );
}

function SettingsOverlay({
  muted,
  testMode,
  onResume,
  onRestart,
  onMuteToggle,
  onTestModeToggle,
  onResetBest,
}) {
  return (
    <section className="screen-overlay screen-overlay--dialog">
      <div className="dialog-panel settings-panel">
        <h2>Settings</h2>
        <div className="settings-options">
          <button
            className={`settings-row ${muted ? 'is-on' : ''}`}
            data-ui-control
            type="button"
            aria-pressed={muted}
            onClick={onMuteToggle}
          >
            <span>Mute</span>
            <span className="settings-switch" aria-hidden="true">
              <span />
            </span>
            <strong>{muted ? 'On' : 'Off'}</strong>
          </button>
          <button
            className={`settings-row ${testMode ? 'is-on' : ''}`}
            data-ui-control
            type="button"
            aria-pressed={testMode}
            onClick={onTestModeToggle}
          >
            <span>Test Mode</span>
            <span className="settings-switch" aria-hidden="true">
              <span />
            </span>
            <strong>{testMode ? 'On' : 'Off'}</strong>
          </button>
        </div>
        <button className="menu-button menu-button--red" data-ui-control type="button" onClick={onResetBest}>Reset Record</button>
        <button className="menu-button menu-button--green" data-ui-control type="button" onClick={onResume}>Resume</button>
        <button className="menu-button menu-button--blue" data-ui-control type="button" onClick={onRestart}>Restart</button>
      </div>
    </section>
  );
}

function GameOverOverlay({ score, best, onRestart }) {
  return (
    <section className="game-over-overlay" aria-label="Game over">
      <div className="game-over-card">
        <h2>Game Over</h2>
        <div className="game-over-stats">
          <div>
            <span>Score</span>
            <strong>{formatNumber(score)}</strong>
          </div>
          <div>
            <span>Record</span>
            <strong>{formatNumber(best)}</strong>
          </div>
        </div>
        <button className="play-again-button" data-ui-control type="button" onClick={onRestart}>
          Play Again
        </button>
      </div>
    </section>
  );
}

function ReferenceOverlay({ theme }) {
  const showReference = new URLSearchParams(window.location.search).get('reference') === '1';

  if (!showReference) {
    return null;
  }

  return <img className="reference-overlay" src={theme.concepts.gameplay} alt="" aria-hidden="true" />;
}

export function StackingGame({ theme }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const effectTimerRef = useRef(null);
  const [gameState, setGameState] = useState(INITIAL_STATE);
  const [effect, setEffect] = useState(null);
  const [settings, setSettings] = useState(readSettings);
  const [testMode, setTestMode] = useState(false);
  const mutedRef = useRef(settings.muted);
  const audioBus = useMemo(() => createAudioBus(theme.audio), [theme.audio]);

  const playSound = useCallback((name) => {
    audioBus.play(name, !mutedRef.current);
  }, [audioBus]);

  const handleEngineEvent = useCallback((event) => {
    if (effectTimerRef.current) {
      window.clearTimeout(effectTimerRef.current);
    }

    setEffect(event.type);
    effectTimerRef.current = window.setTimeout(() => {
      setEffect(null);
      effectTimerRef.current = null;
    }, 420);

    const canVibrate = navigator.vibrate && (navigator.userActivation?.hasBeenActive ?? true);

    if (event.type === 'perfect' && canVibrate) {
      navigator.vibrate([16, 24, 16]);
    } else if ((event.type === 'slice' || event.type === 'gameOver') && canVibrate) {
      navigator.vibrate(28);
    }
  }, []);

  useEffect(() => () => {
    if (effectTimerRef.current) {
      window.clearTimeout(effectTimerRef.current);
    }
  }, []);

  useEffect(() => {
    mutedRef.current = settings.muted;
    writeSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!canvasRef.current) {
      return undefined;
    }

    audioBus.warm();
    const engine = new StackingEngine({
      canvas: canvasRef.current,
      theme,
      onStateChange: setGameState,
      onEvent: handleEngineEvent,
      onPlaySound: playSound,
    });

    engineRef.current = engine;
    engine.startGame();

    const exposeQaEngine = import.meta.env.DEV || new URLSearchParams(window.location.search).has('qa');
    if (exposeQaEngine) {
      window.__cargoStackerEngine = engine;
      window.cargoStackerEngine = engine;
    }

    return () => {
      if (exposeQaEngine && window.__cargoStackerEngine === engine) {
        delete window.__cargoStackerEngine;
      }
      if (exposeQaEngine && window.cargoStackerEngine === engine) {
        delete window.cargoStackerEngine;
      }
      engine.destroy();
      engineRef.current = null;
    };
  }, [audioBus, handleEngineEvent, playSound, theme]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        engineRef.current?.handleTap();
      }

      if (event.code === 'Escape') {
        event.preventDefault();
        engineRef.current?.togglePause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePointerDown = useCallback((event) => {
    if (event.target.closest('[data-ui-control]')) {
      return;
    }

    engineRef.current?.handleTap();
  }, []);

  const handlePause = useCallback(() => {
    playSound('button');
    engineRef.current?.togglePause();
  }, [playSound]);

  const handleRestart = useCallback(() => {
    playSound('button');
    engineRef.current?.startGame();
  }, [playSound]);

  const handlePerfectStep = useCallback(() => {
    engineRef.current?.placeActivePerfectly();
  }, []);

  const handleMuteToggle = useCallback(() => {
    setSettings((current) => {
      const nextSettings = {
        ...current,
        muted: !current.muted,
      };

      if (!nextSettings.muted) {
        audioBus.play('button', true);
      }

      return nextSettings;
    });
  }, [audioBus]);

  const handleTestModeToggle = useCallback(() => {
    playSound('button');
    setTestMode((current) => !current);
  }, [playSound]);

  const handleResetBest = useCallback(() => {
    playSound('button');
    engineRef.current?.resetBestScore();
  }, [playSound]);

  const cameraClimb = Math.max(0, gameState.cameraY || 0);
  const progress = Math.min(76, Math.pow(cameraClimb, 1.18) * 2.8);
  const backgroundY = `${100 - progress}%`;

  return (
    <section
      className={`game-stage status-${gameState.status} effect-${effect || 'none'}`}
      style={{
        '--stage-bg': `url(${theme.backgrounds.scroll})`,
        '--stage-bg-y': backgroundY,
      }}
      onPointerDown={handlePointerDown}
    >
      <canvas ref={canvasRef} className="game-canvas" aria-label={`${theme.displayName} playfield`} />
      {gameState.status !== 'gameOver' && (
        <ScoreHud
          score={gameState.score}
          best={gameState.best}
          theme={theme}
          muted={settings.muted}
          testMode={testMode}
          onSettings={handlePause}
          onMuteToggle={handleMuteToggle}
          onPerfectStep={handlePerfectStep}
        />
      )}
      {effect === 'perfect' && gameState.perfectStreak >= 2 && gameState.status === 'playing' && (
        <div className="streak-callout" aria-live="polite">
          Perfect x{gameState.perfectStreak}
        </div>
      )}
      {gameState.status === 'paused' && (
        <SettingsOverlay
          muted={settings.muted}
          testMode={testMode}
          onResume={handlePause}
          onRestart={handleRestart}
          onMuteToggle={handleMuteToggle}
          onTestModeToggle={handleTestModeToggle}
          onResetBest={handleResetBest}
        />
      )}
      {gameState.status === 'gameOver' && (
        <GameOverOverlay score={gameState.score} best={gameState.best} onRestart={handleRestart} />
      )}
      <div className="hit-flash" aria-hidden="true" />
      <ReferenceOverlay theme={theme} />
    </section>
  );
}
