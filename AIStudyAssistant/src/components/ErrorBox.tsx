import { useI18n } from "../i18n/I18nProvider.js";
import type { MessageKey } from "../i18n/dictionary.js";
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
  return (
    <div className="alert alert-error" role="alert">
      <Icon name="alert" />
      <div>
        <p>{errorText(error, t)}</p>
        {requestId && <small>{t("err.requestId").replace("{id}", requestId)}</small>}
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
