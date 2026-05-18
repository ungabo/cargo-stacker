import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createAudioBus } from './audio.js';
import { StackingEngine } from './StackingEngine.js';

const INITIAL_STATE = {
  status: 'menu',
  score: 0,
  best: 0,
  perfectStreak: 0,
};

function formatNumber(value) {
  return value.toLocaleString('en-US');
}

function ScoreHud({ score, theme, soundEnabled, onPause, onSoundToggle }) {
  return (
    <>
      <button className="settings-button" data-ui-control type="button" aria-label="Pause" onClick={onPause}>
        <img src={theme.ui.settings} alt="" />
      </button>
      <button
        className={`coin-pill ${soundEnabled ? '' : 'is-muted'}`}
        data-ui-control
        type="button"
        aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
        onClick={onSoundToggle}
      >
        <span>1250</span>
      </button>
      <img className="title-logo" src={theme.ui.logo} alt="Cargo Stacker" />
      <section className="score-readout" aria-label="Score">
        <div className="score-label">
          <span>Score</span>
        </div>
        <strong>{formatNumber(score)}</strong>
      </section>
    </>
  );
}

function TimingBar({ theme }) {
  return (
    <div className="timing-bar-wrap" aria-hidden="true">
      <img className="timing-pointer timing-pointer--down" src={theme.ui.pointerDown} alt="" />
      <img className="timing-bar-art" src={theme.ui.timingBar} alt="" />
      <img className="timing-pointer timing-pointer--up" src={theme.ui.pointerUp} alt="" />
    </div>
  );
}

function GuideLine() {
  return (
    <div className="guide-line" aria-hidden="true">
      <span className="guide-arrow guide-arrow--left" />
      <span className="guide-dashes guide-dashes--left" />
      <span className="guide-dashes guide-dashes--right" />
      <span className="guide-arrow guide-arrow--right" />
    </div>
  );
}

function PausedOverlay({ onResume, onRestart }) {
  return (
    <section className="screen-overlay screen-overlay--dialog">
      <div className="dialog-panel">
        <h2>Paused</h2>
        <button className="menu-button menu-button--green" data-ui-control type="button" onClick={onResume}>Resume</button>
        <button className="menu-button menu-button--blue" data-ui-control type="button" onClick={onRestart}>Restart</button>
      </div>
    </section>
  );
}

function GameOverOverlay({ theme, score, best, onRestart }) {
  return (
    <section className="game-over-overlay" aria-label="Game over">
      <div className="game-over-card">
        <img className="game-over-panel-art" src={theme.ui.panelGameOver} alt="" />
        <div className="game-over-stats">
          <div>
            <span>Score</span>
            <strong>{formatNumber(score)}</strong>
          </div>
          <div>
            <span>Best</span>
            <strong>{formatNumber(best)}</strong>
          </div>
        </div>
        <button className="play-again-button" data-ui-control type="button" onClick={onRestart} aria-label="Play again">
          <img src={theme.ui.buttonPlayAgain} alt="" />
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
  const soundEnabledRef = useRef(true);
  const [gameState, setGameState] = useState(INITIAL_STATE);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [effect, setEffect] = useState(null);
  const audioBus = useMemo(() => createAudioBus(theme.audio), [theme.audio]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const playSound = useCallback((name) => {
    audioBus.play(name, soundEnabledRef.current);
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

    if (event.type === 'perfect' && navigator.vibrate) {
      navigator.vibrate([16, 24, 16]);
    } else if ((event.type === 'slice' || event.type === 'gameOver') && navigator.vibrate) {
      navigator.vibrate(28);
    }
  }, []);

  useEffect(() => () => {
    if (effectTimerRef.current) {
      window.clearTimeout(effectTimerRef.current);
    }
  }, []);

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

    const exposeQaEngine = new URLSearchParams(window.location.search).has('qa');
    if (exposeQaEngine) {
      window.__cargoStackerEngine = engine;
    }

    return () => {
      if (exposeQaEngine && window.__cargoStackerEngine === engine) {
        delete window.__cargoStackerEngine;
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

  const handleSoundToggle = useCallback(() => {
    const next = !soundEnabledRef.current;
    setSoundEnabled(next);
    soundEnabledRef.current = next;
    if (next) {
      audioBus.play('button', true);
    }
  }, [audioBus]);

  const progress = Math.min(100, gameState.score * 1.8);
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
      <ScoreHud
        score={gameState.score}
        theme={theme}
        soundEnabled={soundEnabled}
        onPause={handlePause}
        onSoundToggle={handleSoundToggle}
      />
      <TimingBar theme={theme} />
      <GuideLine />
      {effect === 'perfect' && gameState.perfectStreak >= 2 && gameState.status === 'playing' && (
        <div className="streak-callout" aria-live="polite">
          Perfect x{gameState.perfectStreak}
        </div>
      )}
      {gameState.status === 'paused' && (
        <PausedOverlay onResume={handlePause} onRestart={handleRestart} />
      )}
      {gameState.status === 'gameOver' && (
        <GameOverOverlay theme={theme} score={gameState.score} best={gameState.best} onRestart={handleRestart} />
      )}
      <div className="hit-flash" aria-hidden="true" />
      <ReferenceOverlay theme={theme} />
    </section>
  );
}
