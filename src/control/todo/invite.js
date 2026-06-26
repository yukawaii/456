// invite.js
import actions from '../../actions';
import states from '../states';
import bridge from '@vkontakte/vk-bridge';

const down = (store) => {
  store.dispatch(actions.keyboard.invite(true));

  const state = store.getState();
  const cur = state.get('cur');
  const isPause = state.get('pause');
  
  if (cur !== null && !isPause) {
    states.pause(true);
  }

  setTimeout(() => {
    // Проверяем, инициализирован ли VK Bridge
    if (window.vkInitialized) {
      bridge.send('VKWebAppShowInviteBox')
        .catch((e) => console.error('Ошибка окна приглашений ВК:', e));
    } else {
      console.warn('VK Bridge еще не инициализирован, пропускаем вызов');
      // Можно показать пользователю сообщение или просто игнорировать
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