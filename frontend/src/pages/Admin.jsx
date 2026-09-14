import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import { clearApplicationData, createBackup, getAdminDashboard } from "../services/api";

export default function Admin({ onCleared }) {
  const [stats, setStats] = useState(null);
  const [showReset, setShowReset] = useState(false);
  const [code, setCode] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadStats() {
    try { setStats(await getAdminDashboard()); } catch (err) { setError(err.message); }
  }

  useEffect(() => { loadStats(); }, []);

  async function backup() {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await createBackup();
      setMessage(result.path ? `Backup creat: ${result.path}` : result.message);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function resetEverything() {
    if (!acknowledged || !code) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await clearApplicationData(code);
      setMessage(`Datele au fost șterse. Backup de siguranță: ${result.backup_path || "indisponibil"}`);
      setShowReset(false);
      setCode("");
      setAcknowledged(false);
      await loadStats();
      await onCleared?.();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <section className="page admin-page">
      <div className="page-intro">
        <div>
          <span className="page-kicker">SYSTEM CONTROL</span>
          <h2>Administrare sistem</h2>
          <p>Operații de mentenanță pentru mediul de test: backup, stare bazei de date și reset complet controlat.</p>
        </div>
      </div>

      {message && <div className="alert alert-success"><strong>Operație finalizată.</strong><span>{message}</span></div>}
      {error && <div className="alert alert-error"><strong>Operația a eșuat.</strong><span>{error}</span></div>}

      <div className="admin-status-grid">
        <div className="panel admin-summary-card"><span>Obiecte</span><strong>{stats?.devices_total ?? "—"}</strong><small>{stats?.devices_available ?? 0} disponibile</small></div>
        <div className="panel admin-summary-card"><span>Împrumuturi active</span><strong>{stats?.active_loans ?? "—"}</strong><small>urmărite în timp real</small></div>
        <div className="panel admin-summary-card"><span>Jurnal</span><strong>{stats?.journal_total ?? "—"}</strong><small>evenimente detaliate</small></div>
        <div className="panel admin-summary-card"><span>Notificări necitite</span><strong>{stats?.unread_notifications ?? "—"}</strong><small>în centrul de notificări</small></div>
      </div>

      <div className="admin-settings-grid">
        <div className="panel maintenance-card">
          <div className="maintenance-icon"><Icon name="database" size={22} /></div>
          <div>
            <span className="panel-eyebrow">RECOVERY</span>
            <h3>Backup manual</h3>
            <p>Creează o copie SQLite înainte de teste mai agresive sau modificări de structură.</p>
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
          <button className="btn btn-danger" onClick={() => setShowReset(true)}><Icon name="trash" size={15} /> Clear all application data</button>
        </div>
      </div>

      {showReset && (
        <div className="reset-modal-backdrop" onMouseDown={() => !busy && setShowReset(false)}>
          <div className="reset-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="reset-modal-icon"><Icon name="alert" size={26} /></div>
            <span className="panel-eyebrow">CONFIRMARE NECESARĂ</span>
            <h3>Ștergi toate datele aplicației?</h3>
            <p>Această funcție este destinată mediului de test. Datele din baza curentă și imaginile încărcate vor fi eliminate.</p>
            <label className="field">
              <span>Cod special administrator</span>
              <input type="password" autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Introdu codul de reset" />
            </label>
            <label className="reset-check">
              <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
              <span>Înțeleg că operația șterge toate datele de test curente.</span>
            </label>
            <div className="reset-actions">
              <button className="btn btn-secondary" onClick={() => setShowReset(false)} disabled={busy}>Anulează</button>
              <button className="btn btn-danger" onClick={resetEverything} disabled={busy || !acknowledged || !code}>{busy ? "Se șterge..." : "Confirmă resetarea"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
