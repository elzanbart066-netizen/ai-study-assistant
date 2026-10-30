import type {
  AskResult,
  CodeLanguage,
  CodeResult,
  FileResult,
  ImageResult,
  SolveResult,
} from "../models/index.js";
import type { MessageKey } from "../i18n/dictionary.js";
import { useI18n } from "../i18n/I18nProvider.js";
import { assetUrl } from "../services/api.js";
import { AnswerCard, CopyButton } from "./AnswerCard.js";
import { Icon } from "./Icon.js";
import { RichText } from "./RichText.js";
import { SourceCard } from "./SourceCard.js";

interface ViewProps<T> {
  result: T;
  messageId?: string | null;
  onRegenerate?: () => void;
}

export function AskView({ result, messageId, onRegenerate }: ViewProps<AskResult>) {
  const { t } = useI18n();
  const copy = [result.summary, result.explanation, result.example, ...result.sources.map((s) => `${s.title}: ${s.url}`)]
    .filter(Boolean)
    .join("\n\n");
  return (
    <AnswerCard
      copyText={copy}
      download={{ name: "answer.txt", text: copy }}
      messageId={messageId}
      onRegenerate={onRegenerate}
      provider={result.provider}
      title={t("tool.ask.title")}
    >
      <section className="answer-summary">
        <h3>{t("answer.summary")}</h3>
        <RichText text={result.summary} />
      </section>
      {result.explanation && (
        <section>
          <h3>{t("answer.explanation")}</h3>
          <RichText text={result.explanation} />
        </section>
      )}
      {result.example && (
        <section className="answer-example">
          <h3>{t("answer.example")}</h3>
          <RichText text={result.example} />
        </section>
      )}
      {result.uncertainty && (
        <div className="alert alert-warn">
          <Icon name="info" />
          <div>
            <strong>{t("answer.uncertainty")}</strong>
            <RichText text={result.uncertainty} />
          </div>
        </div>
      )}
      <section>
        <h3>{t("answer.sources")}</h3>
        {result.sources.length > 0 ? (
          <div className="sources">
            {result.sources.map((s, i) => (
              <SourceCard index={i} key={s.url} source={s} />
            ))}
          </div>
        ) : (
          <p className="muted">{t("answer.noSources")}</p>
        )}
        {result.license && <p className="muted small">{t("answer.license", { license: result.license })}</p>}
      </section>
    </AnswerCard>
  );
}

export function SolveView({ result, messageId, onRegenerate }: ViewProps<SolveResult>) {
  const { t } = useI18n();
  const copy = [
    `${t("answer.given")}: ${result.given}`,
    `${t("answer.method")}: ${result.method}`,
    ...result.steps.map((s, i) => `${i + 1}. ${s}`),
    `${t("answer.answer")}: ${result.answer}`,
    `${t("answer.check")}: ${result.check}`,
  ].join("\n");
  return (
    <AnswerCard
      copyText={copy}
      download={{ name: "solution.txt", text: copy }}
      messageId={messageId}
      onRegenerate={onRegenerate}
      provider={result.provider}
      title={t("tool.solve.title")}
    >
      <dl className="solve-grid">
        <dt>{t("answer.given")}</dt>
        <dd className="math">{result.given}</dd>
        <dt>{t("answer.method")}</dt>
        <dd>{result.method}</dd>
      </dl>
      <section>
        <h3>{t("answer.steps")}</h3>
        <ol className="steps">
          {result.steps.map((s, i) => (
            <li key={i}>
              {s}
            </li>
          ))}
        </ol>
      </section>
      {result.table && (
        <div className="table-wrap">
          <table className="truth-table">
            <thead>
              <tr>
                {result.table.headers.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td className={j === row.length - 1 ? (cell === "1" ? "yes" : "no") : ""} key={j}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="final-answer">
        <span>{t("answer.answer")}</span>
        <strong className="math">{result.answer}</strong>
      </div>
      <section className="check">
        <h3>
          <Icon name="check" size={18} /> {t("answer.check")}
        </h3>
        <p className="pre">{result.check}</p>
      </section>
    </AnswerCard>
  );
}

const EXT: Record<CodeLanguage, string> = { python: "py", javascript: "js", java: "java", cpp: "cpp", csharp: "cs" };
export const CODE_LABEL: Record<CodeLanguage, string> = {
  python: "Python",
  javascript: "JavaScript",
  java: "Java",
  cpp: "C++",
  csharp: "C#",
};

export function CodeView({ result, messageId, onRegenerate }: ViewProps<CodeResult>) {
  const { t } = useI18n();
  const fileName = result.language === "java" ? "Main.java" : `main.${EXT[result.language]}`;
  return (
    <AnswerCard
      copyText={result.code}
      download={{ name: fileName, text: `${result.code}\n` }}
      messageId={messageId}
      onRegenerate={onRegenerate}
      provider={result.provider}
      title={`${t("answer.code")} · ${CODE_LABEL[result.language]}`}
    >
      <div className="code-block">
        <div className="code-head">
          <span>{fileName}</span>
          <CopyButton text={result.code} />
        </div>
        <pre>
          <code>{result.code}</code>
        </pre>
      </div>
      {result.explanation && (
        <section>
          <h3>{t("answer.explanation")}</h3>
          <RichText text={result.explanation} />
        </section>
      )}
      {(result.sampleInput || result.sampleOutput) && (
        <div className="io-grid">
          <div>
            <h3>{t("answer.sampleInput")}</h3>
            <pre className="io">{result.sampleInput || "—"}</pre>
          </div>
          <div>
            <h3>{t("answer.sampleOutput")}</h3>
            <pre className="io">{result.sampleOutput || "—"}</pre>
          </div>
        </div>
      )}
    </AnswerCard>
  );
}

export function FileView({ result, messageId, onRegenerate }: ViewProps<FileResult>) {
  const { t } = useI18n();
  return (
    <AnswerCard
      download={{ name: result.name, href: assetUrl(result.assetId) }}
      messageId={messageId}
      onRegenerate={onRegenerate}
      provider={result.provider}
      title={`${t("tool.files.preview")} · ${result.format.toUpperCase()}`}
    >
      <div className={`doc-preview doc-${result.format}`}>
        {result.format === "pptx" ? (
          <div className="slides">
            <div className="slide slide-title">{result.title}</div>
            {result.sections.map((s) => (
              <div className="slide" key={s.heading}>
                <strong>{s.heading}</strong>
                <ul>
                  {s.paragraphs.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="doc-page">
            <h1>{result.title}</h1>
            {result.sections.map((s) => (
              <section key={s.heading}>
                <h2>{s.heading}</h2>
                {s.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
      {result.sources.length > 0 && (
        <section>
          <h3>{t("answer.sources")}</h3>
          <div className="sources">
            {result.sources.map((s, i) => (
              <SourceCard index={i} key={s.url} source={s} />
            ))}
          </div>
        </section>
      )}
    </AnswerCard>
  );
}

const OPERATION_LABEL: Record<string, MessageKey> = {
  crop: "tool.images.crop",
  rotate: "tool.images.rotate",
  flip: "tool.images.flip",
  brightness: "tool.images.brightness",
  contrast: "tool.images.contrast",
  saturation: "tool.images.saturation",
  grayscale: "tool.images.grayscale",
  sepia: "tool.images.sepia",
  invert: "tool.images.invert",
  blur: "tool.images.blur",
  background: "tool.images.background",
  text: "tool.images.text",
  recolor: "tool.images.recolor",
};

export function operationLabel(op: string, t: (key: MessageKey) => string): string {
  const key = OPERATION_LABEL[op];
  return key ? t(key) : op;
}

export function ImageView({ result, messageId }: ViewProps<ImageResult>) {
  const { t } = useI18n();
  return (
    <AnswerCard
      download={{ name: `edited.${result.format}`, href: assetUrl(result.editedAssetId) }}
      messageId={messageId}
      title={t("tool.images.compare")}
    >
      <div className="compare">
        <figure>
          <img alt={t("tool.images.original")} src={assetUrl(result.originalAssetId, true)} />
          <figcaption>{t("tool.images.original")}</figcaption>
        </figure>
        <figure>
          <img alt={t("tool.images.edited")} src={assetUrl(result.editedAssetId, true)} />
          <figcaption>{t("tool.images.edited")}</figcaption>
        </figure>
      </div>
      <p className="muted">{result.operations.map((op) => operationLabel(op, t)).join(" · ")}</p>
    </AnswerCard>
  );
}
