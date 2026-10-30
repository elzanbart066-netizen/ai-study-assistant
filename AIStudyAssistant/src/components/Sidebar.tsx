import { NavLink } from "react-router-dom";
import type { MessageKey } from "../i18n/dictionary.js";
import { useI18n } from "../i18n/I18nProvider.js";
import { useAuth } from "../services/AuthProvider.js";
import { Icon, type IconName } from "./Icon.js";

export const NAV_ITEMS: { to: string; label: MessageKey; icon: IconName }[] = [
  { to: "/dashboard", label: "nav.dashboard", icon: "home" },
  { to: "/ask", label: "nav.ask", icon: "ask" },
  { to: "/solve", label: "nav.solve", icon: "solve" },
  { to: "/code", label: "nav.code", icon: "code" },
  { to: "/files", label: "nav.files", icon: "file" },
  { to: "/images", label: "nav.images", icon: "image" },
  { to: "/history", label: "nav.history", icon: "history" },
  { to: "/profile", label: "nav.profile", icon: "user" },
];

export function Sidebar() {
  const { t } = useI18n();
  const { user } = useAuth();
  return (
    <aside className="sidebar">
      <nav aria-label={t("nav.menu")}>
        {NAV_ITEMS.map((item) => (
          <NavLink className="side-link" key={item.to} to={item.to}>
            <Icon name={item.icon} size={19} />
            <span>{t(item.label)}</span>
          </NavLink>
        ))}
      </nav>
      {user && (
        <div className="side-user">
          <span className="avatar" aria-hidden="true">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
        </div>
      )}
    </aside>
  );
}
