import store from '../store';
import todo from './todo';
import { fetchYandexLeaderboard } from '../unit/yandexSdk';

const keyboard = {
  37: 'left',
  38: 'rotate',
  39: 'right',
  40: 'down',
  32: 'space',
  83: 's',
  82: 'r',
  80: 'p',
  76: 'l',
};

let keydownActive;



const boardKeys = Object.keys(keyboard).map(e => parseInt(e, 10));

const keyDown = (e) => {

  if (e.metaKey === true || boardKeys.indexOf(e.keyCode) === -1) {
    return;
  }
  e.preventDefault();
  
  const type = keyboard[e.keyCode];
  
  // Для всех клавиш вызываем todo (включая L)
  if (type === keydownActive) {
    return;
  }
  keydownActive = type;
  todo[type].down(store);
  
  // Для L дополнительно открываем лидерборд
  if (e.keyCode === 76) {
    if (typeof window.openLeaderboard === 'function') {
      window.openLeaderboard();
    }
  }
};

const keyUp = (e) => {
  if (e.metaKey === true || boardKeys.indexOf(e.keyCode) === -1) {
    return;
  }
  e.preventDefault();
  
  const type = keyboard[e.keyCode];
  // Убираем return для L
  if (type === keydownActive) {
    keydownActive = '';
  }
  todo[type].up(store);
};

document.addEventListener('keydown', keyDown, true);
document.addEventListener('keyup', keyUp, true);