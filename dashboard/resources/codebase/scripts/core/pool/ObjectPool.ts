import {
    _decorator,
    Component,
    Prefab,
    NodePool,
    Node,
    instantiate,
    Tween,
    Vec3,
    UIOpacity,
} from "cc";
const { ccclass, property } = _decorator;

@ccclass("ObjectPool")
export default class ObjectPool extends Component {
    @property(Prefab)
    prefab: Prefab | null = null;
    @property
    initialSize: number = 16;
    private instances: NodePool | null = null;
    onLoad() {
        this.instances = new NodePool();
        for (var i = 0; i < this.initialSize; i++) {
            var obj = this.createInstance();
            this.instances.put(obj);
        }
    }
    getObject(parent?: Node) {
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
        Tween.stopAllByTarget(obj);
        obj.angle = 0;
        obj.scale = new Vec3(1, 1, 1);
        let uiOpacity = obj.getComponent(UIOpacity);
        if (uiOpacity) uiOpacity.opacity = 255;
        return obj;
    }
    returnObject(object: Node) {
        this.instances.put(object);
    }
    reset() {
        var objectsToReturn: Node[] = [];
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
        var obj = instantiate(this.prefab);
        var pooledObject = obj.addComponent(PooledObject);
        pooledObject.pool = this;
        return obj;
    }
}

export class PooledObject extends Component {
    public pool: ObjectPool;
}
