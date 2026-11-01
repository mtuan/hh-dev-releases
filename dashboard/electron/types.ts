export interface BuildProfile {
    id: string;
    label: string;
    platform: string;
    debug: boolean;
    buildPath: string;
    packageName?: string;
    environment?: string;
    iosTeamId?: string;
    iosApiKeyId?: string;
    iosApiIssuerId?: string;
    iosApiKeyPath?: string;
    androidKeystorePath?: string;
    androidKeystorePassword?: string;
    androidKeyAlias?: string;
    androidKeyPassword?: string;
    androidPlayServiceAccountPath?: string;
    androidPlayTrack?: string;
    facebookAppId?: string;
    facebookAppAccessToken?: string;
    facebookBusinessId?: string;
}

export interface FacebookConsoleRequest {
    id: string;
    method: string;
    host: string;
    path: string;
    resourceType: string;
    statusCode?: number;
    startedAt: string;
    durationMs?: number;
}

export interface FacebookConsoleStatus {
    persistent: boolean;
    signedIn: boolean;
    accountId?: string;
    browserOpen: boolean;
    appId?: string;
    businessId?: string;
    requestCount: number;
}

export interface FacebookConsoleBrowserBounds { x: number; y: number; width: number; height: number; }
export interface FacebookConsoleBrowserState { url: string; title: string; canGoBack: boolean; canGoForward: boolean; loading: boolean; }
export type FacebookConsoleBrowserAction = 'back' | 'forward' | 'reload' | 'home';
export interface FacebookConsoleAssetFile { fileName: string; label: string; sourceUrl: string; previewUrl: string; status: 'extracted'; sourceKind: 'original' | 'video' | 'preview' | 'background'; width: number; height: number; validationStatus: 'valid' | 'corrupt'; validationMessage?: string; }
export interface FacebookConsoleAssetExtraction { directory: string; files: FacebookConsoleAssetFile[]; skipped: number; }

export interface IosDevice { id: string; name: string; model: string; }
export type IosDeployTarget = 'device' | 'simulator' | 'testflight';
export interface IosDeployRequest { projectId: string; profileId: string; target: IosDeployTarget; deviceId?: string; taskId: string; }
export interface AndroidDevice { id: string; name: string; model: string; }
export type AndroidDeployTarget = 'device' | 'simulator' | 'google-play';
export interface AndroidDeployRequest { projectId: string; profileId: string; target: AndroidDeployTarget; deviceId?: string; taskId: string; }
export interface FacebookDeployRequest { projectId: string; profileId: string; taskId: string; }
export type LoadingMode = 'text' | 'progress-bar';
export type LoadingDesignerComponentType = 'node' | 'canvas' | 'widget' | 'layout' | 'gradient' | 'loading-progress' | 'background' | 'text' | 'image' | 'progress-html' | 'progress-image';
export interface LoadingDesignerComponent { references?: { progressBarNodeId: string; progressTextNodeId: string }; }
export interface LoadingDesignerComponent { layoutResizeMode?: 'none' | 'container'; }
export interface LoadingDesignerComponent { id: string; parentId?: string; type: LoadingDesignerComponentType; name: string; enabled?: boolean; isComponent?: boolean; coordinateUnit?: 'px'; x: number; y: number; width: number; height?: number; rotation?: number; anchorX?: number; anchorY?: number; scaleX?: number; scaleY?: number; opacity?: number; left?: number; right?: number; top?: number; bottom?: number; widgetEdges?: { left: boolean; right: boolean; top: boolean; bottom: boolean }; layout?: { direction: 'none' | 'horizontal' | 'vertical' | 'grid'; spacingX: number; spacingY: number; paddingLeft: number; paddingRight: number; paddingTop: number; paddingBottom: number }; designWidth?: number; designHeight?: number; text?: string; fontSize?: number; color?: string; textStyle?: Partial<LoadingStyle>; progressStyle?: Partial<LoadingStyle>; image?: string; binding?: 'progress'; }
export interface LoadingStyle { mode: LoadingMode; themeColor: string; textEffect: 'none' | 'shadow' | 'glow'; progressThickness: number; backgroundType: 'image' | 'color'; backgroundStylePreset: string; backgroundThemeId: string; backgroundColorStyle: 'fill' | 'linear-gradient' | 'radial-gradient' | 'conic-gradient'; backgroundColor: string; backgroundGradientFrom: string; backgroundGradientTo: string; backgroundGradientColors: string[]; backgroundGradientAngle: number; backgroundGradientCenterX: number; backgroundGradientCenterY: number; backgroundRadialShape: 'circle' | 'ellipse'; backgroundImage?: string; logoType: 'image' | 'text'; logoStylePreset: string; logoThemeId: string; logoImage?: string; logoText: string; logoFontFamily: string; logoFontSize: number; logoFontWeight: 'normal' | 'bold'; logoFontStyle: 'normal' | 'italic'; logoTextDecoration: 'none' | 'underline'; logoColor: string; logoEffect: 'none' | 'shadow' | 'glow'; logoFillType: 'solid' | 'gradient'; logoGradientFrom: string; logoGradientTo: string; logoGradientAngle: number; logoOutlineColor: string; logoOutlineWidth: number; logoShadowColor: string; logoShadowOffsetX: number; logoShadowOffsetY: number; logoShadowBlur: number; logoGlowColor: string; logoGlowSize: number; logoLetterSpacing: number; logoWarp: 'none' | 'bubble' | 'arc' | 'wave' | 'slant'; logoPositionX: number; logoPositionY: number; progressStylePreset: string; progressThemeId: string; progressFrameImage?: string; progressBarImage?: string; fontSize: number; textColor: string; positionX: number; positionY: number; loadingText: string; designerComponents: LoadingDesignerComponent[]; }
export type PlatformLoadingMode = 'inherit' | 'custom' | 'disabled';
export interface LoadingScreenDocument { version: 1; enabled: boolean; defaults: LoadingStyle; platformModes: Record<string, PlatformLoadingMode>; overrides: Record<string, Partial<LoadingStyle>>; }
export interface LoadingScreenView { document: LoadingScreenDocument; resolved: Record<string, LoadingStyle | null>; assetUrls: Record<string, string>; designSize: { width: number; height: number }; }

export type ProjectOrientation = 'portrait' | 'landscape';

export interface ProjectConfig {
    id: string;
    name: string;
    orientation: ProjectOrientation;
    iconPath?: string;
    projectPath: string;
    creatorExecutable: string;
    profiles: BuildProfile[];
}

export interface ProjectInfoUpdate {
    currentId: string;
    id: string;
    name: string;
    orientation: ProjectOrientation;
    projectPath: string;
    iconSourcePath?: string;
    clearIcon?: boolean;
}

export interface ProjectsFile {
    projects: ProjectConfig[];
}

export type FakePlayerGender = 'male' | 'female';
export type FakePlayerAvatarKind = 'realistic' | 'illustrated' | 'anime' | 'animal' | 'robot' | 'landscape' | 'abstract';
export interface FakePlayerAvatarGeneration { kind: FakePlayerAvatarKind; style: string; }
export interface FakePlayerAvatar { id: string; gender: FakePlayerGender; fileName: string; previewUrl: string; playerId?: string; generated?: boolean; kind?: FakePlayerAvatarKind; style?: string; }
export interface FakePlayerName { id: string; name: string; age: number; gender: FakePlayerGender; country: string; aliases: string[]; avatarId?: string; }
export interface FakePlayersLibrary { avatars: FakePlayerAvatar[]; names: FakePlayerName[]; }

export interface DetectedProject {
    projectPath: string;
    name: string;
    creatorVersion: string;
    creatorExecutable: string | null;
    profiles?: BuildProfile[];
}

export interface BridgeStatus {
    supported: boolean;
    installed: boolean;
    running: boolean;
    editorOpen: boolean;
}

export interface CocosAccountStatus {
    sessionFile: string;
    sessionExists: boolean;
    email?: string;
    nickname?: string;
    updatedAt?: string;
}

export interface ToolingStatus {
    creatorVersion: string;
    creatorFamily: '2.x' | '3.x';
    lockExists: boolean;
    loadingConfigExists: boolean;
    loadingThemeExists: boolean;
    bridgeInstalled: boolean;
    previewSimulatorInstalled: boolean;
    previewSimulatorCustomized: boolean;
    managedInstallationExists: boolean;
    conflicts: string[];
    needsSync: boolean;
}

export interface BuildTemplateStatus {
    state: 'unavailable' | 'not-installed' | 'partial' | 'installed' | 'customized';
    sourceFileCount: number;
    installedFileCount: number;
    unchanged: string[];
    modified: string[];
    missing: string[];
    projectOnly: string[];
    destination: string;
}

export interface AndroidToolchainPaths {
    sdkPath: string;
    ndkPath: string;
    javaHome: string;
}

export interface AndroidToolchainStatus {
    requiredJdkMajor: 11 | 17;
    configured: AndroidToolchainPaths;
    detected: AndroidToolchainPaths;
    ready: boolean;
    canApplyDetected: boolean;
    issues: string[];
}

export type AndroidToolchainComponent = 'sdk' | 'ndk' | 'jdk';

export type BuildJobStatus = 'pending' | 'running' | 'success' | 'failed' | 'canceled';

export type ManagedJobType = 'build' | 'deploy' | 'install' | 'config' | 'update';

export type UpdateChannel = 'stable' | 'beta';
export type ReleasePlatform = 'macos' | 'windows';
export type AppUpdateStage = 'unsupported' | 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'deferred' | 'error';
export interface AppUpdatePreferences {
    channel: UpdateChannel;
    autoCheck: boolean;
    autoDownload: boolean;
}
export interface AppUpdateState extends AppUpdatePreferences {
    currentVersion: string;
    availableVersion?: string;
    stage: AppUpdateStage;
    progress: number;
    checkedAt?: string;
    error?: string;
    packaged: boolean;
    feedConfigured: boolean;
}
export type ReleaseRequirementStatus = 'ready' | 'missing' | 'external';
export interface ReleaseRequirement {
    id: string;
    category: 'Distribution' | 'Update hosting' | 'macOS signing' | 'Windows signing';
    name: string;
    description: string;
    configuration: string;
    status: ReleaseRequirementStatus;
}
export interface ReleaseDeploymentInfo {
    development: boolean;
    version: string;
    gitRemote?: string;
    githubRepository?: string;
    requirements: ReleaseRequirement[];
}
export interface ReleaseDeploymentConfig {
    releaseRepositoryPath: string;
    repository: string;
    branch: string;
    workflowFile: string;
    githubToken: string;
    githubAuthStatus: string;
    updateBaseUrl: string;
    r2Endpoint: string;
    r2Bucket: string;
    r2AccessKeyId: string;
    r2SecretAccessKey: string;
    macCertificate: string;
    macCertificatePassword: string;
    appleId: string;
    appleAppPassword: string;
    appleTeamId: string;
    windowsCertificate: string;
    windowsCertificatePassword: string;
    windowsPublisherName: string;
    productionTag?: string;
    configuredAt?: string;
}
export interface DeveloperIdIdentity {
    hash: string;
    name: string;
    teamId: string;
}
export interface MacSigningPreparation {
    status: 'ready' | 'manual-required' | 'choose-team' | 'authorization-required';
    identities: DeveloperIdIdentity[];
    authorizationIdentityNames?: string[];
    macCertificate?: string;
    macCertificatePassword?: string;
    appleTeamId?: string;
    githubSecretsUploaded?: boolean;
}
export interface MacSigningProgress {
    phase: 'identity' | 'authorization' | 'validation' | 'github';
    status: 'pending' | 'active' | 'complete' | 'skipped';
    detail: string;
}
export interface ReleaseBuild {
    id: string;
    tag: string;
    version: string;
    name: string;
    channel: UpdateChannel;
    createdAt: string;
    publishedAt?: string;
    url: string;
    production: boolean;
    assets: number;
    platform: ReleasePlatform;
}
export interface CreateReleaseBuildRequest { version: string; channel: UpdateChannel; platform: ReleasePlatform; }
export interface ManagedJobProjectSnapshot { id: string; name: string; projectPath: string; orientation: ProjectOrientation; creatorExecutable: string; }
export interface ManagedJobTask {
    id: string;
    name: string;
    status: BuildJobStatus;
    progress: number;
    startedAt?: string;
    finishedAt?: string;
    durationMs?: number;
    error?: string;
}
export interface ManagedJob {
    id: string;
    type: ManagedJobType;
    name: string;
    status: BuildJobStatus;
    progress: number;
    projectId?: string;
    profileId?: string;
    project?: ManagedJobProjectSnapshot;
    action: string;
    sourceUrl: string;
    startedAt: string;
    finishedAt?: string;
    durationMs?: number;
    tasks: ManagedJobTask[];
    logs: string[];
    errorLogs: string[];
}

export interface BuildJob {
    id: string;
    projectId: string;
    profileId: string;
    status: BuildJobStatus;
}

export interface StartBuildRequest {
    projectId: string;
    profileIds: string[];
}

export interface LogPayload {
    jobId: string;
    line: string;
}

export interface StatusPayload {
    jobId: string;
    status: BuildJobStatus;
    exitCode?: number;
}

export interface ProgressPayload {
    jobId: string;
    percent: number;
}

export interface BuildRecord {
    projectId: string;
    profileId: string;
    status: BuildJobStatus | 'not-built';
    version: string;
    progress: number;
    startedAt?: string;
    finishedAt?: string;
    outputExists: boolean;
    errorDetails?: string;
    deploymentStatus?: 'uploading' | 'success' | 'failed' | 'canceled';
    deploymentTaskId?: string;
    deploymentFinishedAt?: string;
    deploymentErrorDetails?: string;
}

export type LocalWebServerProtocol = 'http' | 'https';
export interface LocalWebServerInfo { protocol: LocalWebServerProtocol; url: string; port: number; }

export interface BuildApi {
    rendererReady(): Promise<void>;
    getProjects(): Promise<ProjectsFile>;
    getFakePlayers(): Promise<FakePlayersLibrary>;
    addFakePlayerAvatar(sourcePath: string, gender: FakePlayerGender): Promise<FakePlayersLibrary>;
    removeFakePlayerAvatar(id: string): Promise<FakePlayersLibrary>;
    addFakePlayerName(name: string, age: number, gender: FakePlayerGender, country: string, aliases: string[]): Promise<FakePlayersLibrary>;
    seedFakePlayerNames(): Promise<FakePlayersLibrary>;
    generateFakePlayerAvatars(options?: FakePlayerAvatarGeneration): Promise<FakePlayersLibrary>;
    removeFakePlayerName(id: string): Promise<FakePlayersLibrary>;
    detectCurrentProject(): Promise<DetectedProject | null>;
    inspectProjectFolder(projectPath: string): Promise<DetectedProject>;
    updateProjectInfo(update: ProjectInfoUpdate): Promise<ProjectsFile>;
    getBridgeStatus(projectPath: string): Promise<BridgeStatus>;
    getCocosAccountStatus(): Promise<CocosAccountStatus>;
    installBridge(projectPath: string): Promise<BridgeStatus>;
    getToolingStatus(projectPath: string): Promise<ToolingStatus>;
    syncTooling(projectPath: string): Promise<ToolingStatus>;
    syncPreviewSimulator(projectPath: string): Promise<ToolingStatus>;
    resetPreviewSimulator(projectPath: string): Promise<ToolingStatus>;
    getAndroidToolchainStatus(projectPath: string): Promise<AndroidToolchainStatus>;
    applyDetectedAndroidToolchain(projectPath: string): Promise<AndroidToolchainStatus>;
    resolveAndroidToolchain(projectPath: string): Promise<AndroidToolchainStatus>;
    resolveAndroidToolchainComponent(projectPath: string, component: AndroidToolchainComponent, taskId: string): Promise<AndroidToolchainStatus>;
    cancelAndroidToolchainTask(taskId: string): Promise<void>;
    setAndroidToolchainComponent(projectPath: string, component: AndroidToolchainComponent, selectedPath: string): Promise<AndroidToolchainStatus>;
    clearAndroidToolchainComponent(projectPath: string, component: AndroidToolchainComponent): Promise<AndroidToolchainStatus>;
    resetSetupComponent(projectPath: string, component: 'codebase' | 'bridge' | 'tooling'): Promise<void>;
    openCreator(projectPath: string, creatorExecutable: string): Promise<void>;
    saveProjects(data: ProjectsFile): Promise<void>;
    startBuild(request: StartBuildRequest): Promise<string[]>;
    cancelBuild(jobId: string): Promise<void>;
    cancelBuildProfile(projectId: string, profileId: string): Promise<void>;
    getBuildRecords(projectId: string): Promise<BuildRecord[]>;
    getJobs(): Promise<ManagedJob[]>;
    getJob(jobId: string): Promise<ManagedJob | null>;
    clearFinishedJobs(): Promise<number>;
    onJobsChanged(callback: () => void): void;
    getUpdateState(): Promise<AppUpdateState>;
    saveUpdatePreferences(preferences: AppUpdatePreferences): Promise<AppUpdateState>;
    checkForUpdates(): Promise<AppUpdateState>;
    downloadUpdate(): Promise<AppUpdateState>;
    installUpdate(): Promise<AppUpdateState>;
    onUpdateStateChanged(callback: (state: AppUpdateState) => void): void;
    getReleaseDeploymentInfo(): Promise<ReleaseDeploymentInfo>;
    openReleaseGuide(): Promise<void>;
    getReleaseDeploymentConfig(): Promise<ReleaseDeploymentConfig>;
    inspectReleaseRepository(repositoryPath: string): Promise<Pick<ReleaseDeploymentConfig, 'releaseRepositoryPath' | 'repository' | 'branch' | 'githubAuthStatus' | 'updateBaseUrl'>>;
    prepareMacSigning(config: ReleaseDeploymentConfig, teamId?: string, keychainAuthorizationConfirmed?: boolean): Promise<MacSigningPreparation>;
    onMacSigningProgress(callback: (progress: MacSigningProgress) => void): void;
    openXcode(): Promise<void>;
    saveReleaseDeploymentConfig(config: ReleaseDeploymentConfig): Promise<ReleaseDeploymentConfig>;
    listReleaseBuilds(): Promise<ReleaseBuild[]>;
    createReleaseBuild(request: CreateReleaseBuildRequest): Promise<string>;
    promoteReleaseBuild(tag: string): Promise<string>;
    openBuildOutput(projectId: string, profileId: string): Promise<void>;
    startLocalWebServer(projectId: string, profileId: string, protocol: LocalWebServerProtocol): Promise<LocalWebServerInfo>;
    openExternalUrl(url: string): Promise<void>;
    openLocalPreview(projectPath: string, creatorExecutable: string): Promise<string>;
    listIosDevices(): Promise<IosDevice[]>;
    deployIos(request: IosDeployRequest): Promise<string>;
    listAndroidDevices(projectId: string): Promise<AndroidDevice[]>;
    deployAndroid(request: AndroidDeployRequest): Promise<string>;
    deployFacebook(request: FacebookDeployRequest): Promise<string>;
    cancelDeployment(taskId: string): Promise<void>;
    getFacebookAppAccessToken(appId: string, appSecret: string): Promise<string>;
    getFacebookConsoleStatus(projectId: string): Promise<FacebookConsoleStatus>;
    openFacebookConsole(projectId: string): Promise<void>;
    clearFacebookConsoleSession(): Promise<void>;
    listFacebookConsoleRequests(): Promise<FacebookConsoleRequest[]>;
    showFacebookConsoleBrowser(projectId: string, bounds: FacebookConsoleBrowserBounds): Promise<FacebookConsoleBrowserState>;
    resizeFacebookConsoleBrowser(bounds: FacebookConsoleBrowserBounds): Promise<void>;
    hideFacebookConsoleBrowser(): Promise<void>;
    navigateFacebookConsoleBrowser(action: FacebookConsoleBrowserAction, url?: string): Promise<FacebookConsoleBrowserState>;
    getFacebookConsoleBrowserState(): Promise<FacebookConsoleBrowserState>;
    onFacebookConsoleBrowserChanged(callback: (state: FacebookConsoleBrowserState) => void): void;
    extractFacebookConsoleAssets(projectId: string): Promise<FacebookConsoleAssetExtraction>;
    listFacebookConsoleAssets(projectId: string): Promise<FacebookConsoleAssetExtraction>;
    reparseFacebookConsoleAssets(projectId: string): Promise<string>;
    openFacebookConsoleAssetsFolder(projectId: string): Promise<void>;
    pickFolder(): Promise<string | null>;
    pickFile(): Promise<string | null>;
    pickExecutable(): Promise<string | null>;
    pickImage(): Promise<string | null>;
    pickProjectIcon(): Promise<string | null>;
    getLoadingScreen(projectPath: string, platforms: string[]): Promise<LoadingScreenView>;
    saveLoadingScreen(projectPath: string, document: LoadingScreenDocument, platforms: string[]): Promise<LoadingScreenView>;
    openLoadingWebPreview(projectPath: string, platform: string | null, progress: number): Promise<string>;
    setLoadingAsset(projectPath: string, platform: string | null, kind: 'background' | 'logo' | 'frame' | 'bar', source: string): Promise<LoadingScreenView>;
    clearLoadingAsset(projectPath: string, platform: string | null, kind: 'background' | 'logo' | 'frame' | 'bar'): Promise<LoadingScreenView>;
    setLoadingComponentAsset(projectPath: string, platform: string | null, componentId: string, source: string): Promise<LoadingScreenView>;
    getBuildTemplateStatus(projectPath: string, platform: string): Promise<BuildTemplateStatus>;
    importBuildTemplate(projectPath: string, platform: string, relativePaths: string[]): Promise<void>;
    listCodebaseFiles(projectPath: string): Promise<string[]>;
    findCodebaseConflicts(projectPath: string, relativePaths: string[]): Promise<string[]>;
    importCodebase(projectPath: string, relativePaths: string[]): Promise<void>;
    onLog(callback: (payload: LogPayload) => void): void;
    onStatus(callback: (payload: StatusPayload) => void): void;
    onProgress(callback: (payload: ProgressPayload) => void): void;
}
