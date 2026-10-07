// Offline play and durable saves: the service worker (public/sw.js) caches the game so it runs
// without a connection, and persistent storage asks the browser not to clear saved progress
// when it tidies up space.

export const registerServiceWorker = () => {
  if (process.env.NODE_ENV !== 'production' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Not supported here (e.g. a private window): the game still works online
  });
};

export const isStoragePersisted = async (): Promise<boolean | null> => {
  try {
    return typeof navigator !== 'undefined' && navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  } catch {
    return null;
  }
};

// Ask once the player has some progress worth keeping (some browsers show a prompt)
export const requestPersistentStorage = async () => {
  try {
    if ((await isStoragePersisted()) === false) await navigator.storage.persist();
  } catch {
    // Not supported: saves stay in ordinary storage
  }
};
