// yandexSdk.js — для VK Games (по образу рабочего App.js)
import actions from '../actions';
import store from '../store';
import { i18n, lan } from './const';
// ===== КОНФИГУРАЦИЯ =====
const APP_ID = 54620141;
// ACCESS_TOKEN для серверных вызовов (не для клиента)
const ACCESS_TOKEN = "2238166b2238166b2238166b2021797986222382238166b4826d211f79d2796efcd8994";

let vkInitialized = false;
let vkUserId = null;
let vkUserToken = null;      // ← ТОКЕН ПОЛЬЗОВАТЕЛЯ
let vkUserLang = null;       // ← ЯЗЫК ПОЛЬЗОВАТЕЛЯ
let ysdkInstance = null;

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
export const setYsdk = (ysdk) => { ysdkInstance = ysdk; console.log('SDK готов'); };
export const getYsdk = () => ysdkInstance;

// Получение токена пользователя
function getUserAccessToken() {  return vkBridge.send('VKWebAppGetAuthToken', {
    app_id: APP_ID,    scope: ''  })
  .then(data => {    console.log('[VK] Токен игрока получен');    vkUserToken = data.access_token;
    return vkUserToken;  })
  .catch(err => {    console.error('[VK] Ошибка получения токена:', err);
    return null;  });
}

// Определение платформы
var PLATFORM = null;
function getPlatform() {
  if (PLATFORM) return PLATFORM;  var urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('vk_client') === 'ok') {    PLATFORM = 'ok';    console.log('🎮 Платформа (по vk_client):', PLATFORM);
    return PLATFORM;  }
  var ua = navigator.userAgent;
  if (ua.indexOf('Odnoklassniki') !== -1 || ua.indexOf('OKApp') !== -1) {    PLATFORM = 'ok';    console.log('🎮 Платформа (по User-Agent):', PLATFORM);
    return PLATFORM;  }
  var hostname = window.location.hostname;  if (hostname.indexOf('ok.ru') !== -1 || hostname.indexOf('odnoklassniki') !== -1) {
    PLATFORM = 'ok';    console.log('🎮 Платформа (по домену):', PLATFORM);
    return PLATFORM;  }
  PLATFORM = 'vk';  console.log('🎮 Платформа (по умолчанию):', PLATFORM);
  return PLATFORM;
}

// Получение единого ID пользователя для синхронизации между ВК и ОК
export const updateSyncUserId = () => {  if (typeof vkBridge === 'undefined') {    console.warn('[updateSyncUserId] VK Bridge не найден');
    return;  }  
  vkBridge.send('VKWebAppGetLaunchParams')
    .then((launchParams) => {      vkUserId = launchParams.vk_original_vk_id || launchParams.vk_user_id;
      console.log('[updateSyncUserId] Единый ID пользователя:', vkUserId);    })
    .catch((err) => {      console.error('[updateSyncUserId] Ошибка:', err);    });
};

// Получение языка пользователя
export const updateUserLanguage = () => {  if (typeof vkBridge === 'undefined') {    console.warn('[updateUserLanguage] VK Bridge не найден');
    return;  }  
  vkBridge.send('VKWebAppGetLaunchParams')
    .then((launchParams) => {      const language = launchParams.vk_language || launchParams.language || 'ru';
      vkUserLang = language;      console.log('[updateUserLanguage] Язык пользователя:', language);      
      // Применяем язык к игре
      try {        const { changeLanguageFromVK } = require('./const');        changeLanguageFromVK(language);
      } catch(e) {        console.warn('Не удалось применить язык:', e);      }    })
    .catch((err) => {      console.error('[updateUserLanguage] Ошибка:', err);    });
};

// ===== ИНИЦИАЛИЗАЦИЯ =====
export const initYandexSdk = () => {  return new Promise((resolve) => {    if (typeof vkBridge === 'undefined') {
      console.warn('VK Bridge не обнаружен');      resolve(null);      return;    }    
    vkBridge.send('VKWebAppInit')      .then(() => {        console.log('VK Bridge успешно инициализирован');
        vkInitialized = true;     // Получаем единый ID и язык 
        return Promise.all([          vkBridge.send('VKWebAppGetLaunchParams'),          vkBridge.send('VKWebAppGetUserInfo')        ]);      })
      .then(([launchParams, userInfo]) => {        // Обновляем ID (приоритет у vk_original_vk_id для синхронизации)
        vkUserId = launchParams.vk_original_vk_id || launchParams.vk_user_id || userInfo.id;
        vkUserLang = launchParams.vk_language || userInfo.language || 'ru';        
        console.log('[VK] Пользователь:', userInfo.first_name);        console.log('[VK] Единый ID для синхронизации:', vkUserId);        console.log('[VK] Язык:', vkUserLang);        
        // Применяем язык к игре
        try {          const { changeLanguageFromVK } = require('./const');          changeLanguageFromVK(vkUserLang);
        } catch(e) {          console.warn('Не удалось применить язык:', e);        }        
        // Получаем токен пользователя
        return getUserAccessToken();
      })      .then(() => {        ysdkInstance = { bridge: vkBridge, userId: vkUserId, token: vkUserToken, lang: vkUserLang };        resolve(ysdkInstance);
      })      .catch((err) => {        console.error('Ошибка инициализации VK Bridge:', err);        resolve(null);      });  });
};

// ===== ЗАГРУЗКА РЕКОРДА =====
export const loadYandexHighScore = (storeInstance) => {
  // Быстро из localStorage
  try {    const localScore = localStorage.getItem('tetris_high_score');
    if (localScore && parseInt(localScore, 10) > 0) {      storeInstance.dispatch(actions.max(parseInt(localScore, 10)));
      console.log('📀 Быстрая загрузка из localStorage:', localScore);    }
  } catch(e) {}    if (!vkInitialized || !vkUserId) {    console.warn('[loadYandexHighScore] VK не инициализирован');
    return;
  }  
  // Используем apps.getScore с токеном пользователя
  vkBridge.send('VKWebAppCallAPIMethod', {    method: 'apps.getScore',    request_id: 'loadScore_' + Date.now(),
    params: {      user_id: vkUserId,      v: '5.131',      access_token: vkUserToken  // ← ТОКЕН ПОЛЬЗОВАТЕЛЯ
    }
  })
  .then((data) => {    let highScore = parseInt(data.response) || 0;
    if (highScore > 0) {      storeInstance.dispatch(actions.max(highScore));
      localStorage.setItem('tetris_high_score', highScore);      console.log('☁️ Загружен рекорд из VK API:', highScore);    }
  })  .catch(err => console.error('Ошибка загрузки рекорда:', err));
};

// ===== СОХРАНЕНИЕ РЕКОРДА =====
export const saveYandexScore = (scoreValue) => {
  const currentScore = parseInt(scoreValue, 10) || 0;
  if (currentScore <= 0) return;  
  if (!vkInitialized || !vkUserId || !vkUserToken) {    console.warn('[saveYandexScore] VK не инициализирован или нет токена');    return;  }  
  // Локальная защита
  try {    const maxRecordInGame = store.getState().get('max') || 0;
    if (currentScore < maxRecordInGame) {      console.log(`[VK] Рекорд не побит: ${currentScore} < ${maxRecordInGame}`);
      return;    }  } catch(e) {}  
  // 1. Получаем текущий рекорд через apps.getScore
  vkBridge.send('VKWebAppCallAPIMethod', {    method: 'apps.getScore',    request_id: 'getScore_' + Date.now(),
    params: {      user_id: vkUserId,      v: '5.131',      access_token: vkUserToken    }
  })  .then((data) => {    let currentVKScore = parseInt(data.response) || 0;    
    if (currentScore > currentVKScore) {
      // 2. Сохраняем через secure.addAppEvent
      vkBridge.send('VKWebAppCallAPIMethod', {        method: 'secure.addAppEvent',        request_id: 'addScore_' + Date.now(),
        params: {          client_secret: ACCESS_TOKEN,          user_id: vkUserId,          activity_id: 2,          value: currentScore,
          v: '5.131',          global: 1,          access_token: vkUserToken        }
      })      .then(() => {        console.log(`✅ Рекорд ${currentScore} сохранён в VK!`);
        localStorage.setItem('tetris_high_score', currentScore);        store.dispatch(actions.max(currentScore));
      })
      .catch(err => console.error('❌ Ошибка сохранения:', err));
    } else {      console.log(`ℹ️ Рекорд не побит: ${currentScore} <= ${currentVKScore}`);    }
  })  .catch(err => console.error('❌ Ошибка получения рекорда:', err));
};

// ===== ЛИДЕРБОРД (ДЛЯ ВК — ТАБЛИЦА, ДЛЯ ОК — alert) =====
export const fetchYandexLeaderboard = () => {  return new Promise((resolve) => {    const platform = getPlatform();    
// Для Одноклассников — красивое окно оценки приложения
if (platform === 'ok') {    console.log('[ОК] Предлагаем оценить приложение');       // Используем локализацию, если она есть
    let title = "Оцените игру!";    let text = "Если вам нравится Тетрис, поставьте оценку в магазине приложений. Это поможет нам стать лучше!";    
    if (typeof i18n !== 'undefined' && i18n.rateGame && i18n.rateGame[lan]) {        title = i18n.rateGame[lan];        text = i18n.rateGameText[lan];    }    
    if (typeof swal !== 'undefined') {        // 1. Временно отключаем перехват фокуса на уровне Bootstrap (если используется)
        // Это решит проблему с невозможностью нажать на кнопку.
        if (typeof $ !== 'undefined' && $.fn && $.fn.modal) {            try { $(document).off('focusin.modal'); } catch(e) {}     }
        // 2. Показываем наше окно
        swal.fire({            title: title,            text: text,            icon: "success",            confirmButtonText: 'Ok'        }).then(() => {
            // 3. После закрытия окна всё идёт штатно
            resolve({ status: 'success' });        });        
        // 4. Ключевой момент: отключаем перехват фокуса повторно после открытия окна.
        // Это гарантирует, что кнопка OK станет кликабельной в эмуляторе.
        setTimeout(() => {            if (typeof $ !== 'undefined' && $.fn && $.fn.modal) {                try { $(document).off('focusin.modal'); } catch(e) {}            }            
            // 5. На случай, если jQuery нет, но Bootstrap есть
            if (typeof bootstrap !== 'undefined') {                try {                    const modalElement = document.querySelector('.modal');
                    if (modalElement && bootstrap.Modal && bootstrap.Modal.getInstance(modalElement)) {                        bootstrap.Modal.getInstance(modalElement)._focustrap.deactivate();
                    }                } catch(e) {}            }        }, 50);        
    } else {        // Запасной вариант
        alert(text);        resolve({ status: 'success' });    }    return;}
    // Для VK — таблица лидеров
    if (!vkInitialized) {      resolve({ status: 'offline' });      return;    }    
    const currentMaxScore = store.getState().get('max') || 0;    
    vkBridge.send('VKWebAppShowLeaderBoardBox', { user_result: currentMaxScore })
      .then(() => resolve({ status: 'success' }))      .catch((error) => {        console.error('Ошибка открытия лидерборда:', error);
        resolve({ status: 'error', error });      });  });
};

// ===== РЕКЛАМА =====
export const showFullscreenAd = (onAdCloseCallback = null) => {
  if (!vkInitialized) {    if (onAdCloseCallback) onAdCloseCallback();
    return;
  }  
  vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' })
    .then((data) => {      if (data.result && onAdCloseCallback) onAdCloseCallback();
    })
    .catch((error) => {      console.error('Ошибка показа рекламы:', error);
      if (onAdCloseCallback) onAdCloseCallback();
    });
};

// ===== ПРИГЛАШЕНИЕ ДРУЗЕЙ =====
export const showVkInviteBox = () => {
  const platform = getPlatform();  
  if (platform === 'ok') {    if (typeof FAPI !== 'undefined' && FAPI.ui && typeof FAPI.ui.showInvite === 'function') {
      FAPI.ui.showInvite();
    } else {      alert('Пригласите друзей в игру!');    }
    return;
  }  
  if (platform === 'vk' && typeof vkBridge !== 'undefined') {
    vkBridge.send('VKWebAppShowInviteBox')
      .then((data) => {        if (data.success) console.log('[ВК] Приглашения отправлены');      })
      .catch((err) => console.error('[ВК] Ошибка:', err));  }
};

export const invitePlatformFriends = showVkInviteBox;
export const isVkInitialized = () => vkInitialized;

function logPlatform() {  console.log('🎮 Платформа:', getPlatform());}

// Алиасы для совместимости с index.js
export const getPlatformScore = loadYandexHighScore;
export const sendPlatformScore = saveYandexScore;
export const showPlatformLeaderboard = fetchYandexLeaderboard;
export const showPlatformAd = showFullscreenAd;
// ===== ЭКСПОРТ ДЛЯ COMMONJS (WEBPACK 1) =====
module.exports = {
  initYandexSdk: initYandexSdk,
  loadYandexHighScore: loadYandexHighScore,
  saveYandexScore: saveYandexScore,
  fetchYandexLeaderboard: fetchYandexLeaderboard,
  showFullscreenAd: showFullscreenAd,
  showVkInviteBox: showVkInviteBox,
  invitePlatformFriends: invitePlatformFriends,
  getPlatform: getPlatform,
  logPlatform: logPlatform,
  setYsdk: setYsdk,
  getYsdk: getYsdk,
    getPlatformScore: getPlatformScore,
  sendPlatformScore: sendPlatformScore,
  showPlatformLeaderboard: showPlatformLeaderboard,
  showPlatformAd: showPlatformAd,
};