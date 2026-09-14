import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import { createPerson, deactivatePerson, getPeople, updatePerson } from "../services/api";

const emptyForm = { name: "", email: "", phone: "" };

export default function People() {
  const [people, setPeople] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadPeople() {
    try { setPeople(await getPeople(true)); setError(""); }
    catch (err) { setError(err.message); }
  }
  useEffect(() => { loadPeople(); }, []);

  function startEdit(person) {
    setEditingId(person.id);
    setForm({ name: person.name || "", email: person.email || "", phone: person.phone || "" });
    setMessage("");
  }
  function cancelEdit() { setEditingId(null); setForm(emptyForm); }

  async function handleSubmit(event) {
    event.preventDefault(); setMessage(""); setError("");
    const payload = { name: form.name, email: form.email || null, phone: form.phone || null };
    try {
      if (editingId) { await updatePerson(editingId, payload); setMessage("Persoana a fost actualizată."); }
      else { await createPerson(payload); setMessage("Persoana a fost adăugată."); }
      cancelEdit(); await loadPeople();
    } catch (err) { setError(err.message); }
  }

  async function toggleActive(person) {
    try {
      if (person.active) await deactivatePerson(person.id);
      else await updatePerson(person.id, { active: true });
      await loadPeople();
    } catch (err) { setError(err.message); }
  }

  return (
    <section className="page">
      <div className="page-intro">
        <div><span className="page-kicker">PEOPLE DIRECTORY</span><h2>Persoane</h2><p>Responsabilii și destinatarii împrumuturilor, cu datele de contact într-un singur loc.</p></div>
        <div className="count-chip"><strong>{people.filter((p) => p.active).length}</strong><span>active</span></div>
      </div>

      <div className="split-management">
        <form className="panel compact-form" onSubmit={handleSubmit}>
          <div className="panel-header"><div><span className="panel-eyebrow">{editingId ? "EDITARE" : "PERSOANĂ NOUĂ"}</span><h3>{editingId ? "Actualizează datele" : "Adaugă persoană"}</h3></div><div className="round-icon"><Icon name="user" size={19} /></div></div>
          <label className="field"><span>Nume *</span><input name="name" placeholder="Nume complet" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label className="field with-icon"><span>Email</span><div><Icon name="mail" size={17} /><input name="email" type="email" placeholder="nume@exemplu.ro" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div></label>
          <label className="field with-icon"><span>Telefon</span><div><Icon name="phone" size={17} /><input name="phone" placeholder="07xx xxx xxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div></label>
          <div className="form-actions"><button className="btn btn-primary" type="submit">{editingId ? "Salvează modificările" : "Adaugă persoană"}</button>{editingId && <button className="btn btn-secondary" type="button" onClick={cancelEdit}>Renunță</button>}</div>
          {message && <div className="alert alert-success"><Icon name="check" size={17} />{message}</div>}
          {error && <div className="alert alert-error"><Icon name="alert" size={17} />{error}</div>}
        </form>

        <div className="table-wrapper management-table">
          <table>
            <thead><tr><th>Persoană</th><th>Contact</th><th>Status</th><th>Acțiuni</th></tr></thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.id}>
                  <td><div className="object-cell"><div className="object-avatar person-avatar">{(person.name || "?").charAt(0).toUpperCase()}</div><div><strong>{person.name}</strong><span>ID #{person.id}</span></div></div></td>
                  <td><div className="contact-stack"><span>{person.email || "Fără email"}</span><small>{person.phone || "Fără telefon"}</small></div></td>
                  <td><span className={`badge ${person.active ? "badge-available" : "badge-retired"}`}>{person.active ? "Activ" : "Inactiv"}</span></td>
                  <td><div className="row-actions"><button className="icon-action" onClick={() => startEdit(person)} title="Editează"><Icon name="edit" size={16} /></button><button className={`icon-action ${person.active ? "danger" : "success"}`} onClick={() => toggleActive(person)} title={person.active ? "Dezactivează" : "Reactivează"}>{person.active ? <Icon name="trash" size={16} /> : <Icon name="check" size={16} />}</button></div></td>
                </tr>
              ))}
              {!people.length && <tr><td colSpan="4"><div className="empty-inline">Nu există persoane înregistrate.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
