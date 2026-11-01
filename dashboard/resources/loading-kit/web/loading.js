(function (global) {
  'use strict';
  var root, fill, message, completed = false, boundLabels = [], designerFills = [], designerTexts = [];
  function isEnabled(item, items) { var current = item; var visited = {}; while (current) { if (current.enabled === false || visited[current.id]) return false; visited[current.id] = true; current = current.parentId ? items.find(function (candidate) { return candidate.id === current.parentId; }) : null; } return Boolean(item); }
  function renderTitle(element, source) {
    var content = document.createElement('div'); content.className = 'loading-title-content';
    String(source || 'GAME TITLE').replace(/\r\n?/g, '\n').split('\n').forEach(function (sourceLine) {
      var line = document.createElement('div'); line.className = 'loading-title-line';
      var heading = sourceLine.match(/^(#{1,6})\s*(.*)$/); var lineLevel = heading ? heading[1].length : 1; var text = heading ? heading[2] : sourceLine; var level = lineLevel;
      text.split(/(<\/?h[1-6]>)/gi).forEach(function (part) {
        var tag = part.match(/^<(\/)?h([1-6])>$/i);
        if (tag) { level = tag[1] ? lineLevel : Number(tag[2]); return; }
        if (!part) return;
        var span = document.createElement('span'); span.className = 'loading-title-h' + level; span.textContent = part; line.appendChild(span);
      });
      if (!line.childNodes.length) line.appendChild(document.createTextNode('\u00a0')); content.appendChild(line);
    });
    element.replaceChildren(content); return content;
  }
  function setProgress(config, value) {
    if (!root || completed) return;
    var percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
    fill.style.width = percent + '%';
    if (config.mode === 'progress-bar') message.textContent = ''; else if (config.progressTextStyle) renderTitle(message, (config.progressTextStyle.logoText || 'Loading') + ' ' + percent + '%'); else message.textContent = (config.loadingText || 'Loading') + ' ' + percent + '%';
    boundLabels.forEach(function (item) { if (item.textStyle) renderTitle(item.node, (item.text || 'Loading') + ' ' + percent + '%'); else item.node.textContent = (item.text || 'Loading') + ' ' + percent + '%'; }); designerFills.forEach(function (node) { node.style.width = percent + '%'; });
  }
  function complete(config) {
    if (!root || completed) return;
    setProgress(config, 1); completed = true; root.classList.add('is-complete');
    setTimeout(function () { if (root && root.parentNode) root.parentNode.removeChild(root); }, 350);
  }
  function connectToCocosSplash(config) {
    var splash = document.getElementById('splash');
    if (!splash) return;
    var nativeFill = splash.querySelector('.progress-bar span');
    function syncProgress() {
      if (!nativeFill) return;
      var width = parseFloat(nativeFill.style.width || '0');
      if (!isNaN(width)) setProgress(config, width / 100);
    }
    function syncVisibility() {
      if (splash.style.display === 'none') complete(config);
    }
    if (nativeFill) new MutationObserver(syncProgress).observe(nativeFill, { attributes: true, attributeFilter: ['style'] });
    new MutationObserver(syncVisibility).observe(splash, { attributes: true, attributeFilter: ['style', 'class'] });
    syncProgress(); syncVisibility();
  }
  function mount(config) {
    if (global.HayHayLoadingGraph && global.HayHayLoadingGraph.mount(config)) return;
    if (root) return;
    root = document.createElement('div'); root.id = 'cocos-loading-kit';
    if (global.__HAYHAY_LOADING_PREVIEW__) root.className = 'is-preview';
    if (config.backgroundType === 'image' && config.backgroundImage) root.style.backgroundImage = 'url("hayhay-loading/' + config.backgroundImage + '")';
    else if (config.backgroundColorStyle === 'radial-gradient') root.style.background = 'radial-gradient(' + (config.backgroundRadialShape || 'circle') + ' at ' + (config.backgroundGradientCenterX == null ? 50 : config.backgroundGradientCenterX) + '% ' + (config.backgroundGradientCenterY == null ? 50 : config.backgroundGradientCenterY) + '%,' + (config.backgroundGradientColors || [config.backgroundGradientFrom || '#10141c', config.backgroundGradientTo || '#3a6ea5']).join(',') + ')';
    else if (config.backgroundColorStyle === 'conic-gradient') root.style.background = 'conic-gradient(from ' + (config.backgroundGradientAngle || 0) + 'deg at ' + (config.backgroundGradientCenterX == null ? 50 : config.backgroundGradientCenterX) + '% ' + (config.backgroundGradientCenterY == null ? 50 : config.backgroundGradientCenterY) + '%,' + (config.backgroundGradientColors || [config.backgroundGradientFrom || '#10141c', config.backgroundGradientTo || '#3a6ea5']).join(',') + ')';
    else if (config.backgroundColorStyle === 'linear-gradient' || config.backgroundColorStyle === 'gradient') root.style.background = 'linear-gradient(' + (config.backgroundGradientAngle || 0) + 'deg,' + (config.backgroundGradientColors || [config.backgroundGradientFrom || '#10141c', config.backgroundGradientTo || '#3a6ea5']).join(',') + ')';
    else root.style.background = config.backgroundColor || '#10141c';
    root.style.setProperty('--loading-color', config.textColor || '#fff');
    root.style.setProperty('--loading-theme', config.themeColor || '#4b92ff');
    root.style.setProperty('--loading-theme-soft', (config.themeColor || '#4b92ff') + '33');
    root.style.setProperty('--loading-x', (config.positionX == null ? 50 : config.positionX) + '%');
    root.style.setProperty('--loading-y', (config.positionY == null ? 82 : config.positionY) + '%');
    root.innerHTML = '<div class="cocos-loading-logo"></div><div class="cocos-loading-content"><div class="cocos-loading-progress"><div class="cocos-loading-fill"></div></div><div class="cocos-loading-message"></div></div>';
    var logo = root.querySelector('.cocos-loading-logo'); var progress = root.querySelector('.cocos-loading-progress'); fill = root.querySelector('.cocos-loading-fill'); message = root.querySelector('.cocos-loading-message');
    logo.style.left = (config.logoPositionX == null ? 50 : config.logoPositionX) + '%'; logo.style.top = (config.logoPositionY == null ? 24 : config.logoPositionY) + '%';
    if (config.logoType === 'image' && config.logoImage) logo.style.backgroundImage = 'url("hayhay-loading/' + config.logoImage + '")'; else renderTitle(logo, config.logoText);
    progress.hidden = config.mode !== 'progress-bar'; message.hidden = config.mode === 'progress-bar';
    var designer = Array.isArray(config.designerComponents) ? config.designerComponents : [];
    if (designer.length) {
      var canvasComponent = designer.find(function (item) { return item.id === 'canvas-component' && isEnabled(item, designer); }); if (canvasComponent) { config.designWidth = canvasComponent.designWidth || config.designWidth; config.designHeight = canvasComponent.designHeight || config.designHeight; }
      var backgroundComponent = designer.find(function (item) { return item.id === 'background'; }); if (backgroundComponent && !isEnabled(backgroundComponent, designer)) root.style.background = 'transparent';
      var titleComponent = designer.find(function (item) { return item.id === 'title' && isEnabled(item, designer); }); var progressComponent = designer.find(function (item) { return item.id === 'progress-bar' && isEnabled(item, designer); }); var progressTextComponent = designer.find(function (item) { return item.id === 'progress-text' && isEnabled(item, designer); });
      if (titleComponent) { Object.assign(config, titleComponent.textStyle || {}); config.logoPositionX = titleComponent.x; config.logoPositionY = titleComponent.y; config.logoFontSize = titleComponent.fontSize || config.logoFontSize; config.logoColor = titleComponent.color || config.logoColor; logo.style.left = titleComponent.x + '%'; logo.style.top = titleComponent.y + '%'; if (titleComponent.type === 'text') renderTitle(logo, titleComponent.text || config.logoText); }
      if (progressComponent) { Object.assign(config, { mode: 'progress-bar', progressStylePreset: 'custom', progressThemeId: 'custom', themeColor: '#4b92ff', progressThickness: 24 }, progressComponent.progressStyle || {}); config.positionX = progressComponent.x; config.positionY = progressComponent.y; root.style.setProperty('--loading-x', progressComponent.x + '%'); root.style.setProperty('--loading-y', progressComponent.y + '%'); }
      if (progressTextComponent) { config.progressTextStyle = Object.assign({ logoText: 'Loading', logoFontFamily: 'system', logoFontSize: 48, logoFontWeight: 'bold', logoFontStyle: 'normal', logoTextDecoration: 'none', logoColor: '#fff', logoFillType: 'solid', logoGradientFrom: '#fff', logoGradientTo: '#4b92ff', logoGradientAngle: 180, logoOutlineColor: '#000', logoOutlineWidth: 0, logoShadowColor: '#000', logoShadowOffsetX: 0, logoShadowOffsetY: 3, logoShadowBlur: 6, logoGlowColor: '#4b92ff', logoGlowSize: 0, logoLetterSpacing: 0 }, progressTextComponent.textStyle || {}); boundLabels.push({ node: message, text: progressTextComponent.text || config.progressTextStyle.logoText, textStyle: config.progressTextStyle }); }
      logo.hidden = !titleComponent; progress.hidden = !progressComponent; message.hidden = !progressTextComponent;
      designer.filter(function (item) { return ['background','title','progress','progress-bar','progress-text'].indexOf(item.id) < 0 && item.type !== 'node' && isEnabled(item, designer); }).forEach(function (item) {
        var node = document.createElement('div'); node.className = 'cocos-loading-designer-component'; node.style.left = item.x + '%'; node.style.top = item.y + '%'; node.style.width = item.width + '%';
        if (item.type === 'image' || item.type === 'progress-image') { node.className += ' is-image'; if (item.image) node.style.backgroundImage = 'url("hayhay-loading/' + item.image + '")'; }
        else if (item.type === 'progress-html') { var itemProgressStyle = Object.assign({ mode: 'text' }, item.progressStyle || {}); if (itemProgressStyle.mode === 'text') { var progressNodeTextStyle = Object.assign({ logoText: 'Loading', logoFontFamily: 'system', logoFontSize: 48, logoFontWeight: 'bold', logoFontStyle: 'normal', logoTextDecoration: 'none', logoColor: '#fff', logoFillType: 'solid', logoGradientFrom: '#fff', logoGradientTo: '#4b92ff', logoGradientAngle: 180, logoOutlineColor: '#000', logoOutlineWidth: 0, logoShadowColor: '#000', logoShadowOffsetX: 0, logoShadowOffsetY: 3, logoShadowBlur: 6, logoGlowColor: '#4b92ff', logoGlowSize: 0, logoLetterSpacing: 0 }, item.textStyle || {}); boundLabels.push({ node: node, text: progressNodeTextStyle.logoText, textStyle: progressNodeTextStyle }); designerTexts.push({ node: node, style: progressNodeTextStyle, fontSize: progressNodeTextStyle.logoFontSize, color: progressNodeTextStyle.logoColor }); } else { node.className += ' is-bar'; var bar = document.createElement('div'); node.appendChild(bar); designerFills.push(bar); } }
        else { var itemTextStyle = item.textStyle || {}; if (item.binding === 'progress') boundLabels.push({ node: node, text: item.text || itemTextStyle.logoText || 'Loading', textStyle: itemTextStyle }); else renderTitle(node, item.text || itemTextStyle.logoText || 'Text'); designerTexts.push({ node: node, style: itemTextStyle, fontSize: itemTextStyle.logoFontSize || item.fontSize || 48, color: itemTextStyle.logoColor || item.color || '#fff' }); }
        root.appendChild(node);
      });
    }
    if (config.progressFrameImage) progress.style.backgroundImage = 'url("hayhay-loading/' + config.progressFrameImage + '")';
    if (config.progressBarImage) fill.style.backgroundImage = 'url("hayhay-loading/' + config.progressBarImage + '")';
    var host = global.__HAYHAY_LOADING_PREVIEW__ ? document.getElementById('GameDiv') : document.body;
    host = host || document.body; host.appendChild(root);
    function resize() {
      var settings = global._CCSettings || {};
      var designWidth = Number(config.designWidth || settings.designWidth) || 1080;
      var designHeight = Number(config.designHeight || settings.designHeight) || 1920;
      var scale = Math.min(root.clientWidth / designWidth, root.clientHeight / designHeight) || 1;
      root.style.setProperty('--loading-thickness', ((config.progressThickness || 24) * scale) + 'px');
      root.style.setProperty('--loading-font-size', ((config.fontSize || 18) * scale) + 'px');
      root.style.setProperty('--loading-logo-font-size', ((config.logoFontSize || 72) * scale) + 'px');
      root.style.setProperty('--loading-max-width', (420 * scale) + 'px');
      root.style.setProperty('--loading-padding', (4 * scale) + 'px');
      root.style.setProperty('--loading-margin', (10 * scale) + 'px');
      message.style.textShadow = config.textEffect === 'glow' ? '0 0 ' + (18 * scale) + 'px ' + (config.themeColor || '#4b92ff') + ',0 ' + (2 * scale) + 'px ' + (4 * scale) + 'px #000' : config.textEffect === 'none' ? 'none' : '0 ' + (2 * scale) + 'px ' + (5 * scale) + 'px rgba(0,0,0,.75)';
      var gradient = 'linear-gradient(' + (config.logoGradientAngle || 0) + 'deg,' + (config.logoGradientFrom || config.logoColor || '#fff') + ',' + (config.logoGradientTo || config.themeColor || '#4b92ff') + ')';
      var titleFonts = { 'lilita-one': ['HayHay Lilita One', 400], 'titan-one': ['HayHay Titan One', 400], 'bungee': ['HayHay Bungee', 400], 'baloo-2': ['HayHay Baloo 2', 800] }; var titleFont = titleFonts[config.logoFontFamily] || ['system-ui, sans-serif', 900]; logo.style.fontFamily = titleFont[0]; logo.style.fontWeight = config.logoFontWeight === 'normal' ? '400' : String(Math.max(700, titleFont[1])); logo.style.fontStyle = config.logoFontStyle || 'normal'; logo.style.textDecoration = config.logoTextDecoration || 'none';
      logo.style.color = config.logoFillType === 'gradient' ? 'transparent' : (config.logoColor || '#fff'); logo.style.backgroundImage = config.logoFillType === 'gradient' ? gradient : '';
      logo.style.backgroundClip = config.logoFillType === 'gradient' ? 'text' : ''; logo.style.webkitBackgroundClip = config.logoFillType === 'gradient' ? 'text' : ''; logo.style.webkitTextFillColor = config.logoFillType === 'gradient' ? 'transparent' : '';
      logo.style.webkitTextStroke = ((config.logoOutlineWidth || 0) * scale) + 'px ' + (config.logoOutlineColor || '#000'); logo.style.letterSpacing = ((config.logoLetterSpacing || 0) * scale) + 'px';
      var titleShadows = []; if (config.logoShadowBlur || config.logoShadowOffsetX || config.logoShadowOffsetY) titleShadows.push(((config.logoShadowOffsetX || 0) * scale) + 'px ' + ((config.logoShadowOffsetY || 0) * scale) + 'px ' + ((config.logoShadowBlur || 0) * scale) + 'px ' + (config.logoShadowColor || '#000')); if (config.logoGlowSize) { titleShadows.push('0 0 ' + (config.logoGlowSize * scale) + 'px ' + (config.logoGlowColor || config.themeColor || '#4b92ff')); titleShadows.push('0 0 ' + (config.logoGlowSize * .45 * scale) + 'px ' + (config.logoGlowColor || config.themeColor || '#4b92ff')); } logo.style.textShadow = titleShadows.length ? titleShadows.join(',') : 'none';
      logo.style.transform = config.logoWarp === 'bubble' ? 'translate(-50%,-50%) scaleX(1.08) scaleY(1.18)' : config.logoWarp === 'arc' ? 'translate(-50%,-50%) perspective(500px) rotateX(-12deg) scaleX(1.08)' : config.logoWarp === 'wave' ? 'translate(-50%,-50%) rotate(-2deg) skewX(-5deg)' : config.logoWarp === 'slant' ? 'translate(-50%,-50%) skewX(-10deg) scaleX(1.06)' : 'translate(-50%,-50%)';
      if (config.mode === 'text' && config.progressTextStyle) { var progressText = config.progressTextStyle; var progressFont = titleFonts[progressText.logoFontFamily] || ['system-ui, sans-serif', 900]; var progressGradient = 'linear-gradient(' + (progressText.logoGradientAngle || 0) + 'deg,' + (progressText.logoGradientFrom || progressText.logoColor || '#fff') + ',' + (progressText.logoGradientTo || progressText.logoColor || '#fff') + ')'; message.style.fontFamily = progressFont[0]; message.style.fontSize = ((progressText.logoFontSize || 48) * scale) + 'px'; message.style.fontWeight = progressText.logoFontWeight === 'normal' ? '400' : String(Math.max(700, progressFont[1])); message.style.fontStyle = progressText.logoFontStyle || 'normal'; message.style.textDecoration = progressText.logoTextDecoration || 'none'; message.style.color = progressText.logoFillType === 'gradient' ? 'transparent' : (progressText.logoColor || '#fff'); message.style.backgroundImage = progressText.logoFillType === 'gradient' ? progressGradient : ''; message.style.backgroundClip = progressText.logoFillType === 'gradient' ? 'text' : ''; message.style.webkitBackgroundClip = progressText.logoFillType === 'gradient' ? 'text' : ''; message.style.webkitTextFillColor = progressText.logoFillType === 'gradient' ? 'transparent' : ''; message.style.webkitTextStroke = ((progressText.logoOutlineWidth || 0) * scale) + 'px ' + (progressText.logoOutlineColor || '#000'); message.style.letterSpacing = ((progressText.logoLetterSpacing || 0) * scale) + 'px'; var progressShadows = []; if (progressText.logoShadowBlur || progressText.logoShadowOffsetX || progressText.logoShadowOffsetY) progressShadows.push(((progressText.logoShadowOffsetX || 0) * scale) + 'px ' + ((progressText.logoShadowOffsetY || 0) * scale) + 'px ' + ((progressText.logoShadowBlur || 0) * scale) + 'px ' + (progressText.logoShadowColor || '#000')); if (progressText.logoGlowSize) progressShadows.push('0 0 ' + (progressText.logoGlowSize * scale) + 'px ' + (progressText.logoGlowColor || '#4b92ff')); message.style.textShadow = progressShadows.length ? progressShadows.join(',') : 'none'; }
      designerTexts.forEach(function (entry) { var style = entry.style; var font = titleFonts[style.logoFontFamily] || ['system-ui, sans-serif', 900]; var colors = [style.logoGradientFrom || entry.color, style.logoGradientTo || entry.color]; var fillGradient = 'linear-gradient(' + (style.logoGradientAngle || 0) + 'deg,' + colors.join(',') + ')'; entry.node.style.fontFamily = font[0]; entry.node.style.fontSize = (entry.fontSize * scale) + 'px'; entry.node.style.fontWeight = style.logoFontWeight === 'normal' ? '400' : String(Math.max(700, font[1])); entry.node.style.fontStyle = style.logoFontStyle || 'normal'; entry.node.style.textDecoration = style.logoTextDecoration || 'none'; entry.node.style.color = style.logoFillType === 'gradient' ? 'transparent' : entry.color; entry.node.style.backgroundImage = style.logoFillType === 'gradient' ? fillGradient : ''; entry.node.style.backgroundClip = style.logoFillType === 'gradient' ? 'text' : ''; entry.node.style.webkitBackgroundClip = style.logoFillType === 'gradient' ? 'text' : ''; entry.node.style.webkitTextFillColor = style.logoFillType === 'gradient' ? 'transparent' : ''; entry.node.style.webkitTextStroke = ((style.logoOutlineWidth || 0) * scale) + 'px ' + (style.logoOutlineColor || '#000'); entry.node.style.letterSpacing = ((style.logoLetterSpacing || 0) * scale) + 'px'; var shadows = []; if (style.logoShadowBlur || style.logoShadowOffsetX || style.logoShadowOffsetY) shadows.push(((style.logoShadowOffsetX || 0) * scale) + 'px ' + ((style.logoShadowOffsetY || 0) * scale) + 'px ' + ((style.logoShadowBlur || 0) * scale) + 'px ' + (style.logoShadowColor || '#000')); if (style.logoGlowSize) shadows.push('0 0 ' + (style.logoGlowSize * scale) + 'px ' + (style.logoGlowColor || '#4b92ff')); entry.node.style.textShadow = shadows.length ? shadows.join(',') : 'none'; });
    }
    resize(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize); if (global.ResizeObserver) new ResizeObserver(resize).observe(root); else global.addEventListener('resize', resize);
    setProgress(config, 0); connectToCocosSplash(config);
    global.HayHayLoading = { setProgress: function (value) { setProgress(config, value); }, complete: function () { complete(config); } };
  }
  function start() { fetch(global.__HAYHAY_LOADING_CONFIG_URL__ || 'hayhay-loading/config.json').then(function (r) { return r.json(); }).then(mount).catch(function () { mount({}); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}(window));
