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

function formatNumber(value) {
  return value.toLocaleString('en-US');
}

function ScoreHud({ score, best, theme, onPause, onPerfectStep }) {
  return (
    <>
      <button className="settings-button" data-ui-control type="button" aria-label="Pause" onClick={onPause}>
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
      <button
        className="test-stack-button"
        data-ui-control
        type="button"
        aria-label="Place one perfectly aligned container"
        onClick={onPerfectStep}
      >
        Perfect +1
      </button>
    </>
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
  const audioBus = useMemo(() => createAudioBus(theme.audio), [theme.audio]);

  const playSound = useCallback((name) => {
    audioBus.play(name, true);
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
          onPause={handlePause}
          onPerfectStep={handlePerfectStep}
        />
      )}
      {effect === 'perfect' && gameState.perfectStreak >= 2 && gameState.status === 'playing' && (
        <div className="streak-callout" aria-live="polite">
          Perfect x{gameState.perfectStreak}
        </div>
      )}
      {gameState.status === 'paused' && (
        <PausedOverlay onResume={handlePause} onRestart={handleRestart} />
      )}
      {gameState.status === 'gameOver' && (
        <GameOverOverlay score={gameState.score} best={gameState.best} onRestart={handleRestart} />
      )}
      <div className="hit-flash" aria-hidden="true" />
      <ReferenceOverlay theme={theme} />
    </section>
  );
}
