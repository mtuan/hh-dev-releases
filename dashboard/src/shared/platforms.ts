interface PlatformPresentation {
    name: string;
    description: string;
}

const PLATFORM_PRESENTATION: Record<string, PlatformPresentation> = {
    'fb-instant-games': {
        name: 'Facebook Instant Games',
        description: 'Web game builds for Facebook Instant Games hosting.',
    },
    android: {
        name: 'Android',
        description: 'Native Android builds for devices, testing tracks, and Google Play.',
    },
    ios: {
        name: 'iOS',
        description: 'Native iOS builds for devices, TestFlight, and the App Store.',
    },
    'bytedance-mini-game': {
        name: 'TikTok / ByteDance Mini Game',
        description: 'Mini game builds for TikTok and ByteDance distribution.',
    },
    'web-mobile': {
        name: 'Mobile Web',
        description: 'Browser builds optimized for phones and tablets.',
    },
    'web-desktop': {
        name: 'Desktop Web',
        description: 'Browser builds optimized for desktop displays.',
    },
    mac: {
        name: 'macOS',
        description: 'Native macOS builds for local testing and distribution.',
    },
};

export const SUPPORTED_PLATFORMS = Object.keys(PLATFORM_PRESENTATION);

function titleCaseIdentifier(value: string): string {
    return value.split(/[-_]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

export function platformName(platform: string): string {
    return PLATFORM_PRESENTATION[platform]?.name ?? titleCaseIdentifier(platform);
}

export function platformDescription(platform: string): string {
    return PLATFORM_PRESENTATION[platform]?.description ?? 'Build and distribution settings for this platform.';
}
