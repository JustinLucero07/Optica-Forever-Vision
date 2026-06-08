import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
import { initTheme } from "./store/theme"
import { initBrand } from "./store/brand"

initTheme()
initBrand()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
