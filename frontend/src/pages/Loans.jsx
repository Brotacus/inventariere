import { useEffect, useMemo, useState } from "react";
import {
  createLoan,
  getDevices,
  getLoans,
  getPeople,
  returnLoan,
} from "../services/api";

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
      const [loanData, deviceData, peopleData] = await Promise.all([
        getLoans(filter),
        getDevices(),
        getPeople(false),
      ]);
      setLoans(loanData);
      setDevices(deviceData);
      setPeople(peopleData);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadData();
  }, [filter]);

  const availableDevices = useMemo(
    () => devices.filter((device) => device.status === "AVAILABLE"),
    [devices]
  );

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      await createLoan({
        device_id: Number(form.device_id),
        person_id: Number(form.person_id),
      });
      setForm({ device_id: "", person_id: "" });
      setMessage("Împrumutul a fost înregistrat.");
      await loadData();
      await onInventoryChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReturn(loanId) {
    try {
      await returnLoan(loanId);
      setMessage("Returul a fost înregistrat.");
      await loadData();
      await onInventoryChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("ro-RO");
  }

  return (
    <section>
      <div className="page-heading page-heading-row">
        <div>
          <h2>Împrumuturi</h2>
          <p>Asociază un obiect disponibil unei persoane și înregistrează returul.</p>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Toate</option>
          <option value="ACTIVE">Active</option>
          <option value="RETURNED">Returnate</option>
        </select>
      </div>

      <form className="admin-form" onSubmit={handleSubmit}>
        <select
          value={form.device_id}
          onChange={(e) => setForm({ ...form, device_id: e.target.value })}
          required
        >
          <option value="">Selectează obiectul</option>
          {availableDevices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.code} - {device.name}
            </option>
          ))}
        </select>

        <select
          value={form.person_id}
          onChange={(e) => setForm({ ...form, person_id: e.target.value })}
          required
        >
          <option value="">Selectează persoana</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>{person.name}</option>
          ))}
        </select>

        <button className="btn-primary" type="submit">Înregistrează împrumut</button>
      </form>

      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th><th>Obiect</th><th>Persoană</th><th>Data împrumut</th>
              <th>Data retur</th><th>Status</th><th>Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => (
              <tr key={loan.id}>
                <td>{loan.id}</td>
                <td>{loan.device_code} - {loan.device_name}</td>
                <td>{loan.person_name}</td>
                <td>{formatDate(loan.loan_date)}</td>
                <td>{formatDate(loan.return_date)}</td>
                <td>
                  <span className={`badge ${loan.status === "ACTIVE" ? "badge-loaned" : "badge-available"}`}>
                    {loan.status}
                  </span>
                </td>
                <td>
                  {loan.status === "ACTIVE" ? (
                    <button className="btn-primary" onClick={() => handleReturn(loan.id)}>
                      Marchează retur
                    </button>
                  ) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
