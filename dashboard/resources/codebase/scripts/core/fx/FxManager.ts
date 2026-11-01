import { Node, Vec3 } from 'cc';
import { AppLifecycle } from '../app/types';
import ObjectPool from '../pool/ObjectPool';

/**
 * Generic playFx(id, position) API: each effect id maps to its own ObjectPool
 * (prefab + initial size wired in the Editor, same convention as
 * AudioManager.soundPool), so different visual effects keep their own prefab
 * instead of sharing one generic node the way audio clips share one player.
 */
export class FxManager implements AppLifecycle {
    private readonly effectPools: Map<string, ObjectPool> = new Map();

    public init(): void {
    }

    public registerEffectPool(id: string, pool: ObjectPool): void {
        this.effectPools.set(id, pool);
    }

    public unregisterEffectPool(id: string): void {
        this.effectPools.delete(id);
    }

    public playFx(id: string, position?: Vec3, parent?: Node): Node | null {
        const pool = this.effectPools.get(id);
        if (!pool) {
            console.warn(`FxManager.playFx(): no effect pool registered for "${id}"`);
            return null;
        }

        const node = pool.getObject(parent);
        if (node && position) {
            node.setPosition(position);
        }

        return node;
    }

    public stopFx(id: string, node: Node): void {
        const pool = this.effectPools.get(id);
        if (!pool || !node) {
            return;
        }

        pool.returnObject(node);
    }
}
