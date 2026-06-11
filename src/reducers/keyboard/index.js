import { combineReducers } from 'redux-immutable';
import drop from './drop';
import down from './down';
import left from './left';
import right from './right';
import rotate from './rotate';
import reset from './reset';
import music from './music';
import pause from './pause';
import leaderboard from './leaderboard'; // Импортируем наш редюсер кнопки
import invite from './invite'; 

const keyboardReducer = combineReducers({
  drop,
  down,
  left,
  right,
  rotate,
  reset,
  music,
  pause,
  leaderboard, // Регистрируем её в Redux-состоянии клавиатуры
  invite,
});

export default keyboardReducer;
