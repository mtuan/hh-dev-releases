"use strict";
(() => {
  // resources/loading-kit/runtime/loading-runtime-core.ts
  var FONT_WEIGHTS = { "lilita-one": 400, "titan-one": 400, bungee: 400, "baloo-2": 800, system: 400 };
  function isLoadingItemEnabled(item, items) {
    let current = item;
    const visited = /* @__PURE__ */ new Set();
    while (current) {
      if (current.enabled === false || visited.has(current.id)) return false;
      visited.add(current.id);
      current = current.parentId ? items.find((candidate) => candidate.id === current.parentId) : void 0;
    }
    return Boolean(item);
  }
  function parseLoadingText(source) {
    return String(source || "").replace(/\r\n?/g, "\n").split("\n").map((sourceLine) => {
      const heading = sourceLine.match(/^(#{1,6})\s*(.*)$/);
      const lineLevel = heading?.[1].length ?? 1;
      const text = heading?.[2] ?? sourceLine;
      let level = lineLevel;
      const runs = [];
      for (const part of text.split(/(<\/?h[1-6]>)/gi)) {
        const tag = part.match(/^<(\/)?h([1-6])>$/i);
        if (tag) {
          level = tag[1] ? lineLevel : Number(tag[2]);
          continue;
        }
        if (part) runs.push({ level, text: part });
      }
      return { runs: runs.length ? runs : [{ level: lineLevel, text: "\xA0" }] };
    });
  }
  function formatLoadingProgressText(base, value) {
    return `${base || "Loading"} ${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
  }
  function resolveLoadingTextVisual(component) {
    const style = component.textStyle ?? {};
    const family = style.logoFontFamily ?? "system";
    const color = style.logoColor ?? component.color ?? "#ffffff";
    const bold = style.logoFontWeight !== "normal";
    return { fontFamily: family, fontSize: style.logoFontSize ?? component.fontSize ?? 48, fontWeight: bold ? Math.max(700, FONT_WEIGHTS[family] ?? 400) : 400, fontStyle: style.logoFontStyle ?? "normal", textDecoration: style.logoTextDecoration ?? "none", letterSpacing: style.logoLetterSpacing ?? 0, color, fillType: style.logoFillType === "gradient" ? "gradient" : "solid", gradientFrom: style.logoGradientFrom ?? color, gradientTo: style.logoGradientTo ?? color, gradientAngle: style.logoGradientAngle ?? 180, outlineColor: style.logoOutlineColor ?? "#000000", outlineWidth: style.logoOutlineWidth ?? 0, shadowColor: style.logoShadowColor ?? "#000000", shadowX: style.logoShadowOffsetX ?? 0, shadowY: style.logoShadowOffsetY ?? 0, shadowBlur: style.logoShadowBlur ?? 0, glowColor: style.logoGlowColor ?? color, glowSize: style.logoGlowSize ?? 0, warp: style.logoWarp ?? "none" };
  }
  function resolveLoadingProgressVisual(component, fallbackColor = "#4b92ff") {
    const style = component.progressStyle ?? {};
    const color = style.themeColor ?? fallbackColor;
    return { color, trackColor: `${color}33`, thickness: style.progressThickness ?? component.height ?? 24 };
  }
  var HEADING_SCALES = [1, 1, 0.86, 0.72, 0.62, 0.54, 0.46];
  function textAdvance(text, fontSize, letterSpacing) {
    const glyphs = Array.from(text);
    const em = glyphs.reduce((sum, glyph) => sum + (/\s/.test(glyph) ? 0.33 : /[ilI1.,'!:;|]/.test(glyph) ? 0.3 : /[MW@#%&]/.test(glyph) ? 0.9 : /[A-Z0-9]/.test(glyph) ? 0.66 : 0.62), 0);
    return em * fontSize + Math.max(0, glyphs.length - 1) * letterSpacing;
  }
  function loadingRuntimeTextSize(component) {
    const style = component.textStyle ?? {};
    const text = component.text ?? style.logoText ?? "";
    const lines = parseLoadingText(text);
    const fontSize = style.logoFontSize ?? component.fontSize ?? 48;
    const letterSpacing = style.logoLetterSpacing ?? 0;
    const outline = Math.max(0, style.logoOutlineWidth ?? 0);
    const glow = Math.max(0, style.logoGlowSize ?? 0);
    const shadowBlur = Math.max(0, style.logoShadowBlur ?? 0);
    const shadowX = Math.abs(style.logoShadowOffsetX ?? 0);
    const shadowY = Math.abs(style.logoShadowOffsetY ?? 0);
    const contentWidth = Math.max(0, ...lines.map((line) => line.runs.reduce((sum, run) => sum + textAdvance(run.text, fontSize * (HEADING_SCALES[run.level] ?? 1), letterSpacing), 0)));
    return { width: Math.ceil(contentWidth + outline * 2 + glow + shadowBlur + shadowX), height: Math.ceil(Math.max(1, lines.length) * fontSize * 1.1 + outline * 2 + glow * 0.5 + shadowBlur + shadowY) };
  }
  function resolveLoadingRuntimeFrames(items, designWidth, designHeight) {
    const byId = new Map(items.map((item) => [item.id, item]));
    const frames = /* @__PURE__ */ new Map();
    const resolving = /* @__PURE__ */ new Set();
    const sizes = /* @__PURE__ */ new Map();
    const sizing = /* @__PURE__ */ new Set();
    const sizeOf = (node) => {
      const cached = sizes.get(node.id);
      if (cached) return cached;
      if (sizing.has(node.id)) return { width: node.width, height: node.height ?? 0 };
      sizing.add(node.id);
      let width = node.width;
      let height = node.height ?? 0;
      const textRenderer = node.type === "text" ? node : items.find((item) => item.parentId === node.id && item.type === "text" && isLoadingItemEnabled(item, items));
      if (textRenderer) ({ width, height } = loadingRuntimeTextSize(textRenderer));
      const layoutComponent = items.find((item) => item.parentId === node.id && item.type === "layout" && isLoadingItemEnabled(item, items));
      const layout = layoutComponent?.layout;
      if (layout && layout.direction !== "none" && layoutComponent?.layoutResizeMode === "container") {
        const childSizes = items.filter((item) => item.parentId === node.id && !item.isComponent && isLoadingItemEnabled(item, items)).map(sizeOf);
        if (layout.direction === "horizontal") {
          width = layout.paddingLeft + layout.paddingRight + childSizes.reduce((sum, size) => sum + size.width, 0) + Math.max(0, childSizes.length - 1) * layout.spacingX;
          height = layout.paddingTop + layout.paddingBottom + Math.max(0, ...childSizes.map((size) => size.height));
        } else if (layout.direction === "vertical") {
          width = layout.paddingLeft + layout.paddingRight + Math.max(0, ...childSizes.map((size) => size.width));
          height = layout.paddingTop + layout.paddingBottom + childSizes.reduce((sum, size) => sum + size.height, 0) + Math.max(0, childSizes.length - 1) * layout.spacingY;
        } else {
          const columns = Math.max(1, Math.ceil(Math.sqrt(childSizes.length)));
          const rows = Math.max(1, Math.ceil(childSizes.length / columns));
          const cellWidth = Math.max(0, ...childSizes.map((size) => size.width));
          const cellHeight = Math.max(0, ...childSizes.map((size) => size.height));
          width = layout.paddingLeft + layout.paddingRight + columns * cellWidth + Math.max(0, columns - 1) * layout.spacingX;
          height = layout.paddingTop + layout.paddingBottom + rows * cellHeight + Math.max(0, rows - 1) * layout.spacingY;
        }
      }
      const result = { width, height };
      sizes.set(node.id, result);
      sizing.delete(node.id);
      return result;
    };
    const frameOf = (id) => {
      const cached = frames.get(id);
      if (cached) return cached;
      const node = byId.get(id);
      if (!node || node.isComponent || resolving.has(id)) return void 0;
      resolving.add(id);
      const parent = node.parentId ? frameOf(node.parentId) : void 0;
      const parentFrame = parent ?? { left: 0, bottom: 0, width: designWidth, height: designHeight, anchorX: 0.5, anchorY: 0.5, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
      if (id === "canvas") {
        const root = { ...parentFrame, anchorX: node.anchorX ?? 0.5, anchorY: node.anchorY ?? 0.5, rotation: node.rotation ?? 0, scaleX: node.scaleX ?? 1, scaleY: node.scaleY ?? 1, opacity: node.opacity ?? 1 };
        frames.set(id, root);
        resolving.delete(id);
        return root;
      }
      const anchorX = node.anchorX ?? 0.5;
      const anchorY = node.anchorY ?? 0.5;
      const measured = sizeOf(node);
      let width = measured.width;
      let height = measured.height;
      const textControlsSize = node.type === "text" || items.some((item) => item.parentId === node.id && item.type === "text" && isLoadingItemEnabled(item, items));
      let anchorWorldX = parentFrame.left + parentFrame.anchorX * parentFrame.width + node.x;
      let anchorWorldY = parentFrame.bottom + parentFrame.anchorY * parentFrame.height + node.y;
      if (node.coordinateUnit !== "px") {
        if (!textControlsSize) {
          width = node.width / 100 * parentFrame.width;
          height = (node.height ?? 20) / 100 * parentFrame.height;
        }
        anchorWorldX = parentFrame.left + node.x / 100 * parentFrame.width;
        anchorWorldY = parentFrame.bottom + (1 - node.y / 100) * parentFrame.height;
      }
      const layoutComponent = node.parentId ? items.find((item) => item.parentId === node.parentId && item.type === "layout" && isLoadingItemEnabled(item, items)) : void 0;
      const layout = layoutComponent?.layout;
      if (layout && layout.direction !== "none") {
        const siblings = items.filter((item) => item.parentId === node.parentId && !item.isComponent && isLoadingItemEnabled(item, items));
        const index = Math.max(0, siblings.findIndex((item) => item.id === id));
        if (layout.direction === "horizontal") {
          const before = siblings.slice(0, index).reduce((sum, item) => sum + sizeOf(item).width, 0);
          const left = parentFrame.left + layout.paddingLeft + before + index * layout.spacingX;
          const availableHeight = Math.max(0, parentFrame.height - layout.paddingTop - layout.paddingBottom);
          const bottom = parentFrame.bottom + layout.paddingBottom + Math.max(0, (availableHeight - height) / 2);
          anchorWorldX = left + anchorX * width;
          anchorWorldY = bottom + anchorY * height;
        } else if (layout.direction === "vertical") {
          const before = siblings.slice(0, index).reduce((sum, item) => sum + sizeOf(item).height, 0);
          const top = parentFrame.bottom + parentFrame.height - layout.paddingTop - before - index * layout.spacingY;
          const availableWidth = Math.max(0, parentFrame.width - layout.paddingLeft - layout.paddingRight);
          const left = parentFrame.left + layout.paddingLeft + Math.max(0, (availableWidth - width) / 2);
          anchorWorldX = left + anchorX * width;
          anchorWorldY = top - (1 - anchorY) * height;
        } else {
          const columns = Math.max(1, Math.floor((parentFrame.width - layout.paddingLeft - layout.paddingRight + layout.spacingX) / Math.max(1, width + layout.spacingX)));
          const column = index % columns;
          const row = Math.floor(index / columns);
          const left = parentFrame.left + layout.paddingLeft + column * (width + layout.spacingX);
          const top = parentFrame.bottom + parentFrame.height - layout.paddingTop - row * (height + layout.spacingY);
          anchorWorldX = left + anchorX * width;
          anchorWorldY = top - (1 - anchorY) * height;
        }
      }
      const widget = items.find((item) => item.parentId === id && item.type === "widget" && isLoadingItemEnabled(item, items));
      if (widget) {
        const edges = widget.widgetEdges ?? { left: true, right: true, top: true, bottom: true };
        const left = widget.left ?? 0;
        const right = widget.right ?? 0;
        const top = widget.top ?? 0;
        const bottom = widget.bottom ?? 0;
        if (edges.left && edges.right) width = Math.max(0, parentFrame.width - left - right);
        if (edges.bottom && edges.top) height = Math.max(0, parentFrame.height - bottom - top);
        if (edges.left) anchorWorldX = parentFrame.left + left + anchorX * width;
        else if (edges.right) anchorWorldX = parentFrame.left + parentFrame.width - right - (1 - anchorX) * width;
        if (edges.bottom) anchorWorldY = parentFrame.bottom + bottom + anchorY * height;
        else if (edges.top) anchorWorldY = parentFrame.bottom + parentFrame.height - top - (1 - anchorY) * height;
      }
      const result = { left: anchorWorldX - anchorX * width, bottom: anchorWorldY - anchorY * height, width, height, anchorX, anchorY, rotation: parentFrame.rotation + (node.rotation ?? 0), scaleX: parentFrame.scaleX * (node.scaleX ?? 1), scaleY: parentFrame.scaleY * (node.scaleY ?? 1), opacity: parentFrame.opacity * (node.opacity ?? 1) };
      frames.set(id, result);
      resolving.delete(id);
      return result;
    };
    for (const item of items) if (!item.isComponent) frameOf(item.id);
    return frames;
  }

  // resources/loading-kit/web/loading-graph-entry.js
  (function(global) {
    "use strict";
    function renderText(node, value) {
      var content = document.createElement("div");
      content.className = "loading-title-content";
      parseLoadingText(value).forEach(function(source) {
        var line = document.createElement("div");
        line.className = "loading-title-line";
        source.runs.forEach(function(run) {
          var span = document.createElement("span");
          span.className = "loading-title-h" + run.level;
          span.textContent = run.text;
          line.appendChild(span);
        });
        content.appendChild(line);
      });
      node.replaceChildren(content);
    }
    function applyTextStyle(node, renderer) {
      var style = resolveLoadingTextVisual(renderer), fonts = { "lilita-one": "HayHay Lilita One", "titan-one": "HayHay Titan One", "bungee": "HayHay Bungee", "baloo-2": "HayHay Baloo 2" };
      node.style.fontFamily = fonts[style.fontFamily] || "system-ui,sans-serif";
      node.style.fontSize = style.fontSize + "px";
      node.style.fontWeight = String(style.fontWeight);
      node.style.fontStyle = style.fontStyle;
      node.style.textDecoration = style.textDecoration;
      node.style.letterSpacing = style.letterSpacing + "px";
      node.style.webkitTextStroke = style.outlineWidth + "px " + style.outlineColor;
      var shadows = [];
      if (style.shadowBlur || style.shadowX || style.shadowY) shadows.push(style.shadowX + "px " + style.shadowY + "px " + style.shadowBlur + "px " + style.shadowColor);
      if (style.glowSize) {
        shadows.push("0 0 " + style.glowSize + "px " + style.glowColor);
        shadows.push("0 0 " + style.glowSize * 0.45 + "px " + style.glowColor);
      }
      node.style.textShadow = shadows.join(",") || "none";
      if (style.fillType === "gradient") {
        node.style.color = "transparent";
        node.style.backgroundImage = "linear-gradient(" + style.gradientAngle + "deg," + style.gradientFrom + "," + style.gradientTo + ")";
        node.style.backgroundClip = "text";
        node.style.webkitBackgroundClip = "text";
        node.style.webkitTextFillColor = "transparent";
      } else {
        node.style.color = style.color;
        node.style.backgroundImage = "";
        node.style.backgroundClip = "";
        node.style.webkitBackgroundClip = "";
        node.style.webkitTextFillColor = "";
      }
    }
    function mount(config) {
      var items = Array.isArray(config.designerComponents) ? config.designerComponents : [];
      if (!items.some(function(item) {
        return item.id === "canvas" && !item.isComponent;
      })) return false;
      var root = document.createElement("div");
      root.id = "cocos-loading-kit";
      if (global.__HAYHAY_LOADING_PREVIEW__) root.className = "is-preview";
      var canvas = items.find(function(item) {
        return item.type === "canvas" && isLoadingItemEnabled(item, items);
      });
      var designWidth = canvas && canvas.designWidth || config.designWidth || 1080, designHeight = canvas && canvas.designHeight || config.designHeight || 1920, frames = resolveLoadingRuntimeFrames(items, designWidth, designHeight), scene = document.createElement("div"), labels = [], fills = [], completed = false;
      scene.className = "cocos-loading-scene";
      scene.style.width = designWidth + "px";
      scene.style.height = designHeight + "px";
      root.appendChild(scene);
      function background() {
        var colors = config.backgroundGradientColors || [config.backgroundGradientFrom || "#10141c", config.backgroundGradientTo || "#3a6ea5"];
        if (config.backgroundColorStyle === "radial-gradient") return "radial-gradient(" + (config.backgroundRadialShape || "circle") + " at " + (config.backgroundGradientCenterX == null ? 50 : config.backgroundGradientCenterX) + "% " + (config.backgroundGradientCenterY == null ? 50 : config.backgroundGradientCenterY) + "%," + colors.join(",") + ")";
        if (config.backgroundColorStyle === "conic-gradient") return "conic-gradient(from " + (config.backgroundGradientAngle || 0) + "deg," + colors.join(",") + ")";
        if (config.backgroundColorStyle === "fill") return config.backgroundColor;
        return "linear-gradient(" + (config.backgroundGradientAngle || 0) + "deg," + colors.join(",") + ")";
      }
      items.filter(function(item) {
        return !item.isComponent && item.id !== "canvas" && isLoadingItemEnabled(item, items);
      }).forEach(function(item) {
        var frame = frames.get(item.id);
        if (!frame) return;
        var node = document.createElement("div");
        node.className = "cocos-loading-runtime-node";
        node.style.left = frame.left + "px";
        node.style.top = designHeight - frame.bottom - frame.height + "px";
        node.style.width = frame.width + "px";
        node.style.height = frame.height + "px";
        node.style.transformOrigin = frame.anchorX * 100 + "% " + (1 - frame.anchorY) * 100 + "%";
        node.style.transform = "rotate(" + -frame.rotation + "deg) scale(" + frame.scaleX + "," + frame.scaleY + ")";
        node.style.opacity = frame.opacity;
        var renderers = items.filter(function(value) {
          return value.parentId === item.id && value.isComponent && isLoadingItemEnabled(value, items);
        });
        if (item.type === "text") renderers.unshift(item);
        renderers.forEach(function(renderer) {
          if (renderer.type === "gradient" || renderer.type === "background") node.style.background = background();
          else if (renderer.type === "image" || renderer.type === "progress-image") {
            var file = renderer.image || (renderer.id === "background-image" ? config.backgroundImage : "");
            if (file) {
              node.classList.add("is-image");
              node.style.backgroundImage = 'url("hayhay-loading/' + file + '")';
            }
          } else if (renderer.type === "text") {
            node.classList.add("is-text");
            var value = renderer.text == null ? renderer.textStyle && renderer.textStyle.logoText || "Text" : renderer.text;
            renderText(node, value);
            applyTextStyle(node, renderer);
            if (renderer.binding === "progress") labels.push({ node, text: value });
          } else if (renderer.type === "progress-html") {
            node.classList.add("is-runtime-progress");
            var style = resolveLoadingProgressVisual(renderer, config.themeColor), track = document.createElement("div"), bar = document.createElement("div");
            track.style.height = style.thickness + "px";
            track.style.background = style.trackColor;
            bar.style.background = style.color;
            track.appendChild(bar);
            node.appendChild(track);
            fills.push(bar);
          }
        });
        scene.appendChild(node);
      });
      var host = global.__HAYHAY_LOADING_PREVIEW__ ? document.getElementById("GameDiv") : document.body;
      (host || document.body).appendChild(root);
      function resize() {
        var scale = Math.min(root.clientWidth / designWidth, root.clientHeight / designHeight) || 1;
        scene.style.transform = "translate(-50%,-50%) scale(" + scale + ")";
      }
      function progress(value) {
        if (completed) return;
        var normalized = Math.max(0, Math.min(1, value)), percent = Math.round(normalized * 100);
        fills.forEach(function(fill) {
          fill.style.width = percent + "%";
        });
        labels.forEach(function(entry) {
          renderText(entry.node, formatLoadingProgressText(entry.text, normalized));
        });
      }
      function complete() {
        progress(1);
        completed = true;
        root.classList.add("is-complete");
        setTimeout(function() {
          if (root.parentNode) root.parentNode.removeChild(root);
        }, 350);
      }
      resize();
      if (global.ResizeObserver) new ResizeObserver(resize).observe(root);
      else global.addEventListener("resize", resize);
      var splash = document.getElementById("splash");
      if (splash) {
        var nativeFill = splash.querySelector(".progress-bar span");
        if (nativeFill) new MutationObserver(function() {
          var width = parseFloat(nativeFill.style.width || "0");
          if (!isNaN(width)) progress(width / 100);
        }).observe(nativeFill, { attributes: true, attributeFilter: ["style"] });
        new MutationObserver(function() {
          if (splash.style.display === "none") complete();
        }).observe(splash, { attributes: true, attributeFilter: ["style", "class"] });
      }
      progress(0);
      global.HayHayLoading = { setProgress: progress, complete };
      return true;
    }
    global.HayHayLoadingGraph = { mount };
  })(window);
})();
