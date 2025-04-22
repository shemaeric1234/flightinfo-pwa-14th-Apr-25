const CACHE_NAME = "new-flightinfo-pwa-v1.6";

// List of files to cache
const urlsToCache = [
  "/",
  "/index.html",
  "/favicon.ico",
  "/logo192.png",
  "/logo512.png",
  "/manifest.json",
  "/static/css/main.css",
  "/static/js/main.js",
];

// ----------- INSTALL ----------
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

// ----------- ACTIVATE ----------
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
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

    event.waitUntil(
      syncOfflineRequests()
        .then(() => {
          console.log("[Service Worker] Offline requests synced successfully.");
        })
        .catch((err) => {
          console.error(
            "[Service Worker] Error syncing offline requests:",
            err
          );
          // Optionally re-register sync for retry
          self.registration.sync.register("sync-requests");
        })
    );
  } else {
    console.log(`[Service Worker] Unknown sync tag received: ${event.tag}`);
  }
});

// ----------- SYNC OFFLINE REQUESTS FUNCTION ----------
async function syncOfflineRequests() {
  console.log("[Service Worker] Trying to sync offline requests...");

  try {
    const db = await openDatabase();

    // Step 1: Read all saved requests
    const savedRequests = await new Promise((resolve, reject) => {
      const tx = db.transaction("requests", "readonly");
      const store = tx.objectStore("requests");
      const getAll = store.getAll();
      getAll.onsuccess = () => resolve(getAll.result);
      getAll.onerror = () => reject("Failed to fetch saved requests");
    });

    // Step 2: Sync and delete each request one by one
    for (const request of savedRequests) {
      try {
        console.log("[Service Worker] Syncing request:", request);

        await fetch("https://jsonplaceholder.typicode.com/posts", {
          method: "POST",
          body: JSON.stringify(request),
          headers: {
            "Content-Type": "application/json",
          },
        });

        console.log("[Service Worker] Successfully synced request:", request);

        // Open NEW transaction for deleting each time
        const deleteTx = db.transaction("requests", "readwrite");
        const deleteStore = deleteTx.objectStore("requests");
        deleteStore.delete(request.timestamp);
        await new Promise((resolve, reject) => {
          deleteTx.oncomplete = resolve;
          deleteTx.onerror = reject;
        });

        console.log("[Service Worker] Deleted synced request:", request);
      } catch (error) {
        console.error(
          "[Service Worker] Failed to sync request:",
          request,
          error
        );
      }
    }
    // Step 3: After all sync + delete done, show notification
    if (self.registration.showNotification) {
      self.registration.showNotification("Offline Requests Synced!", {
        body: "All your offline flight info requests were successfully sent.",
        icon: "/logo192.png",
      });
      console.log(
        "[Service Worker] Notification shown: Offline Requests Synced!"
      );
    }
    db.close();
  } catch (error) {
    console.error("[Service Worker] Error during syncOfflineRequests:", error);
  }
}

// ----------- HELPER FUNCTION: Open IndexedDB ----------
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("AeroDB", 2);

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject("IndexedDB open failed");
    };
  });
}

// -> npm run build
// -> npx serve -s build

// -> offline -> unregister -> refresh -> servoce worker is gone

// Increment this every time you change the file list or SW logic:
// const CACHE_NAME = "new-flightinfo-pwa-v3";

// // Replace these with your exact hashed filenames from the build output:
// const urlsToCache = [
//   "/",
//   "/index.html",
//   "/favicon.ico",
//   "/logo192.png",
//   "/logo512.png",
//   "/manifest.json", // optional if you want the web app manifest offline
//   "/static/css/main.f855e6bc.css",
//   "/static/js/main.f0104958.js",
//   "/static/js/488.fd50b34a.chunk.js",
// ];

// // INSTALL: Cache the app shell
// self.addEventListener("install", (event) => {
//   console.log("[Service Worker] Installing flightinfo-pwa...");
//   event.waitUntil(
//     caches.open(CACHE_NAME).then((cache) => {
//       return Promise.all(
//         urlsToCache.map((url) => {
//           return fetch(url)
//             .then((response) => {
//               if (!response.ok) {
//                 console.log(`${url} caching: false`); // checking if all files are being cached
//                 return false;
//               }
//               return cache
//                 .put(url, response.clone())
//                 .then(() => {
//                   console.log(`${url} caching: true`);
//                   return true;
//                 })
//                 .catch((err) => {
//                   console.error(`${url} caching: false`, err);
//                   return false;
//                 });
//             })
//             .catch((err) => {
//               console.error(`${url} caching: false`, err);
//               return false;
//             });
//         })
//       );
//     })
//   );
// });

// // ACTIVATE: Clean up old caches
// self.addEventListener("activate", (event) => {
//   console.log("[Service Worker] Activating flightinfo-pwa...");
//   event.waitUntil(
//     caches
//       .keys()
//       .then((cacheNames) => {
//         console.log("All Cache Names:", cacheNames);

//         return Promise.all(
//           cacheNames.map((name) => {
//             if (name !== CACHE_NAME) {
//               console.log("[Service Worker] Deleting old cache:", name);
//               return caches.delete(name);
//             }
//             return null;
//           })
//         );
//       })
//       .then(() => {
//         // After cleanup, open the current cache
//         return caches.open(CACHE_NAME);
//       })
//       .then((cache) => {
//         // Check all files in urlsToCache
//         return Promise.all(
//           urlsToCache.map((url) => {
//             return cache.match(url).then((response) => {
//               if (response) {
//                 console.log(
//                   `[Service Worker] Activation validated: ${url} is in cache.`
//                 );
//                 return true;
//               } else {
//                 console.error(
//                   `[Service Worker] Activation validation failed: ${url} is missing.`
//                 );
//                 return false;
//               }
//             });
//           })
//         );
//       })
//   );
// });

// // FETCH: Serve from cache if available, otherwise go to network
// self.addEventListener("fetch", (event) => {
//   // Log the URL being requested
//   console.log("[Service Worker] Fetch event for:", event.request.url);

//   event.respondWith(
//     caches.match(event.request).then((response) => {
//       if (response) {
//         // If found in cache, serve it and log a message
//         console.log("[Service Worker] Serving from cache:", event.request.url);
//         return response;
//       } else {
//         // Otherwise, fetch from network and log a message
//         console.log(
//           "[Service Worker] No cache found, fetching from network:",
//           event.request.url
//         );
//         return fetch(event.request);
//       }
//     })
//   );
// }
