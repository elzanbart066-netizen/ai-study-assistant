import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/I18nProvider.js";
import type { Language, PublicUser } from "../models/index.js";
import { authService, profileService } from "./index.js";

interface AuthValue {
  user: PublicUser | null;
  loading: boolean;
  setUser: (user: PublicUser | null) => void;
  logout: () => Promise<void>;
  changeLanguage: (language: Language) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setLanguage } = useI18n();
  const [user, setUserState] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const setUser = useCallback(
    (next: PublicUser | null) => {
      setUserState(next);
      if (next) setLanguage(next.language);
    },
    [setLanguage],
  );

  useEffect(() => {
    authService
      .me()
      .then(({ user: me }) => setUser(me))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [setUser]);

  const logout = useCallback(async () => {
    await authService.logout().catch(() => undefined);
    setUserState(null);
  }, []);

  const changeLanguage = useCallback(
    (language: Language) => {
      setLanguage(language);
      if (user) {
        // The choice is stored in the profile; the UI switches immediately either way.
        profileService
          .setLanguage(language)
          .then((r) => setUserState(r.user))
          .catch(() => undefined);
      }
    },
    [setLanguage, user],
  );

  const value = useMemo(() => ({ user, loading, setUser, logout, changeLanguage }), [user, loading, setUser, logout, changeLanguage]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
