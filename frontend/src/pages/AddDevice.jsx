import { useEffect, useState } from "react";
import { createDevice, getLocations, getPeople } from "../services/api";

const initialForm = {
  name: "",
  category: "",
  status: "AVAILABLE",
  serial_number: "",
  location_id: "",
  responsible_person_id: "",
  description: "",
};

export default function AddDevice({ onDeviceAdded }) {
  const [form, setForm] = useState(initialForm);
  const [locations, setLocations] = useState([]);
  const [people, setPeople] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([getLocations(), getPeople(false)])
      .then(([locationData, peopleData]) => {
        setLocations(locationData);
        setPeople(peopleData);
      })
      .catch((err) => setMessage(err.message));
  }, []);

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      const newDevice = await createDevice({
        ...form,
        serial_number: form.serial_number || null,
        location_id: form.location_id ? Number(form.location_id) : null,
        responsible_person_id: form.responsible_person_id ? Number(form.responsible_person_id) : null,
        description: form.description || null,
      });

      setMessage(`Adăugat: ${newDevice.code}`);
      setForm(initialForm);
      await onDeviceAdded();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <h2>Adaugă obiect</h2>
          <p>Pentru statusul LOANED folosește pagina Loans, ca istoricul să rămână corect.</p>
        </div>
      </div>

      <form className="admin-form" onSubmit={handleSubmit}>
        <input name="name" placeholder="Nume" value={form.name} onChange={handleChange} required />
        <input name="category" placeholder="Categorie" value={form.category} onChange={handleChange} required />
        <input name="serial_number" placeholder="Serial number" value={form.serial_number} onChange={handleChange} />

        <select name="status" value={form.status} onChange={handleChange}>
          <option value="AVAILABLE">AVAILABLE</option>
          <option value="IN_USE">IN_USE</option>
          <option value="BROKEN">BROKEN</option>
          <option value="LOST">LOST</option>
          <option value="RETIRED">RETIRED</option>
        </select>

        <select name="location_id" value={form.location_id} onChange={handleChange}>
          <option value="">Fără locație</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>{location.name}</option>
          ))}
        </select>

        <select name="responsible_person_id" value={form.responsible_person_id} onChange={handleChange}>
          <option value="">Fără persoană responsabilă</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>{person.name}</option>
          ))}
        </select>

        <textarea name="description" placeholder="Descriere" value={form.description} onChange={handleChange} />
        <button className="btn-primary" type="submit">Adaugă</button>
      </form>

      {message && <div className="info-message">{message}</div>}
    </section>
  );
}
