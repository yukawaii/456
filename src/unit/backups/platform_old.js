// src/unit/platform.js (CommonJS для Webpack 1)
var PLATFORM = null;

function getPlatform() {
  if (PLATFORM) return PLATFORM;  
  // 1. Самый надёжный способ: параметр запуска
  var urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('vk_client') === 'ok') {
    PLATFORM = 'ok';
    console.log('🎮 Платформа (по vk_client):', PLATFORM);
    return PLATFORM;
  }  
  // 2. User-Agent
  var ua = navigator.userAgent;
  if (ua.indexOf('Odnoklassniki') !== -1 || ua.indexOf('OKApp') !== -1) {
    PLATFORM = 'ok';
    console.log('🎮 Платформа (по User-Agent):', PLATFORM);
    return PLATFORM;
  }  
  // 3. Домен
  var hostname = window.location.hostname;
  if (hostname.indexOf('ok.ru') !== -1 || hostname.indexOf('odnoklassniki') !== -1) {
    PLATFORM = 'ok';
    console.log('🎮 Платформа (по домену):', PLATFORM);
    return PLATFORM;
  }  
  // 4. Всё остальное — VK
  PLATFORM = 'vk';
  console.log('🎮 Платформа (по умолчанию):', PLATFORM);
  return PLATFORM;
}

function initPlatform() {
  var platform = getPlatform();
  return new Promise(function(resolve) {
    if (platform === 'ok') {
      console.log('[ОК] Инициализация FAPI...');      
      // Проверяем, что FAPI доступен
      if (typeof FAPI !== 'undefined') {
        try {          // Получаем параметры запуска
          var rParams = {};
          if (FAPI.Util && typeof FAPI.Util.getRequestParameters === 'function') {
            rParams = FAPI.Util.getRequestParameters();
          }     // Инициализируем FAPI с колбэками
          FAPI.init(
            rParams.api_server,
            rParams.apiconnection,
            function() {
              console.log('[ОК] FAPI инициализирован успешно');
              resolve({ success: true, platform: 'ok', userId: null });
            },
            function(error) {
              console.error('[ОК] Ошибка инициализации FAPI:', error);
              // Всё равно разрешаем — игра будет работать без FAPI
              resolve({ success: true, platform: 'ok', userId: null });
            }
          );
        } catch(e) {          console.error('[ОК] Критическая ошибка при инициализации FAPI:', e);
          resolve({ success: true, platform: 'ok', userId: null });
        }
      } else {        console.warn('[ОК] FAPI не обнаружен, работаем без него');
        resolve({ success: true, platform: 'ok', userId: null });
      }
      return;
    } 
        // Инициализация для VK (остаётся без изменений)
    if (platform === 'vk' && typeof vkBridge !== 'undefined') {
      vkBridge.send('VKWebAppInit')
        .then(function() {
          return vkBridge.send('VKWebAppGetUserInfo');
        })
        .then(function(userInfo) {          console.log('[ВК] Пользователь:', userInfo.first_name);
          resolve({ success: true, platform: 'vk', userId: userInfo.id });
        })
        .catch(function(err) {          console.error('[ВК] Ошибка:', err);
          resolve({ success: false });
        });
    } else {      resolve({ success: false });
    }
  });
}

function getPlatformScore() {
  var platform = getPlatform();
  return new Promise(function(resolve) {
    if (platform === 'vk' && typeof vkBridge !== 'undefined') {
      vkBridge.send('VKWebAppStorageGet', { keys: ['tetris_high_score'] })
        .then(function(data) {
          var score = (data.keys && data.keys[0] && data.keys[0].value) ? parseInt(data.keys[0].value, 10) : 0;
          resolve(score);
        })
        .catch(function() { resolve(0); });
    }
    else if (platform === 'ok') {
      var localScore = localStorage.getItem('tetris_high_score') || '0';
      resolve(parseInt(localScore, 10));
    }
    else {
      resolve(0);
    }
  });
}

function sendPlatformScore(score) {
  var platform = getPlatform();
  if (platform === 'vk' && typeof vkBridge !== 'undefined') {
    getPlatformScore().then(function(currentScore) {
      if (score > currentScore) {
        vkBridge.send('VKWebAppStorageSet', { key: 'tetris_high_score', value: String(score) })
          .then(function() { localStorage.setItem('tetris_high_score', score); })
          .catch(function(err) { console.error('[ВК] Ошибка:', err); });
      }
    });
  }
  else if (platform === 'ok') {
    localStorage.setItem('tetris_high_score', score);
    console.log('[ОК] Рекорд сохранён локально:', score);
  }
}

function showPlatformLeaderboard(currentScore) {
  var platform = getPlatform();  
  if (platform === 'ok') {
    console.log('[ОК] Открываем окно оценки приложения через редирект');    
    // редирект на страницу приложения
    var appId = '512005107616'; // ID  приложения в OK
    var ratingUrl = 'https://ok.ru/app/' + appId;    
    // Пытаемся открыть в новой вкладке (не ломает игру)
    window.open(ratingUrl, '_blank');
    return;
  }  
  if (platform === 'vk' && typeof vkBridge !== 'undefined') {
    console.log('[ВК] Открываем таблицу лидеров');
    // Небольшая задержка для гарантии инициализации.
    setTimeout(function() {
      vkBridge.send('VKWebAppShowLeaderBoardBox', { user_result: currentScore })
        .then(function(data) {
          console.log('✅ Лидерборд успешно вызван', data);
        })
        .catch(function(err) {
          console.error('[ВК] Ошибка открытия лидерборда:', err);
        });
    }, 100);
    return;
  }
}


function showPlatformAd(onAdCloseCallback) {
  var platform = getPlatform();
  var callback = function() { if (onAdCloseCallback) onAdCloseCallback(); };
  
  if (platform === 'vk' && typeof vkBridge !== 'undefined') {
    vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' })
      .then(function(data) { if (data.result) callback(); else callback(); })
      .catch(function() { callback(); });
  }
  else if (platform === 'ok' && typeof FAPI !== 'undefined' && FAPI.ui && FAPI.ui.showAd) {
    FAPI.ui.showAd({ onClose: callback, onError: callback });
  }
  else {
    callback();
  }
}

function invitePlatformFriends() {
  var platform = getPlatform();
  if (platform === 'vk' && typeof vkBridge !== 'undefined') {
    vkBridge.send('VKWebAppShowInviteBox')
      .catch(function(err) { console.error('[ВК] Ошибка:', err); });
  }
  else if (platform === 'ok' && typeof FAPI !== 'undefined' && FAPI.ui && FAPI.ui.showInvite) {
    FAPI.ui.showInvite();
  }
}

function logPlatform() {
  console.log('🎮 Платформа:', getPlatform());
}

// ЭКСПОРТ ДЛЯ COMMONJS (WEBPACK 1)
module.exports = {
  getPlatform: getPlatform,
  initPlatform: initPlatform,
  getPlatformScore: getPlatformScore,
  sendPlatformScore: sendPlatformScore,
  showPlatformLeaderboard: showPlatformLeaderboard,
  showPlatformAd: showPlatformAd,
  invitePlatformFriends: invitePlatformFriends,
  logPlatform: logPlatform
};