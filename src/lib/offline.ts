// Offline play and durable saves: the service worker (public/sw.js) caches the game so it runs
// without a connection, and persistent storage asks the browser not to clear saved progress
// when it tidies up space.

// It registers once the page has loaded, so it doesn't compete with it; the models and art it
// caches for offline play are fetched later still, when the game has been idle a while (and never
// when the browser asks to save data)
const WARM_DELAY_MS = 20000;

export const registerServiceWorker = () => {
  if (process.env.NODE_ENV !== 'production' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const register = () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Not supported here (e.g. a private window): the game still works online
    });
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (saveData) return;
    // (not while a battle is still loading: that waits for its own downloads first)
    const warm = () => {
      if (document.querySelector('[role=progressbar]')) {
        setTimeout(warm, WARM_DELAY_MS);
        return;
      }
      navigator.serviceWorker.ready.then(registration => registration.active?.postMessage({ type: 'warm' })).catch(() => undefined);
    };
    setTimeout(() => {
      if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 10000 });
      else warm();
    }, WARM_DELAY_MS);
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
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
