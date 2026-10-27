import { Link, Navigate } from "react-router-dom";
import { Icon, type IconName } from "../components/Icon.js";
import type { MessageKey } from "../i18n/dictionary.js";
import { useI18n } from "../i18n/I18nProvider.js";
import { useAuth } from "../services/AuthProvider.js";

const FEATURES: { icon: IconName; title: MessageKey; text: MessageKey }[] = [
  { icon: "ask", title: "tool.ask.title", text: "home.f.ask" },
  { icon: "solve", title: "tool.solve.title", text: "home.f.solve" },
  { icon: "code", title: "tool.code.title", text: "home.f.code" },
  { icon: "file", title: "tool.files.title", text: "home.f.files" },
  { icon: "image", title: "tool.images.title", text: "home.f.images" },
  { icon: "history", title: "history.title", text: "home.f.history" },
];

/** Decorative illustration drawn for this project. */
function HeroArt() {
  return (
    <svg aria-hidden="true" className="hero-art" viewBox="0 0 360 300">
      <defs>
        <linearGradient id="g-card" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f1f3f5" />
        </linearGradient>
        <linearGradient id="g-shine" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".9" />
          <stop offset=".5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect fill="url(#g-card)" height="150" rx="18" stroke="#D5D9DE" width="230" x="20" y="30" />
      <rect fill="url(#g-shine)" height="70" rx="18" width="230" x="20" y="30" />
      <circle cx="52" cy="62" fill="#626B74" r="12" />
      <rect fill="#D5D9DE" height="10" rx="5" width="120" x="74" y="52" />
      <rect fill="#E4E7EA" height="8" rx="4" width="90" x="74" y="68" />
      <rect fill="#ECEFF1" height="56" rx="10" width="194" x="38" y="98" />
      <text fill="#33383E" fontFamily="ui-monospace, monospace" fontSize="17" x="52" y="132">2x + 5 = 13</text>
      <rect fill="url(#g-card)" height="130" rx="18" stroke="#D5D9DE" width="200" x="140" y="150" />
      <rect fill="url(#g-shine)" height="60" rx="18" width="200" x="140" y="150" />
      <text fill="#22804A" fontFamily="ui-monospace, monospace" fontSize="15" x="160" y="185">2x = 8</text>
      <text fill="#22804A" fontFamily="ui-monospace, monospace" fontSize="15" x="160" y="210">x = 4  ✓</text>
      <rect fill="#E4E7EA" height="8" rx="4" width="140" x="160" y="232" />
      <rect fill="#E4E7EA" height="8" rx="4" width="100" x="160" y="250" />
      <g fill="none" stroke="#626B74" strokeLinecap="round" strokeWidth="2.5">
        <path d="M300 40v16M292 48h16" />
        <path d="M40 230v12M34 236h12" />
      </g>
    </svg>
  );
}

export function HomePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  if (user) return <Navigate replace to="/dashboard" />;
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow">{t("tagline")}</span>
          <h1>{t("home.title")}</h1>
          <p>{t("home.lead")}</p>
          <div className="hero-actions">
            <Link className="btn btn-primary btn-lg" to="/register">
              {t("home.start")}
              <Icon name="arrow" size={18} />
            </Link>
            <Link className="btn btn-ghost btn-lg" to="/login">
              {t("home.haveAccount")}
            </Link>
          </div>
          <p className="honest">
            <Icon name="check" size={18} />
            {t("home.honest")}
          </p>
        </div>
        <HeroArt />
      </section>

      <section className="features">
        {FEATURES.map((f) => (
          <article className="card feature glossy" key={f.title}>
            <span className="tool-icon">
              <Icon name={f.icon} size={22} />
            </span>
            <h2>{t(f.title)}</h2>
            <p>{t(f.text)}</p>
          </article>
        ))}
      </section>

      <section className="how card">
        <h2>{t("home.how")}</h2>
        <ol>
          <li>
            <b>1</b>
            {t("home.step1")}
          </li>
          <li>
            <b>2</b>
            {t("home.step2")}
          </li>
          <li>
            <b>3</b>
            {t("home.step3")}
          </li>
        </ol>
      </section>
    </div>
  );
}
