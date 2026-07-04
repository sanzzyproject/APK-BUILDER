export interface AppHistory {
  id: string;
  appName: string;
  packageName: string;
  repoName: string;
  downloadUrl: string;
  createdAt: number;
  iconBase64?: string;
}

const DB_NAME = 'apk_builder_db';
const STORE_NAME = 'app_history';
const SETTINGS_STORE = 'settings';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('IndexedDB is not available on server'));
    }
    const request = indexedDB.open(DB_NAME, 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    };
  });
};

export const saveSetting = async (key: string, value: string) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    const store = tx.objectStore(SETTINGS_STORE);
    const request = store.put({ key, value });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getSetting = async (key: string): Promise<string | null> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE, 'readonly');
      const store = tx.objectStore(SETTINGS_STORE);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    return null;
  }
};

export const addAppHistory = async (app: AppHistory) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(app);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getAppHistory = async (): Promise<AppHistory[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const result = request.result as AppHistory[];
        resolve(result.sort((a, b) => b.createdAt - a.createdAt));
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    return [];
  }
};

export const updateAppHistory = async (id: string, updates: Partial<AppHistory>) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      if (getReq.result) {
        const updatedApp = { ...getReq.result, ...updates };
        const putReq = store.put(updatedApp);
        putReq.onsuccess = () => resolve(putReq.result);
        putReq.onerror = () => reject(putReq.error);
      } else {
        reject(new Error('App not found'));
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
};
