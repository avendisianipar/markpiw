// SPDX-License-Identifier: LicenseRef-Proprietary
// IndexedDB: handle folder terakhir dan draf darurat (spesifikasi 6.1, 6.5).

const DB = 'markpiw';
const VERSION = 1;

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB, VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('folders');
      request.result.createObjectStore('drafts');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function run<T>(
  store: string,
  mode: IDBTransactionMode,
  action: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    const request = action(db.transaction(store, mode).objectStore(store));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export interface RecentFolder {
  readonly name: string;
  readonly handle: FileSystemDirectoryHandle;
  readonly openedAt: number;
}

export async function rememberFolder(handle: FileSystemDirectoryHandle): Promise<void> {
  await run('folders', 'readwrite', (s) =>
    s.put({ name: handle.name, handle, openedAt: Date.now() }, handle.name),
  );
}

export async function recentFolders(): Promise<RecentFolder[]> {
  const all =
    (await run<RecentFolder[]>(
      'folders',
      'readonly',
      (s) => s.getAll() as IDBRequest<RecentFolder[]>,
    )) ?? [];
  return all.sort((a, b) => b.openedAt - a.openedAt).slice(0, 5);
}

export async function forgetFolder(name: string): Promise<void> {
  await run('folders', 'readwrite', (s) => s.delete(name));
}

export interface Draft {
  readonly text: string;
  readonly savedAt: number;
}

export async function saveDraft(root: string, path: string, text: string): Promise<void> {
  await run('drafts', 'readwrite', (s) =>
    s.put({ text, savedAt: Date.now() } satisfies Draft, `${root}/${path}`),
  );
}

export async function takeDraft(root: string, path: string): Promise<Draft | null> {
  const key = `${root}/${path}`;
  const draft = await run<Draft | undefined>(
    'drafts',
    'readonly',
    (s) => s.get(key) as IDBRequest<Draft | undefined>,
  );
  return draft ?? null;
}

export async function clearDraft(root: string, path: string): Promise<void> {
  await run('drafts', 'readwrite', (s) => s.delete(`${root}/${path}`));
}
