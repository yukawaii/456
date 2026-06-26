// invite.js
import actions from '../../actions';
import states from '../states';

const down = (store) => {
  store.dispatch(actions.keyboard.invite(true));

  const state = store.getState();
  const cur = state.get('cur');
  const isPause = state.get('pause');
  
  if (cur !== null && !isPause) {
    states.pause(true);
  }

setTimeout(() => {
  if (window.vkBridge && window.vkInitialized) {
    window.vkBridge.send('VKWebAppShowInviteBox')
      .catch((e) => console.error('Ошибка окна приглашений:', e));
  }
}, 150);
};

const up = (store) => {
  store.dispatch(actions.keyboard.invite(false));
};

export default {
  down,
  up,
};