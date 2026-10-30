import { type ReactNode, useEffect, useRef } from "react";
import { useI18n } from "../i18n/I18nProvider.js";
import { Icon } from "./Icon.js";

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}

export function Modal({ title, open, onClose, children, actions }: ModalProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog aria-labelledby="modal-title" className="modal" onClose={onClose} ref={ref}>
      <div className="modal-head">
        <h2 id="modal-title">{title}</h2>
        <button aria-label={t("action.close")} className="icon-btn" onClick={onClose} type="button">
          <Icon name="close" />
        </button>
      </div>
      <div className="modal-body">{children}</div>
      {actions && <div className="modal-actions">{actions}</div>}
    </dialog>
  );
}
