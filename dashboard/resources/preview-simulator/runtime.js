(function (window) {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var storageKey = 'hayhay-preview-platform';
  var platform = params.get('platform') || window.localStorage.getItem(storageKey) || 'web';
  var supported = ['web', 'fb-instant-games', 'tiktok', 'android', 'ios'];
  if (supported.indexOf(platform) < 0) platform = 'web';
  window.localStorage.setItem(storageKey, platform);

  var listeners = {};
  var calls = [];
  function previewLog(event, details) {
    window.__hayhayPreviewLogs = window.__hayhayPreviewLogs || [];
    window.__hayhayPreviewLogs.push([event, details || '']);
    console.info('[HayHay Preview] ' + event + ' ' + JSON.stringify(details || ''));
  }
  function replayPreviewLogs() {
    if (!document.querySelector('.vc-switch') || window.__hayhayPreviewLogsReplayed) return false;
    window.__hayhayPreviewLogsReplayed = true;
    console.info('[HayHay Preview] replaying early lifecycle logs (' + window.__hayhayPreviewLogs.length + ')');
    window.__hayhayPreviewLogs.forEach(function (entry) { console.info('[HayHay Preview] ' + entry[0] + ' ' + JSON.stringify(entry[1])); });
    return true;
  }
  function record(api, args) {
    var entry = { api: api, args: Array.prototype.slice.call(args || []), at: new Date().toISOString() };
    calls.push(entry);
    console.info('[Platform Simulator]', api, entry.args);
    (listeners.call || []).forEach(function (fn) { fn(entry); });
    return entry;
  }
  function resolved(value) { return Promise.resolve(value); }
  function store(namespace) {
    var key = 'hayhay-preview-data:' + namespace + ':';
    return {
      get: function (names) {
        var result = {};
        (names || []).forEach(function (name) {
          var value = window.localStorage.getItem(key + name);
          result[name] = value === null ? undefined : JSON.parse(value);
        });
        return result;
      },
      set: function (values) {
        Object.keys(values || {}).forEach(function (name) { window.localStorage.setItem(key + name, JSON.stringify(values[name])); });
      }
    };
  }

  var simulator = window.HayHayPreviewSimulator = {
    platform: platform,
    calls: calls,
    config: {
      locale: params.get('locale') || 'en_US',
      playerId: params.get('playerId') || 'preview-player',
      playerName: params.get('playerName') || 'Preview Player',
      contextId: params.get('contextId') || 'preview-context'
    },
    on: function (event, callback) { (listeners[event] || (listeners[event] = [])).push(callback); },
    emit: function (event, payload) { record('simulator.emit.' + event, [payload]); (listeners[event] || []).forEach(function (fn) { fn(payload); }); },
    setPlatform: function (next) {
      window.localStorage.setItem(storageKey, next);
      var url = new URL(window.location.href);
      url.searchParams.set('platform', next);
      window.location.href = url.toString();
    },
    clearData: function () {
      Object.keys(window.localStorage).forEach(function (key) { if (key.indexOf('hayhay-preview-data:') === 0) window.localStorage.removeItem(key); });
    }
  };

  function installFacebook() {
    var data = store('facebook');
    var ad = function (placement) {
      return {
        loadAsync: function () { record('FBInstant.ad.loadAsync', arguments); return resolved(); },
        showAsync: function () { record('FBInstant.ad.showAsync', arguments); return resolved(); },
        getPlacementID: function () { return placement; }
      };
    };
    window.FBInstant = {
      getSupportedAPIs: function () { return [
        'getLocale', 'getPlatform', 'getSDKVersion', 'getEntryPointAsync', 'getTournamentAsync', 'getLeaderboardAsync',
        'logEvent', 'shareAsync', 'updateAsync', 'setSessionData', 'onPause',
        'player.getID', 'player.getName', 'player.getPhoto', 'player.getASIDAsync', 'player.getConnectedPlayersAsync',
        'player.getDataAsync', 'player.setDataAsync', 'player.flushDataAsync', 'player.incrementStatsAsync',
        'player.canSubscribeBotAsync', 'player.subscribeBotAsync',
        'context.getID', 'context.getType', 'context.getPlayersAsync', 'context.chooseAsync', 'context.createAsync', 'context.switchAsync',
        'getInterstitialAdAsync', 'getRewardedVideoAsync', 'getRewardedInterstitialAsync',
        'canCreateShortcutAsync', 'createShortcutAsync', 'postSessionScoreAsync', 'loadBannerAdAsync', 'hideBannerAdAsync',
        'payments.getCatalogAsync', 'payments.purchaseAsync', 'payments.consumePurchaseAsync', 'payments.onReady'
      ]; },
      initializeAsync: function () { record('FBInstant.initializeAsync', arguments); return resolved(); },
      startGameAsync: function () { record('FBInstant.startGameAsync', arguments); return resolved(); },
      setLoadingProgress: function (value) { record('FBInstant.setLoadingProgress', arguments); },
      getLocale: function () { record('FBInstant.getLocale', arguments); return simulator.config.locale; },
      getPlatform: function () { return 'WEB'; },
      getSDKVersion: function () { return 'preview-simulator'; },
      getEntryPointAsync: function () { record('FBInstant.getEntryPointAsync', arguments); return resolved('preview'); },
      getTournamentAsync: function () { record('FBInstant.getTournamentAsync', arguments); return resolved({ getPayload: function () { return '{}'; } }); },
      getLeaderboardAsync: function (name) { record('FBInstant.getLeaderboardAsync', arguments); return resolved({
        getName: function () { return name; },
        getEntriesAsync: function () { return resolved([]); },
        getPlayerEntryAsync: function () { return resolved(null); },
        setScoreAsync: function () { return resolved(); }
      }); },
      logEvent: function () { record('FBInstant.logEvent', arguments); return true; },
      setSessionData: function () { record('FBInstant.setSessionData', arguments); },
      onPause: function (callback) { simulator.on('pause', callback); },
      shareAsync: function () { record('FBInstant.shareAsync', arguments); return resolved(); },
      updateAsync: function () { record('FBInstant.updateAsync', arguments); return resolved(); },
      getInterstitialAdAsync: function (placement) { record('FBInstant.getInterstitialAdAsync', arguments); return resolved(ad(placement)); },
      getRewardedVideoAsync: function (placement) { record('FBInstant.getRewardedVideoAsync', arguments); return resolved(ad(placement)); },
      getRewardedInterstitialAsync: function (placement) { record('FBInstant.getRewardedInterstitialAsync', arguments); return resolved(ad(placement)); },
      canCreateShortcutAsync: function () { return resolved(false); },
      createShortcutAsync: function () { record('FBInstant.createShortcutAsync', arguments); return resolved(); },
      postSessionScoreAsync: function () { record('FBInstant.postSessionScoreAsync', arguments); return resolved(); },
      loadBannerAdAsync: function () { record('FBInstant.loadBannerAdAsync', arguments); return resolved(); },
      hideBannerAdAsync: function () { record('FBInstant.hideBannerAdAsync', arguments); return resolved(); },
      player: {
        getID: function () { return simulator.config.playerId; },
        getName: function () { return simulator.config.playerName; },
        getPhoto: function () { return 'res://avatars/default'; },
        getASIDAsync: function () { record('FBInstant.player.getASIDAsync', arguments); return resolved('preview-asid'); },
        getConnectedPlayersAsync: function () { record('FBInstant.player.getConnectedPlayersAsync', arguments); return resolved([]); },
        getDataAsync: function (keys) { record('FBInstant.player.getDataAsync', arguments); return resolved(data.get(keys)); },
        setDataAsync: function (values) { record('FBInstant.player.setDataAsync', arguments); data.set(values); return resolved(); },
        flushDataAsync: function () { record('FBInstant.player.flushDataAsync', arguments); return resolved(); },
        incrementStatsAsync: function (values) { record('FBInstant.player.incrementStatsAsync', arguments); return resolved(values || {}); },
        canSubscribeBotAsync: function () { return resolved(true); },
        subscribeBotAsync: function () { record('FBInstant.player.subscribeBotAsync', arguments); return resolved(); }
      },
      context: {
        getID: function () { return simulator.config.contextId; },
        getType: function () { return 'SOLO'; },
        getPlayersAsync: function () { record('FBInstant.context.getPlayersAsync', arguments); return resolved([]); },
        chooseAsync: function () { record('FBInstant.context.chooseAsync', arguments); return resolved(); },
        createAsync: function (id) { record('FBInstant.context.createAsync', arguments); simulator.config.contextId = id; return resolved(); },
        switchAsync: function (id) { record('FBInstant.context.switchAsync', arguments); simulator.config.contextId = id; return resolved(); }
      },
      payments: {
        getCatalogAsync: function () { record('FBInstant.payments.getCatalogAsync', arguments); return resolved([]); },
        purchaseAsync: function () { record('FBInstant.payments.purchaseAsync', arguments); return Promise.reject({ code: 'PAYMENTS_NOT_AVAILABLE' }); },
        consumePurchaseAsync: function () { record('FBInstant.payments.consumePurchaseAsync', arguments); return resolved(); },
        onReady: function (callback) { if (callback) window.setTimeout(callback, 0); }
      }
    };
  }

  function installTikTok() {
    var data = store('tiktok');
    function success(options, value) { if (options && typeof options.success === 'function') window.setTimeout(function () { options.success(value); }, 0); }
    function complete(options, value) { if (options && typeof options.complete === 'function') window.setTimeout(function () { options.complete(value); }, 0); }
    function eventTarget(name) {
      var handlers = {};
      return {
        onLoad: function (fn) { handlers.load = fn; },
        onError: function (fn) { handlers.error = fn; },
        onClose: function (fn) { handlers.close = fn; },
        load: function () { record('tt.' + name + '.load', arguments); if (handlers.load) handlers.load(); return resolved(); },
        show: function () { record('tt.' + name + '.show', arguments); window.setTimeout(function () { if (handlers.close) handlers.close({ isEnded: true }); }, 200); return resolved(); },
        destroy: function () { record('tt.' + name + '.destroy', arguments); }
      };
    }
    window.tt = {
      getSystemInfoSync: function () { record('tt.getSystemInfoSync', arguments); return { platform: 'devtools', language: simulator.config.locale.replace('_', '-'), system: 'Preview Simulator', model: 'Browser', SDKVersion: 'preview-simulator' }; },
      login: function (options) { record('tt.login', arguments); var result = { code: 'preview-login-code', anonymousCode: 'preview-anonymous-code' }; success(options, result); complete(options, result); },
      getUserInfo: function (options) { record('tt.getUserInfo', arguments); var result = { userInfo: { nickName: simulator.config.playerName, avatarUrl: '' } }; success(options, result); complete(options, result); },
      getStorageSync: function (key) { record('tt.getStorageSync', arguments); return data.get([key])[key]; },
      setStorageSync: function (key, value) { record('tt.setStorageSync', arguments); var values = {}; values[key] = value; data.set(values); },
      getStorage: function (options) { record('tt.getStorage', arguments); success(options, { data: data.get([options.key])[options.key] }); },
      setStorage: function (options) { record('tt.setStorage', arguments); var values = {}; values[options.key] = options.data; data.set(values); success(options, {}); },
      showShareMenu: function (options) { record('tt.showShareMenu', arguments); success(options, {}); },
      shareAppMessage: function (options) { record('tt.shareAppMessage', arguments); success(options, {}); },
      createRewardedVideoAd: function () { record('tt.createRewardedVideoAd', arguments); return eventTarget('rewardedVideoAd'); },
      createInterstitialAd: function () { record('tt.createInterstitialAd', arguments); return eventTarget('interstitialAd'); },
      onShow: function (fn) { simulator.on('show', fn); },
      onHide: function (fn) { simulator.on('hide', fn); }
    };
  }

  function installNative(os) {
    var data = store(os);
    window.HayHayNative = {
      platform: os,
      invoke: function (method, payload) { record('HayHayNative.invoke.' + method, [payload]); return resolved({ ok: true, platform: os }); },
      getLocale: function () { return simulator.config.locale; },
      getItem: function (key) { return data.get([key])[key]; },
      setItem: function (key, value) { var values = {}; values[key] = value; data.set(values); }
    };
  }

  if (platform === 'fb-instant-games') installFacebook();
  if (platform === 'tiktok') installTikTok();
  if (platform === 'android' || platform === 'ios') installNative(platform);

  function installToolbar() {
    var toolbar = document.querySelector('.toolbar');
    if (!toolbar) { previewLog('toolbar missing', { readyState: document.readyState }); return; }
    if (document.getElementById('hayhay-platform-simulator')) { previewLog('toolbar already installed'); return; }
    previewLog('install toolbar', { readyState: document.readyState, viewport: [window.innerWidth, window.innerHeight] });
    var style = document.createElement('style');
    style.textContent = [
      'html,body{overflow:hidden!important;background:#111318!important}',
      '.toolbar{box-sizing:border-box!important;min-height:56px!important;padding:8px 12px!important;background:#1b1e24!important;border-bottom:1px solid #323640!important;gap:8px!important}',
      '.toolbar> :not(#hayhay-platform-simulator):not(#hayhay-preview-native-controls){display:none!important}',
      '#hayhay-preview-native-controls{display:none!important}',
      '#hayhay-platform-simulator{display:flex!important;align-items:center;justify-content:space-between;width:100%;gap:16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
      '.hh-preview-group{display:flex;align-items:center;gap:8px;min-width:0}',
      '.hh-preview-label{color:#9299a7;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}',
      '.hh-preview-select,.hh-preview-button{box-sizing:border-box;height:36px!important;border:1px solid #3a3f49!important;border-radius:7px!important;background:#282c34!important;color:#e7e9ed!important;padding:0 12px!important;font-size:13px!important;font-weight:600!important;box-shadow:none!important;background-image:none!important}',
      '.hh-preview-select{min-width:190px;appearance:auto!important}',
      '.hh-preview-button{cursor:pointer!important}',
      '.hh-preview-button:hover{background:#333843!important;border-color:#4b5260!important}',
      '.hh-preview-button.is-active{color:#fff!important;background:#3979ba!important;border-color:#4c8dce!important}',
      '.hh-preview-modes{display:flex;padding:3px;border-radius:9px;background:#111318}',
      '.hh-preview-modes .hh-preview-button{height:30px!important;border:0!important;background:transparent!important;padding:0 11px!important}',
      '.hh-preview-modes .hh-preview-button.is-active{background:#3979ba!important}',
      '#content{box-sizing:border-box!important;width:100%!important;min-width:0!important;min-height:0!important;padding:16px!important;overflow:hidden!important}',
      '#content .contentWrap{width:100%!important;height:100%!important;min-width:0!important;overflow:hidden!important;display:flex!important;align-items:center!important;justify-content:center!important}',
      '#GameDiv{box-sizing:border-box!important;position:relative!important;inset:auto!important;flex:0 0 auto!important;width:var(--hh-preview-width)!important;height:var(--hh-preview-height)!important;overflow:hidden!important;border:1px solid #343944!important;border-radius:10px!important;box-shadow:0 12px 36px rgba(0,0,0,.35)!important}',
      '#GameCanvas{display:block!important;width:100%!important;height:100%!important}',
      '#splash,#bulletin{box-sizing:border-box!important;position:absolute!important;inset:0!important;width:100%!important;height:100%!important}',
      'body.hh-mode-full #content{padding:0!important}',
      'body.hh-mode-full #GameDiv{width:100%!important;height:100%!important;border:0!important;border-radius:0!important}',
      '.vc-switch{right:12px!important;bottom:12px!important}',
      '@media(max-width:760px){.toolbar{display:flex!important}.hh-preview-label{display:none}.hh-preview-select{min-width:132px}.hh-preview-group{gap:4px}#content{padding:8px!important}}'
    ].join('');
    document.head.appendChild(style);

    var nativeControls = document.createElement('div');
    nativeControls.id = 'hayhay-preview-native-controls';
    Array.prototype.slice.call(toolbar.children).forEach(function (child) { nativeControls.appendChild(child); });
    toolbar.appendChild(nativeControls);

    var wrapper = document.createElement('div');
    wrapper.id = 'hayhay-platform-simulator';
    var primary = document.createElement('div'); primary.className = 'hh-preview-group';
    var platformLabel = document.createElement('span'); platformLabel.className = 'hh-preview-label'; platformLabel.textContent = 'Platform';
    var select = document.createElement('select');
    select.className = 'hh-preview-select';
    select.title = 'Simulated platform';
    [
      ['web', 'Web'],
      ['fb-instant-games', 'Facebook Instant Games'],
      ['tiktok', 'TikTok'],
      ['android', 'Android'],
      ['ios', 'iOS']
    ].forEach(function (option) {
      var element = document.createElement('option');
      element.value = option[0]; element.textContent = option[1]; select.appendChild(element);
    });
    select.value = platform;
    select.addEventListener('change', function () { simulator.setPlatform(select.value); });
    primary.appendChild(platformLabel); primary.appendChild(select);

    var mode = window.localStorage.getItem('hayhay-preview-viewport') || 'full';
    if (['full', 'portrait', 'landscape'].indexOf(mode) < 0) mode = 'full';
    document.documentElement.setAttribute('data-hh-preview-mode', mode);
    previewLog('restore mode', { mode: mode });
    var modes = document.createElement('div'); modes.className = 'hh-preview-modes';
    var lastSize = '';
    function resizeGame(reason) {
      var content = document.getElementById('content');
      var game = document.getElementById('GameDiv');
      if (!content || !game) { previewLog('resize skipped', { reason: reason, content: Boolean(content), game: Boolean(game) }); return; }
      document.body.classList.remove('hh-mode-full', 'hh-mode-portrait', 'hh-mode-landscape');
      document.body.classList.add('hh-mode-' + mode);
      var availableWidth = content.clientWidth - (mode === 'full' ? 0 : 32);
      var availableHeight = content.clientHeight - (mode === 'full' ? 0 : 32);
      var width = availableWidth;
      var height = availableHeight;
      if (mode !== 'full') {
        var ratio = mode === 'portrait' ? 9 / 16 : 16 / 9;
        width = Math.min(availableWidth, availableHeight * ratio);
        height = width / ratio;
      }
      width = Math.max(1, Math.floor(width));
      height = Math.max(1, Math.floor(height));
      if (game.style.getPropertyValue('--hh-preview-width') !== width + 'px') game.style.setProperty('--hh-preview-width', width + 'px');
      if (game.style.getPropertyValue('--hh-preview-height') !== height + 'px') game.style.setProperty('--hh-preview-height', height + 'px');
      var nextSize = mode + ':' + width + 'x' + height;
      if (nextSize !== lastSize || reason === 'mode change') {
        previewLog('apply viewport', {
          reason: reason,
          mode: mode,
          viewport: [window.innerWidth, window.innerHeight],
          content: [content.clientWidth, content.clientHeight],
          frame: [width, height],
          splashVisible: Boolean(document.getElementById('splash') && getComputedStyle(document.getElementById('splash')).display !== 'none')
        });
        lastSize = nextSize;
      }
    }
    ['full', 'portrait', 'landscape'].forEach(function (value) {
      var button = document.createElement('button');
      button.className = 'hh-preview-button' + (mode === value ? ' is-active' : '');
      button.textContent = value.charAt(0).toUpperCase() + value.slice(1);
      button.addEventListener('click', function () {
        mode = value; window.localStorage.setItem('hayhay-preview-viewport', mode); document.documentElement.setAttribute('data-hh-preview-mode', mode);
        Array.prototype.forEach.call(modes.children, function (item) { item.classList.toggle('is-active', item === button); });
        previewLog('mode selected', { previous: document.body.className, mode: mode });
        resizeGame('mode change');
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            previewLog('dispatch resize', { mode: mode, frame: [document.getElementById('GameDiv').clientWidth, document.getElementById('GameDiv').clientHeight] });
            window.dispatchEvent(new Event('resize'));
          });
        });
      });
      modes.appendChild(button);
    });
    primary.appendChild(modes);

    var actions = document.createElement('div'); actions.className = 'hh-preview-group';
    function action(label, title, handler) {
      var button = document.createElement('button'); button.className = 'hh-preview-button'; button.textContent = label; button.title = title;
      button.addEventListener('click', handler); actions.appendChild(button); return button;
    }
    var pauseButton = action('Pause', 'Pause or resume the game', function () {
      var native = document.getElementById('btn-pause'); if (native) native.click();
      window.setTimeout(function () { pauseButton.textContent = window.cc && cc.game && cc.game.isPaused() ? 'Resume' : 'Pause'; }, 0);
    });
    action('Recompile', 'Recompile project scripts', function () { var native = document.getElementById('btn-recompile'); if (native) native.click(); });
    action('Reload', 'Reload the preview', function () { window.location.reload(); });
    action('Console', 'Show or hide the development console', function () { var toggle = document.querySelector('.vc-switch'); if (toggle) toggle.click(); });

    wrapper.appendChild(primary); wrapper.appendChild(actions); toolbar.appendChild(wrapper);
    window.addEventListener('resize', function () { resizeGame('window resize'); });
    resizeGame('install');
    var replayAttempts = 0;
    var replayTimer = window.setInterval(function () {
      replayAttempts += 1;
      if (replayPreviewLogs() || replayAttempts >= 20) window.clearInterval(replayTimer);
    }, 250);
  }
  installToolbar();

  record('simulator.ready', [platform]);
})(window);

