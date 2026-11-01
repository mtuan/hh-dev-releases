import * as fs from 'node:fs';
import * as path from 'node:path';
import { CreatorFamily, creatorInfo } from './tool-packages';
import { loadingTitleFont } from './loading-fonts';
import { loadingNativeRuntimeSource, loadingRuntimeClassName, loadingRuntimeCoreName } from './loading-native-runtime';

export type LoadingAssetKind = 'background' | 'logo' | 'frame' | 'bar';
export type PlatformLoadingMode = 'inherit' | 'custom' | 'disabled';
export type LoadingDesignerComponentType = 'node' | 'canvas' | 'widget' | 'layout' | 'gradient' | 'loading-progress' | 'background' | 'text' | 'image' | 'progress-html' | 'progress-image';
export interface LoadingDesignerComponent { references?: { progressBarNodeId: string; progressTextNodeId: string }; }
export interface LoadingDesignerComponent { layoutResizeMode?: 'none' | 'container'; }
export interface LoadingDesignerComponent { id: string; parentId?: string; type: LoadingDesignerComponentType; name: string; enabled?: boolean; isComponent?: boolean; coordinateUnit?: 'px'; x: number; y: number; width: number; height?: number; rotation?: number; anchorX?: number; anchorY?: number; scaleX?: number; scaleY?: number; opacity?: number; left?: number; right?: number; top?: number; bottom?: number; widgetEdges?: { left: boolean; right: boolean; top: boolean; bottom: boolean }; layout?: { direction: 'none' | 'horizontal' | 'vertical' | 'grid'; spacingX: number; spacingY: number; paddingLeft: number; paddingRight: number; paddingTop: number; paddingBottom: number }; designWidth?: number; designHeight?: number; text?: string; fontSize?: number; color?: string; textStyle?: Partial<LoadingStyle>; progressStyle?: Partial<LoadingStyle>; image?: string; binding?: 'progress'; }
export interface LoadingStyle {
    mode: 'text' | 'progress-bar';
    themeColor: string;
    textEffect: 'none' | 'shadow' | 'glow';
    progressThickness: number;
    backgroundType: 'image' | 'color';
    backgroundStylePreset: string;
    backgroundThemeId: string;
    backgroundColorStyle: 'fill' | 'linear-gradient' | 'radial-gradient' | 'conic-gradient';
    backgroundColor: string;
    backgroundGradientFrom: string;
    backgroundGradientTo: string;
    backgroundGradientColors: string[];
    backgroundGradientAngle: number;
    backgroundGradientCenterX: number;
    backgroundGradientCenterY: number;
    backgroundRadialShape: 'circle' | 'ellipse';
    backgroundImage?: string;
    logoType: 'image' | 'text';
    logoStylePreset: string;
    logoThemeId: string;
    logoImage?: string;
    logoText: string;
    logoFontFamily: string;
    logoFontSize: number;
    logoFontWeight: 'normal' | 'bold';
    logoFontStyle: 'normal' | 'italic';
    logoTextDecoration: 'none' | 'underline';
    logoColor: string;
    logoEffect: 'none' | 'shadow' | 'glow';
    logoFillType: 'solid' | 'gradient';
    logoGradientFrom: string;
    logoGradientTo: string;
    logoGradientAngle: number;
    logoOutlineColor: string;
    logoOutlineWidth: number;
    logoShadowColor: string;
    logoShadowOffsetX: number;
    logoShadowOffsetY: number;
    logoShadowBlur: number;
    logoGlowColor: string;
    logoGlowSize: number;
    logoLetterSpacing: number;
    logoWarp: 'none' | 'bubble' | 'arc' | 'wave' | 'slant';
    logoPositionX: number;
    logoPositionY: number;
    progressStylePreset: string;
    progressThemeId: string;
    progressFrameImage?: string;
    progressBarImage?: string;
    fontSize: number;
    textColor: string;
    positionX: number;
    positionY: number;
    loadingText: string;
    designerComponents: LoadingDesignerComponent[];
}
export type LoadingStyleOverride = Partial<LoadingStyle>;
export interface LoadingScreenDocument {
    version: 1;
    enabled: boolean;
    defaults: LoadingStyle;
    platformModes: Record<string, PlatformLoadingMode>;
    overrides: Record<string, LoadingStyleOverride>;
}
export interface LoadingScreenView {
    document: LoadingScreenDocument;
    resolved: Record<string, LoadingStyle | null>;
    assetUrls: Record<string, string>;
    designSize: { width: number; height: number };
}

const DEFAULT_STYLE: LoadingStyle = { mode: 'progress-bar', themeColor: '#4b92ff', textEffect: 'shadow', progressThickness: 24, backgroundType: 'color', backgroundStylePreset: 'custom', backgroundThemeId: 'custom', backgroundColorStyle: 'linear-gradient', backgroundColor: '#10141c', backgroundGradientFrom: '#10141c', backgroundGradientTo: '#3a6ea5', backgroundGradientColors: ['#10141c', '#3a6ea5'], backgroundGradientAngle: 180, backgroundGradientCenterX: 50, backgroundGradientCenterY: 50, backgroundRadialShape: 'circle', logoType: 'text', logoStylePreset: 'custom', logoThemeId: 'custom', logoText: 'GAME TITLE', logoFontFamily: 'system', logoFontSize: 72, logoFontWeight: 'bold', logoFontStyle: 'normal', logoTextDecoration: 'none', logoColor: '#ffffff', logoEffect: 'glow', logoFillType: 'solid', logoGradientFrom: '#ffffff', logoGradientTo: '#4b92ff', logoGradientAngle: 180, logoOutlineColor: '#000000', logoOutlineWidth: 0, logoShadowColor: '#000000', logoShadowOffsetX: 0, logoShadowOffsetY: 3, logoShadowBlur: 6, logoGlowColor: '#4b92ff', logoGlowSize: 22, logoLetterSpacing: 0, logoWarp: 'none', logoPositionX: 50, logoPositionY: 24, progressStylePreset: 'custom', progressThemeId: 'custom', fontSize: 18, textColor: '#ffffff', positionX: 50, positionY: 82, loadingText: 'Loading', designerComponents: [] };
const DEFAULT_PROGRESS_TEXT_STYLE: Partial<LoadingStyle> = { logoType: 'text', logoStylePreset: 'custom', logoThemeId: 'custom', logoText: 'Loading', logoFontFamily: 'system', logoFontSize: 48, logoFontWeight: 'bold', logoFontStyle: 'normal', logoTextDecoration: 'none', logoColor: '#ffffff', logoFillType: 'solid', logoGradientFrom: '#ffffff', logoGradientTo: '#4b92ff', logoGradientAngle: 180, logoOutlineColor: '#000000', logoOutlineWidth: 0, logoShadowColor: '#000000', logoShadowOffsetX: 0, logoShadowOffsetY: 3, logoShadowBlur: 6, logoGlowColor: '#4b92ff', logoGlowSize: 0, logoLetterSpacing: 0, logoWarp: 'none' };
const CONFIG_FILE = path.join('.cocos-build-dashboard', 'loading', 'config.json');
const LEGACY_CONFIG_FILE = path.join('loading', 'config.json');
const PREVIEW_MARKER_START = '<!-- hayhay-loading-preview:start -->';
const PREVIEW_MARKER_END = '<!-- hayhay-loading-preview:end -->';

function migrateLegacyTitle(style: Partial<LoadingStyle>): Partial<LoadingStyle> {
    if (style.logoGlowSize !== undefined || style.logoShadowBlur !== undefined || style.logoOutlineWidth !== undefined) return style;
    if (style.logoEffect === 'none') return { ...style, logoShadowOffsetX: 0, logoShadowOffsetY: 0, logoShadowBlur: 0, logoGlowSize: 0 };
    if (style.logoEffect === 'shadow') return { ...style, logoShadowColor: '#000000', logoShadowOffsetX: 0, logoShadowOffsetY: 4, logoShadowBlur: 8, logoGlowSize: 0 };
    return style;
}

function readDocument(projectPath: string): LoadingScreenDocument {
    const file = path.join(projectPath, CONFIG_FILE);
    const legacyFile = path.join(projectPath, LEGACY_CONFIG_FILE);
    if (!fs.existsSync(file) && fs.existsSync(legacyFile)) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.copyFileSync(legacyFile, file); }
    if (!fs.existsSync(file)) return { version: 1, enabled: false, defaults: { ...DEFAULT_STYLE }, platformModes: {}, overrides: {} };
    const saved = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<LoadingScreenDocument>;
    const defaults = normalize({ ...DEFAULT_STYLE, ...migrateLegacyTitle(saved.defaults ?? {}) });
    if (!saved.defaults?.mode && defaults.progressFrameImage && defaults.progressBarImage) defaults.mode = 'progress-bar';
    if (!saved.defaults?.backgroundType && defaults.backgroundImage) defaults.backgroundType = 'image';
    const overrides = Object.fromEntries(Object.entries(saved.overrides ?? {}).map(([platform, style]) => [platform, migrateLegacyTitle(style)]));
    return { version: 1, enabled: saved.enabled ?? false, defaults, platformModes: saved.platformModes ?? {}, overrides };
}

function normalize(style: LoadingStyle): LoadingStyle {
    const gradientColors = (Array.isArray(style.backgroundGradientColors) ? style.backgroundGradientColors : [style.backgroundGradientFrom, style.backgroundGradientTo]).filter((color) => /^#[0-9a-f]{6}$/i.test(color)).slice(0, 3);
    while (gradientColors.length < 2) gradientColors.push(gradientColors.length ? '#3a6ea5' : '#10141c');
    return {
        ...style,
        mode: style.mode === 'progress-bar' ? 'progress-bar' : 'text',
        themeColor: /^#[0-9a-f]{6}$/i.test(style.themeColor) ? style.themeColor : '#4b92ff',
        textEffect: style.textEffect === 'glow' ? 'glow' : style.textEffect === 'none' ? 'none' : 'shadow',
        progressThickness: Math.max(4, Math.min(64, Number(style.progressThickness) || 24)),
        backgroundType: style.backgroundType === 'image' ? 'image' : 'color',
        backgroundStylePreset: style.backgroundStylePreset || 'custom',
        backgroundThemeId: style.backgroundThemeId || 'custom',
        backgroundColorStyle: style.backgroundColorStyle === 'conic-gradient' ? 'conic-gradient' : style.backgroundColorStyle === 'radial-gradient' ? 'radial-gradient' : style.backgroundColorStyle === 'linear-gradient' || (style.backgroundColorStyle as string) === 'gradient' ? 'linear-gradient' : 'fill',
        backgroundColor: /^#[0-9a-f]{6}$/i.test(style.backgroundColor) ? style.backgroundColor : '#10141c',
        backgroundGradientFrom: /^#[0-9a-f]{6}$/i.test(style.backgroundGradientFrom) ? style.backgroundGradientFrom : '#10141c',
        backgroundGradientTo: /^#[0-9a-f]{6}$/i.test(style.backgroundGradientTo) ? style.backgroundGradientTo : '#3a6ea5',
        backgroundGradientColors: gradientColors,
        backgroundGradientAngle: Math.max(0, Math.min(360, Number(style.backgroundGradientAngle) || 0)),
        backgroundGradientCenterX: Math.max(0, Math.min(100, Number.isFinite(Number(style.backgroundGradientCenterX)) ? Number(style.backgroundGradientCenterX) : 50)),
        backgroundGradientCenterY: Math.max(0, Math.min(100, Number.isFinite(Number(style.backgroundGradientCenterY)) ? Number(style.backgroundGradientCenterY) : 50)),
        backgroundRadialShape: style.backgroundRadialShape === 'ellipse' ? 'ellipse' : 'circle',
        logoType: style.logoType === 'image' ? 'image' : 'text',
        logoStylePreset: style.logoStylePreset || 'custom',
        logoThemeId: style.logoThemeId || 'custom',
        logoText: style.logoText?.trim() || 'GAME TITLE',
        logoFontFamily: loadingTitleFont(style.logoFontFamily).id,
        logoFontSize: Math.max(12, Math.min(160, Number(style.logoFontSize) || 72)),
        logoFontWeight: style.logoFontWeight === 'normal' ? 'normal' : 'bold',
        logoFontStyle: style.logoFontStyle === 'italic' ? 'italic' : 'normal',
        logoTextDecoration: style.logoTextDecoration === 'underline' ? 'underline' : 'none',
        logoColor: /^#[0-9a-f]{6}$/i.test(style.logoColor) ? style.logoColor : '#ffffff',
        logoEffect: style.logoEffect === 'glow' ? 'glow' : style.logoEffect === 'none' ? 'none' : 'shadow',
        logoFillType: style.logoFillType === 'gradient' ? 'gradient' : 'solid',
        logoGradientFrom: /^#[0-9a-f]{6}$/i.test(style.logoGradientFrom) ? style.logoGradientFrom : style.logoColor,
        logoGradientTo: /^#[0-9a-f]{6}$/i.test(style.logoGradientTo) ? style.logoGradientTo : style.themeColor,
        logoGradientAngle: Math.max(0, Math.min(360, Number(style.logoGradientAngle) || 0)),
        logoOutlineColor: /^#[0-9a-f]{6}$/i.test(style.logoOutlineColor) ? style.logoOutlineColor : '#000000',
        logoOutlineWidth: Math.max(0, Math.min(12, Number(style.logoOutlineWidth) || 0)),
        logoShadowColor: /^#[0-9a-f]{6}$/i.test(style.logoShadowColor) ? style.logoShadowColor : '#000000',
        logoShadowOffsetX: Math.max(-24, Math.min(24, Number(style.logoShadowOffsetX) || 0)),
        logoShadowOffsetY: Math.max(-24, Math.min(24, Number(style.logoShadowOffsetY) || 0)),
        logoShadowBlur: Math.max(0, Math.min(32, Number(style.logoShadowBlur) || 0)),
        logoGlowColor: /^#[0-9a-f]{6}$/i.test(style.logoGlowColor) ? style.logoGlowColor : style.themeColor,
        logoGlowSize: Math.max(0, Math.min(40, Number(style.logoGlowSize) || 0)),
        logoLetterSpacing: Math.max(-4, Math.min(20, Number(style.logoLetterSpacing) || 0)),
        logoWarp: ['bubble', 'arc', 'wave', 'slant'].includes(style.logoWarp) ? style.logoWarp : 'none',
        logoPositionX: Math.max(0, Math.min(100, Number(style.logoPositionX) || 50)),
        logoPositionY: Math.max(0, Math.min(100, Number(style.logoPositionY) || 24)),
        progressStylePreset: style.progressStylePreset || 'custom',
        progressThemeId: style.progressThemeId || 'custom',
        fontSize: Math.max(8, Math.min(96, Number(style.fontSize) || 18)),
        positionX: Math.max(0, Math.min(100, Number(style.positionX) || 0)),
        positionY: Math.max(0, Math.min(100, Number(style.positionY) || 0)),
        textColor: /^#[0-9a-f]{6}$/i.test(style.textColor) ? style.textColor : '#ffffff',
        loadingText: style.loadingText.trim() || 'Loading',
        designerComponents: (Array.isArray(style.designerComponents) && style.designerComponents.length ? style.designerComponents : [
            { id: 'canvas', type: 'node', name: 'Canvas', x: 50, y: 50, width: 100 },
            { id: 'canvas-component', parentId: 'canvas', type: 'canvas', name: 'Canvas component', isComponent: true, x: 50, y: 50, width: 100, designWidth: 1080, designHeight: 1920 },
            { id: 'background', parentId: 'canvas', type: 'background', name: 'Background', x: 50, y: 50, width: 100 },
            { id: 'title', parentId: 'canvas', type: 'text', name: 'Game title', x: style.logoPositionX, y: style.logoPositionY, width: 78, text: style.logoText, fontSize: style.logoFontSize, color: style.logoColor },
            { id: 'progress', parentId: 'canvas', type: 'node', name: 'Progress', x: 50, y: 82, width: 72 },
            { id: 'progress-bar', parentId: 'progress', type: 'progress-html', name: 'Progress bar', isComponent: true, x: 50, y: 82, width: 72, progressStyle: { mode: 'progress-bar', progressStylePreset: 'custom', progressThemeId: 'custom', themeColor: '#4b92ff', progressThickness: 24, positionX: 50, positionY: 82 } as Partial<LoadingStyle> },
            { id: 'progress-text', parentId: 'progress', type: 'text', name: 'Progress text', isComponent: true, x: 50, y: 87, width: 72, text: 'Loading', textStyle: DEFAULT_PROGRESS_TEXT_STYLE, binding: 'progress' },
        ]).filter((item, _index, items) => String(item.id) !== 'loading-text' || !items.some((candidate) => String(candidate.id) === 'loading-bar')).slice(0, 50).map((item, index) => {
            const legacyType = String(item.type); const legacyId = String(item.id); const id = legacyId === 'loading-bar' || legacyId === 'loading-text' ? 'progress' : legacyId || `component-${index + 1}`;
            return ({
            ...item,
            id,
            parentId: id === 'canvas' ? undefined : 'parentId' in item && item.parentId ? String(item.parentId) : ['background', 'title', 'progress'].includes(id) ? 'canvas' : undefined,
            type: legacyType === 'node' || legacyType === 'canvas' || legacyType === 'widget' || legacyType === 'layout' || legacyType === 'gradient' || legacyType === 'loading-progress' || legacyType === 'background' || legacyType === 'image' || legacyType === 'progress-image' || legacyType === 'progress-html' ? legacyType : legacyType === 'loading-bar' ? 'progress-html' : 'text',
            name: String(item.name || 'Component'), enabled: !('enabled' in item) || item.enabled !== false, isComponent: 'isComponent' in item && item.isComponent === true, x: Math.max(0, Math.min(100, Number(item.x) || 50)), y: Math.max(0, Math.min(100, Number(item.y) || 50)), width: Math.max(0, Math.min(100, Number(item.width) || 40)), height: Math.max(0, Math.min(100, 'height' in item ? Number(item.height) : id === 'canvas' || id === 'background' ? 100 : 20)), rotation: Math.max(-360, Math.min(360, 'rotation' in item ? Number(item.rotation) || 0 : 0)), anchorX: Math.max(0, Math.min(100, 'anchorX' in item ? Number(item.anchorX) : 50)), anchorY: Math.max(0, Math.min(100, 'anchorY' in item ? Number(item.anchorY) : 50)), scaleX: Math.max(-1000, Math.min(1000, 'scaleX' in item ? Number(item.scaleX) : 100)), scaleY: Math.max(-1000, Math.min(1000, 'scaleY' in item ? Number(item.scaleY) : 100)), opacity: Math.max(0, Math.min(100, 'opacity' in item ? Number(item.opacity) : 100)), designWidth: 'designWidth' in item ? Math.max(320, Math.min(7680, Number(item.designWidth) || 1080)) : undefined, designHeight: 'designHeight' in item ? Math.max(320, Math.min(7680, Number(item.designHeight) || 1920)) : undefined,
            text: legacyType.startsWith('progress-') || legacyType === 'loading-bar' ? undefined : String(item.text ?? 'Label'), fontSize: legacyType.startsWith('progress-') || legacyType === 'loading-bar' ? undefined : Math.max(8, Math.min(160, Number(item.fontSize) || 48)), color: legacyType.startsWith('progress-') || legacyType === 'loading-bar' ? undefined : /^#[0-9a-f]{6}$/i.test(item.color ?? '') ? item.color : '#ffffff', textStyle: 'textStyle' in item && item.textStyle && typeof item.textStyle === 'object' ? item.textStyle : id === 'title' ? { logoType: style.logoType, logoStylePreset: style.logoStylePreset, logoThemeId: style.logoThemeId, logoText: style.logoText, logoFontFamily: style.logoFontFamily, logoFontSize: style.logoFontSize, logoFontWeight: style.logoFontWeight, logoFontStyle: style.logoFontStyle, logoTextDecoration: style.logoTextDecoration, logoColor: style.logoColor, logoFillType: style.logoFillType, logoGradientFrom: style.logoGradientFrom, logoGradientTo: style.logoGradientTo, logoGradientAngle: style.logoGradientAngle, logoOutlineColor: style.logoOutlineColor, logoOutlineWidth: style.logoOutlineWidth, logoShadowColor: style.logoShadowColor, logoShadowOffsetX: style.logoShadowOffsetX, logoShadowOffsetY: style.logoShadowOffsetY, logoShadowBlur: style.logoShadowBlur, logoGlowColor: style.logoGlowColor, logoGlowSize: style.logoGlowSize, logoLetterSpacing: style.logoLetterSpacing, logoWarp: style.logoWarp, logoPositionX: style.logoPositionX, logoPositionY: style.logoPositionY } : legacyType.startsWith('progress-') || legacyType === 'loading-bar' ? DEFAULT_PROGRESS_TEXT_STYLE : undefined, progressStyle: legacyType === 'progress-html' || legacyType === 'progress-image' || legacyType === 'loading-bar' ? ('progressStyle' in item && item.progressStyle && typeof item.progressStyle === 'object' ? item.progressStyle : { mode: 'text', progressStylePreset: 'custom', progressThemeId: 'custom', themeColor: '#4b92ff', progressThickness: 24, positionX: 50, positionY: 82 } as Partial<LoadingStyle>) : undefined, image: 'image' in item ? item.image : undefined, binding: 'binding' in item && item.binding === 'progress' ? 'progress' : undefined,
            ...('coordinateUnit' in item && item.coordinateUnit === 'px' ? { coordinateUnit: 'px' as const, x: Number(item.x) || 0, y: Number(item.y) || 0, width: Math.max(0, Number(item.width) || 0), height: Math.max(0, Number(item.height) || 0) } : {}),
        }); }),
    };
}

function writeDocument(projectPath: string, document: LoadingScreenDocument): void {
    const file = path.join(projectPath, CONFIG_FILE);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
}

export function resolveLoadingStyle(document: LoadingScreenDocument, platform: string): LoadingStyle | null {
    const mode = document.platformModes[platform] ?? 'inherit';
    if (mode === 'disabled' || (mode === 'inherit' && !document.enabled)) return null;
    return normalize({ ...document.defaults, ...(mode === 'custom' ? document.overrides[platform] ?? {} : {}) });
}

function assetPath(projectPath: string, relative?: string): string | undefined {
    if (!relative) return undefined;
    const full = path.join(projectPath, 'loading', relative);
    return fs.existsSync(full) ? full : undefined;
}

function fileUrl(file?: string): string {
    return file ? `file://${file.split(path.sep).map(encodeURIComponent).join('/')}` : '';
}

function copyLoadingFonts(resourcesRoot: string, target: string): void {
    const source = path.join(resourcesRoot, 'loading-kit', 'web', 'fonts');
    if (fs.existsSync(source)) fs.cpSync(source, path.join(target, 'fonts'), { recursive: true });
}

function detectDesignSize(projectPath: string): { width: number; height: number } {
    const scenesRoot = path.join(projectPath, 'assets', 'scenes');
    if (fs.existsSync(scenesRoot)) {
        for (const name of fs.readdirSync(scenesRoot)) {
            if (!name.endsWith('.fire')) continue;
            try {
                const records = JSON.parse(fs.readFileSync(path.join(scenesRoot, name), 'utf8')) as Array<{ __type__?: string; _designResolution?: { width?: number; height?: number } }>;
                const resolution = records.find((record) => record.__type__ === 'cc.Canvas')?._designResolution;
                const width = Number(resolution?.width); const height = Number(resolution?.height);
                if (width > 0 && height > 0) return { width, height };
            } catch { /* Ignore malformed or non-JSON scene files and use the fallback. */ }
        }
    }
    return { width: 1080, height: 1920 };
}

export function getLoadingScreen(projectPath: string, platforms: string[]): LoadingScreenView {
    const document = readDocument(projectPath);
    const resolved = Object.fromEntries(platforms.map((platform) => [platform, resolveLoadingStyle(document, platform)]));
    const relatives = new Set<string>();
    [document.defaults, ...Object.values(document.overrides)].forEach((style) => {
        [style.backgroundImage, style.logoImage, style.progressFrameImage, style.progressBarImage].forEach((value) => { if (value) relatives.add(value); });
        style.designerComponents?.forEach((component) => { if (component.image) relatives.add(component.image); });
    });
    return { document, resolved, assetUrls: Object.fromEntries(Array.from(relatives).map((relative) => [relative, fileUrl(assetPath(projectPath, relative))])), designSize: detectDesignSize(projectPath) };
}

export function saveLoadingScreen(projectPath: string, document: LoadingScreenDocument, nativePlatforms: string[], resourcesRoot: string): LoadingScreenView {
    const saved: LoadingScreenDocument = { version: 1, enabled: document.enabled === true, defaults: normalize({ ...DEFAULT_STYLE, ...document.defaults }), platformModes: document.platformModes ?? {}, overrides: document.overrides ?? {} };
    writeDocument(projectPath, saved);
    syncNativeLoading(projectPath, saved, nativePlatforms.filter((platform) => platform === 'android' || platform === 'ios'), resourcesRoot);
    syncPreviewLoading(projectPath, saved, resourcesRoot);
    return getLoadingScreen(projectPath, nativePlatforms);
}

export function setLoadingAsset(projectPath: string, platform: string | null, kind: LoadingAssetKind, source: string): LoadingScreenDocument {
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) throw new Error(`Image does not exist: ${source}`);
    const document = readDocument(projectPath);
    const scope = platform ? path.join('overrides', platform) : 'assets';
    const directory = path.join(projectPath, 'loading', scope);
    fs.mkdirSync(directory, { recursive: true });
    const destination = path.join(directory, `${kind}${path.extname(source).toLowerCase() || '.png'}`);
    for (const name of fs.readdirSync(directory)) if (path.parse(name).name === kind) fs.rmSync(path.join(directory, name), { force: true });
    fs.copyFileSync(source, destination);
    const relative = path.relative(path.join(projectPath, 'loading'), destination).split(path.sep).join('/');
    const target: LoadingStyleOverride = platform ? (document.overrides[platform] ??= {}) : document.defaults;
    if (kind === 'background') target.backgroundImage = relative;
    if (kind === 'logo') target.logoImage = relative;
    if (kind === 'frame') target.progressFrameImage = relative;
    if (kind === 'bar') target.progressBarImage = relative;
    writeDocument(projectPath, document);
    return document;
}

export function clearLoadingAsset(projectPath: string, platform: string | null, kind: LoadingAssetKind): LoadingScreenDocument {
    const document = readDocument(projectPath);
    const target: LoadingStyleOverride = platform ? (document.overrides[platform] ??= {}) : document.defaults;
    if (kind === 'background') delete target.backgroundImage;
    if (kind === 'logo') delete target.logoImage;
    if (kind === 'frame') delete target.progressFrameImage;
    if (kind === 'bar') delete target.progressBarImage;
    writeDocument(projectPath, document);
    return document;
}

export function setLoadingComponentAsset(projectPath: string, platform: string | null, componentId: string, source: string): LoadingScreenDocument {
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) throw new Error(`Image does not exist: ${source}`);
    const document = readDocument(projectPath); const target: LoadingStyleOverride = platform ? (document.overrides[platform] ??= {}) : document.defaults;
    const components = structuredClone(target.designerComponents ?? document.defaults.designerComponents ?? []); let component = components.find((item) => item.id === componentId);
    if (!component) { component = { id: componentId, type: 'image', name: 'Image', x: 50, y: 50, width: 40 }; components.push(component); }
    if (component.type !== 'image') throw new Error(`Component is not an image: ${componentId}`);
    const scope = platform ? path.join('overrides', platform, 'components') : path.join('assets', 'components'); const directory = path.join(projectPath, 'loading', scope); fs.mkdirSync(directory, { recursive: true });
    const safeId = componentId.replace(/[^a-z0-9_-]+/gi, '-'); const destination = path.join(directory, `${safeId}${path.extname(source).toLowerCase() || '.png'}`); fs.copyFileSync(source, destination);
    component.image = path.relative(path.join(projectPath, 'loading'), destination).split(path.sep).join('/'); target.designerComponents = components; writeDocument(projectPath, document); return document;
}

function syncNativeLoading(projectPath: string, document: LoadingScreenDocument, platforms: string[], resourcesRoot: string): void {
    if (!platforms.length) return;
    const family = creatorInfo(projectPath).family;
    for (const platform of platforms) {
        const config = resolveLoadingStyle(document, platform);
        const root = path.join(projectPath, 'assets', 'resources', 'hayhay-loading', platform);
        if (!config) { fs.rmSync(root, { recursive: true, force: true }); continue; }
        fs.mkdirSync(root, { recursive: true });
        for (const legacy of ['HayHayLoadingScreen.ts', 'HayHayLoadingScreen.ts.meta']) fs.rmSync(path.join(root, legacy), { force: true });
        const runtimeName = loadingRuntimeClassName(platform);
        fs.writeFileSync(path.join(root, 'config.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
        fs.copyFileSync(path.join(resourcesRoot, 'loading-kit', 'runtime', 'loading-runtime-core.ts'), path.join(root, `${loadingRuntimeCoreName(platform)}.ts`));
        fs.writeFileSync(path.join(root, `${runtimeName}.ts`), loadingNativeRuntimeSource(family, config, platform), 'utf8');
        fs.writeFileSync(path.join(root, 'README.md'), `Managed by HayHay Tools. Add ${runtimeName} to the Canvas in the project loading scene and call setProgress(0..1) while game assets load. Re-save the Loading screen page after changing shared or platform settings.\n`, 'utf8');
        for (const relative of [config.backgroundImage, config.logoImage, config.progressFrameImage, config.progressBarImage].filter(Boolean) as string[]) {
            const source = assetPath(projectPath, relative);
            if (source) fs.copyFileSync(source, path.join(root, path.basename(source)));
        }
        for (const component of config.designerComponents) if (component.image) { const source = assetPath(projectPath, component.image); if (source) fs.copyFileSync(source, path.join(root, path.basename(source))); }
    }
}

function syncPreviewLoading(projectPath: string, document: LoadingScreenDocument, resourcesRoot: string): void {
    if (creatorInfo(projectPath).family !== '2.x') return;
    const indexFile = path.join(projectPath, 'preview-templates', 'index.html');
    if (!fs.existsSync(indexFile)) return;
    const target = path.join(projectPath, 'preview-templates', 'hayhay-loading');
    let html = fs.readFileSync(indexFile, 'utf8');
    html = html.replace(new RegExp(`${PREVIEW_MARKER_START}[\\s\\S]*?${PREVIEW_MARKER_END}\\s*`, 'g'), '');
    if (!document.enabled) {
        fs.rmSync(target, { recursive: true, force: true });
        fs.writeFileSync(indexFile, html, 'utf8');
        return;
    }

    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(path.join(resourcesRoot, 'loading-kit', 'web', 'loading.css'), path.join(target, 'loading.css'));
    fs.copyFileSync(path.join(resourcesRoot, 'loading-kit', 'web', 'loading-graph.js'), path.join(target, 'loading-graph.js'));
    fs.copyFileSync(path.join(resourcesRoot, 'loading-kit', 'web', 'loading.js'), path.join(target, 'loading.js'));
    copyLoadingFonts(resourcesRoot, target);
    const exported = { ...normalize(document.defaults), designWidth: detectDesignSize(projectPath).width, designHeight: detectDesignSize(projectPath).height };
    for (const key of ['backgroundImage', 'logoImage', 'progressFrameImage', 'progressBarImage'] as const) {
        const source = assetPath(projectPath, exported[key]);
        if (source) {
            const name = path.basename(source);
            fs.copyFileSync(source, path.join(target, name));
            exported[key] = name;
        } else {
            delete exported[key];
        }
    }
    exported.designerComponents = exported.designerComponents.map((component) => { if (!component.image) return component; const source = assetPath(projectPath, component.image); if (!source) return { ...component, image: undefined }; const name = path.basename(source); fs.copyFileSync(source, path.join(target, name)); return { ...component, image: name }; });
    fs.writeFileSync(path.join(target, 'config.json'), JSON.stringify(exported), 'utf8');
    if (!/<\/head>/i.test(html)) throw new Error(`Could not install the loading screen into ${indexFile}: closing head tag not found.`);
    const markup = `${PREVIEW_MARKER_START}\n<link rel="stylesheet" href="hayhay-loading/loading.css">\n<script>window.__HAYHAY_LOADING_PREVIEW__=true;window.__HAYHAY_LOADING_CONFIG_URL__='hayhay-loading/config.json';</script>\n<script defer src="hayhay-loading/loading-graph.js"></script>\n<script defer src="hayhay-loading/loading.js"></script>\n${PREVIEW_MARKER_END}`;
    fs.writeFileSync(indexFile, html.replace(/<\/head>/i, `${markup}\n</head>`), 'utf8');
}

export function applyWebLoadingScreen(projectPath: string, platform: string, output: string, resourcesRoot: string): void {
    const htmlFile = path.join(output, 'index.html');
    if ((platform === 'android' || platform === 'ios') || !fs.existsSync(htmlFile)) return;
    const document = readDocument(projectPath); const config = resolveLoadingStyle(document, platform);
    const target = path.join(output, 'hayhay-loading');
    if (!config) {
        fs.rmSync(target, { recursive: true, force: true });
        const current = fs.readFileSync(htmlFile, 'utf8');
        const cleaned = current
            .replace(/\s*<link rel="stylesheet" href="hayhay-loading\/loading\.css">/g, '')
            .replace(/\s*<script>window\.__HAYHAY_LOADING_CONFIG_URL__="hayhay-loading\/config\.json";<\/script>/g, '')
            .replace(/\s*<script defer src="hayhay-loading\/loading-graph\.js"><\/script>/g, '')
            .replace(/\s*<script defer src="hayhay-loading\/loading\.js"><\/script>/g, '');
        if (cleaned !== current) fs.writeFileSync(htmlFile, cleaned, 'utf8');
        return;
    }
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(path.join(resourcesRoot, 'loading-kit', 'web', 'loading.css'), path.join(target, 'loading.css'));
    fs.copyFileSync(path.join(resourcesRoot, 'loading-kit', 'web', 'loading-graph.js'), path.join(target, 'loading-graph.js'));
    fs.copyFileSync(path.join(resourcesRoot, 'loading-kit', 'web', 'loading.js'), path.join(target, 'loading.js'));
    copyLoadingFonts(resourcesRoot, target);
    const designSize = detectDesignSize(projectPath);
    const exported = { ...config, designWidth: designSize.width, designHeight: designSize.height } as LoadingStyle & { designWidth: number; designHeight: number };
    for (const key of ['backgroundImage', 'logoImage', 'progressFrameImage', 'progressBarImage'] as const) {
        const relative = exported[key]; const source = assetPath(projectPath, relative);
        if (source) { fs.copyFileSync(source, path.join(target, path.basename(source))); exported[key] = path.basename(source); }
    }
    exported.designerComponents = exported.designerComponents.map((component) => { if (!component.image) return component; const source = assetPath(projectPath, component.image); if (!source) return { ...component, image: undefined }; const name = path.basename(source); fs.copyFileSync(source, path.join(target, name)); return { ...component, image: name }; });
    fs.writeFileSync(path.join(target, 'config.json'), JSON.stringify(exported), 'utf8');
    let html = fs.readFileSync(htmlFile, 'utf8');
    const markup = '<link rel="stylesheet" href="hayhay-loading/loading.css"><script>window.__HAYHAY_LOADING_CONFIG_URL__="hayhay-loading/config.json";</script><script defer src="hayhay-loading/loading-graph.js"></script><script defer src="hayhay-loading/loading.js"></script>';
    if (!html.includes('hayhay-loading/loading.js')) html = html.replace(/<\/head>/i, `${markup}\n</head>`);
    else if (!html.includes('hayhay-loading/loading-graph.js')) html = html.replace('<script defer src="hayhay-loading/loading.js"></script>', '<script defer src="hayhay-loading/loading-graph.js"></script><script defer src="hayhay-loading/loading.js"></script>');
    fs.writeFileSync(htmlFile, html, 'utf8');
}

/** Materialize the production web loading runtime as a standalone browser preview. */
export function createLoadingWebPreview(projectPath: string, platform: string | null, target: string, resourcesRoot: string, initialProgress: number): void {
    const document = readDocument(projectPath); const config = platform ? resolveLoadingStyle(document, platform) : normalize(document.defaults);
    if (!config) throw new Error('The loading screen is disabled for this scope.');
    fs.rmSync(target, { recursive: true, force: true }); fs.mkdirSync(target, { recursive: true });
    const runtime = path.join(target, 'hayhay-loading'); fs.mkdirSync(runtime, { recursive: true });
    fs.copyFileSync(path.join(resourcesRoot, 'loading-kit', 'web', 'loading.css'), path.join(runtime, 'loading.css'));
    fs.copyFileSync(path.join(resourcesRoot, 'loading-kit', 'web', 'loading-graph.js'), path.join(runtime, 'loading-graph.js'));
    fs.copyFileSync(path.join(resourcesRoot, 'loading-kit', 'web', 'loading.js'), path.join(runtime, 'loading.js')); copyLoadingFonts(resourcesRoot, runtime);
    const designSize = detectDesignSize(projectPath); const exported = { ...config, designWidth: designSize.width, designHeight: designSize.height } as LoadingStyle & { designWidth: number; designHeight: number };
    for (const key of ['backgroundImage', 'logoImage', 'progressFrameImage', 'progressBarImage'] as const) { const source = assetPath(projectPath, exported[key]); if (source) { const name = path.basename(source); fs.copyFileSync(source, path.join(runtime, name)); exported[key] = name; } else delete exported[key]; }
    exported.designerComponents = exported.designerComponents.map((component) => { if (!component.image) return component; const source = assetPath(projectPath, component.image); if (!source) return { ...component, image: undefined }; const name = path.basename(source); fs.copyFileSync(source, path.join(runtime, name)); return { ...component, image: name }; });
    fs.writeFileSync(path.join(runtime, 'config.json'), JSON.stringify(exported), 'utf8');
    const progress = Math.max(0, Math.min(100, Number(initialProgress) || 0)) / 100;
    fs.writeFileSync(path.join(target, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Loading screen preview</title><link rel="stylesheet" href="hayhay-loading/loading.css"><script>window.__HAYHAY_LOADING_CONFIG_URL__='hayhay-loading/config.json';</script><script defer src="hayhay-loading/loading-graph.js"></script><script defer src="hayhay-loading/loading.js"></script><script>document.addEventListener('DOMContentLoaded',function(){var timer=setInterval(function(){if(window.HayHayLoading){clearInterval(timer);window.HayHayLoading.setProgress(${progress});}},20);setTimeout(function(){clearInterval(timer);},5000);});</script></head><body></body></html>`, 'utf8');
}
