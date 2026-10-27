import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon.js";

export function PageHeader({ icon, title, lead, children }: { icon: IconName; title: string; lead: string; children?: ReactNode }) {
  return (
    <div className="page-header">
      <span className="page-icon">
        <Icon name={icon} size={26} />
      </span>
      <div>
        <h1>{title}</h1>
        <p>{lead}</p>
      </div>
      {children}
    </div>
  );
}

export function Thinking({ text }: { text: string }) {
  return (
    <div aria-live="polite" className="card thinking">
      <span className="dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {text}
    </div>
  );
}
