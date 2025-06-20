"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LRUCache = void 0;
class LRUNode {
    constructor(key, value) {
        this.prev = null;
        this.next = null;
        this.key = key;
        this.value = value;
    }
}
class LRUCache {
    constructor(capacity) {
        this.head = null;
        this.tail = null;
        this.capacity = capacity;
        this.cache = new Map();
    }
    get(key) {
        const node = this.cache.get(key);
        if (!node)
            return null;
        this.moveToFront(node);
        return node.value;
    }
    set(key, value) {
        if (this.cache.has(key)) {
            const node = this.cache.get(key);
            node.value = value;
            this.moveToFront(node);
            return;
        }
        const newNode = new LRUNode(key, value);
        if (this.cache.size >= this.capacity) {
            if (this.tail) {
                this.cache.delete(this.tail.key);
                this.removeNode(this.tail);
            }
        }
        this.cache.set(key, newNode);
        this.addToFront(newNode);
    }
    moveToFront(node) {
        this.removeNode(node);
        this.addToFront(node);
    }
    removeNode(node) {
        if (node.prev)
            node.prev.next = node.next;
        if (node.next)
            node.next.prev = node.prev;
        if (node === this.head)
            this.head = node.next;
        if (node === this.tail)
            this.tail = node.prev;
    }
    addToFront(node) {
        node.prev = null;
        node.next = this.head;
        if (this.head)
            this.head.prev = node;
        this.head = node;
        if (!this.tail)
            this.tail = node;
    }
    clear() {
        this.cache.clear();
        this.head = null;
        this.tail = null;
    }
    get size() {
        return this.cache.size;
    }
}
exports.LRUCache = LRUCache;
//# sourceMappingURL=lru.js.map