// yandexSdk.js — для VK Games и OK (единое хранилище)
import actions from '../actions';
import store from '../store';

// ===== ОПРЕДЕЛЕНИЕ ПЛАТФОРМЫ =====
function getPlatform() {
  var urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('vk_client') === 'ok') return 'ok';
  var ua = navigator.userAgent;
  if (ua.indexOf('Odnoklassniki') !== -1 || ua.indexOf('OKApp') !== -1) return 'ok';
  if (window.location.hostname.indexOf('ok.ru') !== -1) return 'ok';
  return 'vk';
}

var PLATFORM = getPlatform();
console.log('🎮 yandexSdk.js платформа:', PLATFORM);

// Конфиг только для VK
const VK_CONFIG = {
  app_id: 54620141,
  client_secret: "Q5I9iCJXGWiwYDb8aaHr",
  access_token: "2238166b2238166b2238166b2021797986222382238166b4826d211f79d2796efcd8994"
};

let vkInitialized = false;
let vkUserId = null;
let ysdkInstance = null;

export const setYsdk = (ysdk) => { ysdkInstance = ysdk; console.log('SDK готов'); };
export const getYsdk = () => ysdkInstance;

// Инициализация
export const initYandexSdk = () => {
  return new Promise((resolve) => {
    if (PLATFORM === 'ok') {
      console.log('[OK] Режим Одноклассников');
      // Для OK просто помечаем как готовое
      vkInitialized = true;
      resolve({ bridge: null, platform: 'ok' });
      return;
    }
    
    if (typeof vkBridge === 'undefined') {
      console.warn('VK Bridge не обнаружен');
      resolve(null);
      return;
    }
    
    vkBridge.send('VKWebAppInit')
      .then(() => {
        console.log('VK Bridge успешно инициализирован');
        vkInitialized = true;
        return vkBridge.send('VKWebAppGetUserInfo');
      })
      .then((userInfo) => {
        vkUserId = userInfo.id;
        console.log('Пользователь авторизован:', userInfo.first_name);
        ysdkInstance = { bridge: vkBridge, userId: vkUserId };
        resolve(ysdkInstance);
      })
      .catch((err) => {
        console.error('Ошибка инициализации VK Bridge:', err);
        resolve(null);
      });
  });
};

// ===== ЕДИНОЕ ХРАНИЛИЩЕ ЧЕРЕЗ localStorage + синхронизация =====
const STORAGE_KEY = 'tetris_high_score';

export const loadYandexHighScore = (storeInstance) => {
  // Сначала из localStorage (мгновенно)
  try {
    var localScore = localStorage.getItem('tetris_high_score');
    if (localScore && parseInt(localScore, 10) > 0) {
      storeInstance.dispatch(actions.max(parseInt(localScore, 10)));
    }
  } catch(e) {}
  
  // Для VK — загружаем из VK Storage
  if (PLATFORM === 'vk' && typeof vkBridge !== 'undefined') {
    vkBridge.send('VKWebAppStorageGet', { keys: ['tetris_high_score'] })
      .then((data) => {
        let highScore = 0;
        if (data.keys && data.keys[0] && data.keys[0].value) {
          highScore = parseInt(data.keys[0].value, 10) || 0;
        }
        if (highScore > 0) {
          storeInstance.dispatch(actions.max(highScore));
          localStorage.setItem('tetris_high_score', highScore);
          console.log('[VK] Загружен рекорд из VK Storage:', highScore);
        }
      })
      .catch(err => console.error('[VK] Ошибка загрузки рекорда:', err));
  }
};

// Сохранение рекорда (единый метод)
export const saveYandexScore = (scoreValue) => {
  const currentScore = parseInt(scoreValue, 10) || 0;
  if (currentScore <= 0) return;  
  if (PLATFORM === 'ok') {
    // Для OK — сохраняем в localStorage
    try {
      var currentMax = store.getState().get('max') || 0;
      if (currentScore > currentMax) {
        localStorage.setItem('tetris_high_score', currentScore);
        store.dispatch(actions.max(currentScore));
        console.log('[OK] Рекорд сохранён в localStorage:', currentScore);
      }
    } catch(e) {}
    return;
  }  
  // Для VK — используем VKWebAppStorageSet
  if (PLATFORM === 'vk' && typeof vkBridge !== 'undefined') {
    // Сначала проверяем текущий рекорд в VK Storage
    vkBridge.send('VKWebAppStorageGet', { keys: ['tetris_high_score'] })
      .then((data) => {
        let currentVKScore = 0;
        if (data.keys && data.keys[0] && data.keys[0].value) {
          currentVKScore = parseInt(data.keys[0].value, 10) || 0;
        }        
        if (currentScore > currentVKScore) {
          // Сохраняем новый рекорд
          vkBridge.send('VKWebAppStorageSet', {
            key: 'tetris_high_score',
            value: String(currentScore)
          })
          .then(() => {
            console.log('[VK] Рекорд сохранён в VK Storage:', currentScore);
            // Обновляем локальный кеш
            localStorage.setItem('tetris_high_score', currentScore);
            if (store && store.dispatch) {
              store.dispatch(actions.max(currentScore));
            }
          })
          .catch(err => console.error('[VK] Ошибка сохранения рекорда:', err));
        } else {
          console.log('[VK] Рекорд не побит (VK):', currentScore, '<=', currentVKScore);
        }
      })
      .catch(err => console.error('[VK] Ошибка получения текущего рекорда:', err));
  }
};

// Лидерборд (для VK — таблица, для OK — ничего или окно оценки)
export const fetchYandexLeaderboard = () => {
  return new Promise((resolve) => {
    if (PLATFORM === 'ok') {
      // В ОК просто ничего не делаем или показываем оценку (без алерта о рекорде)
      if (typeof FAPI !== 'undefined' && FAPI.ui && FAPI.ui.showRate) {
        FAPI.ui.showRate();
      }
      resolve({ status: 'success' });
      return;
    }    
    if (!vkInitialized) {
      resolve({ status: 'offline' });
      return;
    }    
    vkBridge.send('VKWebAppShowLeaderBoardBox', {})
      .then(() => resolve({ status: 'success' }))
      .catch((error) => {
        console.error('Ошибка открытия лидерборда:', error);
        resolve({ status: 'error', error });
      });
  });
};

// Реклама
export const showFullscreenAd = (onAdCloseCallback = null) => {
  if (PLATFORM === 'ok') {
    // Для ОК — реклама через FAPI (если есть)
    if (typeof FAPI !== 'undefined' && FAPI.ui && FAPI.ui.showAd) {
      FAPI.ui.showAd({ 
        onClose: () => { if (onAdCloseCallback) onAdCloseCallback(); },
        onError: () => { if (onAdCloseCallback) onAdCloseCallback(); }
      });
    } else {
      if (onAdCloseCallback) onAdCloseCallback();
    }
    return;
  }
  
  if (!vkInitialized) {
    if (onAdCloseCallback) onAdCloseCallback();
    return;
  }
  
  vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' })
    .then((data) => {
      if (data.result && onAdCloseCallback) onAdCloseCallback();
    })
    .catch((error) => {
      console.error('Ошибка показа рекламы:', error);
      if (onAdCloseCallback) onAdCloseCallback();
    });
};
// Приглашение друзей
export const showVkInviteBox = () => {
  if (PLATFORM === 'ok') {
    if (typeof FAPI !== 'undefined' && FAPI.ui && FAPI.ui.showInvite) {
      FAPI.ui.showInvite();
    }
    return;
  }  
  const vkBridge = window.vkBridge;
  if (vkBridge) {
    vkBridge.send('VKWebAppShowInviteBox')
      .then((data) => { if (data.success) console.log('Приглашения отправлены'); })
      .catch((err) => console.error('Ошибка приглашения:', err));
  }
};