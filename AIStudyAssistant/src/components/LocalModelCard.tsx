import { useState } from "react";
import { useI18n } from "../i18n/I18nProvider.js";
import { getLocalModel } from "../services/aiKey.js";
import { useNotify } from "./Notification.js";

/** Static site only: turns on the free AI model that runs in the browser. */
export function LocalModelCard() {
  const { t } = useI18n();
  const notify = useNotify();
  const model = getLocalModel();
  const [on, setOn] = useState(model?.enabled() ?? false);
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  if (!model) return null;

  const enable = async () => {
    setFailed(false);
    setProgress(0);
    try {
      await model.load((p) => setProgress(p));
      model.setEnabled(true);
      setOn(true);
      notify(t("localAi.ready"));
    } catch {
      model.setEnabled(false);
      setOn(false);
      setFailed(true);
    } finally {
      setProgress(null);
    }
  };
  const disable = () => {
    model.setEnabled(false);
    setOn(false);
  };

  const supported = model.supported();
  return (
    <section className="card form-grid">
      <div className="field">
        <h2 className="label">{t("localAi.title")}</h2>
        <p className="muted">{t("localAi.desc").replace("{model}", model.label)}</p>
        {!supported && <p className="field-error">{t("localAi.unsupported")}</p>}
        {failed && <p className="field-error">{t("localAi.failed")}</p>}
        {on && progress === null && <p className="muted">✓ {t("localAi.on")}</p>}
        {progress !== null && (
          <div aria-label={t("localAi.loading")} aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(progress * 100)} className="progress" role="progressbar">
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
            <small>
              {t("localAi.loading")} {Math.round(progress * 100)}%
            </small>
          </div>
        )}
      </div>
      <div className="form-actions">
        {on ? (
          <button className="btn btn-ghost" onClick={disable} type="button">
            {t("localAi.disable")}
          </button>
        ) : (
          <button className="btn btn-primary" disabled={!supported || progress !== null} onClick={enable} type="button">
            {t("localAi.enable")}
          </button>
        )}
      </div>
    </section>
  );
}
