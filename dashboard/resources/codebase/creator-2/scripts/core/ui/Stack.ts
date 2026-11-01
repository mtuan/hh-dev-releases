export class Stack<T> {
    private capability: number = 0;
    private data: T[] = [];
    constructor(capability: number = 0) {
        this.data = [];
        this.capability = capability;
    }

    isEmpty() {
        return this.data.length === 0;
    }

    isFull() {
        if (this.capability == 0) return false;
        return this.data.length === this.capability;
    }

    push(item: T) {
        if (this.isFull()) return false;

        this.data.push(item);
        return true;
    }

    pop() {
        if (this.isEmpty()) return undefined;
        return this.data.pop();
    }

    peek() {
        if (this.isEmpty()) return undefined;
        return this.data[this.data.length - 1];
    }

    clear() {
        this.data.length = 0;
    }
}
