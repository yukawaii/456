import actions from '../../actions';
import states from '../states';

const down = (store) => {
  // 1. Мгновенно зажимаем бежевую кнопку в Redux (запускаем анимацию)
  store.dispatch(actions.keyboard.invite(true));

  // 2. Ставим ТЕТРА на паузу
  const state = store.getState();
  const cur = state.get('cur');
  const isPause = state.get('pause');
  
  if (cur !== null && !isPause) {
    states.pause(true);
  }

  // 3. Даем кнопке 150 миллисекунд, чтобы красиво просесть вниз, 
  // и только ПОСЛЕ этого вызываем тяжелое окно ВКонтакте
  setTimeout(() => {
    const vkBridge = window.vkBridge;
    if (vkBridge) {
      vkBridge.send('VKWebAppShowInviteBox')
        .catch((e) => console.error('Ошибка окна приглашений ВК:', e));
    }
  }, 150); // Задержка в 150 мс
};

const up = (store) => {
  // Отжимаем кнопку обратно вверх
  store.dispatch(actions.keyboard.invite(false));
};

export default {
  down,
  up,
};
