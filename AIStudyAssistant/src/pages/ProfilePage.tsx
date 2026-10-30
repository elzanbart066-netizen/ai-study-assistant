import { type FormEvent, useEffect, useState } from "react";
import { ApiKeyCard } from "../components/ApiKeyCard.js";
import { LocalModelCard } from "../components/LocalModelCard.js";
import { ErrorBox, fieldError } from "../components/ErrorBox.js";
import { useNotify } from "../components/Notification.js";
import { PageHeader } from "../components/PageHeader.js";
import { useI18n } from "../i18n/I18nProvider.js";
import { LANGUAGES, type Language } from "../models/index.js";
import { STATIC_SITE } from "../services/aiKey.js";
import { useAuth } from "../services/AuthProvider.js";
import { historyService, profileService } from "../services/index.js";

const NAMES: Record<Language, string> = { kk: "Қазақша", ru: "Русский", en: "English" };

export function ProfilePage() {
  const { t, language } = useI18n();
  const { user, setUser, changeLanguage } = useAuth();
  const notify = useNotify();
  const [name, setName] = useState(user?.name ?? "");
  const [saveHistory, setSaveHistory] = useState(user?.saveHistory ?? true);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [byLanguage, setByLanguage] = useState<Record<Language, number> | null>(null);

  useEffect(() => {
    historyService
      .stats()
      .then((s) => setByLanguage(s.byLanguage))
      .catch(() => undefined);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user: updated } = await profileService.update({ name, saveHistory });
      setUser(updated);
      notify(t("profile.updated"));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const nameError = fieldError(error, "name", t);
  return (
    <div className="tool-page narrow">
      <PageHeader icon="user" lead={user?.email ?? ""} title={t("profile.title")} />
      <form className="card form-grid" noValidate onSubmit={submit}>
        <div className="field">
          <label className="label" htmlFor="profile-name">
            {t("auth.name")} <span className="req">*</span>
          </label>
          <input aria-invalid={Boolean(nameError)} id="profile-name" maxLength={80} onChange={(e) => setName(e.target.value)} value={name} />
          {nameError && <p className="field-error">{nameError}</p>}
        </div>
        <fieldset className="field">
          <legend className="label">{t("profile.language")}</legend>
          <div className="format-picker">
            {LANGUAGES.map((l) => (
              <label className={`format-option ${language === l ? "active" : ""}`} key={l}>
                <input checked={language === l} name="lang" onChange={() => changeLanguage(l)} type="radio" />
                <strong>{NAMES[l]}</strong>
                {byLanguage && <small>{byLanguage[l]}</small>}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="check">
          <input checked={saveHistory} onChange={(e) => setSaveHistory(e.target.checked)} type="checkbox" />
          {t("profile.saveHistory")}
        </label>
        {error && !nameError ? <ErrorBox error={error} /> : null}
        <div className="form-actions">
          <button className="btn btn-primary" disabled={busy} type="submit">
            {t("profile.update")}
          </button>
        </div>
      </form>
      {STATIC_SITE && <LocalModelCard />}
      {STATIC_SITE && <ApiKeyCard />}
    </div>
  );
}
