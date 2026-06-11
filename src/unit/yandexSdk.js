// yandexSdk.js — для VK Games (по образу рабочего App.js)
import actions from '../actions';
import store from '../store';
import { i18n, lan } from './const';
const CLOUD_STORAGE_KEY = 'vk_cloud_score';
// ===== КОНФИГУРАЦИЯ =====
const APP_ID = 54620141;
// ACCESS_TOKEN для серверных вызовов (не для клиента)
const ACCESS_TOKEN = '2238166b2238166b2238166b2021797986222382238166b4826d211f79d2796efcd8994';

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
        vkUserId = launchParams.vk_original_vk_id || launchParams.vk_user_id || userInfo.id;   window.vkUserId = vkUserId;  
        vkUserLang = launchParams.vk_language || userInfo.language || 'ru';        
        console.log('[VK] Пользователь:', userInfo.first_name);        console.log('[VK] Единый ID для синхронизации:', vkUserId);   
             console.log('[VK] Язык:', vkUserLang);  
        // Применяем язык к игре
        try {          const { changeLanguageFromVK } = require('./const');          changeLanguageFromVK(vkUserLang);
        } catch(e) {          console.warn('Не удалось применить язык:', e);        }        
        // Получаем токен пользователя
        return getUserAccessToken();
      })      .then(() => {        ysdkInstance = { bridge: vkBridge, userId: vkUserId, token: vkUserToken, lang: vkUserLang };        resolve(ysdkInstance);
      })      .catch((err) => {        console.error('Ошибка инициализации VK Bridge:', err);        resolve(null);      });  });


};

// ===== ЗАГРУЗКА РЕКОРДА (единая для ВК и ОК) =====
export const loadYandexHighScore = (storeInstance) => {  const platform = getPlatform();    // 1. Быстро из localStorage (мгновенно) 
   try {    const localScore = localStorage.getItem('tetris_high_score');    if (localScore && parseInt(localScore, 10) > 0) {      storeInstance.dispatch(actions.max(parseInt(localScore, 10)));
      console.log('📀 Быстрая загрузка из localStorage:', localScore);    }  } catch(e) {}  // 2. Функция для обновления максимального рекорда
  const updateMaxScore = (newScore, source) => {    if (newScore <= 0) return;    const currentMax = storeInstance.getState().get('max') || 0;
    if (newScore > currentMax) {      storeInstance.dispatch(actions.max(newScore));      localStorage.setItem('tetris_high_score', newScore);      console.log(`☁️ ${source}: загружен рекорд ${newScore}`);
      return true;    }    return false;  };  // 3. Загружаем из Cloudflare (единое хранилище для ВК и ОК)
  if (window.vkUserId) {    loadCloudScore(window.vkUserId).then(cloudflareScore => {      updateMaxScore(cloudflareScore, 'Cloudflare');    });  }
  // 4. Для ВК — дополнительно загружаем из VK Storage и синхронизируем с таблицей лидеров
  if (platform === 'vk') {    if (!vkInitialized || !vkUserId) {      console.warn('[loadYandexHighScore] VK не инициализирован');      return;    }    
    if (typeof vkBridge !== 'undefined') {      vkBridge.send('VKWebAppStorageGet', { keys: [CLOUD_STORAGE_KEY] })        .then((data) => {          let cloudScore = 0;          if (data.keys && data.keys[0] && data.keys[0].value) {            cloudScore = parseInt(data.keys[0].value, 10) || 0;          }
                    if (updateMaxScore(cloudScore, 'VK Storage')) {            // Если рекорд обновился, отправляем в таблицу лидеров
            if (vkInitialized && vkUserId && vkUserToken && cloudScore > 0) {              vkBridge.send('VKWebAppCallAPIMethod', {             
                 method: 'secure.addAppEvent',
                request_id: 'syncScore_' + Date.now(),                params: {                  
                  client_secret: 'Q5I9iCJXGWiwYDb8aaHr',                  user_id: vkUserId,                
                   activity_id: 2,                  value: cloudScore,                  v: '5.131',
                  global: 1,                  access_token: ACCESS_TOKEN                }              })
              .then(() => console.log(`🏆 Рекорд ${cloudScore} синхронизирован с таблицей лидеров ВК!`))              .catch(err => console.error('❌ Ошибка синхронизации с таблицей:', err));
            }          }        })        .catch(err => console.error('Ошибка загрузки из VK Storage:', err));    }  }  
  // 5. Для ОК — также пробуем загрузить из VK Storage (как резерв, если Cloudflare недоступен)
  if (platform === 'ok' && typeof vkBridge !== 'undefined') {    vkBridge.send('VKWebAppStorageGet', { keys: [CLOUD_STORAGE_KEY] })
      .then((data) => {        let cloudScore = 0;        if (data.keys && data.keys[0] && data.keys[0].value) {          cloudScore = parseInt(data.keys[0].value, 10) || 0;
        }        updateMaxScore(cloudScore, 'VK Storage (OK резерв)');      })      .catch(err => console.error('Ошибка загрузки из VK Storage (OK):', err));  }
};



// ===== СОХРАНЕНИЕ РЕКОРДА (единая для ВК и ОК) =====
export const saveYandexScore = (scoreValue) => {  const currentScore = parseInt(scoreValue, 10) || 0;  if (currentScore <= 0) return;  
  // 1. Проверяем локальный рекорд (быстрая защита)
  let localMax = 0;  try {    localMax = store.getState().get('max') || 0;  } catch(e) {}    if (currentScore <= localMax) {    console.log(`📀 Рекорд не побит (локально): ${currentScore} <= ${localMax}`);
    return;  }   // 2. Сохраняем локально (мгновенно)
  localStorage.setItem('tetris_high_score', currentScore);  store.dispatch(actions.max(currentScore));  console.log(`📀 Рекорд сохранён в localStorage:`, currentScore);  
  // 3. СОХРАНЯЕМ В CLOUDFLARE (единое хранилище для ВК и ОК)
  const platform = getPlatform();  if (window.vkUserId && currentScore > 0) {    saveCloudScore(window.vkUserId, currentScore);  }  
  // 4. Сохраняем в VK Storage (для синхронизации с таблицей лидеров)
  if (typeof vkBridge !== 'undefined') {    vkBridge.send('VKWebAppStorageGet', { keys: [CLOUD_STORAGE_KEY] })      .then((data) => {        let cloudScore = 0;        if (data.keys && data.keys[0] && data.keys[0].value) {
          cloudScore = parseInt(data.keys[0].value, 10) || 0;        }        if (currentScore > cloudScore) {          vkBridge.send('VKWebAppStorageSet', {            key: CLOUD_STORAGE_KEY,
            value: String(currentScore)          })          .then(() => console.log(`☁️ Рекорд ${currentScore} сохранён в VK Storage! (было ${cloudScore})`))          .catch(err => console.error('❌ Ошибка сохранения в VK Storage:', err));
        } else {          console.log(`☁️ Рекорд в облаке не побит: ${currentScore} <= ${cloudScore}`);        }      })      .catch(err => console.error('❌ Ошибка получения рекорда из VK Storage:', err));  }  
  // 5. ТОЛЬКО ДЛЯ ВК: обновляем таблицу лидеров
  if (platform === 'vk' && vkInitialized && vkUserId && vkUserToken) {      
    // Сначала получаем текущий рекорд из таблицы лидеров
    vkBridge.send('VKWebAppCallAPIMethod', {      method: 'apps.getScore',      request_id: 'checkScore_' + Date.now(),      params: {        user_id: vkUserId,        v: '5.131',        access_token: vkUserToken      }    })
    .then((data) => {      let currentLeaderboardScore = parseInt(data.response) || 0;      console.log(`📊 Текущий рекорд в таблице лидеров: ${currentLeaderboardScore}`);      
      // Отправляем ТОЛЬКО если текущий счёт БОЛЬШЕ табличного
      if (currentScore > currentLeaderboardScore) {        vkBridge.send('VKWebAppCallAPIMethod', {       
           method: 'secure.addAppEvent',          request_id: 'addScore_' + Date.now(),          params: {           
             client_secret: 'Q5I9iCJXGWiwYDb8aaHr',
            user_id: vkUserId,            activity_id: 2,            value: currentScore,            v: '5.131',            global: 1,       
                 access_token: ACCESS_TOKEN          }
        })        .then(() => console.log(`🏆 Рекорд ${currentScore} отправлен в таблицу лидеров ВК! (было ${currentLeaderboardScore})`))        .catch(err => console.error('❌ Ошибка отправки в таблицу лидеров:', err));
      } else {        console.log(`ℹ️ Рекорд ${currentScore} не превышает табличный ${currentLeaderboardScore}, отправка не требуется`);      }    })    .catch(err => console.error('❌ Ошибка получения рекорда из таблицы:', err));  }

    };

// ===== ЛИДЕРБОРД (ДЛЯ ВК — ТАБЛИЦА, ДЛЯ ОК — alert) =====
export const fetchYandexLeaderboard = () => {  return new Promise((resolve) => {    const platform = getPlatform();    
// Для Одноклассников — красивое окно оценки приложения
if (platform === 'ok') {    console.log('[ОК] Предлагаем оценить приложение');       // Используем локализацию, если она есть
    let title = "Оцените игру!";    let text = "Если вам нравится ТЕТРА, поставьте оценку в магазине приложений. Это поможет нам стать лучше!";    
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
// ===== БАННЕРНАЯ РЕКЛАМА (ТОЛЬКО ДЛЯ VK) =====
export const showBannerAd = () => {  const platform = getPlatform();  
  if (platform !== 'vk') {    console.log('[Баннер] Платформа не VK, баннер не показываем');    return;  }
  if (!vkInitialized) {    console.warn('[Баннер] VK не инициализирован');    return;  }
  vkBridge.send('VKWebAppShowBannerAd', {})  // ← пустой объект
    .then(() => console.log('[Баннер] Показан в VK'))    .catch(err => console.error('[Баннер] Ошибка:', err));
  };

export const invitePlatformFriends = showVkInviteBox;
export const isVkInitialized = () => vkInitialized;

function logPlatform() {  console.log('🎮 Платформа:', getPlatform());}


// ===== СИНХРОНИЗАЦИЯ ЧЕРЕЗ CLOUDFLARE WORKER =====
const WORKER_URL = 'https://tetris-score-sync.yukawaii1988.workers.dev';

// Загрузка рекорда из Cloudflare
export const loadCloudScore = (userId) => {
  return new Promise((resolve) => {
    fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, action: 'get' })
    })
    .then(response => response.json())
    .then(data => {
      resolve(data.score || 0);
    })
    .catch(err => {
      console.error('[Cloudflare] Ошибка загрузки:', err);
      resolve(0);
    });
  });
};

// Сохранение рекорда в Cloudflare
export const saveCloudScore = (userId, score) => {
  return new Promise((resolve) => {
    fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, score: score, action: 'set' })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log(`☁️ Cloudflare: рекорд ${score} сохранён (было ${data.old})`);
      } else {
        console.log(`☁️ Cloudflare: рекорд не побит (${data.current})`);
      }
      resolve(data.success);
    })
    .catch(err => {
      console.error('[Cloudflare] Ошибка сохранения:', err);
      resolve(false);
    });
  });
};



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
  showBannerAd: showBannerAd,
    loadCloudScore: loadCloudScore,
  saveCloudScore: saveCloudScore,
};


// Ждём появления vkBridge и выполняем сброс ВРЕМЕННЫЙ СБРОС 
function waitForBridge() {
  if (typeof vkBridge !== 'undefined') {
    console.log('✅ vkBridge найден, выполняем сброс...');
    
    vkBridge.send('VKWebAppCallAPIMethod', {
      method: 'secure.addAppEvent',
      params: {
        client_secret:  'Q5I9iCJXGWiwYDb8aaHr',
        user_id: "3834322",
        activity_id: 2,
        value: 0,
        v: '5.131',
        global: 1,
        access_token: '2238166b2238166b2238166b2021797986222382238166b4826d211f79d2796efcd8994'
      }
    }).then(() => {
      console.log('✅ Рекорд сброшен на 0');
    }).catch(err => {
      console.error('❌ Ошибка:', err);
    });
    
  } else {
    console.log('⏳ Ждём vkBridge...');
    setTimeout(waitForBridge, 500);
  }
}

// Запускаем ожидание
waitForBridge();
///конец врем блока сброса

