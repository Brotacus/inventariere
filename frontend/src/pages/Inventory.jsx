import { useEffect, useState } from "react";
import DeviceTable from "../components/DeviceTable";
import { getLocations, getPeople, updateDevice } from "../services/api";

export default function Inventory({ devices, onDelete, onUpdated }) {
  const [editing, setEditing] = useState(null);
  const [locations, setLocations] = useState([]);
  const [people, setPeople] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getLocations(), getPeople(false)])
      .then(([locationData, peopleData]) => {
        setLocations(locationData);
        setPeople(peopleData);
      })
      .catch((err) => setError(err.message));
  }, []);

  function startEdit(device) {
    setEditing({
      ...device,
      serial_number: device.serial_number || "",
      location_id: device.location_id ?? "",
      responsible_person_id: device.responsible_person_id ?? "",
      description: device.description || "",
    });
  }

  async function saveEdit(event) {
    event.preventDefault();

    try {
      await updateDevice(editing.id, {
        name: editing.name,
        category: editing.category,
        serial_number: editing.serial_number || null,
        status: editing.status,
        location_id: editing.location_id ? Number(editing.location_id) : null,
        responsible_person_id: editing.responsible_person_id ? Number(editing.responsible_person_id) : null,
        description: editing.description || null,
      });
      setEditing(null);
      await onUpdated();
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <h2>Inventory</h2>
          <p>Adminul poate edita sau șterge obiectele din inventar.</p>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {editing && (
        <form className="admin-form edit-panel" onSubmit={saveEdit}>
          <h3>Editare {editing.code}</h3>
          <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
          <input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} required />
          <input placeholder="Serie" value={editing.serial_number} onChange={(e) => setEditing({ ...editing, serial_number: e.target.value })} />

          <select
            value={editing.status}
            onChange={(e) => setEditing({ ...editing, status: e.target.value })}
            disabled={editing.status === "LOANED"}
          >
            {editing.status === "LOANED" && <option value="LOANED">LOANED - returnează din Loans</option>}
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="IN_USE">IN_USE</option>
            <option value="BROKEN">BROKEN</option>
            <option value="LOST">LOST</option>
            <option value="RETIRED">RETIRED</option>
          </select>

          <select value={editing.location_id} onChange={(e) => setEditing({ ...editing, location_id: e.target.value })}>
            <option value="">Fără locație</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>

          <select
            value={editing.responsible_person_id}
            onChange={(e) => setEditing({ ...editing, responsible_person_id: e.target.value })}
            disabled={editing.status === "LOANED"}
          >
            <option value="">Fără persoană responsabilă</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>

          <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          <div className="form-actions">
            <button className="btn-primary" type="submit">Salvează</button>
            <button className="btn-secondary" type="button" onClick={() => setEditing(null)}>Renunță</button>
          </div>
        </form>
      )}

      <DeviceTable devices={devices} onDelete={onDelete} onEdit={startEdit} />
    </section>
  );
}
