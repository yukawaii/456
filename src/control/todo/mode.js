import event from '../../unit/event';
import states from '../states';
import actions from '../../actions';

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
      
      if (cur !== null && !isPause) {
        states.pause(true);
      }
      
      if (typeof window.showModeSelection === 'function') {
        window.showModeSelection();
      }
    },
  });
};

const up = (store) => {
  store.dispatch(actions.keyboard.mode(false));
  event.up({ key: 'mode' });
};

export default { down, up };