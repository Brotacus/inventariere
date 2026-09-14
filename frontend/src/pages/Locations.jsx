import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import { createLocation, deleteLocation, getLocations, updateLocation } from "../services/api";

const emptyForm = { name: "", description: "" };

export default function Locations() {
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadLocations() {
    try { setLocations(await getLocations()); setError(""); }
    catch (err) { setError(err.message); }
  }
  useEffect(() => { loadLocations(); }, []);

  function startEdit(location) { setEditingId(location.id); setForm({ name: location.name, description: location.description || "" }); }
  function resetForm() { setEditingId(null); setForm(emptyForm); }

  async function handleSubmit(event) {
    event.preventDefault(); setError("");
    try {
      const payload = { name: form.name, description: form.description || null };
      if (editingId) { await updateLocation(editingId, payload); setMessage("Locația a fost actualizată."); }
      else { await createLocation(payload); setMessage("Locația a fost adăugată."); }
      resetForm(); await loadLocations();
    } catch (err) { setError(err.message); }
  }

  async function handleDelete(locationId) {
    if (!window.confirm("Ștergi această locație?")) return;
    try { await deleteLocation(locationId); await loadLocations(); }
    catch (err) { setError(err.message); }
  }

  return (
    <section className="page">
      <div className="page-intro">
        <div><span className="page-kicker">STORAGE MAP</span><h2>Locații</h2><p>Laboratoare, camere, dulapuri sau orice zonă în care sunt păstrate echipamente.</p></div>
        <div className="count-chip"><strong>{locations.length}</strong><span>locații</span></div>
      </div>

      <div className="split-management">
        <form className="panel compact-form" onSubmit={handleSubmit}>
          <div className="panel-header"><div><span className="panel-eyebrow">{editingId ? "EDITARE" : "LOCAȚIE NOUĂ"}</span><h3>{editingId ? "Actualizează locația" : "Adaugă locație"}</h3></div><div className="round-icon"><Icon name="pin" size={19} /></div></div>
          <label className="field"><span>Nume locație *</span><input placeholder="Ex. Laborator A210" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label className="field"><span>Descriere</span><textarea className="small-textarea" placeholder="Etaj, dulap, repere..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <div className="form-actions"><button className="btn btn-primary" type="submit">{editingId ? "Salvează modificările" : "Adaugă locație"}</button>{editingId && <button className="btn btn-secondary" type="button" onClick={resetForm}>Renunță</button>}</div>
          {message && <div className="alert alert-success"><Icon name="check" size={17} />{message}</div>}
          {error && <div className="alert alert-error"><Icon name="alert" size={17} />{error}</div>}
        </form>

        <div className="locations-grid">
          {locations.map((location) => (
            <article className="location-card" key={location.id}>
              <div className="location-icon"><Icon name="locations" size={22} /></div>
              <div className="location-card-body"><div><span>LOCAȚIE #{location.id}</span><h3>{location.name}</h3></div><p>{location.description || "Fără descriere suplimentară."}</p></div>
              <div className="row-actions"><button className="icon-action" onClick={() => startEdit(location)} title="Editează"><Icon name="edit" size={16} /></button><button className="icon-action danger" onClick={() => handleDelete(location.id)} title="Șterge"><Icon name="trash" size={16} /></button></div>
            </article>
          ))}
          {!locations.length && <div className="empty-state"><div className="empty-icon"><Icon name="locations" size={28} /></div><h3>Nicio locație</h3><p>Adaugă prima zonă de stocare.</p></div>}
        </div>
      </div>
    </section>
  );
}
