import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createAudioBus } from './game/audio.js';
import {
  advanceGame,
  createInitialGame,
  getVisibleBlocks,
  layout,
  pct,
  placeActiveBlock,
  restartGame,
  togglePause,
} from './game/cargoGame.js';
import { cargoTheme } from './theme/cargoTheme.js';

function number(value) {
  return value.toLocaleString('en-US');
}

function useCargoState() {
  const [game, setGame] = useState(createInitialGame);
  const gameRef = useRef(game);

  const updateGame = useCallback((updater) => {
    setGame((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      gameRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    let frameId;
    let lastTime = performance.now();

    const step = (time) => {
      const deltaSeconds = (time - lastTime) / 1000;
      lastTime = time;
      updateGame((current) => advanceGame(current, deltaSeconds));
      frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [updateGame]);

  return [game, updateGame, gameRef];
}

function Hud({ game, onSettings }) {
  return (
    <>
      <button className="settings-button" data-ui-control type="button" aria-label="Pause" onClick={onSettings}>
        <img src={cargoTheme.ui.settings} alt="" />
      </button>
      <div className="coin-pill" aria-label={`${number(game.coins)} coins`}>
        <span>{game.coins}</span>
      </div>
      <img className="title-logo" src={cargoTheme.ui.logo} alt="Cargo Stacker" />
      <section className="score-readout" aria-label="Score">
        <div className="score-label">
          <span>Score</span>
        </div>
        <strong>{number(game.score)}</strong>
      </section>
    </>
  );
}

function TimingBar() {
  return (
    <div className="timing-bar-wrap" aria-hidden="true">
      <img className="timing-pointer timing-pointer--down" src={cargoTheme.ui.pointerDown} alt="" />
      <img className="timing-bar-art" src={cargoTheme.ui.timingBar} alt="" />
      <img className="timing-pointer timing-pointer--up" src={cargoTheme.ui.pointerUp} alt="" />
    </div>
  );
}

function CraneRig({ active }) {
  const x = active?.x ?? layout.width / 2;

  return (
    <>
      <div className="crane-cable crane-cable--back" aria-hidden="true" />
      <div
        className="crane-rig"
        aria-hidden="true"
        style={{
          left: pct(x),
          top: pct(layout.activeY - 64, layout.height),
        }}
      >
        <span className="crane-line" />
        <span className="crane-block" />
        <span className="crane-hook" />
      </div>
    </>
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

function CargoBlock({ block, className = '', style }) {
  const variant = cargoTheme.containers.find((candidate) => candidate.id === block.variantId) || cargoTheme.containers[0];
  const left = block.x - block.width / 2;
  const top = block.y;
  const innerWidth = (block.imageWidth / block.width) * 100;
  const cropOffset = -(block.cropX / block.width) * 100;

  return (
    <div
      className={`cargo-block ${className}`}
      style={{
        left: pct(left),
        top: pct(top, layout.height),
        width: pct(block.width),
        height: pct(layout.blockHeight, layout.height),
        '--inner-width': `${innerWidth}%`,
        '--crop-offset': `${cropOffset}%`,
        '--container-glow': variant.color,
        ...style,
      }}
      aria-hidden="true"
    >
      <img src={variant.sprite} alt="" draggable="false" />
    </div>
  );
}

function Stack({ game }) {
  const blocks = getVisibleBlocks(game.blocks);

  return (
    <div className="stack-layer" aria-hidden="true">
      {blocks.map((block) => (
        <CargoBlock key={block.id} block={block} />
      ))}
      {game.active && (
        <CargoBlock
          block={{
            ...game.active,
            y: layout.activeY,
          }}
          className="cargo-block--active"
        />
      )}
      {game.offcuts.map((offcut) => (
        <CargoBlock
          key={offcut.id}
          block={offcut}
          className={`cargo-block--offcut ${offcut.splashed ? 'is-splashed' : ''}`}
          style={{
            opacity: offcut.opacity,
            transform: `rotate(${offcut.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
}

function EffectFlash({ event }) {
  return <div className={`effect-flash effect-flash--${event || 'none'}`} aria-hidden="true" />;
}

function PausedOverlay({ muted, onResume, onRestart, onMute }) {
  return (
    <section className="pause-overlay" aria-label="Paused">
      <div className="pause-panel">
        <h2>Paused</h2>
        <button className="menu-button menu-button--green" data-ui-control type="button" onClick={onResume}>Resume</button>
        <button className="menu-button menu-button--blue" data-ui-control type="button" onClick={onRestart}>Restart</button>
        <button className="menu-button menu-button--red" data-ui-control type="button" onClick={onMute}>{muted ? 'Sound On' : 'Sound Off'}</button>
      </div>
    </section>
  );
}

function GameOverOverlay({ game, onRestart }) {
  return (
    <section className="game-over-overlay" aria-label="Game over">
      <div className="game-over-card">
        <img className="game-over-panel-art" src={cargoTheme.ui.panelGameOver} alt="" />
        <div className="game-over-stats">
          <div>
            <span>Score</span>
            <strong>{number(game.score)}</strong>
          </div>
          <div>
            <span>Best</span>
            <strong>{number(game.best)}</strong>
          </div>
        </div>
        <button className="play-again-button" data-ui-control type="button" onClick={onRestart} aria-label="Play again">
          <img src={cargoTheme.ui.buttonPlayAgain} alt="" />
        </button>
      </div>
    </section>
  );
}

function ReferenceOverlay() {
  const showReference = new URLSearchParams(window.location.search).get('reference') === '1';

  if (!showReference) {
    return null;
  }

  return <img className="reference-overlay" src={cargoTheme.concepts.gameplay} alt="" aria-hidden="true" />;
}

export default function App() {
  const [game, updateGame] = useCargoState();
  const [muted, setMuted] = useState(false);
  const audioBus = useMemo(() => createAudioBus(cargoTheme.audio), []);

  useEffect(() => {
    audioBus.warm();
  }, [audioBus]);

  useEffect(() => {
    if (!game.event || muted) {
      return;
    }

    if (game.event === 'perfect') {
      audioBus.play('perfect');
      audioBus.play('thud');
      return;
    }

    if (game.event === 'slice') {
      audioBus.play('slice');
      audioBus.play('thud');
      return;
    }

    if (game.event === 'gameOver') {
      audioBus.play('gameOver');
      audioBus.play('splash');
    }
  }, [audioBus, game.event, muted]);

  const placeBlock = useCallback(() => {
    updateGame((current) => {
      const next = placeActiveBlock(current);
      if (current.status === 'playing' && next.status !== 'gameOver' && !muted) {
        audioBus.play('tap');
      }
      return next;
    });
  }, [audioBus, muted, updateGame]);

  const restart = useCallback(() => {
    updateGame((current) => restartGame(current));
    if (!muted) {
      audioBus.play('button');
    }
  }, [audioBus, muted, updateGame]);

  const toggleSettings = useCallback(() => {
    updateGame((current) => togglePause(current));
    if (!muted) {
      audioBus.play('button');
    }
  }, [audioBus, muted, updateGame]);

  const toggleMuted = useCallback(() => {
    setMuted((current) => !current);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        placeBlock();
      }

      if (event.code === 'Escape') {
        event.preventDefault();
        toggleSettings();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [placeBlock, toggleSettings]);

  const handlePointerDown = useCallback((event) => {
    if (event.target.closest('[data-ui-control]')) {
      return;
    }

    placeBlock();
  }, [placeBlock]);

  return (
    <main className="app-shell">
      <section
        className={`game-stage status-${game.status}`}
        style={{
          '--stage-bg': `url(${cargoTheme.backgrounds.day})`,
        }}
        onPointerDown={handlePointerDown}
      >
        <CraneRig active={game.active} />
        <Hud game={game} onSettings={toggleSettings} />
        <TimingBar />
        <GuideLine />
        <Stack game={game} />
        <EffectFlash event={game.event} />
        {game.status === 'paused' && (
          <PausedOverlay muted={muted} onResume={toggleSettings} onRestart={restart} onMute={toggleMuted} />
        )}
        {game.status === 'gameOver' && <GameOverOverlay game={game} onRestart={restart} />}
        <ReferenceOverlay />
      </section>
    </main>
  );
}
