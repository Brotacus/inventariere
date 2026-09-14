import { useEffect, useState } from "react";
import {
  createPerson,
  deactivatePerson,
  getPeople,
  updatePerson,
} from "../services/api";

const emptyForm = { name: "", email: "", phone: "" };

export default function People() {
  const [people, setPeople] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadPeople() {
    try {
      setPeople(await getPeople(true));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadPeople();
  }, []);

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  function startEdit(person) {
    setEditingId(person.id);
    setForm({
      name: person.name || "",
      email: person.email || "",
      phone: person.phone || "",
    });
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    const payload = {
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
    };

    try {
      if (editingId) {
        await updatePerson(editingId, payload);
        setMessage("Persoana a fost actualizată.");
      } else {
        await createPerson(payload);
        setMessage("Persoana a fost adăugată.");
      }

      cancelEdit();
      await loadPeople();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(person) {
    try {
      if (person.active) {
        await deactivatePerson(person.id);
      } else {
        await updatePerson(person.id, { active: true });
      }
      await loadPeople();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <h2>Persoane</h2>
          <p>Adaugă, editează și activează/dezactivează persoanele responsabile.</p>
        </div>
      </div>

      <form className="admin-form" onSubmit={handleSubmit}>
        <input name="name" placeholder="Nume" value={form.name} onChange={handleChange} required />
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} />
        <input name="phone" placeholder="Telefon" value={form.phone} onChange={handleChange} />
        <div className="form-actions">
          <button className="btn-primary" type="submit">
            {editingId ? "Salvează" : "Adaugă persoană"}
          </button>
          {editingId && (
            <button className="btn-secondary" type="button" onClick={cancelEdit}>
              Renunță
            </button>
          )}
        </div>
      </form>

      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nume</th>
              <th>Email</th>
              <th>Telefon</th>
              <th>Status</th>
              <th>Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id}>
                <td>{person.id}</td>
                <td>{person.name}</td>
                <td>{person.email || "-"}</td>
                <td>{person.phone || "-"}</td>
                <td>
                  <span className={`badge ${person.active ? "badge-available" : "badge-retired"}`}>
                    {person.active ? "Activ" : "Inactiv"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button className="btn-secondary" onClick={() => startEdit(person)}>Editează</button>
                    <button
                      className={person.active ? "btn-danger" : "btn-primary"}
                      onClick={() => toggleActive(person)}
                    >
                      {person.active ? "Dezactivează" : "Reactivează"}
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
