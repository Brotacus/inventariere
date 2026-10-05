import { useEffect, useRef, useState } from "react";

import Icon from "./Icon";
import usePendingAction from "../hooks/usePendingAction";
import { getLoginMethods } from "../services/api";

export default function LoginScreen({ theme, onToggleTheme, onLogin, checking = false, verificationError = "", onRetryVerification }) {
  const [methods, setMethods] = useState({ password: true, ldap: false });
  const [mode, setMode] = useState("password");
  const [methodsError, setMethodsError] = useState("");
  const [methodsAttempt, setMethodsAttempt] = useState(0);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const { busy: submitting, beginAction, endAction } = usePendingAction();
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const usernameRef = useRef(null);
  const ldap = mode === "ldap";
  const canSubmit = Boolean(password && (!ldap || username.trim()));

  useEffect(() => {
    const controller = new AbortController();
    setMethodsError("");
    getLoginMethods(controller.signal).then((available) => {
      setMethods({ password: Boolean(available?.password), ldap: Boolean(available?.ldap) });
      setMode(available?.ldap ? "ldap" : "password");
    }).catch((err) => {
      // Say so instead of silently offering a form that may not be enabled.
      if (!controller.signal.aborted) setMethodsError(err.message || "Serverul nu a răspuns.");
    });
    return () => controller.abort();
  }, [methodsAttempt]);

  useEffect(() => {
    (ldap ? usernameRef : inputRef).current?.focus();
  }, [ldap]);

  function chooseMode(next) {
    setMode(next);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit || checking || !beginAction()) return;
    setError("");
    try {
      await onLogin(password, ldap ? username.trim() : "");
      setPassword("");
    } catch (err) {
      setError(err.message || "Autentificarea nu a reușit.");
      requestAnimationFrame(() => inputRef.current?.focus());
    } finally {
      endAction();
    }
  }

  return (
    <main className="login-shell">
      <button
        type="button"
        className="login-theme-toggle"
        onClick={onToggleTheme}
        aria-label={theme === "dark" ? "Activează modul luminos" : "Activează modul întunecat"}
        title={theme === "dark" ? "Mod luminos" : "Dark mode"}
      >
        <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
      </button>

      <section className="login-stage">
        <div className="login-visual" aria-hidden="true">
          <div className="login-visual-content">
            <div className="login-brand-large">
              <div className="login-logo-frame">
                <img src="/inventory-logo.png" alt="" />
              </div>
              <div>
                <span>INVENTORY WORKSPACE</span>
                <strong>Inventar</strong>
              </div>
            </div>

            <div className="login-visual-copy">
              <span className="login-kicker">ASSET CONTROL / ADMIN</span>
              <h1>Control complet.<br />Acces controlat.</h1>
              <p>
                Inventar, împrumuturi, locații, fotografii și trasabilitate într-un singur workspace intern.
              </p>
            </div>

            <div className="login-visual-status">
              <div><span className="login-live-dot" /><strong>Acces administrativ</strong></div>
              <small>Autentificarea este necesară înainte de accesarea datelor.</small>
            </div>
          </div>
          <div className="login-grid-pattern" />
          <div className="login-orb login-orb-one" />
          <div className="login-orb login-orb-two" />
        </div>

        <div className="login-panel-wrap">
          <div className="login-panel">
            <div className="login-mobile-brand">
              <img src="/inventory-logo.png" alt="Inventar" />
              <div><strong>Inventar</strong><span>Asset Management</span></div>
            </div>

            <div className="login-heading">
              <div className="login-lock-icon"><Icon name="lock" size={20} /></div>
              <span>ACCES RESTRICȚIONAT</span>
              <h2>Autentificare administrator</h2>
              <p>{ldap
                ? "Autentifică-te cu contul instituțional (LDAP) pentru a continua în workspace."
                : "Introdu parola de administrator pentru a continua în workspace."}</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
              {methods.ldap && methods.password && (
                <div className="segmented-control login-method-switch" role="group" aria-label="Metodă de autentificare">
                  <button type="button" className={ldap ? "active" : ""} aria-pressed={ldap} disabled={submitting || checking} onClick={() => chooseMode("ldap")}>Cont LDAP</button>
                  <button type="button" className={!ldap ? "active" : ""} aria-pressed={!ldap} disabled={submitting || checking} onClick={() => chooseMode("password")}>Administrator local</button>
                </div>
              )}

              {ldap ? (
                <label className="login-password-field">
                  <div className="login-field-label"><span>Utilizator</span></div>
                  <div className={`login-input-wrap ${error ? "has-error" : ""}`}>
                    <Icon name="user" size={17} />
                    <input
                      ref={usernameRef}
                      type="text"
                      value={username}
                      onChange={(event) => {
                        setUsername(event.target.value);
                        if (error) setError("");
                      }}
                      placeholder="nume.utilizator"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      name="username"
                      maxLength={64}
                      required
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? "login-error" : undefined}
                      disabled={submitting || checking}
                    />
                  </div>
                </label>
              ) : (
                <label className="login-identity-field">
                  <span>Cont</span>
                  <div>
                    <Icon name="user" size={17} />
                    <strong>Administrator</strong>
                    <em>LOCAL ADMIN</em>
                  </div>
                </label>
              )}

              <label className="login-password-field">
                <div className="login-field-label">
                  <span>Parolă</span>
                  {capsLock && <small>Caps Lock activ</small>}
                </div>
                <div className={`login-input-wrap ${error ? "has-error" : ""}`}>
                  <Icon name="lock" size={17} />
                  <input
                    ref={inputRef}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (error) setError("");
                    }}
                    onKeyUp={(event) => setCapsLock(event.getModifierState?.("CapsLock") || false)}
                    onKeyDown={(event) => setCapsLock(event.getModifierState?.("CapsLock") || false)}
                    placeholder="Introdu parola"
                    autoComplete="current-password"
                    name="password"
                    maxLength={256}
                    required
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "login-error" : undefined}
                    disabled={submitting || checking}
                  />
                  <button
                    type="button"
                    disabled={submitting || checking}
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Ascunde parola" : "Arată parola"}
                  >
                    <Icon name={showPassword ? "eyeOff" : "eye"} size={17} />
                  </button>
                </div>
              </label>

              {error && (
                <div className="login-error" id="login-error" role="alert">
                  <Icon name="alert" size={16} />
                  <span>{error}</span>
                </div>
              )}

              {methodsError && (
                <div className="login-verification-error" role="alert">
                  <p>Metodele de autentificare nu au putut fi încărcate. {methodsError}</p>
                  <button type="button" className="btn btn-secondary" disabled={submitting} onClick={() => setMethodsAttempt(attempt => attempt + 1)}>
                    Reîncearcă
                  </button>
                </div>
              )}

              {verificationError && (
                <div className="login-verification-error" role="alert">
                  <p>{verificationError}</p>
                  <button type="button" className="btn btn-secondary" disabled={checking || submitting} onClick={onRetryVerification}>
                    {checking ? "Se verifică…" : "Reverifică sesiunea"}
                  </button>
                </div>
              )}

              <button className="login-submit" type="submit" disabled={!canSubmit || submitting || checking}>
                {submitting || checking ? (
                  <><span className="login-spinner" /> Se verifică accesul...</>
                ) : (
                  <>Intră în aplicație <Icon name="arrow" size={17} /></>
                )}
              </button>
            </form>

            <a className="login-catalog-link" href="/catalog"><Icon name="inventory" size={18} /> Explorează catalogul public <Icon name="arrow" size={18} /></a>

            <div className="login-security-note">
              <Icon name="shield" size={17} />
              <div>
                <strong>Sesiune administrativă protejată</strong>
                <span>Accesul se păstrează doar pentru sesiunea curentă a browserului. La închiderea filei va fi necesară o nouă autentificare.</span>
              </div>
            </div>

            <div className="login-footer">
              <span><i /> Inventory API</span>
              <span>Protected workspace</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
