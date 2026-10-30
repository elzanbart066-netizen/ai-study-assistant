import { useEffect, useRef, useState } from "react";
import { ErrorBox } from "../components/ErrorBox.js";
import { Icon } from "../components/Icon.js";
import { useNotify } from "../components/Notification.js";
import { PageHeader } from "../components/PageHeader.js";
import { ImageView, operationLabel } from "../components/Results.js";
import { UploadPanel } from "../components/UploadPanel.js";
import type { MessageKey } from "../i18n/dictionary.js";
import { useI18n } from "../i18n/I18nProvider.js";
import {
  DEFAULT_SETTINGS,
  type EditSettings,
  loadImage,
  operationsOf,
  parseInstruction,
  readAsDataUrl,
  renderEdited,
} from "../services/imageOps.js";
import { imageService } from "../services/index.js";
import { useRequest } from "../services/useRequest.js";

const SLIDERS: { key: "brightness" | "contrast" | "saturation" | "blur"; label: MessageKey; min: number; max: number }[] = [
  { key: "brightness", label: "tool.images.brightness", min: 30, max: 200 },
  { key: "contrast", label: "tool.images.contrast", min: 30, max: 200 },
  { key: "saturation", label: "tool.images.saturation", min: 0, max: 250 },
  { key: "blur", label: "tool.images.blur", min: 0, max: 10 },
];
const TOGGLES: { key: "grayscale" | "sepia" | "invert" | "flip" | "crop"; label: MessageKey }[] = [
  { key: "grayscale", label: "tool.images.grayscale" },
  { key: "sepia", label: "tool.images.sepia" },
  { key: "invert", label: "tool.images.invert" },
  { key: "flip", label: "tool.images.flip" },
  { key: "crop", label: "tool.images.crop" },
];

export function ImagesPage() {
  const { t, language } = useI18n();
  const notify = useNotify();
  const [original, setOriginal] = useState<{ url: string; mime: string } | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [settings, setSettings] = useState<EditSettings>(DEFAULT_SETTINGS);
  const [instruction, setInstruction] = useState("");
  const [preview, setPreview] = useState<string>("");
  const [compare, setCompare] = useState(50);
  const [invalid, setInvalid] = useState(false);
  const req = useRequest(imageService.save);
  const renderTimer = useRef<number>(undefined);

  useEffect(() => {
    if (!img || !original) return;
    window.clearTimeout(renderTimer.current);
    renderTimer.current = window.setTimeout(() => setPreview(renderEdited(img, settings, original.mime)), 60);
    return () => window.clearTimeout(renderTimer.current);
  }, [img, settings, original]);

  const onFile = async (file: File) => {
    setInvalid(false);
    req.setData(null);
    const url = await readAsDataUrl(file);
    setOriginal({ url, mime: file.type });
    setImg(await loadImage(url));
    setSettings(DEFAULT_SETTINGS);
  };

  const applyInstruction = () => {
    const parsed = parseInstruction(instruction);
    const keys = Object.keys(parsed);
    if (keys.length === 0) {
      notify(t("tool.images.notUnderstood"), "info");
      return;
    }
    setSettings((s) => ({ ...s, ...parsed }));
    const labels = operationsOf({ ...DEFAULT_SETTINGS, ...parsed }).map((op) => operationLabel(op, t));
    notify(t("tool.images.understood", { ops: labels.join(", ") }), "info");
  };

  const ops = operationsOf(settings);
  const submit = () => {
    if (!original || !preview || ops.length === 0) return;
    void req.run({ original: original.url, edited: preview, operations: ops, instruction, language });
  };

  return (
    <div className="tool-page">
      <PageHeader icon="image" lead={t("tool.images.lead")} title={t("tool.images.title")} />
      {!original ? (
        <div className="card">
          <UploadPanel onFile={onFile} onInvalid={() => setInvalid(true)} />
          {invalid && (
            <p className="field-error" role="alert">
              {t("err.IMAGE_INVALID")}
            </p>
          )}
        </div>
      ) : (
        <div className="image-editor">
          <div className="card editor-stage">
            <div className="compare-slider" style={{ ["--pos" as string]: `${compare}%` }}>
              <img alt={t("tool.images.original")} className="cmp-base" src={original.url} />
              {preview && <img alt={t("tool.images.edited")} className="cmp-top" src={preview} />}
              <span className="cmp-label cmp-left">{t("tool.images.edited")}</span>
              <span className="cmp-label cmp-right">{t("tool.images.original")}</span>
            </div>
            <label className="range-field">
              <span>{t("tool.images.compare")}</span>
              <input max={100} min={0} onChange={(e) => setCompare(Number(e.target.value))} type="range" value={compare} />
            </label>
          </div>
          <div className="card editor-controls">
            <label className="label" htmlFor="img-instruction">
              {t("tool.images.instruction")}
            </label>
            <textarea
              id="img-instruction"
              maxLength={500}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={t("tool.images.instructionPlaceholder")}
              rows={3}
              value={instruction}
            />
            <button className="btn btn-ghost" onClick={applyInstruction} type="button">
              <Icon name="spark" size={18} />
              {t("tool.images.apply")}
            </button>
            <hr />
            {SLIDERS.map((s) => (
              <label className="range-field" key={s.key}>
                <span>
                  {t(s.label)} <output>{settings[s.key]}</output>
                </span>
                <input
                  max={s.max}
                  min={s.min}
                  onChange={(e) => setSettings((v) => ({ ...v, [s.key]: Number(e.target.value) }))}
                  type="range"
                  value={settings[s.key]}
                />
              </label>
            ))}
            <div className="toggle-grid">
              {TOGGLES.map((tg) => (
                <label className="check" key={tg.key}>
                  <input
                    checked={settings[tg.key]}
                    onChange={(e) => setSettings((v) => ({ ...v, [tg.key]: e.target.checked }))}
                    type="checkbox"
                  />
                  {t(tg.label)}
                </label>
              ))}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setSettings((v) => ({ ...v, rotate: ((v.rotate + 90) % 360) as EditSettings["rotate"] }))}
                type="button"
              >
                <Icon name="refresh" size={16} />
                {t("tool.images.rotate")} {settings.rotate}°
              </button>
            </div>
            <label className="field">
              <span className="label">{t("tool.images.text")}</span>
              <input maxLength={60} onChange={(e) => setSettings((v) => ({ ...v, text: e.target.value }))} value={settings.text} />
            </label>
            <label className="inline-field">
              {t("tool.images.background")}
              <input
                onChange={(e) => setSettings((v) => ({ ...v, background: e.target.value }))}
                type="color"
                value={settings.background ?? "#ffffff"}
              />
            </label>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setSettings(DEFAULT_SETTINGS)} type="button">
                {t("tool.images.reset")}
              </button>
              <button
                aria-label={t("upload.choose")}
                className="btn btn-ghost"
                onClick={() => {
                  setOriginal(null);
                  setImg(null);
                  setPreview("");
                }}
                title={t("upload.choose")}
                type="button"
              >
                <Icon name="upload" size={16} />
              </button>
              <button className="btn btn-primary" disabled={req.loading || ops.length === 0} onClick={submit} type="button">
                {req.loading ? <span className="spinner" aria-hidden="true" /> : <Icon name="image" size={18} />}
                {t("tool.images.submit")}
              </button>
            </div>
          </div>
        </div>
      )}
      {req.error ? <ErrorBox error={req.error} onRetry={req.retry} /> : null}
      {req.data && <ImageView messageId={req.data.messageId} result={req.data.result} />}
    </div>
  );
}
