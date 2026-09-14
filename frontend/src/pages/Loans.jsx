import { useEffect, useMemo, useState } from "react";
import Icon from "../components/Icon";
import { createLoan, getDevices, getLoans, getPeople, returnLoan } from "../services/api";

export default function Loans({ onInventoryChanged }) {
  const [loans, setLoans] = useState([]);
  const [devices, setDevices] = useState([]);
  const [people, setPeople] = useState([]);
  const [form, setForm] = useState({ device_id: "", person_id: "" });
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    try {
      const [loanData, deviceData, peopleData] = await Promise.all([getLoans(filter), getDevices(), getPeople(false)]);
      setLoans(loanData); setDevices(deviceData); setPeople(peopleData); setError("");
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { loadData(); }, [filter]);

  const availableDevices = useMemo(() => devices.filter((device) => device.status === "AVAILABLE"), [devices]);

  async function handleSubmit(event) {
    event.preventDefault(); setMessage(""); setError("");
    try {
      await createLoan({ device_id: Number(form.device_id), person_id: Number(form.person_id) });
      setForm({ device_id: "", person_id: "" });
      setMessage("Împrumutul a fost înregistrat. Notificarea email va fi trimisă dacă persoana are adresă configurată.");
      await loadData(); await onInventoryChanged();
    } catch (err) { setError(err.message); }
  }

  async function handleReturn(loanId) {
    try { await returnLoan(loanId); setMessage("Returul a fost înregistrat."); await loadData(); await onInventoryChanged(); }
    catch (err) { setError(err.message); }
  }

  function formatDate(value) { return value ? new Date(value).toLocaleString("ro-RO", { dateStyle: "medium", timeStyle: "short" }) : "—"; }

  return (
    <section className="page">
      <div className="page-intro">
        <div><span className="page-kicker">ASSET CIRCULATION</span><h2>Împrumuturi</h2><p>Predare, retur și trasabilitate pentru fiecare obiect care iese din inventar.</p></div>
        <div className="count-chip"><strong>{loans.length}</strong><span>afișate</span></div>
      </div>

      <div className="loan-create-card">
        <div className="loan-card-copy"><div className="round-icon inverted"><Icon name="loans" size={20} /></div><div><span className="panel-eyebrow light">ÎMPRUMUT NOU</span><h3>Predă un obiect</h3><p>Selectează obiectul și persoana responsabilă.</p></div></div>
        <form className="loan-inline-form" onSubmit={handleSubmit}>
          <label><span>Obiect disponibil</span><select value={form.device_id} onChange={(e) => setForm({ ...form, device_id: e.target.value })} required><option value="">Selectează obiectul</option>{availableDevices.map((device) => <option key={device.id} value={device.id}>{device.code} — {device.name}</option>)}</select></label>
          <label><span>Persoană</span><select value={form.person_id} onChange={(e) => setForm({ ...form, person_id: e.target.value })} required><option value="">Selectează persoana</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}{person.email ? ` · ${person.email}` : ""}</option>)}</select></label>
          <button className="btn btn-light" type="submit"><Icon name="arrow" size={17} /> Înregistrează</button>
        </form>
      </div>

      {message && <div className="alert alert-success"><Icon name="check" size={17} /><span>{message}</span></div>}
      {error && <div className="alert alert-error"><Icon name="alert" size={17} /><span>{error}</span></div>}

      <div className="section-bar">
        <div><h3>Istoric împrumuturi</h3><span>{loans.length} înregistrări afișate</span></div>
        <div className="segmented-control"><button className={!filter ? "active" : ""} onClick={() => setFilter("")}>Toate</button><button className={filter === "ACTIVE" ? "active" : ""} onClick={() => setFilter("ACTIVE")}>Active</button><button className={filter === "RETURNED" ? "active" : ""} onClick={() => setFilter("RETURNED")}>Returnate</button></div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead><tr><th>Obiect</th><th>Persoană</th><th>Împrumutat</th><th>Returnat</th><th>Status</th><th>Acțiune</th></tr></thead>
          <tbody>
            {loans.map((loan) => (
              <tr key={loan.id}>
                <td><div className="object-cell"><div className="object-avatar">{(loan.device_name || "?").charAt(0).toUpperCase()}</div><div><strong>{loan.device_name}</strong><span>{loan.device_code}</span></div></div></td>
                <td><div className="person-inline"><div className="mini-avatar">{(loan.person_name || "?").charAt(0).toUpperCase()}</div>{loan.person_name}</div></td>
                <td>{formatDate(loan.loan_date)}</td><td>{formatDate(loan.return_date)}</td>
                <td><span className={`badge ${loan.status === "ACTIVE" ? "badge-loaned" : "badge-available"}`}>{loan.status === "ACTIVE" ? "Activ" : "Returnat"}</span></td>
                <td>{loan.status === "ACTIVE" ? <button className="btn btn-small btn-secondary" onClick={() => handleReturn(loan.id)}><Icon name="return" size={15} /> Retur</button> : <span className="muted">Închis</span>}</td>
              </tr>
            ))}
            {!loans.length && <tr><td colSpan="6"><div className="empty-inline">Nu există împrumuturi pentru filtrul selectat.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
