import { useEffect, useMemo, useState } from "react";
import Icon from "../components/Icon";
import { createDevice, getPeople, getLocations, uploadDeviceImages } from "../services/api";

const initialForm = {
  name: "",
  category: "",
  status: "AVAILABLE",
  serial_number: "",
  description: "",
  location_id: "",
  responsible_person_id: "",
};

export default function AddDevice({ onDeviceAdded, onNavigate }) {
  const [form, setForm] = useState(initialForm);
  const [locations, setLocations] = useState([]);
  const [responsibles, setResponsibles] = useState([]);
  const [images, setImages] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPeople(false, "responsible").then(setResponsibles).catch((err) => setError(err.message));
    getLocations(true)
      .then((data) => setLocations((data || []).filter((location) => location.active !== false)))
      .catch((err) => setError(err.message));
  }, []);

  const previews = useMemo(
    () => images.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [images]
  );

  useEffect(() => () => previews.forEach((item) => URL.revokeObjectURL(item.url)), [previews]);

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  function handleImages(event) {
    const selected = Array.from(event.target.files || []);
    const allowed = selected.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
    setImages((current) => [...current, ...allowed].slice(0, 10));
    event.target.value = "";
  }

  function removeImage(index) {
    setImages((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (!form.location_id) throw new Error("Selectează locația inițială a obiectului.");

      const newDevice = await createDevice({
        ...form,
        location_id: Number(form.location_id),
        responsible_person_id: form.responsible_person_id ? Number(form.responsible_person_id) : null,
        serial_number: form.serial_number || null,
        description: form.description || null,
      });

      let uploadedCount = 0;
      if (images.length) {
        try {
          const uploaded = await uploadDeviceImages(newDevice.id, images);
          uploadedCount = uploaded?.length || 0;
        } catch (uploadError) {
          setError(`Obiectul a fost creat, dar imaginile nu au putut fi încărcate: ${uploadError.message}`);
        }
      }

      setMessage(
        uploadedCount
          ? `${newDevice.code} a fost adăugat și are ${uploadedCount} ${uploadedCount === 1 ? "imagine" : "imagini"}.`
          : `${newDevice.code} a fost adăugat cu succes.`
      );
      setForm(initialForm);
      setImages([]);
      await onDeviceAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page">
      <div className="page-intro">
        <div>
          <span className="page-kicker">NEW ASSET</span>
          <h2>Adaugă obiect</h2>
          <p>Înregistrează obiectul cu locația lui reală și fotografii încă din prima zi.</p>
        </div>
      </div>

      <div className="form-layout">
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <div className="panel-header form-panel-header">
            <div><span className="panel-eyebrow">DETALII OBIECT</span><h3>Identitate și localizare</h3></div>
            <div className="form-step">01</div>
          </div>

          {!locations.length && (
            <div className="alert alert-error location-required-alert">
              <Icon name="pin" size={18} />
              <div>
                <strong>Ai nevoie de cel puțin o locație.</strong>
                <span>Un obiect nou nu mai poate intra în inventar fără să știm unde se află.</span>
              </div>
              <button type="button" className="btn btn-light" onClick={() => onNavigate?.("Locations")}>Adaugă locație</button>
            </div>
          )}

          <div className="form-grid two-cols">
            <label className="field"><span>Nume obiect *</span><input name="name" placeholder="Ex. Osciloscop Hantek" value={form.name} onChange={handleChange} required /></label>
            <label className="field"><span>Categorie *</span><input name="category" placeholder="Ex. Instrumentație" value={form.category} onChange={handleChange} required /></label>
            <label className="field"><span>Număr de serie</span><input name="serial_number" placeholder="SN-2026-001" value={form.serial_number} onChange={handleChange} /></label>
            <label className="field"><span>Status inițial</span><select name="status" value={form.status} onChange={handleChange}><option value="AVAILABLE">Disponibil</option><option value="IN_USE">În uz</option><option value="BROKEN">Stricat</option><option value="LOST">Pierdut</option><option value="RETIRED">Scos din uz</option></select></label>
            <label className="field"><span>Responsabil obiect</span><select name="responsible_person_id" value={form.responsible_person_id} onChange={handleChange}><option value="">Fără responsabil</option>{responsibles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><small>Se configurează în Persoane. Rămâne asociat și în timpul împrumuturilor.</small></label>
            <label className="field field-location">
              <span><Icon name="pin" size={14} /> Locație inițială *</span>
              <select name="location_id" value={form.location_id} onChange={handleChange} required disabled={!locations.length}>
                <option value="">Selectează locația...</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
            </label>
          </div>

          <label className="field"><span>Descriere</span><textarea name="description" placeholder="Detalii utile, configurație, observații..." value={form.description} onChange={handleChange} /></label>

          <div className="asset-upload-section">
            <div className="upload-heading">
              <div><span className="panel-eyebrow">FOTOGRAFII</span><h3>Imagini ale obiectului</h3></div>
              <span className="upload-counter">{images.length}/10</span>
            </div>

            <label className="image-dropzone">
              <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={handleImages} />
              <span className="dropzone-icon"><Icon name="upload" size={22} /></span>
              <strong>Încarcă fotografii</strong>
              <small>PNG, JPG sau WEBP · maximum 8 MB / imagine</small>
            </label>

            {previews.length > 0 && (
              <div className="pending-image-grid">
                {previews.map((item, index) => (
                  <div className="pending-image" key={`${item.file.name}-${index}`}>
                    <img src={item.url} alt={item.file.name} />
                    <button type="button" onClick={() => removeImage(index)} title="Elimină imaginea"><Icon name="close" size={14} /></button>
                    <span>{item.file.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {message && <div className="alert alert-success"><Icon name="check" size={18} /><span>{message}</span></div>}
          {error && <div className="alert alert-error"><Icon name="alert" size={18} /><span>{error}</span></div>}

          <div className="form-footer">
            <button type="button" className="btn btn-ghost" onClick={() => onNavigate?.("Inventory")}>Anulează</button>
            <button className="btn btn-primary" type="submit" disabled={saving || !locations.length}><Icon name="plus" size={17} />{saving ? "Se salvează..." : "Adaugă în inventar"}</button>
          </div>
        </form>

        <aside className="form-aside">
          <div className="aside-card dark-card"><div className="aside-icon"><Icon name="inventory" /></div><h3>Obiect urmărit din prima zi</h3><p>Prima locație devine automat primul punct din istoricul obiectului. Fiecare mutare ulterioară este păstrată.</p></div>
          <div className="aside-card"><span className="panel-eyebrow">COD AUTOMAT</span><h3>Identitate permanentă</h3><p>Backend-ul generează automat un cod unic de tip <code>DEV-00001</code> după salvare.</p></div>
        </aside>
      </div>
    </section>
  );
}
