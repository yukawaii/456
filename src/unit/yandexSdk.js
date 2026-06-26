// yandexSdk.js — для VK Games (по образу рабочего App.js)
import actions from '../actions';
import store from '../store';
import { i18n, lan } from './const';

const CLOUD_STORAGE_KEY = 'vk_cloud_score2';
// ===== КОНФИГУРАЦИЯ =====
const APP_ID = 54620141;
// ACCESS_TOKEN для серверных вызовов (не для клиента)
const ACCESS_TOKEN = '2238166b2238166b2238166b2021797986222382238166b4826d211f79d2796efcd8994';

let vkInitialized = false;
let vkUserId = null;
let vkUserToken = null;      // ← ТОКЕН ПОЛЬЗОВАТЕЛЯ
let vkUserLang = null;       // ← ЯЗЫК ПОЛЬЗОВАТЕЛЯ
let ysdkInstance = null;

//vkBridge.send("VKWebAppInit"); //конфликт с повторной инит
// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
export const setYsdk = (ysdk) => { ysdkInstance = ysdk; console.log('SDK готов'); };
export const getYsdk = () => ysdkInstance;

// Получение токена пользователя (только для ВК)
function getUserAccessToken() {  const platform = getPlatform();  
  // Для Одноклассников токен не нужен
  if (platform === 'ok') {    console.log('[OK] Токен не требуется для Одноклассников');    vkUserToken = null;    window.vkUserToken = null;    return Promise.resolve(null);  }
    // Для ВК получаем токен
  return vkBridge.send('VKWebAppGetAuthToken', {    app_id: APP_ID,    scope: ''  })  .then(data => {    console.log('[VK] Токен игрока получен');    vkUserToken = data.access_token;    window.vkUserToken = vkUserToken;
    return vkUserToken;  })  .catch(err => {    console.error('[VK] Ошибка получения токена:', err);    vkUserToken = null;    window.vkUserToken = null;    return null;  });
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
  bridge.send('VKWebAppGetLaunchParams')
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
export const initYandexSdk = () => {
    console.log('🔥 initYandexSdk ВЫЗВАН!');
  return new Promise((resolve) => {
    if (typeof vkBridge === 'undefined') {
      console.warn('VK Bridge не обнаружен');
      resolve(null);
      return;
    }
       console.log('[init] Bridge найден, инициализация начинается...');    
 // СОХРАНЯЕМ bridge В window ДЛЯ ДОСТУПА ИЗ ДРУГИХ ФАЙЛОВ И КОНСОЛИ
    window.vkBridge = vkBridge;

    vkBridge.send('VKWebAppInit')
      .then(() => {
        console.log('VK Bridge успешно инициализирован');
        vkInitialized = true;

        return vkBridge.send('VKWebAppGetLaunchParams');
      })
      .then((launchParams) => {
        // Сохраняем оба ID
        const vkOriginalId = launchParams.vk_original_vk_id || launchParams.vk_user_id || launchParams.vk_ok_user_id;
        const vkUserIdRaw = launchParams.vk_user_id; // Оригинальный VK ID (может быть null в ОК)
        
        // Для синхронизации через Cloudflare используем универсальный ID
        vkUserId = vkOriginalId;
        window.vkUserId = vkUserId;
         localStorage.setItem('vk_user_id', vkUserId); 
        
        // Для таблицы лидеров ВК сохраняем оригинальный VK ID (если есть)
        window.vkUserIdForLeaderboard = vkUserIdRaw || vkOriginalId; // fallback
        
        // Язык
        vkUserLang = launchParams.vk_language || launchParams.language || 'ru';
        
        console.log('[VK] Единый ID для синхронизации:', vkUserId);
        console.log('[VK] ID для таблицы лидеров:', window.vkUserIdForLeaderboard);
        console.log('[VK] Язык:', vkUserLang);
        
        // Применяем язык
        try {
          const { changeLanguageFromVK } = require('./const');
          changeLanguageFromVK(vkUserLang);
        } catch(e) {
          console.warn('Не удалось применить язык:', e);
        }
        
        return getUserAccessToken();
      })
      .then(() => {
  // Сохраняем в window для доступа из других мест
  window.vkUserToken = vkUserToken;
  window.vkInitialized = true;
  localStorage.setItem('vk_initialized', 'true');
 // СОХРАНЯЕМ В window ДЛЯ ОТЛАДКИ
  window.initYandexSdk = initYandexSdk;
  window.loadYandexHighScore = loadYandexHighScore;
  window.saveYandexScore = saveYandexScore;
  window.vkBridge = vkBridge;
  window.vkUserId = vkUserId;
  window.vkInitialized = true;
  
  console.log('✅ Функции и данные сохранены в window');
  ysdkInstance = { bridge: vkBridge, userId: vkUserId, token: vkUserToken, lang: window.vkUserLang };
  resolve(ysdkInstance);
});
   /*   .then(() => {
        // Сохраняем в window для доступа из других мест (на всякий случай. Точно - хз зачем, но пусть будет)
  window.vkUserToken = vkUserToken;
  window.vkUserId = vkUserId;
  window.vkUserIdForLeaderboard = vkUserIdForLeaderboard;
  window.vkUserLang = vkUserLang;

        ysdkInstance = { bridge: vkBridge, userId: vkUserId, token: vkUserToken, lang: vkUserLang };
        resolve(ysdkInstance);
      })
      .catch((err) => {
        console.error('Ошибка инициализации VK Bridge:', err);
        resolve(null);
      });*/
  });
};

// ===== ЗАГРУЗКА РЕКОРДА из облаков(единая для ВК и ОК) =====
export const loadYandexHighScore = (storeInstance) => {
    console.log('🔥 loadYandexHighScore ВЫЗВАН!');
  const platform = getPlatform();  
    // Проверяем, что ID установлен
  if (!window.vkUserId) {
    console.warn('[loadYandexHighScore] window.vkUserId отсутствует!');
    // Пытаемся получить ID из URL как fallback
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('vk_user_id') || 
                   urlParams.get('vk_original_vk_id') || 
                   urlParams.get('vk_ok_user_id');
    if (userId) {
      console.log('[loadYandexHighScore] ID из URL (fallback):', userId);
      window.vkUserId = userId;
    }
  }
  let localScore = 0;  
  let cloudflareScore = 0;  
  let vkStorageScore = 0;  
  let leaderboardScore = 0;  
  // Восстанавливаем ID из localStorage, если window.vkUserId потерялся
  if (!window.vkUserId) {
    const savedId = localStorage.getItem('vk_user_id');
    if (savedId) {
      window.vkUserId = savedId;
      console.log('[loadYandexHighScore] ID восстановлен из localStorage:', savedId);
    }
  }
 // 1. Читаем localStorage через правильный ключ
  try {
    const savedData = localStorage.getItem('REACT_TETRIS');
    if (savedData) {
      const parsed = JSON.parse(atob(decodeURIComponent(savedData)));
      localScore = parsed.max || 0;
    }
  } catch(e) {
    // Fallback на старый ключ
    try {
      localScore = parseInt(localStorage.getItem('tetris_high_score'), 10) || 0;
    } catch(e2) {}
  }  console.log('📀 localStorage рекорд:', localScore);
  // Счетчик задач, которые должны завершиться
  let tasksToWait = 0;  
  
  // Функция для финальной синхронизации после загрузки всех данных
const finalizeAndSync = () => {
    // ✅ Сначала находим абсолютный максимум из всех источников
    const absoluteMax = Math.max(localScore, cloudflareScore, vkStorageScore, leaderboardScore);
    console.log('🏆 АБСОЛЮТНЫЙ МАКСИМУМ:', absoluteMax);
    
    // ✅ ПРИНУДИТЕЛЬНАЯ СИНХРОНИЗАЦИЯ ДЛЯ ТЕЛЕФОНА
    // Если это ВК и VK Storage пуст или меньше Cloudflare — обновляем
    if (platform === 'vk' && typeof vkBridge !== 'undefined') {
      // Если VK Storage меньше Cloudflare — обновляем из Cloudflare
      if (vkStorageScore < cloudflareScore && cloudflareScore > 0) {
        vkBridge.send('VKWebAppStorageSet', {
          key: CLOUD_STORAGE_KEY,
          value: String(cloudflareScore)
        });
        console.log('🔄 Телефон: VK Storage обновлён из Cloudflare:', cloudflareScore);
      }
      
      // Если VK Storage меньше локального рекорда — обновляем
      if (vkStorageScore < localScore && localScore > 0) {
        vkBridge.send('VKWebAppStorageSet', {
          key: CLOUD_STORAGE_KEY,
          value: String(localScore)
        });
        console.log('🔄 Телефон: VK Storage обновлён из localStorage:', localScore);
      }
    }
    
    // Обновляем store
    let currentMax = 0;
    try {
      currentMax = storeInstance.getState().get('max') || 0;
    } catch(e) {}
    
    if (absoluteMax > currentMax) {
      storeInstance.dispatch(actions.max(absoluteMax));
      localStorage.setItem('tetris_high_score', absoluteMax);
      localStorage.setItem('vk_user_id', window.vkUserId || '');
      console.log('✅ Рекорд обновлён в store и localStorage:', absoluteMax);
    }
  
    // Таблица лидеров ВК - только для VK
    if (platform === 'vk' && vkInitialized && window.vkUserIdForLeaderboard && vkUserToken && maxScore > leaderboardScore) {
      vkBridge.send('VKWebAppCallAPIMethod', {
        method: 'secure.addAppEvent',
        request_id: 'syncScore_' + Date.now(),
        params: {
          client_secret: 'Q5I9iCJXGWiwYDb8aaHr',
          user_id: window.vkUserIdForLeaderboard,
          activity_id: 2,
          value: maxScore,
          v: '5.131',
          global: 1,
          access_token: ACCESS_TOKEN
        }
      });
    }
  }
};

  const checkAndFinalize = () => {
    tasksToWait--;
    if (tasksToWait === 0) {
      finalizeAndSync();
    }
  };

  // 2. Загружаем из Cloudflare
  if (window.vkUserId) {
    tasksToWait++;
    loadCloudScore(window.vkUserId).then(score => {
      cloudflareScore = score;
      console.log('☁️ Cloudflare рекорд:', cloudflareScore);
      checkAndFinalize();
    });
  }

  // 3. Загружаем из VK Storage - только для VK
  if (platform === 'vk' && typeof vkBridge !== 'undefined') {
    tasksToWait++;
    vkBridge.send('VKWebAppStorageGet', { keys: [CLOUD_STORAGE_KEY] })
      .then(data => {
        if (data.keys && data.keys[0] && data.keys[0].value) {
          vkStorageScore = parseInt(data.keys[0].value, 10) || 0;
        }
        console.log('💾 VK Storage рекорд:', vkStorageScore);
        checkAndFinalize();
      })
      .catch(err => {
        console.warn('Ошибка VK Storage:', err);
        checkAndFinalize();
      });
  }

  // 4. Загружаем из таблицы лидеров ВК - только для VK
  if (platform === 'vk' && vkInitialized && window.vkUserIdForLeaderboard && vkUserToken) {
    tasksToWait++;
    vkBridge.send('VKWebAppCallAPIMethod', {
      method: 'apps.getScore',
      request_id: 'checkScore_' + Date.now(),
      params: {
        user_id: window.vkUserIdForLeaderboard, // ← ИСПРАВЛЕНО!
        v: '5.131',
        access_token: vkUserToken
      }
    })
    .then(data => {
      leaderboardScore = parseInt(data.response) || 0;
      console.log('🏆 Таблица лидеров ВК рекорд:', leaderboardScore);
      checkAndFinalize();
    })
    .catch(err => {
      console.warn('Ошибка таблицы лидеров:', err);
      checkAndFinalize();
    });
  }

  // Если нечего ждать — сразу финализируем
  if (tasksToWait === 0) {
    finalizeAndSync();
  }
};



// ===== СОХРАНЕНИЕ РЕКОРДА в облака (единая для ВК и ОК) =====
export const saveYandexScore = (scoreValue) => {
  console.log('🔥 saveYandexScore ВЫЗВАН!');
  const platform = getPlatform();
  console.log('📱 Платформа:', platform);
  console.log('📱 vkBridge доступен?', typeof vkBridge !== 'undefined');
  
  const currentScore = parseInt(scoreValue, 10) || 0;
  if (currentScore <= 0) return;

  // Проверяем локальный рекорд
  let localMax = 0;
  try {
    localMax = store.getState().get('max') || 0;
  } catch(e) {}

  if (currentScore <= localMax) {
    console.log(`📀 Рекорд не побит (локально): ${currentScore} <= ${localMax}`);
    return;
  }

  // Сохраняем локально
  localStorage.setItem('tetris_high_score', currentScore);
  store.dispatch(actions.max(currentScore));
  console.log(`📀 Рекорд сохранён в localStorage:`, currentScore);

  // ✅ Находим bridge (глобальный или из window)
  const bridge = typeof vkBridge !== 'undefined' ? vkBridge : window.vkBridge;

  // ✅ Для ВК — сохраняем в VK Storage
  if (bridge) {
    bridge.send('VKWebAppStorageSet', {
      key: CLOUD_STORAGE_KEY,
      value: String(currentScore)
    })
    .then(() => console.log(`💾 VK Storage: рекорд ${currentScore} сохранён`))
    .catch(err => console.error('❌ Ошибка VK Storage:', err));
  } else {
    console.warn('⚠️ VK Bridge не доступен, VK Storage не сохранён');
  }

  // Сохраняем в Cloudflare (для ОК и резерва)
  if (window.vkUserId && currentScore > 0) {
    saveCloudScore(window.vkUserId, currentScore)
      .then(() => console.log(`☁️ Cloudflare: рекорд ${currentScore} сохранён`))
      .catch(err => console.error('❌ Ошибка Cloudflare:', err));
  }

  // Таблица лидеров ВК
  if (platform === 'vk' && bridge && vkInitialized && window.vkUserIdForLeaderboard && vkUserToken) {
    bridge.send('VKWebAppCallAPIMethod', {
      method: 'secure.addAppEvent',
      request_id: 'addScore_' + Date.now(),
      params: {
        client_secret: 'Q5I9iCJXGWiwYDb8aaHr',
        user_id: window.vkUserIdForLeaderboard,
        activity_id: 2,
        value: currentScore,
        v: '5.131',
        global: 1,
        access_token: ACCESS_TOKEN
      }
    })
    .then(() => console.log(`🏆 Таблица лидеров ВК: рекорд ${currentScore} отправлен!`))
    .catch(err => console.error('❌ Ошибка таблицы лидеров:', err));
  }

  console.log(`✅ Рекорд ${currentScore} успешно сохранён!`);
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

// ===== СБРОС РЕКОРДА В ТАБЛИЦЕ ЛИДЕРОВ ВК (ТОЛЬКО ДЛЯ ТЕБЯ) =====
export const resetMyLeaderboardScore = () => {
  console.log('🔄 Попытка сброса рекорда в таблице лидеров...');
  
  vkBridge.send('VKWebAppCallAPIMethod', {
    method: 'secure.addAppEvent',
    request_id: 'reset_' + Date.now(),
    params: {
      client_secret: 'Q5I9iCJXGWiwYDb8aaHr',
      user_id: 3834322,
      activity_id: 2,
      value: 0,
      v: '5.131',
      global: 1,
      access_token: '2238166b2238166b2238166b2021797986222382238166b4826d211f79d2796efcd8994'
    }
  })
  .then(() => {
    console.log('✅ Таблица лидеров сброшена на 0');
    // Проверяем
    return vkBridge.send('VKWebAppCallAPIMethod', {
      method: 'apps.getScore',
      request_id: 'check_' + Date.now(),
      params: {
        user_id: 3834322,
        v: '5.131',
        access_token: '2238166b2238166b2238166b2021797986222382238166b4826d211f79d2796efcd8994'
      }
    });
  })
  .then(data => {
    console.log('🏆 Проверка таблицы лидеров после сброса:', data.response);
  })
  .catch(err => {
    console.error('❌ Ошибка сброса таблицы лидеров:', err);
    console.log('ℹ️ Возможно, приложение не верифицировано. Тогда нужно побить рекорд 1444 в игре.');
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