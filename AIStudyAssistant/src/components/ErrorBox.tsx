import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nProvider.js";
import type { MessageKey } from "../i18n/dictionary.js";
import { getLocalModel, hasHostedKey } from "../services/aiKey.js";
import { ApiError } from "../services/api.js";
import { Icon } from "./Icon.js";

export function errorText(error: unknown, t: (key: MessageKey) => string): string {
  if (error instanceof ApiError) {
    const specific = `err.${error.reason}` as MessageKey;
    const translated = t(specific);
    if (translated !== specific) return translated;
    return t(`err.${error.code}` as MessageKey);
  }
  return t("err.INTERNAL");
}

/** Field-level message for validation errors, if the server named a field. */
export function fieldError(error: unknown, field: string, t: (key: MessageKey) => string): string | undefined {
  if (error instanceof ApiError && error.field === field) {
    const key = `field.${error.reason}` as MessageKey;
    const text = t(key);
    return text === key ? errorText(error, t) : text;
  }
  return undefined;
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  if (!error) return null;
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  // With a Gemini or Claude key the AI is connected; its own errors need no model offer.
  const noAi = error instanceof ApiError && error.code === "AI_UNAVAILABLE" && !hasHostedKey();
  return (
    <div className="alert alert-error" role="alert">
      <Icon name="alert" />
      <div>
        <p>{errorText(error, t)}</p>
        {requestId && <small>{t("err.requestId").replace("{id}", requestId)}</small>}
        {noAi && onRetry && <LocalModelOffer onReady={onRetry} />}
      </div>
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry} type="button">
          <Icon name="refresh" size={16} />
          {t("action.retry")}
        </button>
      )}
    </div>
  );
}

/**
 * Static site: when no AI is connected, turn on the free in-browser model right here
 * and send the request again once it is ready, so the student need not visit Profile.
 */
function LocalModelOffer({ onReady }: { onReady: () => void }) {
  const { t } = useI18n();
  const model = getLocalModel();
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const start = () => {
    if (!model) return;
    setFailed(false);
    setProgress(0);
    model
      .load((p) => setProgress(p))
      .then(() => {
        model.setEnabled(true);
        onReady();
      })
      .catch(() => {
        setFailed(true);
        setProgress(null);
      });
  };

  // Already turned on and still downloading: wait for it and retry without a click.
  useEffect(() => {
    if (model?.enabled() && model.supported() && !model.ready()) start();
  }, []);

  // A loaded model that still failed (too slow) gets no offer: retrying would loop.
  if (!model || (model.ready() && progress === null)) return null;
  if (!model.supported()) return <p className="muted">{t("localAi.unsupported")}</p>;
  if (failed) return <p className="field-error">{t("localAi.failed")}</p>;
  if (progress !== null) {
    return (
      <div aria-label={t("localAi.loading")} aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(progress * 100)} className="progress" role="progressbar">
        <span style={{ width: `${Math.round(progress * 100)}%` }} />
        <small>
          {t("localAi.loading")} {Math.round(progress * 100)}%
        </small>
      </div>
    );
  }
  return (
    <p>
      <button className="btn btn-primary btn-sm" onClick={start} type="button">
        {t("localAi.useHere")}
      </button>
    </p>
  );
}
