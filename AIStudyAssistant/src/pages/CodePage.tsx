import { useId, useState } from "react";
import { ChatInput } from "../components/ChatInput.js";
import { ErrorBox, fieldError } from "../components/ErrorBox.js";
import { PageHeader, Thinking } from "../components/PageHeader.js";
import { CODE_LABEL, CodeView } from "../components/Results.js";
import { useI18n } from "../i18n/I18nProvider.js";
import { CODE_LANGUAGES, type CodeLanguage } from "../models/index.js";
import { assistantService } from "../services/index.js";
import { useRequest } from "../services/useRequest.js";

const EXAMPLES = {
  kk: ["n санының факториалы", "Массивті сұрыптау", "Сан жай сан ба, тексеру"],
  ru: ["Факториал числа n", "Сортировка массива", "Проверка простого числа"],
  en: ["Factorial of n", "Sort an array", "Check if a number is prime"],
};

export function CodePage() {
  const { t, language } = useI18n();
  const selectId = useId();
  const [prompt, setPrompt] = useState("");
  const [codeLanguage, setCodeLanguage] = useState<CodeLanguage>("python");
  const [localError, setLocalError] = useState<string>();
  const req = useRequest(assistantService.code);

  const submit = () => {
    if (!prompt.trim()) {
      setLocalError(t("field.promptEmpty"));
      return;
    }
    setLocalError(undefined);
    void req.run(prompt.trim(), codeLanguage, language);
  };

  return (
    <div className="tool-page">
      <PageHeader icon="code" lead={t("tool.code.lead")} title={t("tool.code.title")} />
      <ChatInput
        error={localError ?? fieldError(req.error, "prompt", t)}
        examples={EXAMPLES[language]}
        label={t("tool.code.title")}
        loading={req.loading}
        onChange={setPrompt}
        onSubmit={submit}
        placeholder={t("tool.code.placeholder")}
        submitLabel={t("tool.code.submit")}
        value={prompt}
      >
        <label className="inline-field" htmlFor={selectId}>
          {t("tool.code.language")}
          <select id={selectId} onChange={(e) => setCodeLanguage(e.target.value as CodeLanguage)} value={codeLanguage}>
            {CODE_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {CODE_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
      </ChatInput>
      {req.loading && <Thinking text={t("status.thinking")} />}
      {!req.loading && req.error && !fieldError(req.error, "prompt", t) ? <ErrorBox error={req.error} onRetry={req.retry} /> : null}
      {!req.loading && req.data && <CodeView messageId={req.data.messageId} onRegenerate={req.retry} result={req.data.result} />}
    </div>
  );
}
