import { List } from 'immutable';
import store from '../store';
import { want, isClear, isOver } from '../unit/';
import actions from '../actions';
import { speeds, blankLine, blankMatrix, clearPoints, eachLines } from '../unit/const';
import { music } from '../unit/music';
import { getYsdk } from '../unit/yandexSdk';  
import { saveYandexScore } from '../unit/yandexSdk';
// Переменная для хранения времени последнего УСПЕШНОГО показа рекламы (в миллисекундах)
let lastAdShowTime = 0; let isFirstStart = true;
// ---  функция для показа полноэкранной рекламы  ---
const showYandexAdv = (onCloseCallback) => {  // Импортируем showFullscreenAd из yandexSdk
  const { showFullscreenAd } = require('../unit/yandexSdk');  
  const currentTime = Date.now();  if (lastAdShowTime !== 0 && currentTime - lastAdShowTime < 120000) {
    console.log('Реклама запрошена слишком рано. Прошло меньше 2 минут.');
    if (onCloseCallback) onCloseCallback();
    return;
  }
  lastAdShowTime = currentTime;
  console.log('🔄 Показываем рекламу...');
  showFullscreenAd(onCloseCallback);
};


const getStartMatrix = (startLines) => { 
  const getLine = (min, max) => { 
    const count = parseInt((((max - min) + 1) * Math.random()) + min, 10);
    const line = [];
    for (let i = 0; i < count; i++) { 
      line.push(1); }
    for (let i = 0, len = 10 - count; i < len; i++) { 
      const index = parseInt(((line.length + 1) * Math.random()), 10);
      line.splice(index, 0, 0);
    }
    return List(line);
  };
  let startMatrix = List([]);
  for (let i = 0; i < startLines; i++) {
    if (i <= 2) { // 0-3
      startMatrix = startMatrix.push(getLine(5, 8));
    } else if (i <= 6) { // 4-6
      startMatrix = startMatrix.push(getLine(4, 9));
    } else { // 7-9
      startMatrix = startMatrix.push(getLine(3, 9));
    }
  }
  for (let i = 0, len = 20 - startLines; i < len; i++) { // 插入上部分的灰色
    startMatrix = startMatrix.unshift(List(blankLine));
  }
  return startMatrix;
};
const states = {
  fallInterval: null,
  start: () => {
    isFirstStart = false;
    if (music.start) {
      music.start();
    }
    const state = store.getState();
    states.dispatchPoints(0);
    store.dispatch(actions.speedRun(state.get('speedStart')));
    const startLines = state.get('startLines');
    const startMatrix = getStartMatrix(startLines);
    store.dispatch(actions.matrix(startMatrix));
    store.dispatch(actions.moveBlock({ type: state.get('next') }));
    store.dispatch(actions.nextBlock());
    states.auto();
  },
  auto: (timeout) => {
    const out = (timeout < 0 ? 0 : timeout);
    let state = store.getState();
    let cur = state.get('cur');
    const fall = () => {
      state = store.getState();
      cur = state.get('cur');
      const next = cur.fall();
      if (want(next, state.get('matrix'))) {
        store.dispatch(actions.moveBlock(next));
        states.fallInterval = setTimeout(fall, speeds[state.get('speedRun') - 1]);
      } else {
        let matrix = state.get('matrix');
        const shape = cur && cur.shape;
        const xy = cur && cur.xy;
        shape.forEach((m, k1) => (
          m.forEach((n, k2) => {
            if (n && xy.get(0) + k1 >= 0) { 
              let line = matrix.get(xy.get(0) + k1);
              line = line.set(xy.get(1) + k2, 1);
              matrix = matrix.set(xy.get(0) + k1, line);
            }
          })
        ));
        states.nextAround(matrix);
      }
    };
    clearTimeout(states.fallInterval);
    states.fallInterval = setTimeout(fall,
      out === undefined ? speeds[state.get('speedRun') - 1] : out);
  },
  nextAround: (matrix, stopDownTrigger) => {
    clearTimeout(states.fallInterval);
    store.dispatch(actions.lock(true));
    store.dispatch(actions.matrix(matrix));
    if (typeof stopDownTrigger === 'function') {
      stopDownTrigger();
    }
    const addPoints = (store.getState().get('points') + 10) +
      ((store.getState().get('speedRun') - 1) * 2); 
    states.dispatchPoints(addPoints);
    if (isClear(matrix)) {
      if (music.clear) {
        music.clear();
      }
      return;
    }
    if (isOver(matrix)) {
      if (music.gameover) {
        music.gameover();
      }    
      states.overStart();
      return;
    }
    setTimeout(() => {
      store.dispatch(actions.lock(false));
      store.dispatch(actions.moveBlock({ type: store.getState().get('next') }));
      store.dispatch(actions.nextBlock());
      states.auto();
    }, 100);
  },
  focus: (isFocus) => {
    store.dispatch(actions.focus(isFocus));
    if (!isFocus) {
      clearTimeout(states.fallInterval);
      return;
    }
    const state = store.getState();
    if (state.get('cur') && !state.get('reset') && !state.get('pause')) {
      states.auto();
    }
  },
  pause: (isPause) => {
    store.dispatch(actions.pause(isPause));
    if (isPause) {
      clearTimeout(states.fallInterval);
      //отправка  рекорда (текущий счёт) в облако и таблицу на паузе
// Текущие очки игрока
    const currentPoints = store.getState().get('points') || 0;    
    // Отправляем текущие очки в облако и таблицу (если нужно)
    if (typeof saveYandexScore === 'function') {
      saveYandexScore(currentPoints);
    }
      // РЕКЛАМА ПРИ ПАУЗЕ: когда включается пауза, запускаем показ рекламы     
      showYandexAdv();
      return;
    }
    states.auto();
  },
  clearLines: (matrix, lines) => {
    const state = store.getState();
    let newMatrix = matrix;
    lines.forEach(n => {
      newMatrix = newMatrix.splice(n, 1);
      newMatrix = newMatrix.unshift(List(blankLine));
    });
    store.dispatch(actions.matrix(newMatrix));
    store.dispatch(actions.moveBlock({ type: state.get('next') }));
    store.dispatch(actions.nextBlock());
    states.auto();
    store.dispatch(actions.lock(false));
    const clearLines = state.get('clearLines') + lines.length;
    store.dispatch(actions.clearLines(clearLines)); 
    const addPoints = store.getState().get('points') +
      clearPoints[lines.length - 1]; 
    states.dispatchPoints(addPoints);
    const speedAdd = Math.floor(clearLines / eachLines); 
    let speedNow = state.get('speedStart') + speedAdd;
    speedNow = speedNow > 6 ? 6 : speedNow;
    store.dispatch(actions.speedRun(speedNow));
  },
  overStart: () => {
    clearTimeout(states.fallInterval);
    store.dispatch(actions.lock(true));
    store.dispatch(actions.reset(true));
    store.dispatch(actions.pause(false));    
    
    // --- ОТПРАВЛЯЕМ ФИНАЛЬНЫЙ РЕКОРД  ОДИН РАЗ ПРИ ПРОИГРЫШЕ ---
        try {
            // 1. Берем текущие очки текущей сессии
            const currentPoints = store.getState().get('points') || 0;
            // 2. Берем исторический максимум, сохраненный в игре
            const maxRecord = store.getState().get('max') || 0;            
            // Выбираем, какое число больше — текущее или историческое
            const finalScore = Math.max(currentPoints, maxRecord);
            console.log(`[VK Рекорд] Текущие очки: ${currentPoints}, Лучший рекорд: ${maxRecord}. Отправляем в функцию saveYandexscore: ${finalScore}`);
            if (typeof saveYandexScore === 'function') {
                saveYandexScore(finalScore);
            }
        } catch(e) {            console.error('Ошибка вызова saveYandexScore при проигрыше:', e);
        }    
   // Показываем рекламу только если это не первый запуск
  if (typeof showYandexAdv === 'function' && !isFirstStart) {
    showYandexAdv();     
  } 
  },

  overEnd: () => {
    store.dispatch(actions.matrix(blankMatrix));
    store.dispatch(actions.moveBlock({ reset: true }));
    store.dispatch(actions.reset(false));
    store.dispatch(actions.lock(false));
    store.dispatch(actions.clearLines(0));
  },
 dispatchPoints: (point) => { 
    store.dispatch(actions.points(point));
    if (point > 0 && point > store.getState().get('max')) {
      store.dispatch(actions.max(point)); 
    }
  },
};
export default states;
