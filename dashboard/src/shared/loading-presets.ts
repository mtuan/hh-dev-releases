import type { LoadingStyle } from '../../electron/types';

export interface LoadingTheme { id: string; name: string; colors: Pick<LoadingStyle, 'themeColor' | 'backgroundType' | 'backgroundColorStyle' | 'backgroundGradientFrom' | 'backgroundGradientTo' | 'backgroundGradientAngle' | 'logoColor' | 'logoEffect' | 'textColor' | 'textEffect'>; }

export const LOADING_THEMES: LoadingTheme[] = [
    { id: 'electric-violet', name: 'Neon Nova', colors: { themeColor: '#9b5cff', backgroundType: 'color', backgroundColorStyle: 'radial-gradient', backgroundGradientFrom: '#8a35ff', backgroundGradientTo: '#17003d', backgroundGradientAngle: 135, logoColor: '#fff4ff', logoEffect: 'glow', textColor: '#ffffff', textEffect: 'glow' } },
    { id: 'arctic-pulse', name: 'Ice Beam', colors: { themeColor: '#00eaff', backgroundType: 'color', backgroundColorStyle: 'linear-gradient', backgroundGradientFrom: '#00b8ff', backgroundGradientTo: '#002a78', backgroundGradientAngle: 155, logoColor: '#f2ffff', logoEffect: 'glow', textColor: '#f2ffff', textEffect: 'glow' } },
    { id: 'coral-sunset', name: 'Fireball', colors: { themeColor: '#ff3d5a', backgroundType: 'color', backgroundColorStyle: 'radial-gradient', backgroundGradientFrom: '#ff8a00', backgroundGradientTo: '#9d004f', backgroundGradientAngle: 125, logoColor: '#fff4b8', logoEffect: 'shadow', textColor: '#fff8e8', textEffect: 'glow' } },
    { id: 'emerald-night', name: 'Slime Rush', colors: { themeColor: '#39ff88', backgroundType: 'color', backgroundColorStyle: 'linear-gradient', backgroundGradientFrom: '#00d66f', backgroundGradientTo: '#004f3a', backgroundGradientAngle: 140, logoColor: '#eaff77', logoEffect: 'glow', textColor: '#effff4', textEffect: 'glow' } },
    { id: 'golden-hour', name: 'Coin Rush', colors: { themeColor: '#ffd43b', backgroundType: 'color', backgroundColorStyle: 'radial-gradient', backgroundGradientFrom: '#ffd93d', backgroundGradientTo: '#ff5a00', backgroundGradientAngle: 120, logoColor: '#fff7b0', logoEffect: 'shadow', textColor: '#fffdf0', textEffect: 'glow' } },
    { id: 'bubblegum-pop', name: 'Candy Burst', colors: { themeColor: '#ff3dd1', backgroundType: 'color', backgroundColorStyle: 'linear-gradient', backgroundGradientFrom: '#ff5fcf', backgroundGradientTo: '#7038ff', backgroundGradientAngle: 145, logoColor: '#fff06b', logoEffect: 'glow', textColor: '#fff5fd', textEffect: 'glow' } },
    { id: 'clean-slate', name: 'Hyper Blue', colors: { themeColor: '#2f9bff', backgroundType: 'color', backgroundColorStyle: 'linear-gradient', backgroundGradientFrom: '#00c6ff', backgroundGradientTo: '#1748ff', backgroundGradientAngle: 160, logoColor: '#ffffff', logoEffect: 'shadow', textColor: '#ffffff', textEffect: 'glow' } },
];

export interface LoadingPagePreset {
    id: string;
    name: string;
    themeId: string;
    background: Partial<LoadingStyle>;
    title: Partial<LoadingStyle>;
    progress: Partial<LoadingStyle>;
    progressText: Partial<LoadingStyle>;
}

function pagePreset(id: string, name: string, themeId: string, title: Partial<LoadingStyle>, progressLabel = 'Loading'): LoadingPagePreset {
    const theme = LOADING_THEMES.find((item) => item.id === themeId)!; const colors = theme.colors;
    return {
        id, name, themeId,
        background: { backgroundType: 'color', backgroundStylePreset: id, backgroundThemeId: themeId, backgroundColorStyle: colors.backgroundColorStyle, backgroundGradientFrom: colors.backgroundGradientFrom, backgroundGradientTo: colors.backgroundGradientTo, backgroundGradientColors: [colors.backgroundGradientFrom, colors.backgroundGradientTo], backgroundGradientAngle: colors.backgroundGradientAngle, backgroundGradientCenterX: 50, backgroundGradientCenterY: 42, backgroundRadialShape: 'circle' },
        title: { logoType: 'text', logoStylePreset: id, logoThemeId: themeId, logoColor: colors.logoColor, ...title },
        progress: { mode: 'text', progressStylePreset: id, progressThemeId: themeId, themeColor: colors.themeColor, positionX: 50, positionY: 82 },
        progressText: { logoType: 'text', logoStylePreset: id, logoThemeId: themeId, logoText: progressLabel, logoFontFamily: title.logoFontFamily ?? 'system', logoFontSize: 34, logoFontWeight: 'bold', logoFontStyle: 'normal', logoTextDecoration: 'none', logoColor: colors.textColor, logoFillType: 'solid', logoOutlineColor: title.logoShadowColor ?? '#000000', logoOutlineWidth: 1, logoShadowColor: title.logoShadowColor ?? '#000000', logoShadowOffsetX: 0, logoShadowOffsetY: 3, logoShadowBlur: 4, logoGlowColor: colors.themeColor, logoGlowSize: colors.textEffect === 'glow' ? 8 : 0, logoLetterSpacing: 1, logoWarp: 'none' },
    };
}

export const LOADING_PAGE_PRESETS: LoadingPagePreset[] = [
    pagePreset('bubble-hero', 'Bubble Hero', 'electric-violet', { logoText: '### SHOOT BUBBLES\n# BOUNCING BALLS', logoFontFamily: 'titan-one', logoFontSize: 82, logoFontWeight: 'bold', logoFontStyle: 'normal', logoTextDecoration: 'none', logoFillType: 'solid', logoOutlineColor: '#8b36ff', logoOutlineWidth: 4, logoShadowColor: '#32106f', logoShadowOffsetX: 0, logoShadowOffsetY: 6, logoShadowBlur: 2, logoGlowColor: '#a84fff', logoGlowSize: 14, logoLetterSpacing: 1, logoWarp: 'none', logoPositionX: 50, logoPositionY: 24 }, 'Loading bubbles'),
    pagePreset('candy-stack', 'Candy Stack', 'bubblegum-pop', { logoText: '#### SWEET AND SHINY\n# CANDY POP', logoFontFamily: 'lilita-one', logoFontSize: 86, logoFontWeight: 'bold', logoFontStyle: 'normal', logoTextDecoration: 'none', logoFillType: 'solid', logoOutlineColor: '#ff3dd1', logoOutlineWidth: 5, logoShadowColor: '#68105d', logoShadowOffsetX: 0, logoShadowOffsetY: 7, logoShadowBlur: 2, logoGlowColor: '#ff6bdd', logoGlowSize: 13, logoLetterSpacing: 1, logoWarp: 'bubble', logoPositionX: 50, logoPositionY: 24 }, 'Mixing candy'),
    pagePreset('ocean-quest', 'Ocean Quest', 'arctic-pulse', { logoText: '### DIVE INTO THE\n# OCEAN QUEST', logoFontFamily: 'baloo-2', logoFontSize: 84, logoFontWeight: 'bold', logoFontStyle: 'normal', logoTextDecoration: 'none', logoFillType: 'solid', logoOutlineColor: '#00b8ff', logoOutlineWidth: 5, logoShadowColor: '#003678', logoShadowOffsetX: 0, logoShadowOffsetY: 6, logoShadowBlur: 3, logoGlowColor: '#00eaff', logoGlowSize: 14, logoLetterSpacing: 1, logoWarp: 'wave', logoPositionX: 50, logoPositionY: 24 }, 'Diving in'),
    pagePreset('lava-rush', 'Lava Rush', 'coral-sunset', { logoText: '# LAVA RUSH', logoFontFamily: 'lilita-one', logoFontSize: 94, logoFontWeight: 'bold', logoFontStyle: 'normal', logoTextDecoration: 'none', logoFillType: 'solid', logoOutlineColor: '#ff3d5a', logoOutlineWidth: 6, logoShadowColor: '#5b0900', logoShadowOffsetX: 2, logoShadowOffsetY: 8, logoShadowBlur: 2, logoGlowColor: '#ff5a1f', logoGlowSize: 14, logoLetterSpacing: 0, logoWarp: 'slant', logoPositionX: 50, logoPositionY: 25 }, 'Heating up'),
    pagePreset('friendly-fun', 'Friendly Fun', 'emerald-night', { logoText: '### PLAY WITH\n# FRIENDS', logoFontFamily: 'baloo-2', logoFontSize: 82, logoFontWeight: 'bold', logoFontStyle: 'normal', logoTextDecoration: 'none', logoFillType: 'solid', logoOutlineColor: '#39c96b', logoOutlineWidth: 5, logoShadowColor: '#14532d', logoShadowOffsetX: 0, logoShadowOffsetY: 6, logoShadowBlur: 3, logoGlowColor: '#39ff88', logoGlowSize: 10, logoLetterSpacing: 1, logoWarp: 'none', logoPositionX: 50, logoPositionY: 24 }, 'Finding friends'),
    pagePreset('hyper-drive', 'Hyper Drive', 'clean-slate', { logoText: '# HYPER DRIVE', logoFontFamily: 'bungee', logoFontSize: 78, logoFontWeight: 'bold', logoFontStyle: 'italic', logoTextDecoration: 'none', logoFillType: 'solid', logoOutlineColor: '#1748ff', logoOutlineWidth: 4, logoShadowColor: '#00115e', logoShadowOffsetX: 3, logoShadowOffsetY: 7, logoShadowBlur: 2, logoGlowColor: '#00c6ff', logoGlowSize: 18, logoLetterSpacing: 3, logoWarp: 'slant', logoPositionX: 50, logoPositionY: 25 }, 'Starting engines'),
];
