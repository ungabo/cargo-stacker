const DESIGN_WIDTH = 941;
const DESIGN_HEIGHT = 1672;
const STACK_TOP_Y = 728;
const ACTIVE_Y = 558;
const LAYER_STEP = 88;
const BLOCK_HEIGHT = 102;
const START_WIDTH = 366;
const CENTER_X = DESIGN_WIDTH / 2;
const PERFECT_TOLERANCE = 13;
const MISS_TOLERANCE = 34;
const STARTING_SCORE = 2350;
const DEFAULT_BEST = 6780;
const COIN_BALANCE = 1250;
const STORAGE_KEY = 'cargo-stacker.best-score';

const STACK_SEQUENCE = [
  'cs-03-red',
  'cs-08-steelblue',
  'cs-07-green',
  'cs-05-purple',
  'cs-06-yellow',
  'cs-04-blue',
  'cs-03-red',
  'cs-02-teal',
  'cs-01-orange',
];

const INITIAL_OFFSETS = [-2, 10, -11, 4, -6, 14, -7, 2];

let nextId = 1;

function id(prefix) {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

export const layout = {
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  activeY: ACTIVE_Y,
  blockHeight: BLOCK_HEIGHT,
};

export function pct(value, total = DESIGN_WIDTH) {
  return `${(value / total) * 100}%`;
}

export function readBestScore() {
  const stored = Number.parseInt(window.localStorage.getItem(STORAGE_KEY) || '', 10);
  return Number.isFinite(stored) ? Math.max(stored, DEFAULT_BEST) : DEFAULT_BEST;
}

function variantAt(index) {
  return STACK_SEQUENCE[index % STACK_SEQUENCE.length];
}

function makeBlock({ variantId, x = CENTER_X, width = START_WIDTH, cropX = 0, imageWidth = width }) {
  return {
    id: id('block'),
    variantId,
    x,
    width,
    cropX,
    imageWidth,
  };
}

function makeActive(blocks, direction = Math.random() > 0.5 ? 1 : -1) {
  const previous = blocks[blocks.length - 1];
  const startX = direction > 0 ? 214 : 727;

  return {
    ...makeBlock({
      variantId: variantAt(blocks.length),
      x: startX,
      width: previous.width,
      cropX: 0,
      imageWidth: previous.width,
    }),
    direction,
  };
}

function makeInitialStack() {
  return STACK_SEQUENCE.slice(0, 8).map((variantId, index) => makeBlock({
    variantId,
    x: CENTER_X + INITIAL_OFFSETS[index],
    width: START_WIDTH,
  }));
}

export function createInitialGame() {
  const blocks = makeInitialStack();

  return {
    status: 'playing',
    score: STARTING_SCORE,
    best: readBestScore(),
    coins: COIN_BALANCE,
    perfectStreak: 0,
    blocks,
    active: makeActive(blocks, -1),
    offcuts: [],
    speed: 205,
    event: null,
  };
}

export function restartGame(previous) {
  const fresh = createInitialGame();
  return {
    ...fresh,
    best: previous?.best ?? fresh.best,
    coins: previous?.coins ?? fresh.coins,
  };
}

export function advanceGame(state, deltaSeconds) {
  const delta = Math.min(deltaSeconds, 0.05);
  let active = state.active;

  if (state.status === 'playing' && active) {
    const minX = 202 + active.width / 2;
    const maxX = DESIGN_WIDTH - 202 - active.width / 2;
    let nextX = active.x + active.direction * state.speed * delta;
    let nextDirection = active.direction;

    if (nextX >= maxX) {
      nextX = maxX;
      nextDirection = -1;
    } else if (nextX <= minX) {
      nextX = minX;
      nextDirection = 1;
    }

    active = {
      ...active,
      x: nextX,
      direction: nextDirection,
    };
  }

  const offcuts = state.offcuts
    .map((offcut) => {
      const vy = offcut.vy + 1180 * delta;
      const y = offcut.y + vy * delta;
      const x = offcut.x + offcut.vx * delta;
      const rotation = offcut.rotation + offcut.vr * delta;
      const splashed = offcut.splashed || y > 1464;

      return {
        ...offcut,
        x,
        y,
        vy,
        rotation,
        splashed,
        opacity: splashed ? Math.max(0, offcut.opacity - 1.9 * delta) : offcut.opacity,
      };
    })
    .filter((offcut) => offcut.y < DESIGN_HEIGHT + 180 && offcut.opacity > 0.02);

  return {
    ...state,
    active,
    offcuts,
    event: null,
  };
}

function makeOffcut(active, overlapStart, overlapEnd, direction) {
  const activeLeft = active.x - active.width / 2;
  const activeRight = active.x + active.width / 2;
  const offcutStart = direction < 0 ? activeLeft : overlapEnd;
  const offcutEnd = direction < 0 ? overlapStart : activeRight;
  const width = Math.max(0, offcutEnd - offcutStart);

  if (width < 12) {
    return null;
  }

  return {
    ...makeBlock({
      variantId: active.variantId,
      x: (offcutStart + offcutEnd) / 2,
      width,
      cropX: offcutStart - activeLeft,
      imageWidth: active.imageWidth,
    }),
    y: STACK_TOP_Y,
    vx: direction * (190 + Math.random() * 60),
    vy: -70,
    rotation: direction * 5,
    vr: direction * (260 + Math.random() * 90),
    opacity: 1,
    splashed: false,
  };
}

export function placeActiveBlock(state) {
  if (state.status === 'paused') {
    return {
      ...state,
      status: 'playing',
    };
  }

  if (state.status === 'gameOver') {
    return restartGame(state);
  }

  if (state.status !== 'playing' || !state.active) {
    return state;
  }

  const previous = state.blocks[state.blocks.length - 1];
  const active = state.active;
  const previousLeft = previous.x - previous.width / 2;
  const previousRight = previous.x + previous.width / 2;
  const activeLeft = active.x - active.width / 2;
  const activeRight = active.x + active.width / 2;
  const overlapStart = Math.max(previousLeft, activeLeft);
  const overlapEnd = Math.min(previousRight, activeRight);
  const overlap = overlapEnd - overlapStart;
  const delta = active.x - previous.x;
  const isPerfect = Math.abs(delta) <= PERFECT_TOLERANCE;

  if (overlap <= MISS_TOLERANCE) {
    const falling = {
      ...active,
      id: id('miss'),
      y: ACTIVE_Y,
      vx: Math.sign(delta || 1) * 250,
      vy: -30,
      rotation: Math.sign(delta || 1) * 6,
      vr: Math.sign(delta || 1) * 310,
      opacity: 1,
      splashed: false,
    };

    return {
      ...state,
      status: 'gameOver',
      active: null,
      offcuts: [...state.offcuts, falling],
      best: Math.max(state.best, state.score),
      event: 'gameOver',
    };
  }

  const placedWidth = isPerfect ? previous.width : overlap;
  const placedX = isPerfect ? previous.x : (overlapStart + overlapEnd) / 2;
  const placedCropX = isPerfect ? 0 : overlapStart - activeLeft;
  const placed = makeBlock({
    variantId: active.variantId,
    x: placedX,
    width: placedWidth,
    cropX: placedCropX,
    imageWidth: active.imageWidth,
  });
  const direction = delta < 0 ? -1 : 1;
  const offcut = isPerfect ? null : makeOffcut(active, overlapStart, overlapEnd, direction);
  const scoreGain = isPerfect ? 250 : 100;
  const nextScore = state.score + scoreGain;
  const nextBest = Math.max(state.best, nextScore);
  const blocks = [...state.blocks, placed];

  window.localStorage.setItem(STORAGE_KEY, String(nextBest));

  return {
    ...state,
    score: nextScore,
    best: nextBest,
    perfectStreak: isPerfect ? state.perfectStreak + 1 : 0,
    blocks,
    active: makeActive(blocks, direction > 0 ? -1 : 1),
    offcuts: offcut ? [...state.offcuts, offcut] : state.offcuts,
    speed: Math.min(410, state.speed + 7),
    event: isPerfect ? 'perfect' : 'slice',
  };
}

export function togglePause(state) {
  if (state.status === 'playing') {
    return {
      ...state,
      status: 'paused',
    };
  }

  if (state.status === 'paused') {
    return {
      ...state,
      status: 'playing',
    };
  }

  return state;
}

export function getVisibleBlocks(blocks) {
  return blocks.slice(-9).map((block, index, visible) => {
    const fromTop = visible.length - 1 - index;

    return {
      ...block,
      y: STACK_TOP_Y + fromTop * LAYER_STEP,
    };
  });
}
