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

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (исправленная) =====
// Получение токена пользователя (только для ВК)
function getUserAccessToken() {
  const platform = getPlatform();

  // Для Одноклассников токен не нужен
  if (platform === 'ok') {
    console.log('[OK] Токен не требуется для Одноклассников');
    vkUserToken = null;
    window.vkUserToken = null;
    return Promise.resolve(null);
  }

  // Для ВК получаем токен
  return vkBridge.send('VKWebAppGetAuthToken', {
    app_id: APP_ID,
    scope: ''
  })
  .then(data => {
    console.log('[VK] Токен игрока получен');
    vkUserToken = data.access_token;
    window.vkUserToken = vkUserToken;
    // --- ИСПРАВЛЕНИЕ: Явно сохраняем user_id из данных токена, если он там есть ---
    // Иногда launchParams приходит позже, а токен уже содержит ID
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

// ===== ИНИЦИАЛИЗАЦИЯ (исправленная) =====
export const initYandexSdk = () => {
  console.log('🔥 initYandexSdk ВЫЗВАН!');
  // --- ИСПРАВЛЕНИЕ: Возвращаем промис, который точно зарезолвится ---
  return new Promise((resolve) => {
    if (typeof vkBridge === 'undefined') {
      console.warn('VK Bridge не обнаружен');
      resolve(null);
      return;
    }

    console.log('[init] Bridge найден, инициализация начинается...');
    window.vkBridge = vkBridge;

    // --- ИСПРАВЛЕНИЕ: Цепочка промисов теперь более предсказуема ---
    vkBridge.send('VKWebAppInit')
      .then(() => {
        console.log('VK Bridge успешно инициализирован');
        vkInitialized = true;
        return vkBridge.send('VKWebAppGetLaunchParams');
      })
      .then((launchParams) => {
        console.log('[VK] LaunchParams получены:', launchParams);
        
        // Сохраняем все возможные ID
        const vkOriginalId = launchParams.vk_original_vk_id || launchParams.vk_user_id || launchParams.vk_ok_user_id;
        const vkUserIdRaw = launchParams.vk_user_id;

        // Для синхронизации через Cloudflare используем универсальный ID
        window.vkUserId = vkOriginalId;
        // Для таблицы лидеров ВК сохраняем оригинальный VK ID
        window.vkUserIdForLeaderboard = vkUserIdRaw || vkOriginalId;

        // --- ИСПРАВЛЕНИЕ: Сохраняем ID в localStorage как резерв ---
        if (window.vkUserId) {
          localStorage.setItem('vk_user_id', window.vkUserId);
        }

        // Язык
        window.vkUserLang = launchParams.vk_language || launchParams.language || 'ru';
        
        console.log('[VK] Единый ID для синхронизации:', window.vkUserId);
        console.log('[VK] ID для таблицы лидеров:', window.vkUserIdForLeaderboard);
        console.log('[VK] Язык:', window.vkUserLang);
        
        // Применяем язык
        try {
          const { changeLanguageFromVK } = require('./const');
          changeLanguageFromVK(window.vkUserLang);
        } catch(e) {
          console.warn('Не удалось применить язык:', e);
        }
        
        // --- ИСПРАВЛЕНИЕ: Возвращаем результат получения токена ---
        return getUserAccessToken();
      })
      .then(() => {
        // --- ИСПРАВЛЕНИЕ: Дополнительная проверка ID перед финальным резолвом ---
        // Если ID все еще не установлен, пытаемся восстановить из localStorage
        if (!window.vkUserId) {
          const savedId = localStorage.getItem('vk_user_id');
          if (savedId) {
            window.vkUserId = savedId;
            console.log('[VK] ID восстановлен из localStorage при инициализации:', savedId);
          }
        }

        // Сохраняем все в window для доступа из других мест
        window.vkUserToken = vkUserToken;
        window.vkInitialized = true;
        localStorage.setItem('vk_initialized', 'true');

        // Для отладки
        window.initYandexSdk = initYandexSdk;
        window.loadYandexHighScore = loadYandexHighScore;
        window.saveYandexScore = saveYandexScore;

        console.log('✅ Инициализация VK SDK завершена. ID:', window.vkUserId, 'Токен:', !!window.vkUserToken);
        
        ysdkInstance = { bridge: vkBridge, userId: window.vkUserId, token: window.vkUserToken, lang: window.vkUserLang };
        resolve(ysdkInstance);
      })
      .catch((err) => {
        console.error('Ошибка инициализации VK Bridge:', err);
        // --- ИСПРАВЛЕНИЕ: Даже при ошибке пытаемся восстановить ID из localStorage и резолвим ---
        if (!window.vkUserId) {
          const savedId = localStorage.getItem('vk_user_id');
          if (savedId) {
            window.vkUserId = savedId;
            console.log('[VK] ID восстановлен из localStorage после ошибки:', savedId);
            window.vkInitialized = true; // Помечаем как инициализированный, чтобы функции работали
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



// ===== ЗАГРУЗКА РЕКОРДА из облаков(единая для ВК и ОК) =====
// ===== ЗАГРУЗКА РЕКОРДА из облаков (единая для ВК и ОК) =====
export const loadYandexHighScore = (storeInstance) => {
    console.log('🔥 loadYandexHighScore ВЫЗВАН!');
    const platform = getPlatform();
    
    // === ШАГ 1: Получаем ID пользователя ===
    let userIdForVK = window.vkUserIdForLeaderboard || window.vkUserId;
    
    if (!userIdForVK) {
        // Пытаемся восстановить ID из URL
        const urlParams = new URLSearchParams(window.location.search);
        userIdForVK = urlParams.get('vk_user_id') || 
                       urlParams.get('vk_original_vk_id') || 
                       urlParams.get('vk_ok_user_id') ||
                       localStorage.getItem('vk_user_id');
        
        if (userIdForVK) {
            console.log('[loadYandexHighScore] ID восстановлен из URL/localStorage:', userIdForVK);
            window.vkUserId = userIdForVK;
            if (!window.vkUserIdForLeaderboard) window.vkUserIdForLeaderboard = userIdForVK;
        } else {
            console.warn('[loadYandexHighScore] ⚠️ НЕ НАЙДЕН ID пользователя!');
        }
    }
    
    console.log('[loadYandexHighScore] ID для VK операций:', userIdForVK);
    
    // === ШАГ 2: Читаем локальный рекорд ===
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
    
    // === ШАГ 3: Переменные для хранения рекордов из разных источников ===
    let cloudflareScore = 0;
    let vkStorageScore = 0;
    let leaderboardScore = 0;
    let tasksToWait = 0;
    
    // === ШАГ 4: Функция финальной синхронизации ===
    const finalizeAndSync = function() {
        // Находим абсолютный максимум
        const absoluteMax = Math.max(localScore, cloudflareScore, vkStorageScore, leaderboardScore);
        console.log('🏆 АБСОЛЮТНЫЙ МАКСИМУМ:', absoluteMax);
        console.log('📊 Сравнение:', { localScore, cloudflareScore, vkStorageScore, leaderboardScore });
        
        // === Принудительная синхронизация для телефона ===
        if (platform === 'vk' && typeof vkBridge !== 'undefined' && userIdForVK) {
            // Если VK Storage меньше Cloudflare — обновляем
            if (vkStorageScore < cloudflareScore && cloudflareScore > 0) {
                vkBridge.send('VKWebAppStorageSet', {
                    key: CLOUD_STORAGE_KEY,
                    value: String(cloudflareScore)
                }).catch(err => console.warn('❌ Ошибка VK Storage (Cloudflare):', err));
                console.log('🔄 VK Storage обновлён из Cloudflare:', cloudflareScore);
            }
            
            // Если VK Storage меньше локального рекорда — обновляем
            if (vkStorageScore < localScore && localScore > 0) {
                vkBridge.send('VKWebAppStorageSet', {
                    key: CLOUD_STORAGE_KEY,
                    value: String(localScore)
                }).catch(err => console.warn('❌ Ошибка VK Storage (local):', err));
                console.log('🔄 VK Storage обновлён из localStorage:', localScore);
            }
        }
        
        // === Обновляем store и localStorage ===
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
            console.log('✅ Рекорд обновлён в store и localStorage:', absoluteMax);
        }
        
        // === Отправка рекорда во все облачные хранилища ===
        if (absoluteMax > 0) {
            // 1. Cloudflare (для ОК и резерва)
            if (window.vkUserId && absoluteMax > cloudflareScore) {
                saveCloudScore(window.vkUserId, absoluteMax)
                    .then(() => console.log('☁️ Cloudflare сохранён:', absoluteMax))
                    .catch(err => console.warn('❌ Ошибка Cloudflare:', err));
            }
            
            // 2. VK Storage (только для VK)
            if (platform === 'vk' && typeof vkBridge !== 'undefined' && userIdForVK && absoluteMax > vkStorageScore) {
                vkBridge.send('VKWebAppStorageSet', {
                    key: CLOUD_STORAGE_KEY,
                    value: String(absoluteMax)
                }).catch(err => console.warn('❌ Ошибка VK Storage (sync):', err));
                console.log('💾 VK Storage синхронизирован:', absoluteMax);
            }
            
            // 3. Таблица лидеров ВК (только для VK)
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
                }).catch(err => console.warn('❌ Ошибка таблицы лидеров:', err));
                console.log('🏆 Таблица лидеров обновлена:', absoluteMax);
            }
        }
    };
    
    // === ШАГ 5: Функция проверки готовности ===
    const checkAndFinalize = () => {
        tasksToWait--;
        console.log(`⏳ Осталось задач: ${tasksToWait}`);
        if (tasksToWait === 0) {
            finalizeAndSync();
        }
    };
    
    // === ШАГ 6: Загружаем из Cloudflare ===
    if (window.vkUserId) {
        tasksToWait++;
        loadCloudScore(window.vkUserId)
            .then(score => {
                cloudflareScore = score;
                console.log('☁️ Cloudflare рекорд:', cloudflareScore);
                checkAndFinalize();
            })
            .catch(() => {
                console.warn('⚠️ Ошибка загрузки Cloudflare');
                checkAndFinalize();
            });
    } else {
        console.warn('⚠️ Cloudflare пропущен (нет ID)');
    }
    
    // === ШАГ 7: Загружаем из VK Storage (только для VK) ===
    if (platform === 'vk' && typeof vkBridge !== 'undefined' && userIdForVK) {
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
                console.warn('⚠️ Ошибка VK Storage:', err);
                checkAndFinalize();
            });
    } else {
        console.log('⚠️ VK Storage пропущен (не VK или нет ID)');
        // Если не VK, то считаем задачу выполненной
    }
    
    // === ШАГ 8: Загружаем из таблицы лидеров ВК (только для VK) ===
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
            console.log('🏆 Таблица лидеров ВК рекорд:', leaderboardScore);
            checkAndFinalize();
        })
        .catch(err => {
            console.warn('⚠️ Ошибка таблицы лидеров:', err);
            checkAndFinalize();
        });
    } else {
        console.log('⚠️ Таблица лидеров пропущена');
    }
    
    // === ШАГ 9: Если нечего ждать — сразу финализируем ===
    console.log(`📊 Итого задач для ожидания: ${tasksToWait}`);
    if (tasksToWait === 0) {
        console.log('⚡ Нет задач, сразу финализируем');
        finalizeAndSync();
    }
};



// ===== СОХРАНЕНИЕ РЕКОРДА в облака (единая для ВК и ОК) =====
export const saveYandexScore = (scoreValue) => {
  console.log('🔥 saveYandexScore ВЫЗВАН!');
  const platform = getPlatform();
    // --- ИСПРАВЛЕНИЕ: Определяем ID для сохранения ---
  const effectiveUserId = window.vkUserIdForLeaderboard || window.vkUserId;
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
      // user_id не нужен, т.к. метод вызывается на клиенте
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
  if (platform === 'vk' && bridge && vkInitialized && effectiveUserId && vkUserToken) {
    bridge.send('VKWebAppCallAPIMethod', {
      method: 'secure.addAppEvent',
      request_id: 'addScore_' + Date.now(),
      params: {
        client_secret: 'Q5I9iCJXGWiwYDb8aaHr',
        user_id: effectiveUserId, // ИСПРАВЛЕНИЕ
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