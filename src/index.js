// src/index.js (упрощённая версия)

import store from './store';
import React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import App from './containers/';
import './unit/const';
import './control';
import { subscribeRecord } from './unit';
import actions from './actions';
import { 
  loadYandexHighScore, 
  saveYandexScore, 
  fetchYandexLeaderboard, 
  showFullscreenAd,
  showVkInviteBox,
  getPlatform,
  logPlatform,
  initYandexSdk,
  showBannerAd,        
} from './unit/yandexSdk';

console.log('🔥 index.js ЗАГРУЖЕН!');

logPlatform();
var PLATFORM = getPlatform();


// Инициализация VK и загрузка рекорда (не блокирует рендер)
// src/index.js

if (typeof vkBridge !== 'undefined') {
  console.log('🔥 vkBridge найден, вызываем initYandexSdk...');
  
  initYandexSdk().then(() => {
    console.log('🔥 initYandexSdk завершен!');
    
    // ✅ Сначала загружаем рекорд из Cloudflare
    loadYandexHighScore(store);
    
    // ✅ Потом подписываемся на изменения
    subscribeRecord(store);
    
    if (typeof showBannerAd === 'function') {
      showBannerAd();
    }
  }).catch(err => {
    console.error('Ошибка инициализации:', err);
    loadYandexHighScore(store);
    subscribeRecord(store);
  });
}

window.openLeaderboard = fetchYandexLeaderboard;

window.store = store;
window.actions = actions; // тоже пригодится
console.log('✅ store сохранен в window для отладки');
//обнуление рекорда на экране (берем его из клауда, а не из локалов)
//store.dispatch(actions.max(0));

// Не обнуляем рекорд при загрузке, а загружаем из VK Storage
const savedMax = parseInt(localStorage.getItem('tetris_high_score'), 10) || 0;
if (savedMax > 0) {
  store.dispatch(actions.max(savedMax));
  console.log('✅ Рекорд загружен из localStorage:', savedMax);
}

// Начальная реклама (-) и Запуск React
//showFullscreenAd(() => {
  render(
    React.createElement(Provider, { store: store },
      React.createElement(App, null)
   ),
   document.getElementById('root')
  );
//});