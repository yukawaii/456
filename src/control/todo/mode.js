import event from '../../unit/event';
import states from '../states';
import actions from '../../actions';
import { GAME_MODES, setGameMode, getCurrentMode, MODE_SHAPES } from '../../unit/modes';

const down = (store) => {
  store.dispatch(actions.keyboard.mode(true));
  
  event.down({
    key: 'mode',
    once: true,
    callback: () => {
      const state = store.getState();
      
      if (state.get('lock')) {
        return;
      }
      
      const cur = state.get('cur');
      const isPause = state.get('pause');
      
      // Ставим на паузу
      if (cur !== null && !isPause) {
        states.pause(true);
      }
      
      // Переключаем режим
      const currentMode = getCurrentMode();
      let newMode;
      
      if (currentMode === GAME_MODES.CLASSIC) {
        newMode = GAME_MODES.TETRA;
      } else {
        newMode = GAME_MODES.CLASSIC;
      }
      
      setGameMode(newMode);
      
      // Меняем фигурки в const.js
      const newShapes = MODE_SHAPES[newMode];
      
      // Обновляем через window.blockShapeUpdate
      if (window.blockShapeUpdate) {
        window.blockShapeUpdate(newShapes);
      }
      
      // Принудительно обновляем blockType для следующих фигурок
      if (window.blockType) {
        // Забираем типы из новых фигурок
        const newBlockType = Object.keys(newShapes);
        window.blockType.length = 0;
        newBlockType.forEach(key => window.blockType.push(key));
      }
      
      // Перезапускаем игру
      states.overStart();
      
      console.log('Режим изменён на:', newMode);
      console.log('Новые типы фигурок:', Object.keys(newShapes));
    },
  });
};

const up = (store) => {
  store.dispatch(actions.keyboard.mode(false));
  event.up({ key: 'mode' });
};

export default { down, up };