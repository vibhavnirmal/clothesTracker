const STORAGE_KEY = 'clothes-tracker-offline-queue-v1';

export type QueuedAction =
  | {
      type: 'record-wear';
      payload: { clothesIds: string[]; queuedAt: number };
    }
  | {
      type: 'record-wash';
      payload: { clothesIds: string[]; queuedAt: number };
    };

function toComparableKey(action: QueuedAction): string {
  const sortedIds = [...action.payload.clothesIds].sort();
  return `${action.type}:${sortedIds.join('|')}`;
}

function dedupeQueue(queue: QueuedAction[]): QueuedAction[] {
  const seen = new Set<string>();
  const result: QueuedAction[] = [];

  for (let index = queue.length - 1; index >= 0; index -= 1) {
    const action = queue[index];
    const key = toComparableKey(action);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(action);
  }

  return result.reverse();
}

function isStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function loadQueue(): QueuedAction[] {
  if (!isStorageAvailable()) {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch (error) {
    console.error('[offline-queue] failed to load queue', error);
    return [];
  }
}

function saveQueue(queue: QueuedAction[]): void {
  if (!isStorageAvailable()) {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('[offline-queue] failed to save queue', error);
  }
}

export function enqueueAction(action: QueuedAction): QueuedAction[] {
  const queue = loadQueue().filter(existing => toComparableKey(existing) !== toComparableKey(action));
  queue.push(action);
  const deduped = dedupeQueue(queue);
  saveQueue(deduped);
  return deduped;
}

export function dequeueActions(): QueuedAction[] {
  const queue = loadQueue();
  saveQueue([]);
  return queue;
}

export function getQueueLength(): number {
  return loadQueue().length;
}

export function peekQueue(): QueuedAction[] {
  return loadQueue();
}

export function registerSync(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.ready
    .then(registration => {
      const extendedRegistration = registration as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> | void };
      };

      if (extendedRegistration.sync && typeof extendedRegistration.sync.register === 'function') {
        return extendedRegistration.sync.register('clothes-tracker-sync');
      }
    })
    .catch(error => {
      console.error('[offline-queue] failed to register sync', error);
    });
}

export function replayQueue(flush: (action: QueuedAction) => Promise<void>): Promise<void> {
  const queue = dequeueActions();

  return queue.reduce<Promise<void>>(async (previousPromise, action, index) => {
    await previousPromise;
    try {
      await flush(action);
    } catch (error) {
      console.error('[offline-queue] replay failed, re-queueing remaining actions', error);
      const remaining = dedupeQueue(queue.slice(index));
      saveQueue(remaining);
      throw error;
    }
  }, Promise.resolve());
}
