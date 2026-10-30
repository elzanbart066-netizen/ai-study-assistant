import { type FormEvent, useState } from "react";
import { useI18n } from "../i18n/I18nProvider.js";
import { type KeyKind, readApiKey, writeApiKey } from "../services/aiKey.js";
import { useNotify } from "./Notification.js";

const PREFIX = { claude: "aiKey", gemini: "geminiKey" } as const;
const PLACEHOLDER = { claude: "sk-ant-...", gemini: "AIza..." };

/** Static site only: lets the student add their own Claude or Gemini API key. */
export function ApiKeyCard({ kind = "claude" }: { kind?: KeyKind }) {
  const { t: translate } = useI18n();
  const t = (name: "title" | "on" | "off" | "hint" | "save" | "remove" | "saved" | "removed") => translate(`${PREFIX[kind]}.${name}`);
  const notify = useNotify();
  const [saved, setSaved] = useState(readApiKey(kind) !== "");
  const [value, setValue] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const key = value.trim();
    if (!key) return;
    writeApiKey(key, kind);
    setValue("");
    setSaved(true);
    notify(t("saved"));
  };
  const remove = () => {
    writeApiKey("", kind);
    setSaved(false);
    notify(t("removed"));
  };

  return (
    <form className="card form-grid" noValidate onSubmit={submit}>
      <div className="field">
        <label className="label" htmlFor={`ai-key-${kind}`}>
          {t("title")}
        </label>
        <p className="muted">{saved ? t("on") : t("off")}</p>
        <input
          autoComplete="off"
          id={`ai-key-${kind}`}
          onChange={(e) => setValue(e.target.value)}
          placeholder={PLACEHOLDER[kind]}
          type="password"
          value={value}
        />
        <p className="muted">{t("hint")}</p>
      </div>
      <div className="form-actions">
        {saved && (
          <button className="btn btn-ghost" onClick={remove} type="button">
            {t("remove")}
          </button>
        )}
        <button className="btn btn-primary" disabled={!value.trim()} type="submit">
          {t("save")}
        </button>
      </div>
    </form>
  );
}
