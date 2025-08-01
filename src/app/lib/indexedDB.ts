import { ProcessedData, ReflectionSession } from './data';

const DB_NAME = 'ChatGPTJournalDB';
const DB_VERSION = 3; // Use version 3 for clean start
const STORE_NAME = 'journalData';
const REFLECTION_STORE_NAME = 'reflectionSessions';

interface JournalDataRecord {
  id: string;
  data: ProcessedData;
  timestamp: number;
}

interface ReflectionDataRecord {
  id: string;
  session: ReflectionSession;
  timestamp: number;
}

class IndexedDBStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Delete existing stores if they exist
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        if (db.objectStoreNames.contains(REFLECTION_STORE_NAME)) {
          db.deleteObjectStore(REFLECTION_STORE_NAME);
        }

        // Create journal data store
        const journalStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        journalStore.createIndex('timestamp', 'timestamp', { unique: false });

        // Create reflection sessions store
        const reflectionStore = db.createObjectStore(REFLECTION_STORE_NAME, { keyPath: 'id' });
        reflectionStore.createIndex('timestamp', 'timestamp', { unique: false });
        reflectionStore.createIndex('dateString', 'session.dateString', { unique: false });
        reflectionStore.createIndex('reflectionType', 'session.reflectionType', { unique: false });
      };
    });
  }

  async saveJournalData(data: ProcessedData): Promise<void> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const record: JournalDataRecord = {
        id: 'current',
        data: data,
        timestamp: Date.now()
      };

      const request = store.put(record);

      request.onerror = () => {
        reject(new Error('Failed to save journal data'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  async getJournalData(): Promise<ProcessedData | null> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('current');

      request.onerror = () => {
        reject(new Error('Failed to get journal data'));
      };

      request.onsuccess = () => {
        const result = request.result as JournalDataRecord;
        if (result) {
          // Convert date strings back to Date objects in messages
          if (result.data.conversations && result.data.conversations.conversations) {
            result.data.conversations.conversations.forEach((conv: any) => {
              conv.messages = conv.messages.map((msg: any) => ({
                ...msg,
                date: new Date(msg.date)
              }));
            });
          }
          
          // Convert date strings back to Date objects in memory data
          if (result.data.memoryData) {
            ['people', 'goals', 'generalMemories'].forEach(category => {
              if (result.data.memoryData![category as keyof typeof result.data.memoryData]) {
                (result.data.memoryData![category as keyof typeof result.data.memoryData] as any[]).forEach((item: any) => {
                  if (item.firstMentioned) item.firstMentioned = new Date(item.firstMentioned);
                  if (item.lastMentioned) item.lastMentioned = new Date(item.lastMentioned);
                  if (item.extractedFrom) {
                    item.extractedFrom.forEach((ref: any) => {
                      if (ref.date) ref.date = new Date(ref.date);
                    });
                  }
                });
              }
            });
          }
          
          resolve(result.data);
        } else {
          resolve(null);
        }
      };
    });
  }

  async clearJournalData(): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete('current');

      request.onerror = () => {
        reject(new Error('Failed to clear journal data'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  async getStorageInfo(): Promise<{ used: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0
      };
    }
    return { used: 0, quota: 0 };
  }

  // Reflection Session Methods
  async saveReflectionSession(session: ReflectionSession): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([REFLECTION_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(REFLECTION_STORE_NAME);

      const record: ReflectionDataRecord = {
        id: session.id,
        session: session,
        timestamp: Date.now()
      };

      const request = store.put(record);

      request.onerror = () => {
        reject(new Error('Failed to save reflection session'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  async getReflectionSessionsByDate(dateString: string): Promise<ReflectionSession[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([REFLECTION_STORE_NAME], 'readonly');
      const store = transaction.objectStore(REFLECTION_STORE_NAME);
      const index = store.index('dateString');
      const request = index.getAll(dateString);

      request.onerror = () => {
        reject(new Error('Failed to get reflection sessions by date'));
      };

      request.onsuccess = () => {
        const results = request.result as ReflectionDataRecord[];
        const sessions = results.map(record => record.session);
        resolve(sessions);
      };
    });
  }

  async getReflectionSessionsByType(reflectionType: string): Promise<ReflectionSession[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([REFLECTION_STORE_NAME], 'readonly');
      const store = transaction.objectStore(REFLECTION_STORE_NAME);
      const index = store.index('reflectionType');
      const request = index.getAll(reflectionType);

      request.onerror = () => {
        reject(new Error('Failed to get reflection sessions by type'));
      };

      request.onsuccess = () => {
        const results = request.result as ReflectionDataRecord[];
        const sessions = results.map(record => record.session);
        resolve(sessions);
      };
    });
  }

  async getAllReflectionSessions(): Promise<ReflectionSession[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([REFLECTION_STORE_NAME], 'readonly');
      const store = transaction.objectStore(REFLECTION_STORE_NAME);
      const request = store.getAll();

      request.onerror = () => {
        reject(new Error('Failed to get all reflection sessions'));
      };

      request.onsuccess = () => {
        const results = request.result as ReflectionDataRecord[];
        const sessions = results.map(record => record.session);
        // Sort by most recent first
        sessions.sort((a, b) => (b.completedAt || b.startedAt) - (a.completedAt || a.startedAt));
        resolve(sessions);
      };
    });
  }

  async deleteReflectionSession(sessionId: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([REFLECTION_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(REFLECTION_STORE_NAME);
      const request = store.delete(sessionId);

      request.onerror = () => {
        reject(new Error('Failed to delete reflection session'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }
}

// Create singleton instance
export const indexedDBStorage = new IndexedDBStorage(); 