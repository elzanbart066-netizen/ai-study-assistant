import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
import { NotificationProvider } from "./components/Notification.js";
import { I18nProvider } from "./i18n/I18nProvider.js";
import { AuthProvider } from "./services/AuthProvider.js";
import "./styles/main.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <I18nProvider>
          <AuthProvider>
            <NotificationProvider>
              <App />
            </NotificationProvider>
          </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}
