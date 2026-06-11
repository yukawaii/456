// modes.js — CommonJS для Webpack 1
var GAME_MODES = {
  CLASSIC: 'classic',
  TETRA: 'tetra',
};

var MODE_SHAPES = {};
MODE_SHAPES[GAME_MODES.CLASSIC] = {
  I: [[1, 1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  Z: [[1, 1, 0], [0, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
};
MODE_SHAPES[GAME_MODES.TETRA] = {
  I: [[1, 1, 1]],
  L: [[1, 0], [1, 1]],
  J: [[0, 1], [1, 1]],
  Z: [[1, 1, 0], [0, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 1, 0]],
};

var currentMode = localStorage.getItem('tetris_game_mode') || GAME_MODES.CLASSIC;
var currentShapes = MODE_SHAPES[currentMode];

function getCurrentMode() {
  return currentMode;
}

function getCurrentShapes() {
  return currentShapes;
}

function setGameMode(mode) {
  if (MODE_SHAPES[mode]) {
    currentMode = mode;
    currentShapes = MODE_SHAPES[mode];
    localStorage.setItem('tetris_game_mode', mode);
    if (typeof window !== 'undefined' && window.blockShapeUpdate) {
      window.blockShapeUpdate(currentShapes);
    }
  }
}

module.exports = {
  GAME_MODES: GAME_MODES,
  MODE_SHAPES: MODE_SHAPES,
  getCurrentMode: getCurrentMode,
  getCurrentShapes: getCurrentShapes,
  setGameMode: setGameMode,
};