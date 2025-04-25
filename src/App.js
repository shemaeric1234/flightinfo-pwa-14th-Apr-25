import React, { useEffect, useState, lazy, Suspense } from "react";
import {
  Grid,
  Typography,
  Card,
  CardContent,
  CardActions,
  List,
  Divider,
  Button,
} from "@mui/material"; // Assuming you have a Div2 component in your project
import CardActionArea from "@mui/material/CardActionArea";
import CircularProgress from "@mui/material/CircularProgress";
import { openDB } from "idb";
const RequestForm = lazy(() => import("./components/RequestForm")); // Lazy load the RequestForm component

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
          "https://api.aviationstack.com/v1/flights?access_key=6c5bfda9b4d1b014b29426ca5e587858"
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

  // 12. show notification
  // Function to get delayed flight
  const getDelayedFlight = (allFlights) => {
    try {
      allFlights.push({
        airline: { name: "RwandaAir" },
        flight: { iata: "AKH4500" },
        departure: { scheduled: Date.now() + 1000 * 60 * 5 },
        arrival: { airport: "Kigali International Airport" },
        flight_status: "Delayed",
      });

      // Check if there are any flights available
      if (!Array.isArray(allFlights) || allFlights.length === 0) {
        console.log("No flights available.");
        return "Flight named N/A have been delayed departure time N/A";
      }

      // Find the first delayed flight based on the scheduled departure time
      const delayedFlight = allFlights.find((flight) => {
        const scheduledTime = flight.departure?.scheduled;
        return scheduledTime && scheduledTime <= Date.now() + 1000 * 60 * 30;
      });

      // If no delayed flight is found
      if (!delayedFlight) {
        console.log("No delayed flights found.");
        return "Flight named N/A have been delayed departure time N/A";
      }

      // Extract relevant flight details
      const flightName = delayedFlight.flight?.iata || "N/A";
      const departureTime = delayedFlight.departure?.scheduled
        ? new Date(delayedFlight.departure.scheduled).toLocaleTimeString()
        : "N/A";
      return `Flight named ${flightName} has been delayed. Scheduled departure time: ${departureTime}`;
    } catch (error) {
      console.error("Error while getting delayed flight:", error);
      return "Flight named N/A have been delayed departure time N/A";
    }
  };
  const flightDelayNotification = async () => {
    if ("serviceWorker" in navigator && "Notification" in window) {
      if (Notification.permission === "granted") {
        const sw = await navigator.serviceWorker.ready;
        sw.showNotification("Flight Delayed!", {
          body: `Your ${getDelayedFlight(flightsToShow)}`,
          icon: "/plane-icon.png",
        });
      } else if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          const sw = await navigator.serviceWorker.ready;
          sw.showNotification("Flight Delayed!", {
            body: `Your ${getDelayedFlight(flightsToShow)}`,
            icon: "/plane-icon.png",
          });
        }
      }
    }
  };

  const showFlightDelayNotification = () => {
    setTimeout(() => {
      flightDelayNotification();
    }, 1000 * 3); // 5 seconds delay for demo purposes
  };

  return (
    <>
      {showInstallButton && (
        <div style={{ textAlign: "center", margin: "20px 0" }}>
          <Typography variant="h6" sx={{ marginBottom: 2 }}>
            Install Flight Schedule App on your device!
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={handleInstall}
            style={{ marginBottom: 2 }}
          >
            Install Now
          </Button>
        </div>
      )}
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
            <Button
              variant="outlined"
              sx={{ margin: 2 }}
              onClick={showNotification}
            >
              Show notification
            </Button>
            <Button
              variant="outlined"
              sx={{ margin: 2 }}
              onClick={showFlightDelayNotification}
            >
              Flight Delay notification
            </Button>
            {/* Install button */}
            {showInstallButton && (
              <Button
                variant="outlined"
                onClick={handleInstall}
                sx={{ margin: 2 }}
              >
                Install App
              </Button>
            )}
          </Grid>
          <Divider sx={{ width: "100%" }} />
        </Grid>
        <h2>Request Flight Info</h2>
        <Grid
          container
          justifyContent={"center"}
          sx={{ margin: 5, width: "100%" }}
        >
          <Suspense fallback={<CircularProgress />}>
            <RequestForm
              name={name}
              setName={setName}
              flightNo={flightNo}
              setFlightNo={setFlightNo}
              handleSubmit={handleSubmit}
            />
          </Suspense>
        </Grid>
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
                    <List
                      component="nav"
                      aria-label="main mailbox folders"
                      key={index}
                    >
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
                          </CardContent>
                          <CardActions component="div">
                            {" "}
                            {/* Show Favorite button only when online */}
                            {isOnline && (
                              <button onClick={() => handleFavorite(flight)}>
                                {isFavorite(flight.flight.iata)
                                  ? "★ Favorited"
                                  : "☆ Favorite"}
                              </button>
                            )}
                          </CardActions>
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
