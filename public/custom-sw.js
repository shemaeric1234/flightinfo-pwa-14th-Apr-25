const CACHE_NAME = "new-flightinfo-pwa-v1.9";

const urlsToCache = [
  "/flightinfo-pwa-14th-Apr-25/",
  "/flightinfo-pwa-14th-Apr-25/index.html",
  "/flightinfo-pwa-14th-Apr-25/favicon.ico",
  "/flightinfo-pwa-14th-Apr-25/logo192.png",
  "/flightinfo-pwa-14th-Apr-25/logo512.png",
  "/flightinfo-pwa-14th-Apr-25/manifest.json",
  "/flightinfo-pwa-14th-Apr-25/static/css/main.*.css",
  "/flightinfo-pwa-14th-Apr-25/static/js/main.*.js",
];

// ----------- INSTALL ----------
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing...");
  self.skipWaiting(); // Skip waiting to activate new SW immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

// ----------- ACTIVATE ----------
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating...");
  // self.clientsClaim(); // Take control of pages immediately
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
  );
});

// ----------- FETCH ----------
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

// ----------- SYNC EVENT ----------
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-requests") {
    console.log("[Service Worker] Sync event triggered for saved requests");
    event.waitUntil(syncOfflineRequests());
  }
});

// ----------- SYNC FUNCTION ----------
async function syncOfflineRequests() {
  console.log("[Service Worker] Trying to sync offline requests...");

  try {
    const db = await openDatabase();
    const tx = db.transaction("requests", "readonly");
    const store = tx.objectStore("requests");
    const getAll = store.getAll();

    const savedRequests = await new Promise((resolve, reject) => {
      getAll.onsuccess = () => resolve(getAll.result);
      getAll.onerror = () => reject("Failed to fetch saved requests");
    });

    for (const request of savedRequests) {
      try {
        await fetch("https://jsonplaceholder.typicode.com/posts", {
          method: "POST",
          body: JSON.stringify(request),
          headers: { "Content-Type": "application/json" },
        });

        const deleteTx = db.transaction("requests", "readwrite");
        const deleteStore = deleteTx.objectStore("requests");
        deleteStore.delete(request.timestamp);
        await new Promise((resolve, reject) => {
          deleteTx.oncomplete = resolve;
          deleteTx.onerror = reject;
        });

        console.log("[Service Worker] Synced & deleted:", request);
      } catch (error) {
        console.error(
          "[Service Worker] Failed to sync request:",
          request,
          error
        );
      }
    }

    // Notify user once all offline requests are synced
    if (self.registration.showNotification) {
      self.registration.showNotification("Offline Requests Synced!", {
        body: "All your saved flight requests were submitted.",
        icon: "/logo192.png",
      });
    }

    db.close();
  } catch (error) {
    console.error("[Service Worker] Error during sync:", error);
  }
}

// ----------- OPEN IndexedDB ----------
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("AeroDB", 2);
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject("IndexedDB open failed");
  });
}

// -> npm run build
// -> npx serve -s build

// -> offline -> unregister -> refresh -> servoce worker is gone
