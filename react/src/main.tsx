import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./estilo.css";
import "./voce.css";
import { aplicarVisual, lerVisual } from "./voce";

aplicarVisual(lerVisual());

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
