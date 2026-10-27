import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon, type IconName } from "../components/Icon.js";
import type { MessageKey } from "../i18n/dictionary.js";
import { useI18n } from "../i18n/I18nProvider.js";
import type { HistoryEntry, HistoryStats, ToolType } from "../models/index.js";
import { useAuth } from "../services/AuthProvider.js";
import { historyService } from "../services/index.js";

export const TYPE_ICON: Record<ToolType, IconName> = { ask: "ask", solve: "solve", code: "code", file: "file", image: "image" };

const TOOLS: { to: string; icon: IconName; title: MessageKey; text: MessageKey }[] = [
  { to: "/ask", icon: "ask", title: "tool.ask.title", text: "home.f.ask" },
  { to: "/solve", icon: "solve", title: "tool.solve.title", text: "home.f.solve" },
  { to: "/code", icon: "code", title: "tool.code.title", text: "home.f.code" },
  { to: "/files", icon: "file", title: "tool.files.title", text: "home.f.files" },
  { to: "/images", icon: "image", title: "tool.images.title", text: "home.f.images" },
  { to: "/history", icon: "history", title: "history.title", text: "home.f.history" },
];

export function DashboardPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [recent, setRecent] = useState<HistoryEntry[] | null>(null);
  const [stats, setStats] = useState<HistoryStats | null>(null);

  useEffect(() => {
    historyService
      .list({ limit: 5 })
      .then((r) => setRecent(r.items))
      .catch(() => setRecent([]));
    historyService
      .stats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const max = stats ? Math.max(1, ...Object.values(stats.byType)) : 1;

  return (
    <div className="dashboard">
      <section className="welcome card glossy">
        <h1>{t("dash.hello", { name: user?.name.split(" ")[0] ?? "" })}</h1>
        <p>{t("dash.lead")}</p>
      </section>

      <section aria-label={t("nav.menu")} className="tool-grid">
        {TOOLS.map((tool) => (
          <Link className="card tool-card" key={tool.to} to={tool.to}>
            <span className="tool-icon">
              <Icon name={tool.icon} size={24} />
            </span>
            <strong>{t(tool.title)}</strong>
            <small>{t(tool.text)}</small>
            <Icon className="tool-arrow" name="arrow" size={18} />
          </Link>
        ))}
      </section>

      <div className="dash-cols">
        <section className="card">
          <div className="card-title">
            <h2>{t("dash.recent")}</h2>
            <Link to="/history">{t("dash.seeAll")} →</Link>
          </div>
          {recent === null && <p className="muted">{t("status.loading")}</p>}
          {recent?.length === 0 && <p className="muted">{t("dash.noRecent")}</p>}
          <ul className="recent">
            {recent?.map((item) => (
              <li key={item.id}>
                <Link to={`/history?open=${item.id}`}>
                  <span className={`type-icon type-${item.type}`}>
                    <Icon name={TYPE_ICON[item.type]} size={16} />
                  </span>
                  <span className="ellipsis">{item.prompt}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {stats && (
          <section className="card">
            <div className="card-title">
              <h2>{t("dash.stats")}</h2>
            </div>
            <div className="stat-tiles">
              <div>
                <strong>{stats.total}</strong>
                <small>{t("dash.total")}</small>
              </div>
              <div>
                <strong>{stats.filesCreated}</strong>
                <small>{t("dash.filesCreated")}</small>
              </div>
              <div>
                <strong>{stats.imagesEdited}</strong>
                <small>{t("dash.imagesEdited")}</small>
              </div>
              <div>
                <strong>{stats.savedCount}</strong>
                <small>{t("dash.saved")}</small>
              </div>
            </div>
            <ul className="bars">
              {(Object.keys(stats.byType) as ToolType[]).map((type) => (
                <li key={type}>
                  <span>{t(`type.${type}` as MessageKey)}</span>
                  <span className="bar">
                    <i style={{ width: `${(stats.byType[type] / max) * 100}%` }} />
                  </span>
                  <b>{stats.byType[type]}</b>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
