export declare class LRUCache<V> {
    private capacity;
    private cache;
    private head;
    private tail;
    constructor(capacity: number);
    get(key: string): V | null;
    set(key: string, value: V): void;
    private moveToFront;
    private removeNode;
    private addToFront;
    clear(): void;
    get size(): number;
}
//# sourceMappingURL=lru.d.ts.map