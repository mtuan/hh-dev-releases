import type { LoadingDesignerComponent, LoadingStyle } from '../../electron/types';
import { loadingTitleFont } from '../../electron/loading-fonts';
import { LOADING_PAGE_PRESETS } from './loading-presets';
import { parseLoadingText, resolveLoadingTextVisual } from '../../resources/loading-kit/runtime/loading-runtime-core';

export interface LoadingTitlePreset {
    id: string;
    name: string;
    themeId: string;
    text: string;
    style: Partial<LoadingStyle>;
}

export const LOADING_TITLE_PRESETS: LoadingTitlePreset[] = LOADING_PAGE_PRESETS.map((preset) => ({ id: preset.id, name: preset.name, themeId: preset.themeId, text: preset.title.logoText ?? 'GAME TITLE', style: preset.title }));

export function renderLoadingTitle(element: HTMLElement, source: string): HTMLElement {
    const content = document.createElement('div'); content.className = 'loading-title-content';
    for (const sourceLine of parseLoadingText(source || 'GAME TITLE')) {
        const line = document.createElement('div'); line.className = 'loading-title-line';
        for (const run of sourceLine.runs) { const span = document.createElement('span'); span.className = `loading-title-h${run.level}`; span.textContent = run.text; line.appendChild(span); }
        content.appendChild(line);
    }
    element.replaceChildren(content); return content;
}

export function applyTextComponentStyle(element: HTMLElement, component: LoadingDesignerComponent, scale = 1): void {
    const style = resolveLoadingTextVisual(component); const font = loadingTitleFont(style.fontFamily); element.style.fontFamily = font.family; element.style.fontSize = `${style.fontSize * scale}px`; element.style.fontWeight = String(style.fontWeight); element.style.fontStyle = style.fontStyle; element.style.textDecoration = style.textDecoration;
    const gradient = `linear-gradient(${style.gradientAngle}deg,${style.gradientFrom},${style.gradientTo})`;
    element.style.color = style.fillType === 'gradient' ? 'transparent' : style.color;
    element.style.backgroundImage = style.fillType === 'gradient' ? gradient : '';
    element.style.backgroundClip = style.fillType === 'gradient' ? 'text' : '';
    element.style.setProperty('-webkit-background-clip', style.fillType === 'gradient' ? 'text' : '');
    element.style.setProperty('-webkit-text-fill-color', style.fillType === 'gradient' ? 'transparent' : '');
    element.style.setProperty('-webkit-text-stroke', `${style.outlineWidth * scale}px ${style.outlineColor}`);
    const shadows: string[] = [];
    if (style.shadowBlur || style.shadowX || style.shadowY) shadows.push(`${style.shadowX * scale}px ${style.shadowY * scale}px ${style.shadowBlur * scale}px ${style.shadowColor}`);
    if (style.glowSize) shadows.push(`0 0 ${style.glowSize * scale}px ${style.glowColor}`, `0 0 ${style.glowSize * .45 * scale}px ${style.glowColor}`);
    element.style.textShadow = shadows.length ? shadows.join(',') : 'none';
    element.style.letterSpacing = `${style.letterSpacing * scale}px`;
    const warp = style.warp === 'bubble' ? 'translate(-50%,-50%) scaleX(1.08) scaleY(1.18)' : style.warp === 'arc' ? 'translate(-50%,-50%) perspective(500px) rotateX(-12deg) scaleX(1.08)' : style.warp === 'wave' ? 'translate(-50%,-50%) rotate(-2deg) skewX(-5deg)' : style.warp === 'slant' ? 'translate(-50%,-50%) skewX(-10deg) scaleX(1.06)' : 'translate(-50%,-50%)';
    element.style.transform = warp;
}
