import "./polyfill.js";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "../src/App.js";
import { NotificationProvider } from "../src/components/Notification.js";
import { I18nProvider } from "../src/i18n/I18nProvider.js";
import { AuthProvider } from "../src/services/AuthProvider.js";
import "../src/styles/main.css";
import { setLogSink } from "../server/lib/logger.js";

setLogSink((line) => console.warn(line));

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <HashRouter>
        <I18nProvider>
          <AuthProvider>
            <NotificationProvider>
              <App />
            </NotificationProvider>
          </AuthProvider>
        </I18nProvider>
      </HashRouter>
    </StrictMode>,
  );
}
