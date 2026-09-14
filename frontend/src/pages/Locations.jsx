import { useEffect, useState } from "react";
import {
  createLocation,
  deleteLocation,
  getLocations,
  updateLocation,
} from "../services/api";

const emptyForm = { name: "", description: "" };

export default function Locations() {
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadLocations() {
    try {
      setLocations(await getLocations(true));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadLocations();
  }, []);

  function startEdit(location) {
    setEditingId(location.id);
    setForm({ name: location.name, description: location.description || "" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
      };

      if (editingId) {
        await updateLocation(editingId, payload);
        setMessage("Locația a fost actualizată.");
      } else {
        await createLocation(payload);
        setMessage("Locația a fost adăugată.");
      }

      resetForm();
      await loadLocations();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(location) {
    try {
      if (location.active) {
        if (!window.confirm("Arhivezi această locație? Datele și istoricul rămân salvate.")) return;
        await deleteLocation(location.id);
      } else {
        await updateLocation(location.id, { active: true });
      }
      await loadLocations();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <h2>Locații</h2>
          <p>Locațiile nu se șterg definitiv; se arhivează pentru a păstra istoricul.</p>
        </div>
      </div>

      <form className="admin-form" onSubmit={handleSubmit}>
        <input
          name="name"
          placeholder="Nume locație"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          name="description"
          placeholder="Descriere"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div className="form-actions">
          <button className="btn-primary" type="submit">{editingId ? "Salvează" : "Adaugă locație"}</button>
          {editingId && <button className="btn-secondary" type="button" onClick={resetForm}>Renunță</button>}
        </div>
      </form>

      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>ID</th><th>Nume</th><th>Descriere</th><th>Status</th><th>Acțiuni</th></tr>
          </thead>
          <tbody>
            {locations.map((location) => (
              <tr key={location.id}>
                <td>{location.id}</td>
                <td>{location.name}</td>
                <td>{location.description || "-"}</td>
                <td>
                  <span className={`badge ${location.active ? "badge-available" : "badge-retired"}`}>
                    {location.active ? "Activă" : "Arhivată"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button className="btn-secondary" onClick={() => startEdit(location)}>Editează</button>
                    <button
                      className={location.active ? "btn-danger" : "btn-primary"}
                      onClick={() => toggleActive(location)}
                    >
                      {location.active ? "Arhivează" : "Reactivează"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
