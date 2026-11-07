/** A small IndexedDB wrapper. Two stores: `meta` (key/value) and `queue` (things waiting to sync, keyed by ref). */

const VERSION = 1;

function open(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      if (!db.objectStoreNames.contains("queue")) db.createObjectStore("queue", { keyPath: "ref" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const done = <T,>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export type FieldDb = {
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;
  all<T>(): Promise<T[]>;
  put(item: unknown): Promise<void>;
  remove(ref: string): Promise<void>;
  clear(): Promise<void>;
};

/** One database per signed-in user, so two salespeople sharing a phone never see each other's queue. */
export async function openFieldDb(userId: number): Promise<FieldDb> {
  const db = await open(`depot-field-${userId}`);
  const tx = (store: "meta" | "queue", mode: IDBTransactionMode) => db.transaction(store, mode).objectStore(store);

  return {
    getMeta: async <T,>(key: string) => (await done(tx("meta", "readonly").get(key))) as T | undefined,
    setMeta: async (key, value) => void (await done(tx("meta", "readwrite").put(value, key))),
    all: async <T,>() => (await done(tx("queue", "readonly").getAll())) as T[],
    put: async (item) => void (await done(tx("queue", "readwrite").put(item))),
    remove: async (ref) => void (await done(tx("queue", "readwrite").delete(ref))),
    clear: async () => {
      await done(tx("queue", "readwrite").clear());
      await done(tx("meta", "readwrite").clear());
    },
  };
}
