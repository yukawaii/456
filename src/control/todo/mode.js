// src/control/todo/mode.js
import states from '../states';

// Здесь будет логика при нажатии на кнопку
const down = (store) => {
  // Вызываем глобальную функцию, которую ты создал ранее в containers/index.js
  if (typeof window.onModeToggle === 'function') {
    window.onModeToggle();
  }
};

// Здесь логика при отпускании кнопки (обычно пустая для таких кнопок)
const up = (store) => {
  // Ничего не делаем
};

export default {
  down,
  up,
};