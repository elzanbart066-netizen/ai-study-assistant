import { type FormEvent, useState } from "react";
import { useI18n } from "../i18n/I18nProvider.js";
import { readApiKey, writeApiKey } from "../services/aiKey.js";
import { useNotify } from "./Notification.js";

/** Static site only: lets the student add their own Claude API key. */
export function ApiKeyCard() {
  const { t } = useI18n();
  const notify = useNotify();
  const [saved, setSaved] = useState(readApiKey() !== "");
  const [value, setValue] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const key = value.trim();
    if (!key) return;
    writeApiKey(key);
    setValue("");
    setSaved(true);
    notify(t("aiKey.saved"));
  };
  const remove = () => {
    writeApiKey("");
    setSaved(false);
    notify(t("aiKey.removed"));
  };

  return (
    <form className="card form-grid" noValidate onSubmit={submit}>
      <div className="field">
        <label className="label" htmlFor="ai-key">
          {t("aiKey.title")}
        </label>
        <p className="muted">{saved ? t("aiKey.on") : t("aiKey.off")}</p>
        <input
          autoComplete="off"
          id="ai-key"
          onChange={(e) => setValue(e.target.value)}
          placeholder="sk-ant-..."
          type="password"
          value={value}
        />
        <p className="muted">{t("aiKey.hint")}</p>
      </div>
      <div className="form-actions">
        {saved && (
          <button className="btn btn-ghost" onClick={remove} type="button">
            {t("aiKey.remove")}
          </button>
        )}
        <button className="btn btn-primary" disabled={!value.trim()} type="submit">
          {t("aiKey.save")}
        </button>
      </div>
    </form>
  );
}
