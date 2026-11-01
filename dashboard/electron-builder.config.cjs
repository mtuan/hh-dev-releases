const releaseRepository = process.env.RELEASE_REPOSITORY?.split('/');

module.exports = {
  appId: 'com.hayhay.cocos-build-dashboard',
  productName: 'Cocos Build Dashboard',
  asar: true,
  forceCodeSigning: process.env.CI_RELEASE === 'true',
  directories: { output: 'release' },
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
  files: ['dist/**/*', 'src/**/*', 'resources/loading-kit/web/fonts/**/*', 'package.json'],
  extraResources: [{ from: 'resources', to: 'dashboard-resources' }],
  mac: {
    target: [{ target: 'dmg', arch: ['x64', 'arm64'] }, { target: 'zip', arch: ['x64', 'arm64'] }],
    category: 'public.app-category.developer-tools',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    notarize: process.env.CI_RELEASE === 'true',
  },
  dmg: { sign: true },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    ...(process.env.WINDOWS_PUBLISHER_NAME ? { publisherName: [process.env.WINDOWS_PUBLISHER_NAME] } : {}),
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    deleteAppDataOnUninstall: false,
  },
  ...(releaseRepository?.length === 2 ? { publish: [{ provider: 'github', owner: releaseRepository[0], repo: releaseRepository[1], private: false, channel: process.env.UPDATE_CHANNEL === 'beta' ? 'beta' : 'latest' }] } : {}),
};
