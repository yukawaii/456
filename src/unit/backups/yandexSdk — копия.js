// yandexSdk.js — для VK Games с токенами
import actions from '../actions';  import store from '../store'; const VK_CONFIG = {  app_id: 54620141,    client_secret: "Q5I9iCJXGWiwYDb8aaHr",   
  access_token: "2238166b2238166b2238166b2021797986222382238166b4826d211f79d2796efcd8994"  };let vkInitialized = false; let vkUserId = null;let ysdkInstance = null;
// ===== ФУНКЦИИ ДЛЯ СОВМЕСТИМОСТИ (сохраняем названия) =====
export const setYsdk = (ysdk) => { ysdkInstance = ysdk; console.log('VK Bridge готов');}; export const getYsdk = () => ysdkInstance;

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

// Инициализация SDK (сохраняем название initYandexSdk)
export const initYandexSdk = () => {  return new Promise((resolve) => {  if (typeof vkBridge === 'undefined') { console.warn('VK Bridge не обнаружен');  resolve(null);
      return;    }
    vkBridge.send('VKWebAppInit') .then(() => {  console.log('VK Bridge успешно инициализирован');  vkInitialized = true; return vkBridge.send('VKWebAppGetUserInfo');
      })   .then((userInfo) => {   vkUserId = userInfo.id;  console.log('Пользователь авторизован:', userInfo.first_name); ysdkInstance = { bridge: vkBridge, userId: vkUserId };
        resolve(ysdkInstance); }) .catch((err) => { console.error('Ошибка инициализации VK Bridge:', err); resolve(null); });});};

// Сохранение рекорда (правильная версия)
export const saveYandexScore = (scoreValue) => {
  const vkBridge = window.vkBridge;
  if (!vkBridge) return;  
  const currentScore = parseInt(scoreValue, 10) || 0;
  if (currentScore <= 0) return;  
  // Используем уже полученный vkUserId
  if (!vkUserId) {    console.warn('[saveYandexScore] vkUserId не получен');
    return;
  }  // Локальная защита
  try {    const state = store.getState();
    const maxRecordInGame = state.get('max') || 0;
    if (currentScore < maxRecordInGame) {
      console.log(`[VK Рекорд] Текущий счёт (${currentScore}) меньше рекорда (${maxRecordInGame}). Отмена.`);
      return;
    }
  } catch (e) {    console.warn("Не удалось сверить очки с Redux:", e);
  }    // Сохраняем локально
  localStorage.setItem('tetris_high_score', currentScore);
    // Сохраняем в VK API с привязкой к пользователю
  vkBridge.send('VKWebAppCallAPIMethod', {    method: 'secure.addAppEvent',    request_id: 'addScore_' + Date.now(),
    params: {      client_secret: VK_CONFIG.client_secret,      user_id: vkUserId,  // ← используем vkUserId
      activity_id: 2,      value: currentScore,      v: '5.131',
      global: 1,
      access_token: VK_CONFIG.access_token    }
  })
  .then(() => {    console.log(`✅ Рекорд ${currentScore} сохранён в VK!`);    store.dispatch(actions.max(currentScore));
  })  .catch(err => console.error('❌ Ошибка сохранения рекорда:', err));
};


// Загрузка рекорда себе в игру
export const loadYandexHighScore = (store) => {  // Сначала из localStorage
  try {    const localScore = localStorage.getItem('tetris_high_score');
    if (localScore && parseInt(localScore, 10) > 0) {      store.dispatch(actions.max(parseInt(localScore, 10)));
      console.log('📀 Быстрая загрузка из localStorage:', localScore);
    }
  } catch(e) {}    // Используем уже полученный vkUserId
  if (!vkUserId) {    console.warn('[loadYandexHighScore] vkUserId не получен');    return;
  }  
  // Загружаем из VK API с привязкой к пользователю
  vkBridge.send('VKWebAppCallAPIMethod', {    method: 'apps.getScore',
    request_id: 'loadScore_' + Date.now(),
    params: {
      user_id: vkUserId,  // ← используем vkUserId
      v: '5.131',
      access_token: VK_CONFIG.access_token    }
  })
  .then((data) => {    let cloudScore = parseInt(data.response) || 0;
    if (cloudScore > 0) {      store.dispatch(actions.max(cloudScore));      localStorage.setItem('tetris_high_score', cloudScore);
      console.log('☁️ Загружен рекорд из VK API:', cloudScore);    }
  })  .catch(err => console.error('Ошибка загрузки рекорда из VK API:', err));
};


export const fetchYandexLeaderboard = () => {  return new Promise((resolve) => { if (!vkInitialized) {resolve({ status: 'offline' }); return; }
  vkBridge.send('VKWebAppShowLeaderBoardBox', {}) .then(() => { resolve({ status: 'success' }); }) .catch((error) => {console.error('Ошибка открытия лидерборда:', error); resolve({ status: 'error', error }); });});};
// Показ рекламы (сохраняем название showFullscreenAd)
export const showFullscreenAd = (onAdCloseCallback = null) => { if (!vkInitialized) { if (onAdCloseCallback) onAdCloseCallback(); return; }
  vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' })    .then((data) => {
      if (data.result && onAdCloseCallback) onAdCloseCallback();
    })
    .catch((error) => {
      console.error('Ошибка показа рекламы:', error);
      if (onAdCloseCallback) onAdCloseCallback();
    });
};

// Универсальное приглашение друзей (использует существующую getPlatform)
export const showVkInviteBox = () => {
    const platform = getPlatform();  // используем существующую функцию    
    console.log(`[Приглашение] Платформа: ${platform}`);    
    if (platform === 'ok') {        if (typeof FAPI !== 'undefined' && FAPI.ui && typeof FAPI.ui.showInvite === 'function') {
            console.log('[ОК] Открываем окно приглашения друзей');     FAPI.ui.showInvite();
        } else {            console.warn('[ОК] FAPI.ui.showInvite не найден');
            alert('Пригласите друзей в игру!');
        }
        return;
    }    
    if (platform === 'vk') {
        const vkBridge = window.vkBridge;
        if (vkBridge) {            console.log('[ВК] Открываем окно приглашения друзей');
            vkBridge.send('VKWebAppShowInviteBox')
                .then((data) => {
                    if (data.success) console.log('[ВК] Приглашения успешно отправлены!');
                })
                .catch((err) => console.error('[ВК] Ошибка:', err));
        } else {            console.warn('[ВК] VK Bridge не найден');
        }
        return;
    }    
    console.warn('[Приглашение] Неизвестная платформа');
    alert('Пригласите друзей в игру!');
};


export const invitePlatformFriends = showVkInviteBox;
function logPlatform() {
  console.log('🎮 Платформа:', getPlatform());
}
// ===== ЭКСПОРТ ДЛЯ COMMONJS (WEBPACK 1) =====
module.exports = {
  // Основные функции
  initYandexSdk: initYandexSdk,
  loadYandexHighScore: loadYandexHighScore,
  saveYandexScore: saveYandexScore,
  fetchYandexLeaderboard: fetchYandexLeaderboard,
  showFullscreenAd: showFullscreenAd,
  showVkInviteBox: showVkInviteBox,
  invitePlatformFriends: invitePlatformFriends,
  
  // Алиасы для совместимости с удалённым platform.js
  getPlatform: getPlatform,
  initPlatform: initYandexSdk,
  getPlatformScore: loadYandexHighScore,  // загружает рекорд
  sendPlatformScore: saveYandexScore,      // сохраняет рекорд
  showPlatformLeaderboard: fetchYandexLeaderboard,
  showPlatformAd: showFullscreenAd,
  logPlatform: logPlatform,
  
  // Вспомогательные
  setYsdk: setYsdk,
  getYsdk: getYsdk
};