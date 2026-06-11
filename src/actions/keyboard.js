import * as reducerType from '../unit/reducerType';

function drop(data) {
  return {
    type: reducerType.KEY_DROP,
    data,
  };
}

function down(data) {
  return {
    type: reducerType.KEY_DOWN,
    data,
  };
}

function left(data) {
  return {
    type: reducerType.KEY_LEFT,
    data,
  };
}

function right(data) {
  return {
    type: reducerType.KEY_RIGHT,
    data,
  };
}

function rotate(data) {
  return {
    type: reducerType.KEY_ROTATE,
    data,
  };
}

function reset(data) {
  return {
    type: reducerType.KEY_RESET,
    data,
  };
}

function music(data) {
  return {
    type: reducerType.KEY_MUSIC,
    data,
  };
}

function pause(data) {
  return {
    type: reducerType.KEY_PAUSE,
    data,
  };
}

// Добавляем экшен для обработки состояния нажатия золотой кнопки
function leaderboard(data) {
  return {
    type: reducerType.KEY_LEADERBOARD,
    data,
  };
}
function invite(data) {
  return {
    type: reducerType.KEY_INVITE,
    data,
  };
}

// смена режимов
function mode(data) {
  return {
    type: reducerType.KEY_MODE,
    data,
  };
}

export default {
  drop,
  down,
  left,
  right,
  rotate,
  reset,
  music,
  pause,
  leaderboard, 
  invite,
  mode, 
};
