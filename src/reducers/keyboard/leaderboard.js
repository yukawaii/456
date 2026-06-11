import * as reducerType from '../../unit/reducerType';

// Начальное состояние кнопки — строго false
const initState = false;

const reducer = (state = initState, action) => {
  switch (action.type) {
    case reducerType.KEY_LEADERBOARD:
      // Возвращаем true при нажатии и false при отжатии
      return action.data; 
    default:
      return state;
  }
};

export default reducer;
