import { useEffect, useRef, useState } from "react";
import useDialogFocus from "../hooks/useDialogFocus";
import usePendingAction from "../hooks/usePendingAction";
import useLatestRequest from "../hooks/useLatestRequest";
import Icon from "../components/Icon";
import { clearApplicationData, createBackup, getAdminDashboard } from "../services/api";

export default function Admin({ onCleared }) {
  const [stats, setStats] = useState(null);
  const [showReset, setShowReset] = useState(false);
  const [code, setCode] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const { busy, beginAction, endAction } = usePendingAction();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dialogRef = useRef(null);
  const codeRef = useRef(null);
  const requests = useLatestRequest();

  function closeReset() {
    if (busy) return;
    setShowReset(false);
    setCode("");
    setAcknowledged(false);
    setError("");
  }
  useDialogFocus({ active: showReset, dialogRef, initialFocusRef: codeRef, onClose: closeReset });

  async function loadStats() {
    const request = requests.begin();
    try { const data = await getAdminDashboard(); if (requests.isCurrent(request)) { setStats(data); setError(""); } }
    catch (err) { if (requests.isCurrent(request)) setError(err.message); }
  }

  useEffect(() => { loadStats(); }, []);

  async function backup() {
    if (!beginAction()) return;
    setError(""); setMessage("");
    try {
      const result = await createBackup();
      setMessage(result.path ? `Backup creat: ${result.path}` : result.message);
    } catch (err) { setError(err.message); }
    finally { endAction(); }
  }

  async function resetEverything() {
    if (!acknowledged || !code || !beginAction()) return;
    setError(""); setMessage("");
    try {
      const result = await clearApplicationData(code);
      setMessage(`Datele au fost șterse. Backup complet de siguranță: ${result.backup_path || "indisponibil"}${result.cleanup_pending ? ". Atenție: fotografiile au fost retrase din aplicație, dar curățarea folderului temporar de pe server trebuie finalizată." : ""}`);
      setShowReset(false);
      setCode("");
      setAcknowledged(false);
      await loadStats();
      await onCleared?.();
    } catch (err) { setError(err.message); }
    finally { endAction(); }
  }

  return (
    <section className="page admin-page">
      <div className="admin-page-content" inert={showReset ? true : undefined}>
      <div className="page-intro">
        <div>
          <span className="page-kicker">SYSTEM CONTROL</span>
          <h2>Administrare sistem</h2>
          <p>Operații de mentenanță pentru mediul de test: backup, stare bazei de date și reset complet controlat.</p>
        </div>
      </div>

      {message && <div className="alert alert-success" role="status"><strong>Operație finalizată.</strong><span>{message}</span></div>}
      {error && <div className="alert alert-error" role="alert"><strong>Operația a eșuat.</strong><span>{error}</span></div>}

      <div className="admin-status-grid">
        <div className="panel admin-summary-card"><span>Obiecte</span><strong>{stats?.devices_total ?? "—"}</strong><small>{stats?.devices_available ?? "—"} disponibile</small></div>
        <div className="panel admin-summary-card"><span>Împrumuturi active</span><strong>{stats?.active_loans ?? "—"}</strong><small>la ultima încărcare</small></div>
        <div className="panel admin-summary-card"><span>Jurnal</span><strong>{stats?.journal_total ?? "—"}</strong><small>evenimente detaliate</small></div>
        <div className="panel admin-summary-card"><span>Notificări necitite</span><strong>{stats?.unread_notifications ?? "—"}</strong><small>în centrul de notificări</small></div>
      </div>

      <div className="admin-settings-grid">
        <div className="panel maintenance-card">
          <div className="maintenance-icon"><Icon name="database" size={22} /></div>
          <div>
            <span className="panel-eyebrow">RECOVERY</span>
            <h3>Backup manual</h3>
            <p>Salvează baza de date și fotografiile într-o arhivă înainte de modificări importante.</p>
          </div>
          <button className="btn btn-secondary" onClick={backup} disabled={busy}><Icon name="database" size={15} /> Creează backup</button>
        </div>

        <div className="panel danger-zone">
          <div className="danger-zone-head">
            <div className="danger-icon"><Icon name="alert" size={22} /></div>
            <div>
              <span className="panel-eyebrow">DANGER ZONE</span>
              <h3>Reset complet al datelor</h3>
              <p>Șterge obiecte, persoane, locații, împrumuturi, imagini, loguri, jurnal și notificări. Structura aplicației și configurarea rămân intacte.</p>
            </div>
          </div>
          <div className="danger-note"><Icon name="shield" size={16} /><span>Backend-ul creează automat un backup chiar înainte de reset. Operația necesită codul de administrator configurat în <code>backend/.env</code>.</span></div>
          <button className="btn btn-danger" disabled={busy} onClick={() => { setError(""); setShowReset(true); }}><Icon name="trash" size={15} /> Clear all application data</button>
        </div>
      </div>
      </div>

      {showReset && (
        <div className="reset-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) closeReset(); }}>
          <div ref={dialogRef} className="reset-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description" aria-busy={busy} tabIndex={-1}>
            <div className="reset-modal-icon"><Icon name="alert" size={26} /></div>
            <span className="panel-eyebrow">CONFIRMARE NECESARĂ</span>
            <h3 id="reset-title">Ștergi toate datele aplicației?</h3>
            <p id="reset-description">Această funcție este destinată mediului de test. Datele din baza curentă și imaginile încărcate vor fi eliminate.</p>
            <label className="field">
              <span>Cod special administrator</span>
              <input ref={codeRef} type="password" autoComplete="off" maxLength={1024} disabled={busy} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Introdu codul de reset" />
            </label>
            <label className="reset-check">
              <input type="checkbox" disabled={busy} checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
              <span>Înțeleg că operația șterge toate datele de test curente.</span>
            </label>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <div className="reset-actions">
              <button className="btn btn-secondary" onClick={closeReset} disabled={busy}>Anulează</button>
              <button className="btn btn-danger" onClick={resetEverything} disabled={busy || !acknowledged || !code}>{busy ? "Se șterge..." : "Confirmă resetarea"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
