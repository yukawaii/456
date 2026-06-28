// yandexSdk.js — для VK Games (Webpack 1 совместимый)
import actions from '../actions';
import store from '../store';
import { i18n, lan } from './const';

var CLOUD_STORAGE_KEY = 'vk_cloud_score2';
// ===== КОНФИГУРАЦИЯ =====
var APP_ID = 54620141;
var ACCESS_TOKEN = '2238166b2238166b2238166b2021797986222382238166b4826d211f79d2796efcd8994';

var vkInitialized = false;
var vkUserId = null;
var vkUserToken = null;
var vkUserLang = null;
var ysdkInstance = null;

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
export var setYsdk = function(ysdk) { ysdkInstance = ysdk; console.log('SDK готов'); };
export var getYsdk = function() { return ysdkInstance; };

// Получение токена пользователя
function getUserAccessToken() {
  var platform = getPlatform();
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
  .then(function(data) {
    console.log('[VK] Токен игрока получен');
    vkUserToken = data.access_token;
    window.vkUserToken = vkUserToken;
    if (data.user_id && !window.vkUserId) {
      window.vkUserId = data.user_id;
      console.log('[VK] ID пользователя получен из токена:', window.vkUserId);
    }
    return vkUserToken;
  })
  .catch(function(err) {
    console.error('[VK] Ошибка получения токена:', err);
    vkUserToken = null;
    window.vkUserToken = null;
    return null;
  });
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
export var initYandexSdk = function() {
  console.log('🔥 initYandexSdk ВЫЗВАН!');
  return new Promise(function(resolve) {
    if (typeof vkBridge === 'undefined') {
      console.warn('VK Bridge не обнаружен');
      resolve(null);
      return;
    }
    console.log('[init] Bridge найден, инициализация начинается...');
    window.vkBridge = vkBridge;

    vkBridge.send('VKWebAppInit')
      .then(function() {
        console.log('VK Bridge успешно инициализирован');
        vkInitialized = true;
        return vkBridge.send('VKWebAppGetLaunchParams');
      })
      .then(function(launchParams) {
        console.log('[VK] LaunchParams получены:', launchParams);
        var vkUserId = launchParams.vk_user_id;
        var vkOriginalId = launchParams.vk_original_vk_id;
        var vkOkUserId = launchParams.vk_ok_user_id;
        
        window.vkUserIdForLeaderboard = vkUserId || vkOriginalId;
        window.vkUserId = vkOriginalId || vkUserId || vkOkUserId;
        window.vkUserLang = launchParams.vk_language || launchParams.language || 'ru';
        
        console.log('[VK] ID для таблицы лидеров:', window.vkUserIdForLeaderboard);
        console.log('[VK] ID для Cloudflare:', window.vkUserId);
        
        try {
          var constModule = require('./const');
          constModule.changeLanguageFromVK(window.vkUserLang);
        } catch(e) {
          console.warn('Не удалось применить язык:', e);
        }
        return getUserAccessToken();
      })
      .then(function() {
        if (!window.vkUserId) {
          var savedId = localStorage.getItem('vk_user_id');
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
      .catch(function(err) {
        console.error('Ошибка инициализации VK Bridge:', err);
        if (!window.vkUserId) {
          var savedId = localStorage.getItem('vk_user_id');
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

// ===== ЛОГГИРОВАНИЕ ПЛАТФОРМЫ =====
function logPlatform() {
    console.log('🎮 Платформа:', getPlatform());
}


// ===== ЗАГРУЗКА РЕКОРДА =====
export var loadYandexHighScore = function(storeInstance) {
  console.log('🔥 loadYandexHighScore ВЫЗВАН!');
  var platform = getPlatform();
  var userIdForVK = window.vkUserIdForLeaderboard || window.vkUserId;
  
  console.log('[load] ID пользователя:', userIdForVK);
  
  // Читаем локальный рекорд
  var localScore = 0;
  try {
    var savedData = localStorage.getItem('REACT_TETRIS');
    if (savedData) {
      var parsed = JSON.parse(atob(decodeURIComponent(savedData)));
      localScore = parsed.max || 0;
    }
  } catch(e) {
    try {
      localScore = parseInt(localStorage.getItem('tetris_high_score'), 10) || 0;
    } catch(e2) {}
  }
  console.log('loadYandexHighScore 📀 localStorage рекорд:', localScore);
  
  var cloudflareScore = 0;
  var vkStorageScore = 0;
  var leaderboardScore = 0;
  var tasksToWait = 0;
  
  // ===== ИСПРАВЛЕННЫЙ finalizeAndSync =====
  var finalizeAndSync = function() {
    console.log('🔥 FINALIZE_AND_SYNC');
    console.log(' FINALIZE_AND_SYNC localScore:', localScore);
    console.log('FINALIZE_AND_SYNC  cloudflareScore:', cloudflareScore);
    console.log(' FINALIZE_AND_SYNC vkStorageScore:', vkStorageScore);
    console.log(' FINALIZE_AND_SYNC leaderboardScore:', leaderboardScore);
    
    var absoluteMax = Math.max(localScore, cloudflareScore, vkStorageScore, leaderboardScore);
    console.log('FINALIZE_AND_SYNC🏆 АБСОЛЮТНЫЙ МАКСИМУМ:', absoluteMax);
    
    // ✅ Проверяем текущий рекорд в store
    // Обновляем store
    var currentMax = 0;
    try {
      currentMax = storeInstance.getState().get('max') || 0;
    } catch(e) {}
    
    if (absoluteMax > currentMax) {
      storeInstance.dispatch(actions.max(absoluteMax));
      localStorage.setItem('tetris_high_score', String(absoluteMax));
      localStorage.setItem('tetris_max_sync', String(absoluteMax)); // ← ДОБАВИТЬ
      if (window.vkUserId) {
        localStorage.setItem('vk_user_id', window.vkUserId);
      }
      console.log('FINALIZE_AND_SYNC✅ Рекорд обновлён в store:', absoluteMax);
    } else if (absoluteMax > 0 && currentMax !== absoluteMax) {
      // 
      storeInstance.dispatch(actions.max(absoluteMax));
      localStorage.setItem('tetris_high_score', String(absoluteMax));
      localStorage.setItem('tetris_max_sync', String(absoluteMax));
      console.log('FINALIZE_AND_SYNC🔄 Принудительное обновление store до:', absoluteMax);
    }
    
    // Принудительная синхронизация — только если текущий рекорд больше
    if (platform === 'vk' && typeof vkBridge !== 'undefined' && userIdForVK) {
      // Если VK Storage пуст, но есть рекорд — сохраняем!
      if (vkStorageScore === 0 && (cloudflareScore > 0 || localScore > 0)) {
        var maxScore = Math.max(cloudflareScore, localScore);
        console.log('loadYandexHighScore⚠️ VK Storage = 0! Принудительно сохраняем:', maxScore);
        vkBridge.send('VKWebAppStorageSet', {
          key: CLOUD_STORAGE_KEY,
          value: String(maxScore)
        }).catch(function(err) { console.error('loadYandexHighScore❌ Ошибка принудительного сохранения:', err); });
      }
      
      // Синхронизация из Cloudflare — только если больше
      if (cloudflareScore > vkStorageScore && cloudflareScore > 0) {
        console.log('loadYandexHighScore🔄 VK Storage обновлён из Cloudflare:', cloudflareScore);
        vkBridge.send('VKWebAppStorageSet', {
          key: CLOUD_STORAGE_KEY,
          value: String(cloudflareScore)
        }).catch(function(err) { console.error('loadYandexHighScore❌ Ошибка VK Storage (Cloudflare):', err); });
      }
      
      // Синхронизация из localStorage — только если больше
      if (localScore > vkStorageScore && localScore > 0) {
        console.log('loadYandexHighScore🔄 VK Storage обновлён из localStorage:', localScore);
        vkBridge.send('VKWebAppStorageSet', {
          key: CLOUD_STORAGE_KEY,
          value: String(localScore)
        }).catch(function(err) { console.error('loadYandexHighScore❌ Ошибка VK Storage (local):', err); });
      }
    }
    
    // Сохраняем в Cloudflare (как резерв) — только если больше
    if (window.vkUserId && absoluteMax > cloudflareScore) {
      saveCloudScore(window.vkUserId, absoluteMax)
        .then(function() { console.log('loadYandexHighScore☁️ Cloudflare сохранён:', absoluteMax); })
        .catch(function(err) { console.error('loadYandexHighScore❌ Ошибка Cloudflare:', err); });
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
      .then(function() { console.log('loadYandexHighScore✅ Таблица лидеров обновлена'); })
      .catch(function(err) { console.error('loadYandexHighScore❌ Ошибка таблицы лидеров:', err); });
    }
  };
  
  var checkAndFinalize = function() {
    tasksToWait--;
    if (tasksToWait === 0) {
      finalizeAndSync();
    }
  };
  
  // Загружаем из Cloudflare
  if (window.vkUserId) {
    tasksToWait++;
    loadCloudScore(window.vkUserId)
      .then(function(score) {
        cloudflareScore = score;
        console.log('loadYandexHighScore☁️ Cloudflare рекорд:', cloudflareScore);
        checkAndFinalize();
      })
      .catch(function() {
        console.warn('loadYandexHighScore⚠️ Ошибка Cloudflare');
        checkAndFinalize();
      });
  }
  
  // Загружаем из VK Storage
  if (platform === 'vk' && typeof vkBridge !== 'undefined') {
    tasksToWait++;
    console.log('loadYandexHighScore💾 Загружаем из VK Storage с ключом:', CLOUD_STORAGE_KEY);
    
    vkBridge.send('VKWebAppStorageGet', { keys: [CLOUD_STORAGE_KEY] })
      .then(function(data) {
        console.log('loadYandexHighScore💾 Полный ответ VK Storage:', JSON.stringify(data));
        
        var score = 0;
        if (data && data.keys) {
          if (Array.isArray(data.keys)) {
            if (data.keys.length > 0 && data.keys[0].value !== undefined) {
              score = parseInt(data.keys[0].value, 10) || 0;
              console.log('loadYandexHighScore💾 Рекорд найден (массив):', score);
            }
          } else if (typeof data.keys === 'object' && data.keys !== null) {
            if (data.keys.value !== undefined) {
              score = parseInt(data.keys.value, 10) || 0;
              console.log('loadYandexHighScore💾 Рекорд найден (объект):', score);
            } else if (data.keys[CLOUD_STORAGE_KEY] !== undefined) {
              score = parseInt(data.keys[CLOUD_STORAGE_KEY], 10) || 0;
              console.log('loadYandexHighScore💾 Рекорд найден (объект по ключу):', score);
            }
          } else if (data.response) {
            if (Array.isArray(data.response) && data.response.length > 0) {
              score = parseInt(data.response[0], 10) || 0;
              console.log('loadYandexHighScore💾 Рекорд найден (response):', score);
            }
          }
        }
        
vkStorageScore = score;
console.log('loadYandexHighScore💾 Итоговый VK Storage рекорд:', vkStorageScore);

// ✅ ПРИНУДИТЕЛЬНО ОБНОВЛЯЕМ РЕКОРД НА ЭКРАНЕ
var currentMax = 0;
try {
  currentMax = storeInstance.getState().get('max') || 0;
} catch(e) {}

if (vkStorageScore > currentMax) {
  storeInstance.dispatch(actions.max(vkStorageScore));
  localStorage.setItem('tetris_high_score', String(vkStorageScore));
  localStorage.setItem('tetris_max_sync', String(vkStorageScore));
  console.log('loadYandexHighScore✅ РЕКОРД ОБНОВЛЁН НА ЭКРАНЕ:', vkStorageScore);
} else if (vkStorageScore > 0 && currentMax === 0) {
  // Если store пуст, но есть рекорд в VK
  storeInstance.dispatch(actions.max(vkStorageScore));
  localStorage.setItem('tetris_high_score', String(vkStorageScore));
  localStorage.setItem('tetris_max_sync', String(vkStorageScore));
  console.log('loadYandexHighScore✅ РЕКОРД ЗАГРУЖЕН ИЗ VK STORAGE:', vkStorageScore);
}

checkAndFinalize();
      })
      .catch(function(err) {
        console.error('loadYandexHighScore❌ Ошибка загрузки VK Storage:', err);
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
    .then(function(data) {
      leaderboardScore = parseInt(data.response) || 0;
      console.log('loadYandexHighScore🏆 Таблица лидеров:', leaderboardScore);
      checkAndFinalize();
    })
    .catch(function(err) {
      console.warn('loadYandexHighScore⚠️ Ошибка таблицы лидеров:', err);
      checkAndFinalize();
    });
  }
  
  if (tasksToWait === 0) {
    finalizeAndSync();
  }
};


// ===== СОХРАНЕНИЕ РЕКОРДА =====
export var saveYandexScore = function(scoreValue) {
  console.log('🔥 saveYandexScore ВЫЗВАН!');
  var platform = getPlatform();
  var effectiveUserId = window.vkUserIdForLeaderboard || window.vkUserId;
  console.log('📱 Платформа:', platform);
  console.log('📊 Переданный счёт:', scoreValue);
  
  var currentScore = parseInt(scoreValue, 10) || 0;
  if (currentScore <= 0) return;
  
  var bridge = typeof vkBridge !== 'undefined' ? vkBridge : window.vkBridge;
  
  // ===== ДЛЯ VK =====
  if (platform === 'vk' && bridge && effectiveUserId) {
    console.log('🔍 Проверяем рекорд в VK Storage...');
    
    fetch('https://api.vk.com/method/storage.get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'key=' + encodeURIComponent(CLOUD_STORAGE_KEY) + 
            '&user_id=' + effectiveUserId + 
            '&v=5.131' + 
            '&access_token=' + ACCESS_TOKEN
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
      var existingScore = 0;
      if (data.response && data.response[0] && data.response[0].value) {
        existingScore = parseInt(data.response[0].value, 10) || 0;
      }
      console.log('💾 Текущий рекорд в VK Storage:', existingScore);
      console.log('📊 Новый рекорд:', currentScore);
      
      // ЕСЛИ РЕКОРД ПОБИТ
      if (currentScore > existingScore) {
        saveRecordToAllStorages(currentScore, platform, bridge, effectiveUserId);
      } else {
        console.log('💾 Рекорд ' + currentScore + ' НЕ ПОБИТ (существующий ' + existingScore + ' больше)');
        // Обновляем локальный рекорд из VK Storage
        var localMax = 0;
        try {
          localMax = store.getState().get('max') || 0;
        } catch(e) {}
        if (existingScore > localMax) {
          console.log('🔄 Обновляем локальный рекорд из VK Storage:', existingScore);
          store.dispatch(actions.max(existingScore));
          localStorage.setItem('tetris_high_score', String(existingScore));
          localStorage.setItem('tetris_max_sync', String(existingScore));
        }
      }
    })
    .catch(function(err) {
      console.warn('⚠️ Ошибка проверки VK Storage:', err);
      // Если не удалось проверить — сохраняем локально
      localStorage.setItem('tetris_high_score', String(currentScore));
      localStorage.setItem('tetris_max_sync', String(currentScore));
      store.dispatch(actions.max(currentScore));
    });
  }
  
  // ===== ДЛЯ ОДНОКЛАССНИКОВ =====
  else if (platform === 'ok' && window.vkUserId) {
    console.log('🔍 Проверяем рекорд в Cloudflare (ОК)...');
    
    loadCloudScore(window.vkUserId)
      .then(function(existingScore) {
        console.log('☁️ Текущий рекорд в Cloudflare:', existingScore);
        console.log('📊 Новый рекорд:', currentScore);
        
        // ЕСЛИ РЕКОРД ПОБИТ
        if (currentScore > existingScore) {
          console.log('🚀 РЕКОРД ПОБИТ! Сохраняем в Cloudflare...');
          
          // Сохраняем локально
          localStorage.setItem('tetris_high_score', String(currentScore));
          localStorage.setItem('tetris_max_sync', String(currentScore));
          store.dispatch(actions.max(currentScore));
          console.log('📀 Локально сохранён:', currentScore);
          
          // Сохраняем в Cloudflare
          saveCloudScore(window.vkUserId, currentScore)
            .then(function() { console.log('☁️ Cloudflare сохранён:', currentScore); })
            .catch(function(err) { console.error('❌ Ошибка Cloudflare:', err); });
          
          console.log('✅ Рекорд ' + currentScore + ' сохранён в Cloudflare!');
        } else {
          console.log('💾 Рекорд ' + currentScore + ' НЕ ПОБИТ (существующий ' + existingScore + ' больше)');
          // Обновляем локальный рекорд из Cloudflare
          var localMax = 0;
          try {
            localMax = store.getState().get('max') || 0;
          } catch(e) {}
          if (existingScore > localMax) {
            console.log('🔄 Обновляем локальный рекорд из Cloudflare:', existingScore);
            store.dispatch(actions.max(existingScore));
            localStorage.setItem('tetris_high_score', String(existingScore));
            localStorage.setItem('tetris_max_sync', String(existingScore));
          }
        }
      })
      .catch(function(err) {
        console.warn('⚠️ Ошибка проверки Cloudflare:', err);
        // Если не удалось проверить — сохраняем локально
        localStorage.setItem('tetris_high_score', String(currentScore));
        localStorage.setItem('tetris_max_sync', String(currentScore));
        store.dispatch(actions.max(currentScore));
      });
  }
  
  // ===== ДЛЯ ДРУГИХ ПЛАТФОРМ (или если нет интернета) =====
  else {
    console.log('📀 Сохраняем только локально (не VK, не ОК):', currentScore);
    localStorage.setItem('tetris_high_score', String(currentScore));
    localStorage.setItem('tetris_max_sync', String(currentScore));
    store.dispatch(actions.max(currentScore));
  }
};

// ===== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ VK =====
function saveRecordToAllStorages(currentScore, platform, bridge, effectiveUserId) {
  console.log('🚀 РЕКОРД ПОБИТ! Сохраняем везде...');
  
  // 1. Локально
  localStorage.setItem('tetris_high_score', String(currentScore));
  localStorage.setItem('tetris_max_sync', String(currentScore));
  store.dispatch(actions.max(currentScore));
  console.log('📀 Локально сохранён:', currentScore);
  
  // 2. VK Storage
  fetch('https://api.vk.com/method/storage.set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'key=' + encodeURIComponent(CLOUD_STORAGE_KEY) + 
          '&value=' + encodeURIComponent(String(currentScore)) + 
          '&user_id=' + effectiveUserId + 
          '&v=5.131' + 
          '&access_token=' + ACCESS_TOKEN
  })
  .then(function(resp) { return resp.json(); })
  .then(function(result) {
    if (result.response === 1) {
      console.log('✅ VK Storage обновлён:', currentScore);
    }
  })
  .catch(function(err) { console.warn('⚠️ Ошибка VK Storage:', err); });
  
  // 3. Cloudflare
  if (window.vkUserId) {
    saveCloudScore(window.vkUserId, currentScore)
      .then(function() { console.log('☁️ Cloudflare сохранён:', currentScore); })
      .catch(function(err) { console.error('❌ Ошибка Cloudflare:', err); });
  }
  
  // 4. Таблица лидеров ВК
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
    .then(function() { console.log('🏆 Таблица лидеров ВК: рекорд ' + currentScore + ' отправлен!'); })
    .catch(function(err) { console.error('❌ Ошибка таблицы лидеров:', err); });
  }
  
  console.log('✅ Рекорд ' + currentScore + ' сохранён везде!');
}

// ===== ЛИДЕРБОРД =====
export var fetchYandexLeaderboard = function() {
  return new Promise(function(resolve) {
    var platform = getPlatform();
    if (platform === 'ok') {
      console.log('[ОК] Предлагаем оценить приложение fetchYandexLeaderboard');
      var title = "Оцените игру!";
      var text = "Если вам нравится ТЕТРА, поставьте оценку в магазине приложений. Это поможет нам стать лучше!";
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
    var currentMaxScore = store.getState().get('max') || 0;
    vkBridge.send('VKWebAppShowLeaderBoardBox', { user_result: currentMaxScore })
      .then(function() { resolve({ status: 'success' }); })
      .catch(function(error) {
        console.error('fetchYandexLeaderboard Ошибка открытия лидерборда:', error);
        resolve({ status: 'error', error: error });
      });
  });
};

// ===== РЕКЛАМА =====
export var showFullscreenAd = function(onAdCloseCallback) {
  if (typeof onAdCloseCallback === 'undefined') onAdCloseCallback = null;
  if (!vkInitialized) {
    if (onAdCloseCallback) onAdCloseCallback();
    return;
  }
  vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' })
    .then(function(data) {
      if (data.result && onAdCloseCallback) onAdCloseCallback();
    })
    .catch(function(error) {
      console.error('Ошибка показа рекламы:', error);
      if (onAdCloseCallback) onAdCloseCallback();
    });
};

export var showBannerAd = function() {
  var platform = getPlatform();
  if (platform !== 'vk') {
    console.log('[Баннер] Платформа не VK, баннер не показываем');
    return;
  }
  if (!vkInitialized) {
    console.warn('[Баннер] VK не инициализирован');
    return;
  }
  vkBridge.send('VKWebAppShowBannerAd', {})
    .then(function() { console.log('[Баннер] Показан в VK'); })
    .catch(function(err) { console.error('[Баннер] Ошибка:', err); });
};

export var showVkInviteBox = function() {
  var platform = getPlatform();
  if (platform === 'ok') {
    alert('Пригласите друзей в игру!');
    return;
  }
  if (platform === 'vk' && typeof vkBridge !== 'undefined') {
    vkBridge.send('VKWebAppShowInviteBox')
      .then(function(data) {
        if (data.success) console.log('[ВК] Приглашения отправлены');
      })
      .catch(function(err) { console.error('[ВК] Ошибка:', err); });
  }
};

export var invitePlatformFriends = showVkInviteBox;
export var isVkInitialized = function() { return vkInitialized; };

// ===== СИНХРОНИЗАЦИЯ ЧЕРЕЗ CLOUDFLARE WORKER =====
var WORKER_URL = 'https://tetris-score-sync.yukawaii1988.workers.dev';

export var loadCloudScore = function(userId) {
  return new Promise(function(resolve) {
    fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, action: 'get' })
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
      resolve(data.score || 0);
    })
    .catch(function(err) {
      console.error('loadCloudScore [Cloudflare] Ошибка загрузки:', err);
      resolve(0);
    });
  });
};

export var saveCloudScore = function(userId, score) {
  return new Promise(function(resolve) {
    fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, score: score, action: 'set' })
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
      if (data.success) {
        console.log('saveCloudScore ☁️ Cloudflare: рекорд ' + score + ' сохранён (было ' + data.old + ')');
      } else {
        console.log('saveCloudScore ☁️ Cloudflare: рекорд не побит (' + data.current + ')');
      }
      resolve(data.success);
    })
    .catch(function(err) {
      console.error('saveCloudScore [Cloudflare] Ошибка сохранения:', err);
      resolve(false);
    });
  });
};

// Алиасы
export var getPlatformScore = loadYandexHighScore;
export var sendPlatformScore = saveYandexScore;
export var showPlatformLeaderboard = fetchYandexLeaderboard;
export var showPlatformAd = showFullscreenAd;

// ===== ЭКСПОРТ ДЛЯ COMMONJS =====
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