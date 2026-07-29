/**
 * Storage injection point. The SDK persists its ledger, queue and counters
 * through this interface; the host supplies the implementation (AsyncStorage
 * in React Native, a file in tests, memory in a browser tab). Keeping it
 * injected is what lets the whole SDK stay free of platform imports.
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** In-memory adapter — tests and ephemeral use. */
export class MemoryStorage implements StorageAdapter {
  private m = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.m.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.m.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.m.delete(key);
  }
}
