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

// ПО УМОЛЧАНИЮ ТЕТРА
var currentMode = GAME_MODES.TETRA;

// Читаем из localStorage, но если ничего нет - оставляем ТЕТРА
try {
  var saved = localStorage.getItem('tetris_game_mode');
  if (saved === GAME_MODES.CLASSIC) {
    currentMode = GAME_MODES.CLASSIC;
  } else if (saved === GAME_MODES.TETRA) {
    currentMode = GAME_MODES.TETRA;
  } else {
    // Нет сохраненного режима - ставим ТЕТРА и сохраняем
    currentMode = GAME_MODES.TETRA;
    localStorage.setItem('tetris_game_mode', GAME_MODES.TETRA);
  }
} catch(e) {}

// Устанавливаем глобальную переменную
if (typeof window !== 'undefined') {
  window.currentGameMode = currentMode;
  console.log('modes.js: установил window.currentGameMode =', currentMode);
  console.log('modes.js: localStorage tetris_game_mode =', localStorage.getItem('tetris_game_mode'));
}

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
    if (typeof window !== 'undefined') {
      window.currentGameMode = mode;
      if (window.blockShapeUpdate) {
        window.blockShapeUpdate(currentShapes);
      }
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