import { AssetConfig } from "./AssetBundleManager";

export default class UIDefine {
    public static UI_PATH_CANVAS = "Canvas";
    public static UI_UIROOT_NAME = "Canvas/UIRoot";
    public static UI_UIROOT_NODE = "UIRoot";
    public static MAIN_BUNDLE = "main";
    public static GAME_BUNDLE = "game";
    public static AUDIO_BUNDLE = "audio";
    public static REMOTE_BUNDLE = "remote-bundle";
    public static PATH_HOME = "texture/home/";
    public static PATH_REWARD = "texture/reward/";

    public static HOME_SCENE: AssetConfig = {
        bundle: UIDefine.GAME_BUNDLE,
        path: "home",
    };
    public static GAME_SCENE: AssetConfig = {
        bundle: UIDefine.GAME_BUNDLE,
        path: "game",
    };
    public static LOADING: AssetConfig = { path: "prefab/Loading" };

    public static POPUP_PAUSE: AssetConfig = {
        bundle: UIDefine.GAME_BUNDLE,
        path: "prefab/popup/PausePopup",
    };

    public static POPUP_WIN: AssetConfig = {
        bundle: UIDefine.GAME_BUNDLE,
        path: "prefab/popup/WinPopup",
    };

    public static POPUP_LOSE: AssetConfig = {
        bundle: UIDefine.GAME_BUNDLE,
        path: "prefab/popup/LosePopup",
    };

    public static POPUP_SETTING: AssetConfig = {
        bundle: UIDefine.GAME_BUNDLE,
        path: "prefab/popup/SettingPopup",
    };

    public static POPUP_NOTIFICATION: AssetConfig = {
        bundle: UIDefine.GAME_BUNDLE,
        path: "prefab/popup/NotificationPopup",
    };

    public static POPUP_REVIVE: AssetConfig = {
        bundle: UIDefine.GAME_BUNDLE,
        path: "prefab/popup/RevivePopup",
    };

}
