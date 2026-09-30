import { useEffect, useMemo, useState } from "react";
import usePendingAction from "../hooks/usePendingAction";
import useLatestRequest from "../hooks/useLatestRequest";
import { formatDateTime } from "../hooks/dateFormatting";
import Icon from "../components/Icon";
import { createLoan, getDevices, getLoans, getPeople, returnLoan } from "../services/api";

export default function Loans({ onInventoryChanged }) {
  const [loans, setLoans] = useState([]);
  const [devices, setDevices] = useState([]);
  const [people, setPeople] = useState([]);
  const [form, setForm] = useState({ device_id: "", person_id: "" });
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const { busy, beginAction, endAction } = usePendingAction();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const requests = useLatestRequest();

  async function loadData() {
    const request = requests.begin();
    setLoading(true);
    try {
      const [loanData, deviceData, peopleData] = await Promise.all([getLoans(filter), getDevices(), getPeople(false, "borrower")]);
      if (!requests.isCurrent(request)) return;
      setLoans(loanData); setDevices(deviceData); setPeople(peopleData); setError("");
    } catch (err) { if (requests.isCurrent(request)) setError(err.message); }
    finally { if (requests.isCurrent(request)) setLoading(false); }
  }
  useEffect(() => { loadData(); }, [filter]);

  const availableDevices = useMemo(() => devices.filter((device) => device.status === "AVAILABLE"), [devices]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy || loading) return;
    setMessage(""); setError("");
    if (!beginAction()) return;
    try {
      await createLoan({ device_id: Number(form.device_id), person_id: Number(form.person_id) });
      setForm({ device_id: "", person_id: "" });
      setMessage("Împrumutul a fost înregistrat. Notificarea email va fi trimisă dacă persoana are adresă configurată.");
      await loadData(); await onInventoryChanged();
    } catch (err) { setError(err.message); }
    finally { endAction(); }
  }

  async function handleReturn(loanId) {
    if (loading || !beginAction()) return;
    setError(""); setMessage("");
    try { await returnLoan(loanId); setMessage("Returul a fost înregistrat."); await loadData(); await onInventoryChanged(); }
    catch (err) { setError(err.message); }
    finally { endAction(); }
  }

  const formatDate = formatDateTime;

  return (
    <section className="page">
      <div className="page-intro">
        <div><span className="page-kicker">ASSET CIRCULATION</span><h2>Împrumuturi</h2><p>Predare, retur și trasabilitate pentru fiecare obiect care iese din inventar.</p></div>
        <div className="count-chip"><strong>{loans.length}</strong><span>afișate</span></div>
      </div>

      <div className="loan-create-card">
        <div className="loan-card-copy"><div className="round-icon inverted"><Icon name="loans" size={20} /></div><div><span className="panel-eyebrow light">ÎMPRUMUT NOU</span><h3>Predă un obiect</h3><p>Selectează obiectul și persoana responsabilă.</p></div></div>
        <form className="loan-inline-form" onSubmit={handleSubmit} aria-busy={busy || loading}>
          <label><span>Obiect disponibil</span><select disabled={busy || loading} value={form.device_id} onChange={(e) => setForm({ ...form, device_id: e.target.value })} required><option value="">Selectează obiectul</option>{availableDevices.map((device) => <option key={device.id} value={device.id}>{device.code} — {device.name}</option>)}</select></label>
          <label><span>Persoană care împrumută</span><select disabled={busy || loading} value={form.person_id} onChange={(e) => setForm({ ...form, person_id: e.target.value })} required><option value="">Selectează persoana</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}{person.email ? ` · ${person.email}` : ""}</option>)}</select></label>
          <button disabled={busy || loading || !availableDevices.length || !people.length} className="btn btn-light" type="submit"><Icon name="arrow" size={17} /> {busy ? "Se salvează…" : "Înregistrează"}</button>
        </form>
      </div>

      {loading && <p role="status">Se încarcă împrumuturile…</p>}
      {message && <div className="alert alert-success" role="status"><Icon name="check" size={17} /><span>{message}</span></div>}
      {error && <div className="alert alert-error" role="alert"><Icon name="alert" size={17} /><span>{error}</span><button type="button" className="text-button" disabled={busy || loading} onClick={loadData}>Reîncearcă</button></div>}

      <div className="section-bar">
        <div><h3>Istoric împrumuturi</h3><span>{loans.length} înregistrări afișate</span></div>
        <div className="segmented-control" role="group" aria-label="Filtru împrumuturi"><button disabled={busy} aria-pressed={!filter} className={!filter ? "active" : ""} onClick={() => setFilter("")}>Toate</button><button disabled={busy} aria-pressed={filter === "ACTIVE"} className={filter === "ACTIVE" ? "active" : ""} onClick={() => setFilter("ACTIVE")}>Active</button><button disabled={busy} aria-pressed={filter === "RETURNED"} className={filter === "RETURNED" ? "active" : ""} onClick={() => setFilter("RETURNED")}>Returnate</button></div>
      </div>

      <div className="table-wrapper" aria-busy={loading}>
        <table>
          <thead><tr><th>Obiect</th><th>Persoană</th><th>Împrumutat</th><th>Returnat</th><th>Status</th><th>Acțiune</th></tr></thead>
          <tbody>
            {loans.map((loan) => (
              <tr key={loan.id}>
                <td><div className="object-cell"><div className="object-avatar">{(loan.device_name || "?").charAt(0).toUpperCase()}</div><div><strong>{loan.device_name}</strong><span>{loan.device_code}</span></div></div></td>
                <td><div className="person-inline"><div className="mini-avatar">{(loan.person_name || "?").charAt(0).toUpperCase()}</div>{loan.person_name}</div></td>
                <td>{formatDate(loan.loan_date)}</td><td>{formatDate(loan.return_date)}</td>
                <td><span className={`badge ${loan.status === "ACTIVE" ? "badge-loaned" : "badge-available"}`}>{loan.status === "ACTIVE" ? "Activ" : "Returnat"}</span></td>
                <td>{loan.status === "ACTIVE" ? <button disabled={busy || loading} className="btn btn-small btn-secondary" onClick={() => handleReturn(loan.id)}><Icon name="return" size={15} /> Retur</button> : <span className="muted">Închis</span>}</td>
              </tr>
            ))}
            {!loading && !error && !loans.length && <tr><td colSpan="6"><div className="empty-inline">Nu există împrumuturi pentru filtrul selectat.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
