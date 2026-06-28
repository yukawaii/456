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
    
    // Сохраняем ВСЕ возможные ID
    const vkUserId = launchParams.vk_user_id; // Оригинальный VK ID
    const vkOriginalId = launchParams.vk_original_vk_id; // Оригинальный ID (может быть VK или OK)
    const vkOkUserId = launchParams.vk_ok_user_id; // ID в OK
    
    // Для таблицы лидеров используем vk_user_id (оригинальный VK ID)
    window.vkUserIdForLeaderboard = vkUserId || vkOriginalId;
    
    // Для синхронизации через Cloudflare используем универсальный ID
    window.vkUserId = vkOriginalId || vkUserId || vkOkUserId;
    
    // ❗ КРИТИЧНО: Сохраняем ВСЕ ID для диагностики
    window.vkAllIds = {
        vk_user_id: vkUserId,
        vk_original_vk_id: vkOriginalId,
        vk_ok_user_id: vkOkUserId,
        vk_original_ok_id: launchParams.vk_original_ok_id,
        raw: launchParams
    };
    localStorage.setItem('vk_all_ids', JSON.stringify(window.vkAllIds));
    
    console.log('[VK] Все ID:', window.vkAllIds);
    console.log('[VK] ID для таблицы лидеров:', window.vkUserIdForLeaderboard);
    console.log('[VK] ID для Cloudflare:', window.vkUserId);
        
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



// ===== ЗАГРУЗКА РЕКОРДА из облаков (единая для ВК и ОК) =====
export const loadYandexHighScore = (storeInstance) => {
    // Функция для сохранения логов в localStorage
    const saveLog = (message, data) => {
        const logs = JSON.parse(localStorage.getItem('vk_debug_logs') || '[]');
        logs.push({
            time: new Date().toISOString(),
            message: message,
            data: data || null
        });
        if (logs.length > 50) logs.shift();
        localStorage.setItem('vk_debug_logs', JSON.stringify(logs));
        console.log(message, data || '');
    };
    
    saveLog('🔥 loadYandexHighScore ВЫЗВАН!');
    saveLog('📱 Платформа:', getPlatform());
    
    const platform = getPlatform();
    
    // === ШАГ 1: Получаем ID пользователя ===
    let userIdForVK = window.vkUserIdForLeaderboard || window.vkUserId;
    
    saveLog('🔍 ID пользователя:', userIdForVK);
    saveLog('  window.vkUserIdForLeaderboard:', window.vkUserIdForLeaderboard);
    saveLog('  window.vkUserId:', window.vkUserId);
    
    if (!userIdForVK) {
        const urlParams = new URLSearchParams(window.location.search);
        userIdForVK = urlParams.get('vk_user_id') || 
                       urlParams.get('vk_original_vk_id') || 
                       urlParams.get('vk_ok_user_id') ||
                       localStorage.getItem('vk_user_id');
        
        if (userIdForVK) {
            saveLog('✅ ID восстановлен:', userIdForVK);
            window.vkUserId = userIdForVK;
            if (!window.vkUserIdForLeaderboard) window.vkUserIdForLeaderboard = userIdForVK;
        } else {
            saveLog('⚠️ НЕ НАЙДЕН ID!', window.location.search);
        }
    }
    
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
    saveLog('📀 localStorage рекорд:', localScore);
    
    // === ШАГ 3: Переменные для хранения рекордов ===
    let cloudflareScore = 0;
    let vkStorageScore = 0;
    let leaderboardScore = 0;
    let tasksToWait = 0;
    
    // === ШАГ 4: Функция финальной синхронизации ===
    const finalizeAndSync = function() {
        saveLog('🔥 FINALIZE_AND_SYNC');
        saveLog('  localScore:', localScore);
        saveLog('  cloudflareScore:', cloudflareScore);
        saveLog('  vkStorageScore:', vkStorageScore);
        saveLog('  leaderboardScore:', leaderboardScore);
        
        const absoluteMax = Math.max(localScore, cloudflareScore, vkStorageScore, leaderboardScore);
        saveLog('🏆 АБСОЛЮТНЫЙ МАКСИМУМ:', absoluteMax);
        
        // === Принудительная синхронизация ===
        if (platform === 'vk' && typeof vkBridge !== 'undefined' && userIdForVK) {
            // Если VK Storage пуст, но есть рекорд - сохраняем!
            if (vkStorageScore === 0 && (cloudflareScore > 0 || localScore > 0)) {
                const maxScore = Math.max(cloudflareScore, localScore);
                saveLog('⚠️ VK Storage = 0! Принудительно сохраняем:', maxScore);
                
                vkBridge.send('VKWebAppStorageSet', {
                    key: CLOUD_STORAGE_KEY,
                    value: String(maxScore)
                })
                .then(() => saveLog('✅ VK Storage принудительно сохранён'))
                .catch(err => saveLog('❌ Ошибка принудительного сохранения:', err));
            }
            
            // Обычная синхронизация
            if (vkStorageScore < cloudflareScore && cloudflareScore > 0) {
                vkBridge.send('VKWebAppStorageSet', {
                    key: CLOUD_STORAGE_KEY,
                    value: String(cloudflareScore)
                })
                .then(() => saveLog('✅ VK Storage обновлён из Cloudflare'))
                .catch(err => saveLog('❌ Ошибка VK Storage (Cloudflare):', err));
            }
            
            if (vkStorageScore < localScore && localScore > 0) {
                vkBridge.send('VKWebAppStorageSet', {
                    key: CLOUD_STORAGE_KEY,
                    value: String(localScore)
                })
                .then(() => saveLog('✅ VK Storage обновлён из localStorage'))
                .catch(err => saveLog('❌ Ошибка VK Storage (local):', err));
            }
        }
        
        // === Обновляем store ===
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
            saveLog('✅ Рекорд обновлён в store:', absoluteMax);
        }
        
        // === Сохраняем в Cloudflare (как резерв) ===
        if (window.vkUserId && absoluteMax > cloudflareScore) {
            saveCloudScore(window.vkUserId, absoluteMax)
                .then(() => saveLog('☁️ Cloudflare сохранён:', absoluteMax))
                .catch(err => saveLog('❌ Ошибка Cloudflare:', err));
        }
        
        // === Таблица лидеров ВК ===
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
            .then(() => saveLog('✅ Таблица лидеров обновлена'))
            .catch(err => saveLog('❌ Ошибка таблицы лидеров:', err));
        }
    };
    
    // === ШАГ 5: Функция проверки готовности ===
    const checkAndFinalize = () => {
        tasksToWait--;
        saveLog(`⏳ Осталось задач: ${tasksToWait}`);
        if (tasksToWait === 0) {
            saveLog('✅ Все задачи загружены');
            finalizeAndSync();
        }
    };
    
    // === ШАГ 6: Загружаем из Cloudflare (как резерв) ===
    if (window.vkUserId) {
        tasksToWait++;
        saveLog('☁️ Загружаем из Cloudflare...');
        loadCloudScore(window.vkUserId)
            .then(score => {
                cloudflareScore = score;
                saveLog('☁️ Cloudflare рекорд:', cloudflareScore);
                checkAndFinalize();
            })
            .catch(() => {
                saveLog('⚠️ Ошибка Cloudflare');
                checkAndFinalize();
            });
    }
    
    // === ШАГ 7: Загружаем из VK Storage (ОСНОВНОЙ ИСТОЧНИК) ===
    saveLog('🔍 ШАГ 7: Проверка VK Storage');
    saveLog('  platform === "vk"?', platform === 'vk');
    saveLog('  typeof vkBridge:', typeof vkBridge);
    saveLog('  userIdForVK:', userIdForVK);
    
    if (platform === 'vk' && typeof vkBridge !== 'undefined') {
        tasksToWait++;
        saveLog('💾 Загружаем из VK Storage с ключом:', CLOUD_STORAGE_KEY);
        
        // Пробуем загрузить данные
        vkBridge.send('VKWebAppStorageGet', { keys: [CLOUD_STORAGE_KEY] })
            .then(data => {
                saveLog('💾 Полный ответ VK Storage:', JSON.stringify(data));
                
                // ✅ ИСПРАВЛЕНИЕ: Правильно парсим ответ
                let score = 0;
                if (data && data.keys && Array.isArray(data.keys) && data.keys.length > 0) {
                    // Способ 1: data.keys[0].value
                    if (data.keys[0].value !== undefined) {
                        score = parseInt(data.keys[0].value, 10) || 0;
                        saveLog('💾 Рекорд найден (способ 1):', score);
                    }
                    // Способ 2: data.keys[0] может быть строкой
                    else if (typeof data.keys[0] === 'string') {
                        score = parseInt(data.keys[0], 10) || 0;
                        saveLog('💾 Рекорд найден (способ 2):', score);
                    }
                    // Способ 3: data.keys[0] может быть объектом с полем value
                    else if (data.keys[0].value !== undefined) {
                        score = parseInt(data.keys[0].value, 10) || 0;
                        saveLog('💾 Рекорд найден (способ 3):', score);
                    }
                } else if (data && data.response) {
                    // Способ 4: ответ может быть в data.response
                    if (Array.isArray(data.response) && data.response.length > 0) {
                        score = parseInt(data.response[0], 10) || 0;
                        saveLog('💾 Рекорд найден (способ 4):', score);
                    }
                }
                
                vkStorageScore = score;
                saveLog('💾 Итоговый VK Storage рекорд:', vkStorageScore);
                checkAndFinalize();
            })
            .catch(err => {
                saveLog('❌ Ошибка загрузки VK Storage:', err);
                saveLog('  error_type:', err.error_type);
                saveLog('  error_data:', err.error_data);
                vkStorageScore = 0;
                checkAndFinalize();
            });
    } else {
        saveLog('⚠️ VK Storage пропущен');
    }
    
    // === ШАГ 8: Загружаем из таблицы лидеров ===
    if (platform === 'vk' && vkInitialized && userIdForVK && vkUserToken) {
        tasksToWait++;
        saveLog('🏆 Загружаем из таблицы лидеров...');
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
            saveLog('🏆 Таблица лидеров:', leaderboardScore);
            checkAndFinalize();
        })
        .catch(err => {
            saveLog('❌ Ошибка таблицы лидеров:', err);
            checkAndFinalize();
        });
    }
    
    // === ШАГ 9: Финализируем ===
    saveLog(`📊 Итого задач: ${tasksToWait}`);
    if (tasksToWait === 0) {
        saveLog('⚡ Нет задач, сразу финализируем');
        finalizeAndSync();
    }
    
    // === СОХРАНЯЕМ ЛОГИ В WINDOW для доступа из консоли ===
    window.getVKLogs = function() {
        const logs = localStorage.getItem('vk_debug_logs');
        if (logs) {
            const parsed = JSON.parse(logs);
            console.log('=== VK DEBUG LOGS ===');
            parsed.forEach(log => {
                console.log(`[${log.time}] ${log.message}`, log.data || '');
            });
            return parsed;
        }
        return [];
    };
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

  // ✅ Для ВК — сохраняем в VK Storage (с запасным способом)
if (bridge) {
    // Пробуем стандартный способ
    bridge.send('VKWebAppStorageSet', {
        key: CLOUD_STORAGE_KEY,
        value: String(currentScore)
    })
    .then(() => console.log(`💾 VK Storage: рекорд ${currentScore} сохранён`))
    .catch(err => {
        console.warn('⚠️ Стандартный способ сохранения не сработал:', err);
        // Используем альтернативный способ
        saveToVKStorageAlternative(CLOUD_STORAGE_KEY, currentScore)
            .then(success => {
                if (success) {
                    console.log(`💾 VK Storage (альтернативный): рекорд ${currentScore} сохранён`);
                } else {
                    console.warn('⚠️ Все способы сохранения в VK Storage не сработали');
                }
            });
    });
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

// ===== КНОПКА ДЛЯ ПРОСМОТРА ЛОГОВ НА ТЕЛЕФОНЕ =====
// Добавляем кнопку в игру для просмотра логов на телефоне
export const showDebugLogs = () => {
    const logs = localStorage.getItem('vk_debug_logs');
    if (!logs) {
        alert('❌ Логов нет');
        return;
    }
    
    try {
        const parsed = JSON.parse(logs);
        let message = '=== ЛОГИ VK ===\n\n';
        parsed.forEach(log => {
            message += `[${log.time.split('T')[1].slice(0,8)}] ${log.message}\n`;
            if (log.data && typeof log.data === 'object') {
                message += `  → ${JSON.stringify(log.data).slice(0,100)}\n`;
            } else if (log.data) {
                message += `  → ${log.data}\n`;
            }
        });
        message += `\n📊 Всего записей: ${parsed.length}`;
        alert(message);
    } catch(e) {
        alert('❌ Ошибка чтения логов: ' + e.message);
    }
};

// Добавляем кнопку в DOM (если её нет)
setTimeout(() => {
    if (typeof document !== 'undefined') {
        const existingBtn = document.getElementById('vk_debug_btn');
        if (!existingBtn) {
            const btn = document.createElement('button');
            btn.id = 'vk_debug_btn';
            btn.textContent = '🐛 Логи VK';
            btn.style.cssText = `
                position: fixed;
                bottom: 10px;
                right: 10px;
                z-index: 999999;
                background: #4a76a8;
                color: white;
                border: none;
                border-radius: 50px;
                padding: 10px 20px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                opacity: 0.8;
            `;
            btn.onclick = () => {
                const logs = localStorage.getItem('vk_debug_logs');
                if (!logs) {
                    alert('❌ Логов нет. Сыграйте в игру, чтобы они появились.');
                    return;
                }
                try {
                    const parsed = JSON.parse(logs);
                    let message = '📱 ЛОГИ С ТЕЛЕФОНА\n';
                    message += `📊 Всего записей: ${parsed.length}\n`;
                    message += `🕒 Время: ${new Date().toLocaleString()}\n`;
                    message += '═'.repeat(30) + '\n\n';
                    
                    parsed.slice(-20).forEach(log => {
                        const time = log.time.split('T')[1].slice(0,8);
                        message += `[${time}] ${log.message}\n`;
                        if (log.data && typeof log.data === 'object') {
                            message += `  → ${JSON.stringify(log.data).slice(0,100)}\n`;
                        } else if (log.data) {
                            message += `  → ${String(log.data).slice(0,100)}\n`;
                        }
                    });
                    
                    if (parsed.length > 20) {
                        message += `\n... и ещё ${parsed.length - 20} записей`;
                    }
                    
                    // Показываем в alert
                    alert(message);
                    
                    // Дополнительно сохраняем в window для консоли
                    window._lastLogs = parsed;
                } catch(e) {
                    alert('❌ Ошибка: ' + e.message);
                }
            };
            document.body.appendChild(btn);
            console.log('🐛 Кнопка логов добавлена!');
        }
    }
}, 3000);

// ===== АЛЬТЕРНАТИВНОЕ СОХРАНЕНИЕ В VK STORAGE (для телефона) =====
export const saveToVKStorageAlternative = (key, value) => {
    console.log('💾 Альтернативное сохранение в VK Storage:', key, value);
    
    return new Promise((resolve) => {
        // Способ 1: Через VKWebAppStorageSet (стандартный)
        if (typeof vkBridge !== 'undefined') {
            vkBridge.send('VKWebAppStorageSet', {
                key: key,
                value: String(value)
            })
            .then(() => {
                console.log('✅ VK Storage сохранён (способ 1)');
                resolve(true);
            })
            .catch(err => {
                console.warn('⚠️ Способ 1 не сработал:', err);
                // Способ 2: Через VKWebAppCallAPIMethod с storage.set
                try {
                    vkBridge.send('VKWebAppCallAPIMethod', {
                        method: 'storage.set',
                        request_id: 'storage_set_' + Date.now(),
                        params: {
                            key: key,
                            value: String(value),
                            v: '5.131'
                        }
                    })
                    .then(() => {
                        console.log('✅ VK Storage сохранён (способ 2)');
                        resolve(true);
                    })
                    .catch(err2 => {
                        console.warn('⚠️ Способ 2 не сработал:', err2);
                        // Способ 3: Через прямой fetch
                        try {
                            const userId = window.vkUserIdForLeaderboard || window.vkUserId;
                            fetch(`https://api.vk.com/method/storage.set?key=${key}&value=${String(value)}&user_id=${userId}&v=5.131&access_token=${ACCESS_TOKEN}`, {
                                method: 'POST'
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.response === 1) {
                                    console.log('✅ VK Storage сохранён (способ 3)');
                                    resolve(true);
                                } else {
                                    console.warn('⚠️ Способ 3 вернул ошибку:', data);
                                    resolve(false);
                                }
                            })
                            .catch(err3 => {
                                console.warn('⚠️ Способ 3 не сработал:', err3);
                                resolve(false);
                            });
                        } catch(e3) {
                            console.warn('⚠️ Ошибка способа 3:', e3);
                            resolve(false);
                        }
                    });
                } catch(e2) {
                    console.warn('⚠️ Ошибка способа 2:', e2);
                    resolve(false);
                }
            });
        } else {
            resolve(false);
        }
    });
};

// ===== АЛЬТЕРНАТИВНАЯ ЗАГРУЗКА ИЗ VK STORAGE (для телефона) =====
export const loadFromVKStorageAlternative = (key) => {
    console.log('📥 Альтернативная загрузка из VK Storage:', key);
    
    return new Promise((resolve) => {
        // Способ 1: Через VKWebAppStorageGet (стандартный)
        if (typeof vkBridge !== 'undefined') {
            vkBridge.send('VKWebAppStorageGet', { keys: [key] })
            .then(data => {
                if (data && data.keys && data.keys[0] && data.keys[0].value) {
                    const score = parseInt(data.keys[0].value, 10) || 0;
                    console.log('✅ VK Storage загружен (способ 1):', score);
                    resolve(score);
                } else {
                    console.warn('⚠️ Способ 1 вернул пустой ответ');
                    // Способ 2: Через VKWebAppCallAPIMethod с storage.get
                    try {
                        vkBridge.send('VKWebAppCallAPIMethod', {
                            method: 'storage.get',
                            request_id: 'storage_get_' + Date.now(),
                            params: {
                                key: key,
                                v: '5.131'
                            }
                        })
                        .then(data2 => {
                            if (data2 && data2.response && data2.response[0] && data2.response[0].value) {
                                const score = parseInt(data2.response[0].value, 10) || 0;
                                console.log('✅ VK Storage загружен (способ 2):', score);
                                resolve(score);
                            } else {
                                console.warn('⚠️ Способ 2 вернул пустой ответ');
                                resolve(0);
                            }
                        })
                        .catch(err2 => {
                            console.warn('⚠️ Ошибка способа 2:', err2);
                            resolve(0);
                        });
                    } catch(e2) {
                        console.warn('⚠️ Ошибка способа 2:', e2);
                        resolve(0);
                    }
                }
            })
            .catch(err => {
                console.warn('⚠️ Ошибка способа 1:', err);
                resolve(0);
            });
        } else {
            resolve(0);
        }
    });
};
// ===== ДИАГНОСТИКА ID НА ТЕЛЕФОНЕ =====
export const diagnoseVKIds = () => {
    console.log('🔍 ДИАГНОСТИКА ID:');
    console.log('  window.vkUserId:', window.vkUserId);
    console.log('  window.vkUserIdForLeaderboard:', window.vkUserIdForLeaderboard);
    console.log('  localStorage vk_user_id:', localStorage.getItem('vk_user_id'));
    
    // Проверяем launchParams
    if (typeof vkBridge !== 'undefined') {
        vkBridge.send('VKWebAppGetLaunchParams')
            .then(params => {
                console.log('📋 Все launchParams:', params);
                console.log('  vk_user_id:', params.vk_user_id);
                console.log('  vk_original_vk_id:', params.vk_original_vk_id);
                console.log('  vk_ok_user_id:', params.vk_ok_user_id);
                console.log('  vk_original_ok_id:', params.vk_original_ok_id);
                
                // Сохраняем все ID в localStorage для анализа
                localStorage.setItem('vk_all_ids', JSON.stringify({
                    vk_user_id: params.vk_user_id,
                    vk_original_vk_id: params.vk_original_vk_id,
                    vk_ok_user_id: params.vk_ok_user_id,
                    vk_original_ok_id: params.vk_original_ok_id,
                    timestamp: new Date().toISOString()
                }));
                
                alert('✅ ID сохранены в localStorage!\n' +
                      'vk_user_id: ' + params.vk_user_id + '\n' +
                      'vk_original_vk_id: ' + params.vk_original_vk_id + '\n' +
                      'vk_ok_user_id: ' + params.vk_ok_user_id);
            })
            .catch(err => {
                console.error('❌ Ошибка получения launchParams:', err);
                alert('❌ Ошибка: ' + err);
            });
    } else {
        alert('❌ VK Bridge не найден');
    }
};

// Добавляем функцию в window для доступа из консоли
window.showVKLogs = showDebugLogs;
window.getVKLogs = function() {
    const logs = localStorage.getItem('vk_debug_logs');
    if (logs) {
        const parsed = JSON.parse(logs);
        console.log('=== VK DEBUG LOGS ===');
        parsed.forEach(log => {
            console.log(`[${log.time}] ${log.message}`, log.data || '');
        });
        return parsed;
    }
    console.log('❌ Логов нет');
    return [];
};

// ===== АВТОМАТИЧЕСКИЙ ПОКАЗ ЛОГОВ НА ЭКРАНЕ (ДЛЯ ТЕЛЕФОНА) =====
export const showLogsOnScreen = () => {
    const logs = localStorage.getItem('vk_debug_logs');
    if (!logs) {
        console.log('❌ Логов нет');
        return;
    }
    
    try {
        const parsed = JSON.parse(logs);
        // Создаём оверлей с логами
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            color: #0f0;
            font-family: monospace;
            font-size: 12px;
            padding: 20px;
            overflow-y: auto;
            z-index: 999999;
            white-space: pre-wrap;
        `;
        
        let text = '📱 ЛОГИ С ТЕЛЕФОНА\n';
        text += `📊 Всего записей: ${parsed.length}\n`;
        text += `🕒 Время: ${new Date().toLocaleString()}\n`;
        text += '═'.repeat(30) + '\n\n';
        
        // Показываем последние 30 записей
        const lastLogs = parsed.slice(-30);
        lastLogs.forEach(log => {
            const time = log.time.split('T')[1].slice(0,8);
            text += `[${time}] ${log.message}\n`;
            if (log.data && typeof log.data === 'object') {
                text += `  → ${JSON.stringify(log.data).slice(0,150)}\n`;
            } else if (log.data) {
                text += `  → ${String(log.data).slice(0,150)}\n`;
            }
        });
        
        if (parsed.length > 30) {
            text += `\n... и ещё ${parsed.length - 30} записей`;
        }
        
        overlay.textContent = text;
        
        // Добавляем кнопку закрытия
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕ Закрыть';
        closeBtn.style.cssText = `
            position: sticky;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #ff4444;
            color: white;
            border: none;
            border-radius: 10px;
            padding: 15px 30px;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            margin-top: 20px;
            z-index: 1000000;
        `;
        closeBtn.onclick = () => document.body.removeChild(overlay);
        
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);
    } catch(e) {
        alert('❌ Ошибка: ' + e.message);
    }
};

// Автоматически показываем логи через 10 секунд после загрузки (для телефона)
setTimeout(() => {
    if (typeof document !== 'undefined' && navigator.userAgent.includes('Android')) {
        console.log('📱 Телефон обнаружен, показываем логи...');
        // Показываем логи только если есть кнопка "Показать логи" или по двойному тапу
        const showLogsBtn = document.createElement('button');
        showLogsBtn.textContent = '📊 Показать логи';
        showLogsBtn.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 10px;
            z-index: 999999;
            background: #ff6b35;
            color: white;
            border: none;
            border-radius: 10px;
            padding: 12px 24px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        `;
        showLogsBtn.onclick = showLogsOnScreen;
        document.body.appendChild(showLogsBtn);
        console.log('📊 Кнопка "Показать логи" добавлена!');
    }
}, 5000);
