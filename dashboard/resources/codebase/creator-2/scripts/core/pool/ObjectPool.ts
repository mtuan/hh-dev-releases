const { ccclass, property } = cc._decorator;

@ccclass("ObjectPool")
export default class ObjectPool extends cc.Component {
    @property(cc.Prefab)
    prefab: cc.Prefab | null = null;
    @property
    initialSize: number = 16;
    private instances: cc.NodePool | null = null;
    onLoad() {
        this.instances = new cc.NodePool();
        for (var i = 0; i < this.initialSize; i++) {
            var obj = this.createInstance();
            this.instances.put(obj);
        }
    }
    getObject(parent?: cc.Node) {
        if (!this.instances) return null;
        let obj =
            this.instances.size() > 0
                ? this.instances.get()
                : this.createInstance();
        if (!parent) {
            obj.parent = this.node;
        } else {
            obj.parent = parent;
        }
        cc.Tween.stopAllByTarget(obj);
        obj.angle = 0;
        obj.scale = 1;
        obj.opacity = 255;
        return obj;
    }
    returnObject(object: cc.Node) {
        this.instances.put(object);
    }
    reset() {
        var objectsToReturn: cc.Node[] = [];
        for (let instance of this.node.getComponentsInChildren(PooledObject)) {
            if (instance.node.active) {
                objectsToReturn.push(instance.node);
            }
        }
        for (let instance of objectsToReturn) {
            this.returnObject(instance);
        }
    }
    createInstance() {
        var obj = cc.instantiate(this.prefab);
        var pooledObject = obj.addComponent(PooledObject);
        pooledObject.pool = this;
        return obj;
    }
}

export class PooledObject extends cc.Component {
    public pool: ObjectPool;
}
