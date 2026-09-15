/* Tool-scoped local Beta only. Bump VERSION for every shell release; never skipWaiting. */
'use strict';
const VERSION = '20260905-beta-17';
const SCOPE = self.registration.scope;
const PREFIX = `site-report-local-shell-${encodeURIComponent(SCOPE)}-`;
if (new URL(SCOPE).pathname !== '/site-report-local/') throw new Error('Daily Report service worker requires its dedicated scope');
const CACHE = `${PREFIX}${VERSION}`;
const SHELL = [
  './index.html', './app.js', './styles.css', './documents.js', './storage.js',
  './catalog.js', './archive.js', './full-report.js', './full-report-ui.js',
  './backup-status.js', './photo-input.js',
  './manifest.webmanifest', './assets/fonts.css', './assets/lucide.js', './assets/icon-512.png',
  './assets/sarabun-400-thai.woff2', './assets/sarabun-400-latin.woff2',
  './assets/sarabun-700-thai.woff2', './assets/sarabun-700-latin.woff2',
].map(path => new URL(path, SCOPE).href);
const shellSet = new Set(SHELL);

async function offlineStatus() {
  const cache = await caches.open(CACHE);
  const entries = await Promise.all(SHELL.map(url => cache.match(url)));
  return { type: 'SITE_REPORT_OFFLINE_STATUS', version: VERSION, ready: entries.every(response => response?.ok) };
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Re-registering unchanged VERSION must not mutate a running version's
    // complete shell. A real release must bump VERSION above.
    if ((await offlineStatus()).ready) return;
    try {
      // addAll is all-or-nothing; any missing font/script prevents offline readiness.
      await cache.addAll(SHELL.map(url => new Request(url, { cache: 'reload' })));
      if (!(await offlineStatus()).ready) throw new Error('Incomplete local app shell');
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    if (!(await offlineStatus()).ready) throw new Error('Incomplete local app shell');
    // This exact app + registration scope only. Other caches are not ours.
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
    const status = await offlineStatus();
    for (const client of await self.clients.matchAll({ type: 'window' })) client.postMessage(status);
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'SITE_REPORT_OFFLINE_STATUS_REQUEST') return;
  event.waitUntil(offlineStatus().then(status => {
    if (event.ports[0]) event.ports[0].postMessage(status);
    else event.source?.postMessage(status);
  }));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  url.search = '';
  url.hash = '';
  if (url.href === SCOPE && event.request.mode === 'navigate') url.pathname += 'index.html';
  if (!shellSet.has(url.href)) return;
  event.respondWith((async () => {
    // A running shell stays one installed version; it never mixes latest scripts
    // with cached HTML. Activation happens after the old app's tabs are closed.
    const cached = await (await caches.open(CACHE)).match(url.href);
    if (cached) return cached;
    return new Response('Local app shell is incomplete. Reconnect and reload.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  })());
});
