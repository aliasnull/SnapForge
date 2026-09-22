/**
 * Offline cache control.
 *
 * The service worker (see `public/sw.js`) caches the app shell so SnapForge
 * opens without a network connection. That cache holds only the app's own
 * HTML, JavaScript, CSS and icons — never an image the user opened, because
 * images are never sent over the network at all.
 *
 * This module is the one place the UI can ask the worker to drop that cache,
 * which keeps "clear my local data" honest: the button really does leave
 * nothing behind.
 */

/** True when this browser exposes the Cache Storage API. */
export function supportsOfflineCache(): boolean {
  return typeof caches !== 'undefined';
}

/**
 * Ask the active service worker to delete the app-shell cache.
 *
 * Resolves even when there is no worker or the browser blocks storage: the
 * caller is a "clear data" button, and failing to reach the worker must not
 * turn a successful clear into an error dialog.
 */
export async function clearAppShellCache(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const worker = registration?.active ?? navigator.serviceWorker.controller;

    if (worker) {
      worker.postMessage('snapforge:clear-cache');
      return;
    }

    // No worker to ask — clean the caches directly if the API is available.
    if (typeof caches === 'undefined') return;
    const names = await caches.keys();
    await Promise.all(
      names.filter((name) => name.startsWith('snapforge-')).map((name) => caches.delete(name)),
    );
  } catch {
    // Best effort only. There is nothing the user could do about a failure here.
  }
}
