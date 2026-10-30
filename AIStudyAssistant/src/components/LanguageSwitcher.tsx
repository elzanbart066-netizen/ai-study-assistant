import { useI18n } from "../i18n/I18nProvider.js";
import { LANGUAGES, type Language } from "../models/index.js";
import { useAuth } from "../services/AuthProvider.js";

const LABEL: Record<Language, string> = { kk: "ҚАЗ", ru: "РУС", en: "ENG" };
const FULL: Record<Language, string> = { kk: "Қазақша", ru: "Русский", en: "English" };

export function LanguageSwitcher() {
  const { language, t } = useI18n();
  const { changeLanguage } = useAuth();
  return (
    <div aria-label={t("nav.language")} className="lang-switch" role="group">
      {LANGUAGES.map((lang) => (
        <button
          aria-label={FULL[lang]}
          aria-pressed={lang === language}
          className={lang === language ? "active" : ""}
          key={lang}
          lang={lang}
          onClick={() => changeLanguage(lang)}
          type="button"
        >
          {LABEL[lang]}
        </button>
      ))}
    </div>
  );
}
