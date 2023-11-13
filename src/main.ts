import "./style.css";
import { renderRoot } from "./lib/pointlessly";
import { App } from "./App";

renderRoot(document.querySelector<HTMLDivElement>("#app")!, App());

// renderTo(root)(App());
