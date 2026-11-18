import React from "react";
import ReactDOM from "react-dom/client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "./styles.css";
import { App } from "./ui/App";

declare global {
  interface Window {
    L: typeof L;
  }
}

// Leaflet-Geoman expects Leaflet's `L` object on window when it is evaluated.
window.L = L;

void import("@geoman-io/leaflet-geoman-free").then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
