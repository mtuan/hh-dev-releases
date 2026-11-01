import { AppLifecycle } from '../app/types';

export type AssetConfig = {
    bundle?: string;
    path: string;
};

export class AssetBundleManager implements AppLifecycle {
    public async init(): Promise<void> {
        // TODO: preload critical bundles listed in config.
    }

    public releaseBundle(bundleName: string): void {
        throw new Error(`AssetBundleManager.releaseBundle() not implemented yet (bundle: ${bundleName})`);
    }

    public async loadAsset<T extends typeof cc.Asset>(
        config: AssetConfig,
        type: T,
        onProgress?: any,
    ): Promise<InstanceType<T>> {
        if (!config || !type) {
            return Promise.resolve(null);
        }
        let bundle = await this.getBundle(config.bundle);
        return new Promise((resolve, reject) => {
            try {
                bundle.load(
                    config.path,
                    type,
                    onProgress,
                    (error, asset: InstanceType<T>) => {
                        if (error) {
                            console.error(error);
                            resolve(null);
                        } else {
                            resolve(asset);
                        }
                    },
                );
            } catch (error) {
                console.error(error);
                resolve(null);
            }
        });
    }

    public async loadAssets<T extends typeof cc.Asset>(
        configs: AssetConfig[],
        type: T,
        onProgress?: any,
    ): Promise<InstanceType<T>[]> {
        if (!configs || !type) {
            return Promise.resolve([]);
        }
        if (!Array.isArray(configs) || configs.length <= 0) {
            return Promise.resolve([]);
        }
        let bundle = await this.getBundle(configs[0].bundle);
        let paths = configs.map((cfg) => {
            let path = cfg.path;
            const typeAssetName = this.getTypeAssetName(type);
            if (typeAssetName) {
                path += `/${typeAssetName}`;
            }
            return path;
        });
        return new Promise((resolve, reject) => {
            try {
                bundle.load(
                    paths,
                    type,
                    onProgress,
                    (error, asset: InstanceType<T>[]) => {
                        if (error) {
                            console.error(error);
                            resolve(null);
                        } else {
                            resolve(asset);
                        }
                    },
                );
            } catch (error) {
                console.error(error);
                resolve(null);
            }
        });
    }

    async getBundle(bundleName: string) {
        if (!bundleName || bundleName == "") {
            return cc.assetManager.resources;
        }
        let bundle = cc.assetManager.getBundle(bundleName);
        if (!bundle) {
            bundle = await this.loadBundle(bundleName);
        }
        return bundle;
    }

    private loadBundle(bundleName: string): Promise<any> {
        return new Promise((resolve, reject) => {
            try {
                cc.assetManager.loadBundle(
                    bundleName,
                    (error: any, bundle: any) => {
                        if (error) {
                            console.log(error);
                            resolve(null);
                        } else {
                            resolve(bundle);
                        }
                    },
                );
            } catch (error) {
                console.log(error);
                resolve(null);
            }
        });
    }

    public getTypeAssetName(type: any) {
        const typeString = Object(type).name;
        switch (typeString) {
            case "SpriteFrame":
                return "spriteFrame";
            case "Texture":
                return "texture";
            default:
                break;
        }
        return null;
    }

}
