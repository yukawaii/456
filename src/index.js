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
if (typeof vkBridge !== 'undefined') {  
   console.log('🔥 vkBridge найден, вызываем initYandexSdk...'); 
  initYandexSdk().then(() => {
      console.log('🔥 initYandexSdk завершен! вызов loadYandexHighScore, subscribeRecord ');
    loadYandexHighScore(store);  
      subscribeRecord(store);
    // Показать баннер только после инициализации VK
  if (typeof showBannerAd === 'function') {
    showBannerAd();
  }
  }).catch(err => {  
      console.error('Ошибка инициализации:', err);
    loadYandexHighScore(store);    subscribeRecord(store);  });
} else {  // Локальный запуск
   console.log('🔥 vkBridge НЕ найден, загружаем локально');
  loadYandexHighScore(store);  subscribeRecord(store);
}

window.openLeaderboard = fetchYandexLeaderboard;

// Начальная реклама и Запуск React
//showFullscreenAd(() => {
  render(
    React.createElement(Provider, { store: store },
      React.createElement(App, null)
   ),
   document.getElementById('root')
  );
//});