const releaseRepository = process.env.RELEASE_REPOSITORY?.split('/');

module.exports = {
  appId: 'com.hayhay.cocos-build-dashboard',
  productName: 'HayHay Dev Tools',
  copyright: 'Copyright © 2026 HayHay',
  asar: true,
  forceCodeSigning: process.env.CI_RELEASE === 'true',
  directories: { output: 'release', buildResources: 'resources/app-icon' },
  artifactName: 'HayHay-Dev-Tools-${version}-${os}-${arch}.${ext}',
  files: ['dist/**/*', 'src/**/*', 'resources/loading-kit/web/fonts/**/*', 'package.json'],
  extraResources: [{ from: 'resources', to: 'dashboard-resources' }],
  mac: {
    icon: 'resources/app-icon/icon.icns',
    target: [{ target: 'dmg', arch: ['x64', 'arm64'] }, { target: 'zip', arch: ['x64', 'arm64'] }],
    category: 'public.app-category.developer-tools',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    notarize: process.env.CI_RELEASE === 'true',
    extendInfo: {
      CFBundleName: 'HayHay Dev Tools',
      CFBundleDisplayName: 'HayHay Dev Tools',
      NSHumanReadableCopyright: 'Copyright © 2026 HayHay',
    },
  },
  dmg: { sign: true },
  win: {
    icon: 'resources/app-icon/icon.ico',
    target: [{ target: 'nsis', arch: ['x64'] }],
    legalTrademarks: 'HayHay',
    ...(process.env.WINDOWS_PUBLISHER_NAME ? { publisherName: [process.env.WINDOWS_PUBLISHER_NAME] } : {}),
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'HayHay Dev Tools',
    uninstallDisplayName: 'HayHay Dev Tools',
    deleteAppDataOnUninstall: false,
  },
  ...(releaseRepository?.length === 2 ? { publish: [{ provider: 'github', owner: releaseRepository[0], repo: releaseRepository[1], private: false, channel: process.env.UPDATE_CHANNEL === 'beta' ? 'beta' : 'latest' }] } : {}),
};
