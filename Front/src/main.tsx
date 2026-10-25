import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
// 설치 이벤트(beforeinstallprompt)를 앱 시작 직후부터 받기 위해 먼저 불러온다.
import "./lib/pwa-install";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
