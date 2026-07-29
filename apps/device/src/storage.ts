import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StorageAdapter } from "@lift/sdk";

/**
 * The ~10-line proof that the SDK's storage injection works: AsyncStorage
 * already satisfies the adapter shape, so the ledger and the event queue
 * survive app restarts with no SDK changes.
 */
export const storage: StorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};
