import { type FormEvent, type KeyboardEvent, type ReactNode, useId } from "react";
import { useI18n } from "../i18n/I18nProvider.js";
import { Icon } from "./Icon.js";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  submitLabel: string;
  loading: boolean;
  label: string;
  examples?: string[];
  maxLength?: number;
  error?: string;
  children?: ReactNode;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  submitLabel,
  loading,
  label,
  examples = [],
  maxLength = 4000,
  error,
  children,
}: ChatInputProps) {
  const { t } = useI18n();
  const id = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!loading) onSubmit();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!loading) onSubmit();
    }
  };

  return (
    <form className="card chat-input" noValidate onSubmit={submit}>
      <label className="label" htmlFor={id}>
        {label} <span aria-hidden="true" className="req">*</span>
      </label>
      <textarea
        aria-describedby={`${id}-hint${error ? ` ${id}-err` : ""}`}
        aria-invalid={Boolean(error)}
        aria-required="true"
        id={id}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={4}
        value={value}
      />
      {error && (
        <p className="field-error" id={`${id}-err`} role="alert">
          {error}
        </p>
      )}
      {examples.length > 0 && (
        <div className="examples">
          <span>{t("action.examples")}</span>
          {examples.map((ex) => (
            <button className="chip" key={ex} onClick={() => onChange(ex)} type="button">
              {ex}
            </button>
          ))}
        </div>
      )}
      <div className="chat-input-bar">
        <div className="chat-input-extra">{children}</div>
        <span className="hint" id={`${id}-hint`}>
          {t("action.sendHint")} · {value.length}/{maxLength}
        </span>
        <button className="btn btn-primary" disabled={loading} type="submit">
          {loading ? <span className="spinner" aria-hidden="true" /> : <Icon name="send" size={18} />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
