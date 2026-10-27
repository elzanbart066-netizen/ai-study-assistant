import { useState } from "react";
import { Link } from "react-router-dom";
import { ErrorBox, fieldError } from "../components/ErrorBox.js";
import { ChatInput } from "../components/ChatInput.js";
import { Icon } from "../components/Icon.js";
import { PageHeader, Thinking } from "../components/PageHeader.js";
import { AskView } from "../components/Results.js";
import { useI18n } from "../i18n/I18nProvider.js";
import { assistantService } from "../services/index.js";
import { useRequest } from "../services/useRequest.js";

const EXAMPLES = {
  kk: ["Фотосинтез қалай жүреді?", "Ньютонның үш заңын мысалмен түсіндір", "Қазақ хандығы қашан құрылды?"],
  ru: ["Как происходит фотосинтез?", "Объясни три закона Ньютона с примерами", "Что такое инфляция?"],
  en: ["How does photosynthesis work?", "Explain Newton's three laws with examples", "What is inflation?"],
};

export function AskPage() {
  const { t, language } = useI18n();
  const [prompt, setPrompt] = useState("");
  const [web, setWeb] = useState(true);
  const [localError, setLocalError] = useState<string>();
  const req = useRequest(assistantService.ask);

  const submit = () => {
    if (!prompt.trim()) {
      setLocalError(t("field.promptEmpty"));
      return;
    }
    setLocalError(undefined);
    void req.run(prompt.trim(), web, language);
  };

  const kind = req.data?.kind;
  const suggestion = kind === "math" || kind === "logic" ? { to: "/solve", label: t("nav.solve") } : kind === "code" ? { to: "/code", label: t("nav.code") } : null;

  return (
    <div className="tool-page">
      <PageHeader icon="ask" lead={t("tool.ask.lead")} title={t("tool.ask.title")} />
      <ChatInput
        error={localError ?? fieldError(req.error, "prompt", t)}
        examples={EXAMPLES[language]}
        label={t("tool.ask.title")}
        loading={req.loading}
        onChange={setPrompt}
        onSubmit={submit}
        placeholder={t("tool.ask.placeholder")}
        submitLabel={t("tool.ask.submit")}
        value={prompt}
      >
        <label className="switch">
          <input checked={web} onChange={(e) => setWeb(e.target.checked)} type="checkbox" />
          <span className="switch-track" aria-hidden="true" />
          <Icon name="globe" size={16} />
          {t("tool.ask.web")}
        </label>
      </ChatInput>
      {req.loading && <Thinking text={t("status.thinking")} />}
      {!req.loading && req.error && !fieldError(req.error, "prompt", t) ? <ErrorBox error={req.error} onRetry={req.retry} /> : null}
      {!req.loading && req.data && (
        <>
          {suggestion && (
            <p className="alert alert-info">
              <Icon name="info" />
              <span>
                {t("answer.tryTool", { tool: suggestion.label })} <Link to={suggestion.to}>{suggestion.label} →</Link>
              </span>
            </p>
          )}
          <AskView messageId={req.data.messageId} onRegenerate={req.retry} result={req.data.result} />
        </>
      )}
    </div>
  );
}
