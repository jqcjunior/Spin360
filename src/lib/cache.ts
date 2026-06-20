/**
 * Cache inteligente de assets — funciona online e offline
 * Online: baixa do Supabase e guarda em cache
 * Offline: usa cache local automaticamente
 */

const DB_NAME = 'real360_assets';
const DB_VERSION = 1;
const STORE = 'assets';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise(resolve => {
      const transaction = db.transaction(STORE, 'readonly');
      const req = transaction.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function dbSet(key: string, value: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>(resolve => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
    });
  } catch {}
}

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

/**
 * Retorna asset como base64 — usa cache se offline ou já cacheado
 */
export async function getAsset(key: string, url: string): Promise<string> {
  // 1. Tenta cache local primeiro (funciona offline)
  const cached = await dbGet(key);
  if (cached) return cached;

  // 2. Se online, baixa e guarda em cache
  if (navigator.onLine) {
    try {
      const base64 = await urlToBase64(url);
      await dbSet(key, base64);
      return base64;
    } catch {}
  }

  // 3. Fallback: retorna a URL original (pode funcionar se SW tiver cacheado)
  return url;
}

/**
 * Salva vídeo localmente para sync posterior
 */
export async function saveVideoOffline(id: string, blob: Blob): Promise<void> {
  const base64 = await new Promise<string>(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
  await dbSet(`pending_video_${id}`, base64);
  // Registra na lista de pendentes
  const listRaw = await dbGet('pending_video_ids');
  const list: string[] = listRaw ? JSON.parse(listRaw) : [];
  if (!list.includes(id)) {
    list.push(id);
    await dbSet('pending_video_ids', JSON.stringify(list));
  }
}

/**
 * Retorna lista de vídeos pendentes de upload
 */
export async function getPendingVideos(): Promise<Array<{ id: string; base64: string }>> {
  const listRaw = await dbGet('pending_video_ids');
  if (!listRaw) return [];
  const ids: string[] = JSON.parse(listRaw);
  const result = [];
  for (const id of ids) {
    const base64 = await dbGet(`pending_video_${id}`);
    if (base64) result.push({ id, base64 });
  }
  return result;
}

/**
 * Remove vídeo da fila de pendentes após sync
 */
export async function removePendingVideo(id: string): Promise<void> {
  const listRaw = await dbGet('pending_video_ids');
  if (!listRaw) return;
  const list: string[] = JSON.parse(listRaw);
  await dbSet('pending_video_ids', JSON.stringify(list.filter(i => i !== id)));
  const db = await openDB();
  db.transaction(STORE, 'readwrite').objectStore(STORE).delete(`pending_video_${id}`);
}
