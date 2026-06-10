export class SharedWorkspace {
    data = new Map();
    /**
     * Write a key-value pair to workspace
     */
    set(key, value, owner) {
        this.data.set(key, {
            value,
            owner,
            timestamp: Date.now(),
        });
    }
    /**
     * Read a value from workspace
     */
    get(key) {
        const entry = this.data.get(key);
        return entry?.value;
    }
    /**
     * Get entry metadata
     */
    getEntry(key) {
        return this.data.get(key);
    }
    /**
     * List all keys
     */
    list() {
        return Array.from(this.data.keys());
    }
    /**
     * List keys by prefix
     */
    listByPrefix(prefix) {
        return this.list().filter(k => k.startsWith(prefix));
    }
    /**
     * Delete a key
     */
    delete(key) {
        return this.data.delete(key);
    }
    /**
     * Clear all data
     */
    clear() {
        this.data.clear();
    }
    /**
     * Get all entries as plain object
     */
    toObject() {
        const obj = {};
        for (const [key, entry] of this.data) {
            obj[key] = entry.value;
        }
        return obj;
    }
}
//# sourceMappingURL=workspace.js.map