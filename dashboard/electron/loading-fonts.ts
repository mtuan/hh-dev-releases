export const LOADING_TITLE_FONTS = [
    { id: 'system', label: 'System', family: 'system-ui, sans-serif', file: '', weight: 900 },
    { id: 'lilita-one', label: 'Lilita One', family: 'HayHay Lilita One', file: 'LilitaOne-Regular.ttf', weight: 400 },
    { id: 'titan-one', label: 'Titan One', family: 'HayHay Titan One', file: 'TitanOne-Regular.ttf', weight: 400 },
    { id: 'bungee', label: 'Bungee', family: 'HayHay Bungee', file: 'Bungee-Regular.ttf', weight: 400 },
    { id: 'baloo-2', label: 'Baloo 2 ExtraBold', family: 'HayHay Baloo 2', file: 'Baloo2-wght.ttf', weight: 800 },
] as const;

export type LoadingTitleFontId = typeof LOADING_TITLE_FONTS[number]['id'];

export function loadingTitleFont(id: string): typeof LOADING_TITLE_FONTS[number] {
    return LOADING_TITLE_FONTS.find((font) => font.id === id) ?? LOADING_TITLE_FONTS[0];
}
