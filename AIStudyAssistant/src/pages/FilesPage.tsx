import { type FormEvent, useState } from "react";
import { ErrorBox, fieldError } from "../components/ErrorBox.js";
import { Icon } from "../components/Icon.js";
import { PageHeader, Thinking } from "../components/PageHeader.js";
import { FileView } from "../components/Results.js";
import { useI18n } from "../i18n/I18nProvider.js";
import { FILE_FORMATS, type FileFormat } from "../models/index.js";
import { fileService } from "../services/index.js";
import { useRequest } from "../services/useRequest.js";

const FORMAT_NOTE: Record<FileFormat, string> = { docx: "Word", pdf: "PDF", pptx: "PowerPoint", txt: "Text" };

export function FilesPage() {
  const { t, language } = useI18n();
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const [format, setFormat] = useState<FileFormat>("docx");
  const [errors, setErrors] = useState<{ title?: string; instruction?: string }>({});
  const req = useRequest(fileService.create);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = {
      title: title.trim() ? undefined : t("field.title"),
      instruction: instruction.trim() ? undefined : t("field.promptEmpty"),
    };
    setErrors(next);
    if (next.title || next.instruction) return;
    void req.run({ title: title.trim(), instruction: instruction.trim(), format, language });
  };

  const titleError = errors.title ?? fieldError(req.error, "title", t);
  const instructionError = errors.instruction ?? fieldError(req.error, "instruction", t);

  return (
    <div className="tool-page">
      <PageHeader icon="file" lead={t("tool.files.lead")} title={t("tool.files.title")} />
      <form className="card form-grid" noValidate onSubmit={submit}>
        <div className="field">
          <label className="label" htmlFor="file-title">
            {t("tool.files.fileTitle")} <span className="req">*</span>
          </label>
          <input
            aria-invalid={Boolean(titleError)}
            id="file-title"
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("tool.files.titlePlaceholder")}
            value={title}
          />
          {titleError && <p className="field-error">{titleError}</p>}
        </div>
        <div className="field">
          <label className="label" htmlFor="file-instruction">
            {t("tool.files.instruction")} <span className="req">*</span>
          </label>
          <textarea
            aria-invalid={Boolean(instructionError)}
            id="file-instruction"
            maxLength={4000}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={t("tool.files.instructionPlaceholder")}
            rows={4}
            value={instruction}
          />
          {instructionError && <p className="field-error">{instructionError}</p>}
        </div>
        <fieldset className="field">
          <legend className="label">{t("tool.files.format")}</legend>
          <div className="format-picker">
            {FILE_FORMATS.map((f) => (
              <label className={`format-option ${format === f ? "active" : ""}`} key={f}>
                <input checked={format === f} name="format" onChange={() => setFormat(f)} type="radio" value={f} />
                <strong>{f.toUpperCase()}</strong>
                <small>{FORMAT_NOTE[f]}</small>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="form-actions">
          <button className="btn btn-primary" disabled={req.loading} type="submit">
            {req.loading ? <span className="spinner" aria-hidden="true" /> : <Icon name="file" size={18} />}
            {t("tool.files.submit")}
          </button>
        </div>
      </form>
      {req.loading && <Thinking text={t("status.thinking")} />}
      {!req.loading && req.error && !titleError && !instructionError ? <ErrorBox error={req.error} onRetry={req.retry} /> : null}
      {!req.loading && req.data && <FileView messageId={req.data.messageId} onRegenerate={req.retry} result={req.data.result} />}
    </div>
  );
}
