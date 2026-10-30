import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider.js";
import { useAuth } from "../services/AuthProvider.js";
import { Icon } from "./Icon.js";
import { LanguageSwitcher } from "./LanguageSwitcher.js";
import { NAV_ITEMS } from "./Sidebar.js";

export function Header() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const onLogout = async () => {
    setOpen(false);
    await logout();
    navigate("/");
  };

  return (
    <header className="header">
      <div className="header-inner">
        <Link className="brand" to={user ? "/dashboard" : "/"}>
          <span className="brand-mark">
            <Icon name="logo" size={22} />
          </span>
          <span className="brand-name">{t("appName")}</span>
        </Link>

        {user && (
          <nav aria-label={t("nav.menu")} className="top-nav">
            {NAV_ITEMS.slice(1, 6).map((item) => (
              <NavLink key={item.to} to={item.to}>
                {t(item.label)}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="header-actions">
          <LanguageSwitcher />
          {user ? (
            <button className="btn btn-ghost hide-sm" onClick={onLogout} type="button">
              <Icon name="logout" size={18} />
              {t("nav.logout")}
            </button>
          ) : (
            <>
              <Link className="btn btn-ghost hide-sm" to="/login">
                {t("nav.login")}
              </Link>
              <Link className="btn btn-primary hide-sm" to="/register">
                {t("nav.register")}
              </Link>
            </>
          )}
          <button
            aria-controls="mobile-menu"
            aria-expanded={open}
            aria-label={t("nav.menu")}
            className="icon-btn burger"
            onClick={() => setOpen((v) => !v)}
            type="button"
          >
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>

      {open && (
        <nav aria-label={t("nav.menu")} className="mobile-menu" id="mobile-menu">
          {user ? (
            <>
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.to} onClick={() => setOpen(false)} to={item.to}>
                  <Icon name={item.icon} size={18} />
                  {t(item.label)}
                </NavLink>
              ))}
              <button onClick={onLogout} type="button">
                <Icon name="logout" size={18} />
                {t("nav.logout")}
              </button>
            </>
          ) : (
            <>
              <NavLink onClick={() => setOpen(false)} to="/login">
                {t("nav.login")}
              </NavLink>
              <NavLink onClick={() => setOpen(false)} to="/register">
                {t("nav.register")}
              </NavLink>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
