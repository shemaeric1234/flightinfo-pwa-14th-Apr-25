import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
// import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import reportWebVitals from "./reportWebVitals";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// register custom service worker
// if ("serviceWorker" in navigator) {
//   navigator.serviceWorker
//     .register("/custom-sw.js")
//     .then(() => {
//       console.log("Custom SW Registered");
//     })
//     .catch((error) => {
//       console.error("SW registration failed:", error);
//     });
// }

// if ("serviceWorker" in navigator) {
//   navigator.serviceWorker
//     .register("/service-worker.js")
//     .then(() => {
//       console.log("Custom SW Registered");
//     })
//     .catch((error) => {
//       console.error("SW registration failed:", error);
//     });
// }

// Workbox service worker registration
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(
        "https://shemaeric1234.github.io/flightinfo-pwa-14th-Apr-25/custom-sw.js"
      )
      .then((reg) => {
        console.log("Custom SW registered:", reg);
      })
      .catch((err) => {
        console.error("Custom SW registration failed:", err);
      });
  });
}

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
// serviceWorkerRegistration.register();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
