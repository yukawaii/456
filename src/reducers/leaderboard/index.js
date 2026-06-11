import * as reducerType from '../../unit/reducerType';

// По умолчанию кнопка таблицы лидеров не нажата (false)
let initState = false;

const leaderboard = (state = initState, action) => {
  switch (action.type) {
    case reducerType.LEADERBOARD: // Опираемся на типы экшенов из reducerType
      return action.data;
    default:
      return state;
  }
};

export default leaderboard;
