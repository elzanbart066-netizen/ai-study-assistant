import { type DragEvent, useId, useState } from "react";
import { useI18n } from "../i18n/I18nProvider.js";
import { Icon } from "./Icon.js";

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface UploadPanelProps {
  onFile: (file: File) => void;
  onInvalid: () => void;
}

export function UploadPanel({ onFile, onInvalid }: UploadPanelProps) {
  const { t } = useI18n();
  const id = useId();
  const [dragging, setDragging] = useState(false);

  const accept = (file: File | undefined) => {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
      onInvalid();
      return;
    }
    onFile(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    accept(e.dataTransfer.files[0]);
  };

  return (
    <div
      className={`upload ${dragging ? "dragging" : ""}`}
      onDragLeave={() => setDragging(false)}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDrop={onDrop}
    >
      <Icon name="upload" size={30} />
      <p>
        {t("upload.drop")}{" "}
        <label className="link" htmlFor={id}>
          {t("upload.choose")}
        </label>
      </p>
      <small>{t("upload.limits")}</small>
      <input
        accept={IMAGE_TYPES.join(",")}
        className="visually-hidden"
        id={id}
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = "";
        }}
        type="file"
      />
    </div>
  );
}
