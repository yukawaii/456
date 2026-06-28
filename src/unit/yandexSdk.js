// yandexSdk.js — для VK Games
import actions from '../actions';
import store from '../store';
import { i18n, lan } from './const';

const CLOUD_STORAGE_KEY = 'vk_cloud_score2';
// ===== КОНФИГУРАЦИЯ =====
const APP_ID = 54620141;
const ACCESS_TOKEN = '2238166b2238166b2238166b2021797986222382238166b4826d211f79d2796efcd8994';

let vkInitialized = false;
let vkUserId = null;
let vkUserToken = null;
let vkUserLang = null;
let ysdkInstance = null;

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
export const setYsdk = (ysdk) => { ysdkInstance = ysdk; console.log('SDK готов'); };
export const getYsdk = () => ysdkInstance;

// Получение токена пользователя
function getUserAccessToken() {
  const platform = getPlatform();
  if (platform === 'ok') {
    console.log('[OK] Токен не требуется для Одноклассников');
    vkUserToken = null;
    window.vkUserToken = null;
    return Promise.resolve(null);
  }
  return vkBridge.send('VKWebAppGetAuthToken', {
    app_id: APP_ID,
    scope: ''
  })
  .then(data => {
    console.log('[VK] Токен игрока получен');
    vkUserToken = data.access_token;
    window.vkUserToken = vkUserToken;
    if (data.user_id && !window.vkUserId) {
      window.vkUserId = data.user_id;
      console.log('[VK] ID пользователя получен из токена:', window.vkUserId);
    }
    return vkUserToken;
  })
  .catch(err => {
    console.error('[VK] Ошибка получения токена:', err);
    vkUserToken = null;
    window.vkUserToken = null;
    return null;
  });
}

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
    window.vkBridge = vkBridge;

    vkBridge.send('VKWebAppInit')
      .then(() => {
        console.log('VK Bridge успешно инициализирован');
        vkInitialized = true;
        return vkBridge.send('VKWebAppGetLaunchParams');
      })
      .then((launchParams) => {
        console.log('[VK] LaunchParams получены:', launchParams);
        const vkUserId = launchParams.vk_user_id;
        const vkOriginalId = launchParams.vk_original_vk_id;
        const vkOkUserId = launchParams.vk_ok_user_id;
        
        window.vkUserIdForLeaderboard = vkUserId || vkOriginalId;
        window.vkUserId = vkOriginalId || vkUserId || vkOkUserId;
        window.vkUserLang = launchParams.vk_language || launchParams.language || 'ru';
        
        console.log('[VK] ID для таблицы лидеров:', window.vkUserIdForLeaderboard);
        console.log('[VK] ID для Cloudflare:', window.vkUserId);
        
        try {
          const { changeLanguageFromVK } = require('./const');
          changeLanguageFromVK(window.vkUserLang);
        } catch(e) {
          console.warn('Не удалось применить язык:', e);
        }
        return getUserAccessToken();
      })
      .then(() => {
        if (!window.vkUserId) {
          const savedId = localStorage.getItem('vk_user_id');
          if (savedId) {
            window.vkUserId = savedId;
            console.log('[VK] ID восстановлен из localStorage:', savedId);
          }
        }
        window.vkUserToken = vkUserToken;
        window.vkInitialized = true;
        localStorage.setItem('vk_initialized', 'true');
        console.log('✅ Инициализация VK SDK завершена. ID:', window.vkUserId, 'Токен:', !!window.vkUserToken);
        ysdkInstance = { bridge: vkBridge, userId: window.vkUserId, token: window.vkUserToken, lang: window.vkUserLang };
        resolve(ysdkInstance);
      })
      .catch((err) => {
        console.error('Ошибка инициализации VK Bridge:', err);
        if (!window.vkUserId) {
          const savedId = localStorage.getItem('vk_user_id');
          if (savedId) {
            window.vkUserId = savedId;
            window.vkInitialized = true;
          }
        }
        ysdkInstance = { bridge: vkBridge, userId: window.vkUserId, token: null, lang: 'ru' };
        resolve(ysdkInstance);
      });
  });
};

// Определение платформы
var PLATFORM = null;
function getPlatform() {
  if (PLATFORM) return PLATFORM;
  var urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('vk_client') === 'ok') {
    PLATFORM = 'ok';
    console.log('🎮 Платформа (по vk_client):', PLATFORM);
    return PLATFORM;
  }
  var ua = navigator.userAgent;
  if (ua.indexOf('Odnoklassniki') !== -1 || ua.indexOf('OKApp') !== -1) {
    PLATFORM = 'ok';
    console.log('🎮 Платформа (по User-Agent):', PLATFORM);
    return PLATFORM;
  }
  var hostname = window.location.hostname;
  if (hostname.indexOf('ok.ru') !== -1 || hostname.indexOf('odnoklassniki') !== -1) {
    PLATFORM = 'ok';
    console.log('🎮 Платформа (по домену):', PLATFORM);
    return PLATFORM;
  }
  PLATFORM = 'vk';
  console.log('🎮 Платформа (по умолчанию):', PLATFORM);
  return PLATFORM;
}

// ===== ЗАГРУЗКА РЕКОРДА =====
export const loadYandexHighScore = (storeInstance) => {
  console.log('🔥 loadYandexHighScore ВЫЗВАН!');
  const platform = getPlatform();
  const userIdForVK = window.vkUserIdForLeaderboard || window.vkUserId;
  
  console.log('[load] ID пользователя:', userIdForVK);
  
  // Читаем локальный рекорд
  let localScore = 0;
  try {
    const savedData = localStorage.getItem('REACT_TETRIS');
    if (savedData) {
      const parsed = JSON.parse(atob(decodeURIComponent(savedData)));
      localScore = parsed.max || 0;
    }
  } catch(e) {
    try {
      localScore = parseInt(localStorage.getItem('tetris_high_score'), 10) || 0;
    } catch(e2) {}
  }
  console.log('📀 localStorage рекорд:', localScore);
  
  let cloudflareScore = 0;
  let vkStorageScore = 0;
  let leaderboardScore = 0;
  let tasksToWait = 0;
  
  const finalizeAndSync = function() {
    console.log('🔥 FINALIZE_AND_SYNC');
    console.log('  localScore:', localScore);
    console.log('  cloudflareScore:', cloudflareScore);
    console.log('  vkStorageScore:', vkStorageScore);
    console.log('  leaderboardScore:', leaderboardScore);
    
    const absoluteMax = Math.max(localScore, cloudflareScore, vkStorageScore, leaderboardScore);
    console.log('🏆 АБСОЛЮТНЫЙ МАКСИМУМ:', absoluteMax);
    
    // Принудительная синхронизация — только если текущий рекорд больше
    if (platform === 'vk' && typeof vkBridge !== 'undefined' && userIdForVK) {
      // Если VK Storage пуст, но есть рекорд — сохраняем!
      if (vkStorageScore === 0 && (cloudflareScore > 0 || localScore > 0)) {
        const maxScore = Math.max(cloudflareScore, localScore);
        console.log('⚠️ VK Storage = 0! Принудительно сохраняем:', maxScore);
        vkBridge.send('VKWebAppStorageSet', {
          key: CLOUD_STORAGE_KEY,
          value: String(maxScore)
        }).catch(err => console.error('❌ Ошибка принудительного сохранения:', err));
      }
      
      // Синхронизация из Cloudflare — только если больше
      if (cloudflareScore > vkStorageScore && cloudflareScore > 0) {
        console.log('🔄 VK Storage обновлён из Cloudflare:', cloudflareScore);
        vkBridge.send('VKWebAppStorageSet', {
          key: CLOUD_STORAGE_KEY,
          value: String(cloudflareScore)
        }).catch(err => console.error('❌ Ошибка VK Storage (Cloudflare):', err));
      }
      
      // Синхронизация из localStorage — только если больше
      if (localScore > vkStorageScore && localScore > 0) {
        console.log('🔄 VK Storage обновлён из localStorage:', localScore);
        vkBridge.send('VKWebAppStorageSet', {
          key: CLOUD_STORAGE_KEY,
          value: String(localScore)
        }).catch(err => console.error('❌ Ошибка VK Storage (local):', err));
      }
    }
    
    // Обновляем store
    let currentMax = 0;
    try {
      currentMax = storeInstance.getState().get('max') || 0;
    } catch(e) {}
    
    if (absoluteMax > currentMax) {
      storeInstance.dispatch(actions.max(absoluteMax));
      localStorage.setItem('tetris_high_score', String(absoluteMax));
      if (window.vkUserId) {
        localStorage.setItem('vk_user_id', window.vkUserId);
      }
      console.log('✅ Рекорд обновлён в store:', absoluteMax);
    }
    
    // Сохраняем в Cloudflare (как резерв) — только если больше
    if (window.vkUserId && absoluteMax > cloudflareScore) {
      saveCloudScore(window.vkUserId, absoluteMax)
        .then(() => console.log('☁️ Cloudflare сохранён:', absoluteMax))
        .catch(err => console.error('❌ Ошибка Cloudflare:', err));
    }
    
    // Таблица лидеров ВК — только если больше
    if (platform === 'vk' && vkInitialized && userIdForVK && vkUserToken && absoluteMax > leaderboardScore) {
      vkBridge.send('VKWebAppCallAPIMethod', {
        method: 'secure.addAppEvent',
        request_id: 'syncScore_' + Date.now(),
        params: {
          client_secret: 'Q5I9iCJXGWiwYDb8aaHr',
          user_id: userIdForVK,
          activity_id: 2,
          value: absoluteMax,
          v: '5.131',
          global: 1,
          access_token: ACCESS_TOKEN
        }
      })
      .then(() => console.log('✅ Таблица лидеров обновлена'))
      .catch(err => console.error('❌ Ошибка таблицы лидеров:', err));
    }
  };
  
  const checkAndFinalize = () => {
    tasksToWait--;
    if (tasksToWait === 0) {
      finalizeAndSync();
    }
  };
  
  // Загружаем из Cloudflare
  if (window.vkUserId) {
    tasksToWait++;
    loadCloudScore(window.vkUserId)
      .then(score => {
        cloudflareScore = score;
        console.log('☁️ Cloudflare рекорд:', cloudflareScore);
        checkAndFinalize();
      })
      .catch(() => {
        console.warn('⚠️ Ошибка Cloudflare');
        checkAndFinalize();
      });
  }
  
  // Загружаем из VK Storage
  if (platform === 'vk' && typeof vkBridge !== 'undefined') {
    tasksToWait++;
    console.log('💾 Загружаем из VK Storage с ключом:', CLOUD_STORAGE_KEY);
    
    vkBridge.send('VKWebAppStorageGet', { keys: [CLOUD_STORAGE_KEY] })
      .then(data => {
        console.log('💾 Полный ответ VK Storage:', JSON.stringify(data));
        
        let score = 0;
        if (data && data.keys) {
          // ✅ ИСПРАВЛЕНИЕ: Поддержка двух форматов ответа
          if (Array.isArray(data.keys)) {
            // Формат 1: keys — массив
            if (data.keys.length > 0 && data.keys[0].value !== undefined) {
              score = parseInt(data.keys[0].value, 10) || 0;
              console.log('💾 Рекорд найден (массив):', score);
            }
          } else if (typeof data.keys === 'object' && data.keys !== null) {
            // Формат 2: keys — объект (как на телефоне)
            if (data.keys.value !== undefined) {
              score = parseInt(data.keys.value, 10) || 0;
              console.log('💾 Рекорд найден (объект):', score);
            } else if (data.keys[CLOUD_STORAGE_KEY] !== undefined) {
              score = parseInt(data.keys[CLOUD_STORAGE_KEY], 10) || 0;
              console.log('💾 Рекорд найден (объект по ключу):', score);
            }
          } else if (data.response) {
            // Формат 3: ответ в data.response
            if (Array.isArray(data.response) && data.response.length > 0) {
              score = parseInt(data.response[0], 10) || 0;
              console.log('💾 Рекорд найден (response):', score);
            }
          }
        }
        
        vkStorageScore = score;
        console.log('💾 Итоговый VK Storage рекорд:', vkStorageScore);
        checkAndFinalize();
      })
      .catch(err => {
        console.error('❌ Ошибка загрузки VK Storage:', err);
        vkStorageScore = 0;
        checkAndFinalize();
      });
  }
  
  // Загружаем из таблицы лидеров
  if (platform === 'vk' && vkInitialized && userIdForVK && vkUserToken) {
    tasksToWait++;
    vkBridge.send('VKWebAppCallAPIMethod', {
      method: 'apps.getScore',
      request_id: 'checkScore_' + Date.now(),
      params: {
        user_id: userIdForVK,
        v: '5.131',
        access_token: vkUserToken
      }
    })
    .then(data => {
      leaderboardScore = parseInt(data.response) || 0;
      console.log('🏆 Таблица лидеров:', leaderboardScore);
      checkAndFinalize();
    })
    .catch(err => {
      console.warn('⚠️ Ошибка таблицы лидеров:', err);
      checkAndFinalize();
    });
  }
  
  if (tasksToWait === 0) {
    finalizeAndSync();
  }
};

// ===== СОХРАНЕНИЕ РЕКОРДА =====
export const saveYandexScore = (scoreValue) => {
  console.log('🔥 saveYandexScore ВЫЗВАН!');
  const platform = getPlatform();
  const effectiveUserId = window.vkUserIdForLeaderboard || window.vkUserId;
  console.log('📱 Платформа:', platform);
  
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
  localStorage.setItem('tetris_high_score', String(currentScore));
  store.dispatch(actions.max(currentScore));
  console.log(`📀 Рекорд сохранён в localStorage:`, currentScore);
  
  const bridge = typeof vkBridge !== 'undefined' ? vkBridge : window.vkBridge;
  
  // Сохраняем в VK Storage
  if (bridge && platform === 'vk') {
    // Сначала проверяем текущий рекорд в VK Storage
    bridge.send('VKWebAppStorageGet', { keys: [CLOUD_STORAGE_KEY] })
      .then(data => {
        let existingScore = 0;
        if (data && data.keys) {
          if (Array.isArray(data.keys) && data.keys.length > 0 && data.keys[0].value !== undefined) {
            existingScore = parseInt(data.keys[0].value, 10) || 0;
          } else if (typeof data.keys === 'object' && data.keys.value !== undefined) {
            existingScore = parseInt(data.keys.value, 10) || 0;
          }
        }
        console.log('💾 Текущий рекорд в VK Storage:', existingScore);
        
        // Сохраняем только если новый рекорд больше
        if (currentScore > existingScore) {
          bridge.send('VKWebAppStorageSet', {
            key: CLOUD_STORAGE_KEY,
            value: String(currentScore)
          })
          .then(() => console.log(`💾 VK Storage: рекорд ${currentScore} сохранён`))
          .catch(err => console.error('❌ Ошибка VK Storage:', err));
        } else {
          console.log(`💾 VK Storage: рекорд ${currentScore} НЕ сохранён (существующий ${existingScore} больше)`);
        }
      })
      .catch(err => {
        console.warn('⚠️ Ошибка проверки VK Storage, пробуем сохранить:', err);
        bridge.send('VKWebAppStorageSet', {
          key: CLOUD_STORAGE_KEY,
          value: String(currentScore)
        })
        .then(() => console.log(`💾 VK Storage: рекорд ${currentScore} сохранён (без проверки)`))
        .catch(err2 => console.error('❌ Ошибка VK Storage:', err2));
      });
  }
  
  // Сохраняем в Cloudflare (только если больше)
  if (window.vkUserId && currentScore > 0) {
    saveCloudScore(window.vkUserId, currentScore)
      .then(() => console.log(`☁️ Cloudflare: рекорд ${currentScore} сохранён`))
      .catch(err => console.error('❌ Ошибка Cloudflare:', err));
  }
  
  // Таблица лидеров ВК (только если больше)
  if (platform === 'vk' && bridge && vkInitialized && effectiveUserId && vkUserToken) {
    bridge.send('VKWebAppCallAPIMethod', {
      method: 'secure.addAppEvent',
      request_id: 'addScore_' + Date.now(),
      params: {
        client_secret: 'Q5I9iCJXGWiwYDb8aaHr',
        user_id: effectiveUserId,
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

// ===== ЛИДЕРБОРД =====
export const fetchYandexLeaderboard = () => {
  return new Promise((resolve) => {
    const platform = getPlatform();
    if (platform === 'ok') {
      console.log('[ОК] Предлагаем оценить приложение');
      let title = "Оцените игру!";
      let text = "Если вам нравится ТЕТРА, поставьте оценку в магазине приложений. Это поможет нам стать лучше!";
      if (typeof i18n !== 'undefined' && i18n.rateGame && i18n.rateGame[lan]) {
        title = i18n.rateGame[lan];
        text = i18n.rateGameText[lan];
      }
      alert(text);
      resolve({ status: 'success' });
      return;
    }
    if (!vkInitialized) {
      resolve({ status: 'offline' });
      return;
    }
    const currentMaxScore = store.getState().get('max') || 0;
    vkBridge.send('VKWebAppShowLeaderBoardBox', { user_result: currentMaxScore })
      .then(() => resolve({ status: 'success' }))
      .catch((error) => {
        console.error('Ошибка открытия лидерборда:', error);
        resolve({ status: 'error', error });
      });
  });
};
// ===== ЛОГГИРОВАНИЕ ПЛАТФОРМЫ =====
function logPlatform() {
    console.log('🎮 Платформа:', getPlatform());
}
// ===== РЕКЛАМА =====
export const showFullscreenAd = (onAdCloseCallback = null) => {
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

export const showBannerAd = () => {
  const platform = getPlatform();
  if (platform !== 'vk') {
    console.log('[Баннер] Платформа не VK, баннер не показываем');
    return;
  }
  if (!vkInitialized) {
    console.warn('[Баннер] VK не инициализирован');
    return;
  }
  vkBridge.send('VKWebAppShowBannerAd', {})
    .then(() => console.log('[Баннер] Показан в VK'))
    .catch(err => console.error('[Баннер] Ошибка:', err));
};

export const showVkInviteBox = () => {
  const platform = getPlatform();
  if (platform === 'ok') {
    alert('Пригласите друзей в игру!');
    return;
  }
  if (platform === 'vk' && typeof vkBridge !== 'undefined') {
    vkBridge.send('VKWebAppShowInviteBox')
      .then((data) => {
        if (data.success) console.log('[ВК] Приглашения отправлены');
      })
      .catch((err) => console.error('[ВК] Ошибка:', err));
  }
};

export const invitePlatformFriends = showVkInviteBox;
export const isVkInitialized = () => vkInitialized;

// ===== СИНХРОНИЗАЦИЯ ЧЕРЕЗ CLOUDFLARE WORKER =====
const WORKER_URL = 'https://tetris-score-sync.yukawaii1988.workers.dev';

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

// Алиасы
export const getPlatformScore = loadYandexHighScore;
export const sendPlatformScore = saveYandexScore;
export const showPlatformLeaderboard = fetchYandexLeaderboard;
export const showPlatformAd = showFullscreenAd;
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