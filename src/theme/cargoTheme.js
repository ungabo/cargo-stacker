const BASE = '/themes/cargo/';

function container(id, label, color) {
  return {
    id,
    label,
    sprite: `${BASE}containers/${id}/side.png`,
    color,
    textures: {
      side: `${BASE}containers/${id}/texture-side.png`,
      top: `${BASE}containers/${id}/texture-top.png`,
      end: `${BASE}containers/${id}/texture-end.png`,
    },
  };
}

export const cargoTheme = {
  id: 'cargo',
  displayName: 'Cargo Stacker',
  storageKey: 'cargo-stacker.best-score',
  design: {
    width: 941,
    height: 1672,
  },
  backgrounds: {
    scroll: `${BASE}backgrounds/scroll.png`,
    day: `${BASE}backgrounds/day.png`,
    sunset: `${BASE}backgrounds/sunset.png`,
    night: `${BASE}backgrounds/night.png`,
    storm: `${BASE}backgrounds/storm.png`,
  },
  concepts: {
    gameplay: `${BASE}concepts/gameplay.png`,
    gameOver: `${BASE}concepts/game-over.png`,
  },
  ui: {
    logo: `${BASE}ui/logo-clean.png`,
    scoreBadge: `${BASE}ui/score-badge.png`,
    panelDark: `${BASE}ui/panel-dark.png`,
    buttonGreen: `${BASE}ui/button-green.png`,
    buttonBlue: `${BASE}ui/button-blue.png`,
    buttonRed: `${BASE}ui/button-red.png`,
    settings: `${BASE}ui/settings.png`,
    pause: `${BASE}ui/pause.png`,
  },
  audio: {
    button: `${BASE}audio/button.wav`,
    tap: `${BASE}audio/tap.wav`,
    thud: `${BASE}audio/thud.wav`,
    slice: `${BASE}audio/slice.wav`,
    perfect: `${BASE}audio/perfect.wav`,
    splash: `${BASE}audio/splash.wav`,
    gameOver: `${BASE}audio/game-over.wav`,
  },
  textures: {
    environment: {
      deck: `${BASE}environment/deck.png`,
      water: `${BASE}environment/water.png`,
    },
  },
  scene: {
    deckColor: '#ffffff',
    hullColor: '#173c62',
    groundColor: '#6bd6ff',
    groundOpacity: 0.34,
    edgeOpacity: 0.28,
    craneColor: '#1b3659',
    pieceMetalness: 0.12,
    pieceRoughness: 0.72,
  },
  gameplay: {
    axes: ['x', 'z'],
  },
  containers: [
    container('cs-01-orange', 'Northwind Logistics', '#f57b1b'),
    container('cs-02-teal', 'Ironharbor Shipping', '#18b0aa'),
    container('cs-03-red', 'Redstone Freight', '#e63e2a'),
    container('cs-04-blue', 'Skyline Carriers', '#257edb'),
    container('cs-05-purple', 'Solace Global', '#8c45c5'),
    container('cs-06-yellow', 'Titanforge Industries', '#f7bf22'),
    container('cs-07-green', 'Veridian Transport', '#54bd39'),
    container('cs-08-steelblue', 'Waypoint Express', '#4b7993'),
  ],
  offcuts: [
    `${BASE}containers/offcuts/offcut-1.png`,
    `${BASE}containers/offcuts/offcut-2.png`,
    `${BASE}containers/offcuts/offcut-3.png`,
    `${BASE}containers/offcuts/offcut-4.png`,
  ],
};
