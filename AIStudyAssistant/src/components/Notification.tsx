import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { Icon } from "./Icon.js";

type Kind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: Kind;
  text: string;
}

const NotificationContext = createContext<(text: string, kind?: Kind) => void>(() => undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((text: string, kind: Kind = "success") => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-2), { id, kind, text }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3500);
  }, []);
  const value = useMemo(() => notify, [notify]);
  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="toasts" role="status">
        {toasts.map((t) => (
          <div className={`toast toast-${t.kind}`} key={t.id}>
            <Icon name={t.kind === "error" ? "alert" : t.kind === "info" ? "info" : "check"} size={18} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export const useNotify = () => useContext(NotificationContext);
