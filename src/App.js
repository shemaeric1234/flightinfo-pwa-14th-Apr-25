import React, { useEffect, useState } from "react";
import {
  Grid,
  Typography,
  Card,
  CardContent,
  List,
  Divider,
  Button,
} from "@mui/material"; // Assuming you have a Div2 component in your project
import CardActionArea from "@mui/material/CardActionArea";
import CircularProgress from "@mui/material/CircularProgress";
import { openDB } from "idb";

function App() {
  // 2. State management
  const [flights, setFlights] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [name, setName] = useState("");
  const [flightNo, setFlightNo] = useState("");

  // 3. Initialize AeroDB (favorites + requests)
  const dbPromise = openDB("AeroDB", 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("favorites")) {
        db.createObjectStore("favorites", { keyPath: "flightNumber" });
      }
      if (!db.objectStoreNames.contains("requests")) {
        db.createObjectStore("requests", { keyPath: "timestamp" });
      }
    },
  });

  // 4. Load favorites and fetch flights
  useEffect(() => {
    const loadFavorites = async () => {
      const db = await dbPromise;
      const allFavs = await db.getAll("favorites");
      setFavorites(allFavs);
    };

    const fetchFlights = async () => {
      try {
        const response = await fetch(
          "https://api.aviationstack.com/v1/flights?access_key=89a0374a682dce55fc08f6a91cd2ef82"
        );
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        const firstTen = data.data.slice(0, 10);
        setFlights(firstTen);
      } catch (err) {
        console.error("Error fetching flight data:", err);
        setError(err.message);
      }
    };

    loadFavorites();

    if (isOnline) {
      fetchFlights();
    } else {
      setFlights([]);
    }
  }, [isOnline]);

  // 5. Handle PWA Install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      console.log("PWA setup accepted");
    } else {
      console.log("PWA setup dismissed");
    }
    setDeferredPrompt(null);
    setShowInstallButton(false);
  };

  // 6. Listen to online/offline
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // 7. Favorite or Unfavorite a flight
  const handleFavorite = async (flight) => {
    const db = await dbPromise;
    const flightNumber = flight.flight?.iata || flight.flightNumber;

    const isFav = favorites.some((f) => f.flightNumber === flightNumber);

    if (isFav) {
      await db.delete("favorites", flightNumber);
    } else {
      await db.put("favorites", {
        flightNumber: flightNumber,
        airline: flight.airline?.name,
        departure: flight.departure?.airport || flight.departure,
        arrival: flight.arrival?.airport || flight.arrival,
        status: flight.flight_status,
      });
    }

    const allFavs = await db.getAll("favorites");
    setFavorites(allFavs);
  };

  const isFavorite = (flightNumber) =>
    favorites.some((f) => f.flightNumber === flightNumber);

  // 8. Handle submitting flight info request
  const handleSubmit = async (e) => {
    e.preventDefault();

    const requestData = {
      name,
      flightNumber: flightNo,
      timestamp: Date.now(),
    };

    if (navigator.onLine) {
      await sendToServer(requestData);
      alert("Request sent!");
    } else {
      const db = await dbPromise;
      await db.add("requests", requestData);

      if ("serviceWorker" in navigator && "SyncManager" in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          await registration.sync.register("sync-requests");
          console.log("[App] Sync event registered successfully.");
          alert(
            "Request saved! It will sync automatically when you're back online."
          );
        } catch (err) {
          console.error("[App] Failed to register sync event:", err);
          alert("Failed to schedule sync. Please try again.");
        }
      } else {
        console.warn("[App] Background Sync not supported by this browser.");
        alert("Background Sync is not supported in your browser.");
      }
    }

    setName("");
    setFlightNo("");
  };

  const sendToServer = async (data) => {
    console.log("Sending to server:", data);
    return new Promise((resolve) => setTimeout(resolve, 1000));
  };

  // 9. Show flights (online: API / offline: favorites)
  const flightsToShow = isOnline
    ? flights
    : favorites.map((fav) => ({
        airline: { name: fav.airline },
        flight: { iata: fav.flightNumber },
        departure: { airport: fav.departure },
        arrival: { airport: fav.arrival },
        flight_status: fav.status,
      }));

  // 10. Show error
  if (error) {
    return <div>Error fetching flight data: {error}</div>;
  }

  // 11. show notification
  // Function to show notification
  // This function will be called when the user clicks the "Show notification" button
  // It checks if the user has granted permission for notifications
  // If permission is granted, it shows a notification with the title "Flight Update!"
  // and a message "You have a new flight notification!"
  // If permission is not granted, it requests permission from the user
  // If the user grants permission, it shows the notification
  // If the user denies permission, it does nothing
  // Note: This function requires a service worker to be registered
  // and the service worker must be able to show notifications
  // This is usually done in the service worker file (e.g., custom-sw.js)
  const showNotification = async () => {
    if ("serviceWorker" in navigator && "Notification" in window) {
      if (Notification.permission === "granted") {
        const sw = await navigator.serviceWorker.ready;
        sw.showNotification("Flight Update!", {
          body: "You have a new flight notification!",
          icon: "/logo192.png",
        });
      } else if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          const sw = await navigator.serviceWorker.ready;
          sw.showNotification("Flight Update!", {
            body: "You have a new flight notification!",
            icon: "/logo192.png",
          });
        }
      }
    }
  };
  console.log("showInstallButton==>", showInstallButton);

  return (
    <>
      <Grid container justifyContent={"center"}>
        <Grid
          container
          justifyContent={"center"}
          sx={{ margin: 5, width: "100%" }}
        >
          <Typography variant="h4" sx={{ marginBottom: 2 }}>
            Flight Schedule
          </Typography>

          {/* Display offline notice if user is offline */}
          {!isOnline && (
            <Typography variant="h6" sx={{ marginBottom: 5, color: "red" }}>
              You are offline - showing only saved favorites.
            </Typography>
          )}

          <Grid
            container
            justifyContent={"center"}
            sx={{ margin: 5, width: "100%" }}
          >
            <Button sx={{ margin: 2 }} onClick={showNotification}>
              Show notification
            </Button>
            {/* Install button */}
            {showInstallButton && (
              <Button onClick={handleInstall} style={{ marginBottom: 2 }}>
                Install App
              </Button>
            )}
          </Grid>
          <Divider sx={{ width: "100%" }} />
        </Grid>
        <h2>Request Flight Info</h2>
        <form onSubmit={handleSubmit} style={{ marginBottom: "20px" }}>
          <input
            type="text"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Flight Number"
            value={flightNo}
            onChange={(e) => setFlightNo(e.target.value)}
            required
          />
          <button type="submit">Submit Request</button>
        </form>
        {flightsToShow.length === 0 ? (
          <Grid
            container
            alignItems={"center"}
            justifyContent={"center"}
            sx={{ width: "100%", height: 300 }}
          >
            <CircularProgress />
          </Grid>
        ) : (
          <>
            {
              // If an error occurred while fetching data, display the error
              error ? (
                <div>Error fetching flight data: {error}</div>
              ) : (
                <ul>
                  {flightsToShow.map((flight, index) => (
                    <List component="nav" aria-label="main mailbox folders">
                      <Card>
                        <CardActionArea
                          sx={{
                            height: "100%",
                            "&[data-active]": {
                              backgroundColor: "action.selected",
                              "&:hover": {
                                backgroundColor: "action.selectedHover",
                              },
                            },
                          }}
                        >
                          <CardContent sx={{ height: "100%" }}>
                            <Typography variant="h5" component="div">
                              <strong>
                                {flight.airline?.name || "Unknown Airline"}
                              </strong>{" "}
                              – Flight {flight.flight?.iata || "N/A"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              <span
                                style={{ color: "gray", fontWeight: "bold" }}
                              >
                                Departs:
                              </span>{" "}
                              {flight.departure?.airport || "Unknown Airport"}
                              {flight.departure?.scheduled
                                ? ` at ${new Date(
                                    flight.departure.scheduled
                                  ).toLocaleTimeString()}`
                                : " at N/A time"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              from Terminal{" "}
                              {flight.departure?.terminal || "N/A"}
                              Gate {flight.departure?.gate || "N/A"}
                              <br />
                              <span
                                style={{ color: "gray", fontWeight: "bold" }}
                              >
                                Arrives:
                              </span>{" "}
                              {flight.arrival?.airport || "Unknown Airport"}
                              {flight.arrival?.scheduled
                                ? ` at ${new Date(
                                    flight.arrival.scheduled
                                  ).toLocaleTimeString()}`
                                : " at N/A time"}
                              <br />
                              <span
                                style={{ color: "gray", fontWeight: "bold" }}
                              >
                                Status:
                              </span>{" "}
                              {flight.flight_status || "N/A"}
                            </Typography>
                            {/* Show Favorite button only when online */}
                            {isOnline && (
                              <button onClick={() => handleFavorite(flight)}>
                                {isFavorite(flight.flight.iata)
                                  ? "★ Favorited"
                                  : "☆ Favorite"}
                              </button>
                            )}
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    </List>
                  ))}
                </ul>
              )
            }
          </>
        )}
      </Grid>
    </>
  );
}

export default App;

// // 1. Import React, Hooks, and openDB for IndexedDB
// import React, { useEffect, useState } from 'react';
// import { openDB } from 'idb';

// function App() {
//   // 2. State management
//   const [flights, setFlights] = useState([]);
//   const [favorites, setFavorites] = useState([]);
//   const [error, setError] = useState(null);
//   const [isOnline, setIsOnline] = useState(navigator.onLine);
//   const [deferredPrompt, setDeferredPrompt] = useState(null);
//   const [showInstallButton, setShowInstallButton] = useState(false);
//   const [name, setName] = useState('');
//   const [flightNo, setFlightNo] = useState('');

//   // 3. Initialize AeroDB (favorites + requests)
//   const dbPromise = openDB('AeroDB', 2, {
//     upgrade(db) {
//       if (!db.objectStoreNames.contains('favorites')) {
//         db.createObjectStore('favorites', { keyPath: 'flightNumber' });
//       }
//       if (!db.objectStoreNames.contains('requests')) {
//         db.createObjectStore('requests', { keyPath: 'timestamp' });
//       }
//     }
//   });

//   // 4. Load favorites and fetch flights
//   useEffect(() => {
//     const loadFavorites = async () => {
//       const db = await dbPromise;
//       const allFavs = await db.getAll('favorites');
//       setFavorites(allFavs);
//     };

//     const fetchFlights = async () => {
//       try {
//         const response = await fetch('https://api.aviationstack.com/v1/flights?access_key=7f8bc6ee12c339b93cafece5cc31a4c5');
//         if (!response.ok) {
//           throw new Error(`HTTP error! Status: ${response.status}`);
//         }
//         const data = await response.json();
//         const firstTen = data.data.slice(0, 10);
//         setFlights(firstTen);
//       } catch (err) {
//         console.error('Error fetching flight data:', err);
//         setError(err.message);
//       }
//     };

//     loadFavorites();

//     if (isOnline) {
//       fetchFlights();
//     } else {
//       setFlights([]);
//     }
//   }, [isOnline]);

//   // 5. Handle PWA Install prompt
//   useEffect(() => {
//     const handler = (e) => {
//       e.preventDefault();
//       setDeferredPrompt(e);
//       setShowInstallButton(true);
//     };

//     window.addEventListener('beforeinstallprompt', handler);

//     return () => {
//       window.removeEventListener('beforeinstallprompt', handler);
//     };
//   }, []);

//   const handleInstall = async () => {
//     if (!deferredPrompt) return;
//     deferredPrompt.prompt();
//     const choice = await deferredPrompt.userChoice;
//     if (choice.outcome === 'accepted') {
//       console.log('PWA setup accepted');
//     } else {
//       console.log('PWA setup dismissed');
//     }
//     setDeferredPrompt(null);
//     setShowInstallButton(false);
//   };

//   // 6. Listen to online/offline
//   useEffect(() => {
//     const goOnline = () => setIsOnline(true);
//     const goOffline = () => setIsOnline(false);

//     window.addEventListener('online', goOnline);
//     window.addEventListener('offline', goOffline);

//     return () => {
//       window.removeEventListener('online', goOnline);
//       window.removeEventListener('offline', goOffline);
//     };
//   }, []);

//   // 7. Favorite or Unfavorite a flight
//   const handleFavorite = async (flight) => {
//     const db = await dbPromise;
//     const flightNumber = flight.flight?.iata || flight.flightNumber;

//     const isFav = favorites.some(f => f.flightNumber === flightNumber);

//     if (isFav) {
//       await db.delete('favorites', flightNumber);
//     } else {
//       await db.put('favorites', {
//         flightNumber: flightNumber,
//         airline: flight.airline?.name,
//         departure: flight.departure?.airport || flight.departure,
//         arrival: flight.arrival?.airport || flight.arrival,
//         status: flight.flight_status
//       });
//     }

//     const allFavs = await db.getAll('favorites');
//     setFavorites(allFavs);
//   };

//   const isFavorite = (flightNumber) => favorites.some(f => f.flightNumber === flightNumber);

//   // 8. Handle submitting flight info request
//   const handleSubmit = async (e) => {
//     e.preventDefault();

//     const requestData = {
//       name,
//       flightNumber: flightNo,
//       timestamp: Date.now()
//     };

//     if (navigator.onLine) {
//       await sendToServer(requestData);
//       alert('Request sent!');
//     } else {
//       const db = await dbPromise;
//       await db.add('requests', requestData);

//       if ('serviceWorker' in navigator && 'SyncManager' in window) {
//         const sw = await navigator.serviceWorker.ready;
//         await sw.sync.register('sync-requests');
//         alert('Request saved! Will sync when back online.');
//       } else {
//         alert('Background Sync not supported.');
//       }
//     }

//     setName('');
//     setFlightNo('');
//   };

//   const sendToServer = async (data) => {
//     console.log('Sending to server:', data);
//     return new Promise(resolve => setTimeout(resolve, 1000));
//   };

//   // 9. Show flights (online: API / offline: favorites)
//   const flightsToShow = isOnline
//     ? flights
//     : favorites.map(fav => ({
//         airline: { name: fav.airline },
//         flight: { iata: fav.flightNumber },
//         departure: { airport: fav.departure },
//         arrival: { airport: fav.arrival },
//         flight_status: fav.status
//       }));

//   // 10. Show error
//   if (error) {
//     return <div>Error fetching flight data: {error}</div>;
//   }

//   // 11. Render UI
//   return (
//     <div>
//       <h1>Flight Schedule</h1>

//       {showInstallButton && (
//         <button onClick={handleInstall} style={{ marginBottom: '20px' }}>
//           Install App
//         </button>
//       )}

//       {!isOnline && (
//         <p style={{ color: 'red' }}>You are offline - showing saved favorites.</p>
//       )}

//       {flightsToShow.length === 0 ? (
//         <p>Loading flight data...</p>
//       ) : (
//         <ul>
//           {flightsToShow.map((flight, index) => (
//             <li key={flight.flight.iata || index}>
//               <strong>{flight.airline?.name || 'Unknown Airline'}</strong> – Flight {flight.flight?.iata || 'N/A'}
//               <br />
//               Departs: {flight.departure?.airport || 'Unknown Airport'}
//               <br />
//               Arrives: {flight.arrival?.airport || 'Unknown Airport'}
//               <br />
//               Status: {flight.flight_status || 'N/A'}
//               <br />
//               {isOnline && (
//                 <button onClick={() => handleFavorite(flight)}>
//                   {isFavorite(flight.flight?.iata || flight.flightNumber) ? '★ Favorited' : '☆ Favorite'}
//                 </button>
//               )}
//             </li>
//           ))}
//         </ul>
//       )}
//     </div>
//   );
// }

// export default App;
