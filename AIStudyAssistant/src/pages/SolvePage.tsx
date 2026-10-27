import { useState } from "react";
import { ChatInput } from "../components/ChatInput.js";
import { ErrorBox, fieldError } from "../components/ErrorBox.js";
import { PageHeader, Thinking } from "../components/PageHeader.js";
import { SolveView } from "../components/Results.js";
import { useI18n } from "../i18n/I18nProvider.js";
import { assistantService } from "../services/index.js";
import { useRequest } from "../services/useRequest.js";

const EXAMPLES = ["2x + 5 = 13", "x² − 5x + 6 = 0", "(12 + 8) · 3 − 15 : 5", "(A ∨ B) ∧ ¬A"];
const SYMBOLS = ["²", "√", "·", ":", "(", ")", "∧", "∨", "¬", "→", "↔"];

export function SolvePage() {
  const { t, language } = useI18n();
  const [prompt, setPrompt] = useState("");
  const [localError, setLocalError] = useState<string>();
  const req = useRequest(assistantService.solve);

  const submit = () => {
    if (!prompt.trim()) {
      setLocalError(t("field.promptEmpty"));
      return;
    }
    setLocalError(undefined);
    void req.run(prompt.trim(), language);
  };

  return (
    <div className="tool-page">
      <PageHeader icon="solve" lead={t("tool.solve.lead")} title={t("tool.solve.title")} />
      <ChatInput
        error={localError ?? fieldError(req.error, "prompt", t)}
        examples={EXAMPLES}
        label={t("tool.solve.title")}
        loading={req.loading}
        onChange={setPrompt}
        onSubmit={submit}
        placeholder={t("tool.solve.placeholder")}
        submitLabel={t("tool.solve.submit")}
        value={prompt}
      >
        <div aria-label="symbols" className="symbol-bar" role="group">
          {SYMBOLS.map((s) => (
            <button className="chip chip-sym" key={s} onClick={() => setPrompt((p) => p + s)} type="button">
              {s}
            </button>
          ))}
        </div>
      </ChatInput>
      {req.loading && <Thinking text={t("status.thinking")} />}
      {!req.loading && req.error && !fieldError(req.error, "prompt", t) ? <ErrorBox error={req.error} onRetry={req.retry} /> : null}
      {!req.loading && req.data && <SolveView messageId={req.data.messageId} onRegenerate={req.retry} result={req.data.result} />}
    </div>
  );
}
