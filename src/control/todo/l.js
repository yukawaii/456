import actions from '../../actions';
import states from '../states';

const down = (store) => {
  // Мгновенно зажимаем желтую кнопку в Redux, чтобы сработал визуальный CSS-эффект ухода вниз
  store.dispatch(actions.keyboard.leaderboard(true));

  // Если в стакане есть падающая фигура, аккуратно ставим ТЕТРА на паузу
  const state = store.getState();
  const cur = state.get('cur');
  const isPause = state.get('pause');
  if (cur !== null && !isPause) {
    states.pause(true);
  }
};

const up = (store) => {
  // Отжимаем желтую кнопку обратно вверх
  store.dispatch(actions.keyboard.leaderboard(false));
};

export default {
  down,
  up,
};
