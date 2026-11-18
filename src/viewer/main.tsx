import React from "react";
import ReactDOM from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "../styles.css";
import "./viewer.css";
import { Viewer } from "./Viewer";
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><Viewer /></React.StrictMode>);
