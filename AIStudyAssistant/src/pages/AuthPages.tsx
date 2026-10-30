import { type FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ErrorBox, fieldError } from "../components/ErrorBox.js";
import { Icon } from "../components/Icon.js";
import { useI18n } from "../i18n/I18nProvider.js";
import { ApiError } from "../services/api.js";
import { useAuth } from "../services/AuthProvider.js";
import { authService } from "../services/index.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  hint,
  autoComplete,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  autoComplete?: string;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label} <span className="req">*</span>
      </label>
      <input
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        aria-invalid={Boolean(error)}
        aria-required="true"
        autoComplete={autoComplete}
        id={id}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        value={value}
      />
      {hint && !error && (
        <small className="hint" id={`${id}-hint`}>
          {hint}
        </small>
      )}
      {error && (
        <p className="field-error" id={`${id}-err`}>
          {error}
        </p>
      )}
    </div>
  );
}

function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="card glossy auth-card">
        <span className="brand-mark big">
          <Icon name="logo" size={28} />
        </span>
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  );
}

export function LoginPage() {
  const { t } = useI18n();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      email: EMAIL_RE.test(email.trim()) ? undefined : t("field.email"),
      password: password ? undefined : t("auth.required"),
    };
    setErrors(next);
    if (next.email || next.password) return;
    setBusy(true);
    setError(null);
    try {
      const { user } = await authService.login(email, password);
      setUser(user);
      navigate((location.state as { from?: string } | null)?.from ?? "/dashboard", { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title={t("auth.loginTitle")}>
      <form className="form-grid" noValidate onSubmit={submit}>
        <Field autoComplete="email" error={errors.email} id="login-email" label={t("auth.email")} onChange={setEmail} type="email" value={email} />
        <Field
          autoComplete="current-password"
          error={errors.password}
          id="login-password"
          label={t("auth.password")}
          onChange={setPassword}
          type="password"
          value={password}
        />
        <ErrorBox error={error} />
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">
          {busy && <span className="spinner" aria-hidden="true" />}
          {t("auth.submitLogin")}
        </button>
      </form>
      <p className="muted small center">{t("auth.demo")}</p>
      <p className="center">
        {t("auth.noAccount")} <Link to="/register">{t("nav.register")}</Link>
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { t, language } = useI18n();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", passwordConfirm: "" });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      name: form.name.trim().length >= 2 ? undefined : t("field.name"),
      email: EMAIL_RE.test(form.email.trim()) ? undefined : t("field.email"),
      password: form.password.length >= 8 ? undefined : t("field.password"),
      passwordConfirm: form.password === form.passwordConfirm ? undefined : t("field.passwordConfirm"),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setBusy(true);
    setError(null);
    try {
      const { user } = await authService.register({ ...form, language });
      setUser(user);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_TAKEN") setErrors({ email: t("err.EMAIL_TAKEN") });
      else setError(err);
    } finally {
      setBusy(false);
    }
  };

  const serverField = (f: string) => fieldError(error, f, t);
  return (
    <AuthShell title={t("auth.registerTitle")}>
      <form className="form-grid" noValidate onSubmit={submit}>
        <Field autoComplete="name" error={errors.name ?? serverField("name")} id="reg-name" label={t("auth.name")} onChange={set("name")} value={form.name} />
        <Field autoComplete="email" error={errors.email ?? serverField("email")} id="reg-email" label={t("auth.email")} onChange={set("email")} type="email" value={form.email} />
        <Field
          autoComplete="new-password"
          error={errors.password ?? serverField("password")}
          hint={t("auth.passwordHint")}
          id="reg-password"
          label={t("auth.password")}
          onChange={set("password")}
          type="password"
          value={form.password}
        />
        <Field
          autoComplete="new-password"
          error={errors.passwordConfirm ?? serverField("passwordConfirm")}
          id="reg-password2"
          label={t("auth.passwordConfirm")}
          onChange={set("passwordConfirm")}
          type="password"
          value={form.passwordConfirm}
        />
        {error && !(error instanceof ApiError && error.field) ? <ErrorBox error={error} /> : null}
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">
          {busy && <span className="spinner" aria-hidden="true" />}
          {t("auth.submitRegister")}
        </button>
      </form>
      <p className="center">
        {t("auth.hasAccount")} <Link to="/login">{t("nav.login")}</Link>
      </p>
    </AuthShell>
  );
}
