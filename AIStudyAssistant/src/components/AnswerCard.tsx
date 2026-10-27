import { type ReactNode, useState } from "react";
import { useI18n } from "../i18n/I18nProvider.js";
import type { Provider } from "../models/index.js";
import { historyService } from "../services/index.js";
import { Icon } from "./Icon.js";
import { useNotify } from "./Notification.js";

export function downloadText(name: string, text: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be blocked; nothing else to do
    }
  };
  return (
    <button className="btn btn-ghost btn-sm" onClick={copy} type="button">
      <Icon name={copied ? "check" : "copy"} size={16} />
      {copied ? t("action.copied") : (label ?? t("action.copy"))}
    </button>
  );
}

interface AnswerCardProps {
  title: string;
  provider?: Provider;
  copyText?: string;
  download?: { name: string; text?: string; href?: string };
  messageId?: string | null;
  onRegenerate?: () => void;
  children: ReactNode;
}

/** Shared frame for every tool result with the Copy / Save / Download / Regenerate actions. */
export function AnswerCard({ title, provider, copyText, download, messageId, onRegenerate, children }: AnswerCardProps) {
  const { t } = useI18n();
  const notify = useNotify();
  const [saved, setSaved] = useState(false);

  const toggleSave = async () => {
    if (!messageId) return;
    try {
      await historyService.setSaved(messageId, !saved);
      setSaved(!saved);
      if (!saved) notify(t("action.saved"));
    } catch {
      notify(t("err.DB_UNAVAILABLE"), "error");
    }
  };

  return (
    <article className="card answer">
      <header className="answer-head">
        <h2>{title}</h2>
        {provider && (
          <span className={`badge ${provider === "ai" ? "badge-ai" : ""}`}>
            <Icon name={provider === "ai" ? "spark" : "check"} size={14} />
            {provider === "ai" ? t("answer.ai") : t("answer.offline")}
          </span>
        )}
      </header>
      <div className="answer-body">{children}</div>
      <footer className="answer-actions">
        {copyText !== undefined && <CopyButton text={copyText} />}
        {messageId && (
          <button aria-pressed={saved} className="btn btn-ghost btn-sm" onClick={toggleSave} type="button">
            <Icon name={saved ? "check" : "save"} size={16} />
            {saved ? t("action.saved") : t("action.save")}
          </button>
        )}
        {download?.href && (
          <a className="btn btn-ghost btn-sm" download href={download.href}>
            <Icon name="download" size={16} />
            {t("action.download")}
          </a>
        )}
        {download?.text !== undefined && (
          <button className="btn btn-ghost btn-sm" onClick={() => downloadText(download.name, download.text ?? "")} type="button">
            <Icon name="download" size={16} />
            {t("action.download")}
          </button>
        )}
        {onRegenerate && (
          <button className="btn btn-ghost btn-sm" onClick={onRegenerate} type="button">
            <Icon name="refresh" size={16} />
            {t("action.regenerate")}
          </button>
        )}
      </footer>
    </article>
  );
}
