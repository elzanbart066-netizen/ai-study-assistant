import type { ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Header } from "./components/Header.js";
import { Sidebar } from "./components/Sidebar.js";
import { useI18n } from "./i18n/I18nProvider.js";
import { AskPage } from "./pages/AskPage.js";
import { LoginPage, RegisterPage } from "./pages/AuthPages.js";
import { CodePage } from "./pages/CodePage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { FilesPage } from "./pages/FilesPage.js";
import { HistoryPage } from "./pages/HistoryPage.js";
import { HomePage } from "./pages/HomePage.js";
import { ImagesPage } from "./pages/ImagesPage.js";
import { ProfilePage } from "./pages/ProfilePage.js";
import { SolvePage } from "./pages/SolvePage.js";
import { useAuth } from "./services/AuthProvider.js";

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  if (loading) return <p className="center muted pad">{t("status.loading")}</p>;
  if (!user) return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main" id="main">
        {children}
      </main>
    </div>
  );
}

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="card empty pad center">
      <h1>{t("notFound.title")}</h1>
      <Link className="btn btn-primary" to="/">
        {t("notFound.back")}
      </Link>
    </div>
  );
}

export function App() {
  const { t } = useI18n();
  const { loading } = useAuth();
  return (
    <>
      <a className="skip-link" href="#main">
        ↓
      </a>
      <Header />
      <div className="page">
        {loading ? (
          <p className="center muted pad">{t("status.loading")}</p>
        ) : (
          <Routes>
            <Route element={<HomePage />} path="/" />
            <Route element={<LoginPage />} path="/login" />
            <Route element={<RegisterPage />} path="/register" />
            <Route element={<Protected><DashboardPage /></Protected>} path="/dashboard" />
            <Route element={<Protected><AskPage /></Protected>} path="/ask" />
            <Route element={<Protected><SolvePage /></Protected>} path="/solve" />
            <Route element={<Protected><CodePage /></Protected>} path="/code" />
            <Route element={<Protected><FilesPage /></Protected>} path="/files" />
            <Route element={<Protected><ImagesPage /></Protected>} path="/images" />
            <Route element={<Protected><HistoryPage /></Protected>} path="/history" />
            <Route element={<Protected><ProfilePage /></Protected>} path="/profile" />
            <Route element={<NotFound />} path="*" />
          </Routes>
        )}
      </div>
      <footer className="footer">
        <p>{t("footer.note")}</p>
        <p>© {new Date().getFullYear()} AI Study Assistant</p>
      </footer>
    </>
  );
}
