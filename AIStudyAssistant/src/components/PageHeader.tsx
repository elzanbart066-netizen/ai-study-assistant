import { type ReactNode, useEffect, useState } from "react";
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
  // A running counter shows the page has not frozen while a slow answer is prepared.
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div aria-live="polite" className="card thinking">
      <span className="dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {text}
      {seconds >= 3 && <span className="muted"> {seconds} s</span>}
    </div>
  );
}
