export enum Environment {
    Development = 'development',
    Staging = 'staging',
    Production = 'production',
}

export interface EnvironmentSettings {
    apiBaseUrl?: string;
    debugMode?: boolean;
    [key: string]: unknown;
}

export class EnvironmentConfig {
    private static current: Environment = Environment.Development;

    public static resolve(): Environment {
        throw new Error('EnvironmentConfig.resolve() not implemented yet.');
    }

    public static set(env: Environment): void {
        EnvironmentConfig.current = env;
    }

    public static get(): Environment {
        return EnvironmentConfig.current;
    }

    public static getSettings(): EnvironmentSettings {
        throw new Error('EnvironmentConfig.getSettings() not implemented yet.');
    }
}
