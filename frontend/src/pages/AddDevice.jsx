import { useState } from "react";
import { createDevice } from "../services/api";

export default function AddDevice({ onDeviceAdded }) {
    const [form, setForm] = useState({
        name: "",
        category: "",
        status: "AVAILABLE",
        serial_number: "",
        description: ""
    });

    const [message, setMessage] = useState("");

    function handleChange(event) {
        setForm({
            ...form,
            [event.target.name]: event.target.value
        });
    }

    async function handleSubmit(event) {
        event.preventDefault();

        try {
            const newDevice = await createDevice({
                ...form,
                serial_number: form.serial_number || null,
                description: form.description || null
            });

            setMessage(`Adăugat: ${newDevice.code}`);
            setForm({
                name: "",
                category: "",
                status: "AVAILABLE",
                serial_number: "",
                description: ""
            });

            onDeviceAdded();
        } catch (error) {
            setMessage(error.message);
        }
    }

    return (
        <section>
            <h2>Adaugă obiect</h2>

            <form className="device-form" onSubmit={handleSubmit}>
                <input
                    name="name"
                    placeholder="Nume"
                    value={form.name}
                    onChange={handleChange}
                    required
                />

                <input
                    name="category"
                    placeholder="Categorie"
                    value={form.category}
                    onChange={handleChange}
                    required
                />

                <input
                    name="serial_number"
                    placeholder="Serial number"
                    value={form.serial_number}
                    onChange={handleChange}
                />

                <select name="status" value={form.status} onChange={handleChange}>
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="LOANED">LOANED</option>
                    <option value="IN_USE">IN_USE</option>
                    <option value="BROKEN">BROKEN</option>
                    <option value="LOST">LOST</option>
                    <option value="RETIRED">RETIRED</option>
                </select>

                <textarea
                    name="description"
                    placeholder="Descriere"
                    value={form.description}
                    onChange={handleChange}
                />

                <button type="submit">Adaugă</button>
            </form>

            {message && <p>{message}</p>}
        </section>
    );
}
