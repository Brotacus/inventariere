import { useEffect, useMemo, useState } from "react";
import Icon from "../components/Icon";
import { StatusBadge } from "../components/DeviceTable";
import {
  createDevicePublicAccess,
  deleteDeviceImage,
  getDevicePublicAccess,
  getDeviceTracking,
  getLocations,
  getPeople,
  getLoans,
  mediaUrl,
  regenerateDevicePublicAccess,
  revokeDevicePublicAccess,
  updateDevice,
  uploadDeviceImages,
} from "../services/api";


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DeviceDetail({ deviceId, onBack, onChanged }) {
  const [tracking, setTracking] = useState(null);
  const [locations, setLocations] = useState([]);
  const [people, setPeople] = useState([]);
  const [responsibleId, setResponsibleId] = useState("");
  const [savingResponsible, setSavingResponsible] = useState(false);
  const [currentLoan, setCurrentLoan] = useState(null);
  const [locationId, setLocationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingLocation, setSavingLocation] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [publicAccess, setPublicAccess] = useState(null);
  const [publicAccessBusy, setPublicAccessBusy] = useState(false);
  const [publicBaseUrl, setPublicBaseUrl] = useState(() => window.location.origin);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [trackingData, locationData, accessData, peopleData, loansData] = await Promise.all([
        getDeviceTracking(deviceId),
        getLocations(true),
        getDevicePublicAccess(deviceId, publicBaseUrl).catch((err) => {
          if (err.status === 404) return null;
          throw err;
        }),
        getPeople(true),
        getLoans("ACTIVE"),
      ]);
      setPeople(peopleData);
      setCurrentLoan(loansData.find((loan) => loan.device_id === Number(deviceId)) || null);
      setResponsibleId(String(trackingData.device.responsible_person_id || ""));
      setTracking(trackingData);
      setLocations((locationData || []).filter((location) => location.active !== false));
      setLocationId(String(trackingData.device.location_id || ""));
      setPublicAccess(accessData);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [deviceId]);

  const sortedHistory = useMemo(
    () => [...(tracking?.location_history || [])].sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at)),
    [tracking]
  );

  async function handleResponsibleChange() {
    setSavingResponsible(true); setError(""); setMessage("");
    try {
      await updateDevice(deviceId, { responsible_person_id: responsibleId ? Number(responsibleId) : null });
      await load(); await onChanged?.();
      setMessage("Responsabilul obiectului a fost actualizat.");
    } catch (err) { setError(err.message); }
    finally { setSavingResponsible(false); }
  }

  async function handleLocationChange() {
    if (!locationId) return;
    setSavingLocation(true);
    setMessage("");
    setError("");
    try {
      await updateDevice(deviceId, { location_id: Number(locationId) });
      await load();
      await onChanged?.();
      setMessage("Locația a fost actualizată și mutarea a fost adăugată în istoric.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingLocation(false);
    }
  }

  async function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    setUploading(true);
    setMessage("");
    setError("");
    try {
      const uploaded = await uploadDeviceImages(deviceId, files);
      await load();
      setMessage(`${uploaded.length} ${uploaded.length === 1 ? "imagine a fost încărcată" : "imagini au fost încărcate"}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteImage(imageId) {
    if (!window.confirm("Ștergi această imagine din fișa obiectului?")) return;
    try {
      await deleteDeviceImage(deviceId, imageId);
      await load();
      setMessage("Imaginea a fost ștearsă.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGeneratePublicAccess() {
    setPublicAccessBusy(true);
    setMessage("");
    setError("");
    try {
      const access = await createDevicePublicAccess(deviceId, publicBaseUrl);
      setPublicAccess(access);
      setMessage("Pagina de utilizator și codul QR sunt active.");
    } catch (err) {
      setError(err.message);
    } finally {
      setPublicAccessBusy(false);
    }
  }

  async function handleRefreshPublicAddress() {
    if (!publicAccess) return;
    setPublicAccessBusy(true);
    setMessage("");
    setError("");
    try {
      const access = await getDevicePublicAccess(deviceId, publicBaseUrl);
      setPublicAccess(access);
      setMessage("QR-ul folosește acum adresa introdusă. Tokenul obiectului nu a fost schimbat.");
    } catch (err) {
      setError(err.message);
    } finally {
      setPublicAccessBusy(false);
    }
  }

  async function handleRegeneratePublicAccess() {
    if (!window.confirm("Regenerarea invalidează imediat codul QR și linkul vechi. Continui?")) return;
    setPublicAccessBusy(true);
    setMessage("");
    setError("");
    try {
      const access = await regenerateDevicePublicAccess(deviceId, publicBaseUrl);
      setPublicAccess(access);
      setMessage("Codul QR a fost regenerat. Etichetele vechi nu mai deschid obiectul.");
    } catch (err) {
      setError(err.message);
    } finally {
      setPublicAccessBusy(false);
    }
  }

  async function handleRevokePublicAccess() {
    if (!window.confirm("Dezactivezi pagina de utilizator? QR-ul tipărit nu va mai funcționa până generezi unul nou.")) return;
    setPublicAccessBusy(true);
    setMessage("");
    setError("");
    try {
      await revokeDevicePublicAccess(deviceId);
      setPublicAccess(null);
      setMessage("Accesul prin QR a fost dezactivat.");
    } catch (err) {
      setError(err.message);
    } finally {
      setPublicAccessBusy(false);
    }
  }

  async function handleCopyPublicUrl() {
    if (!publicAccess?.public_url) return;
    try {
      await navigator.clipboard.writeText(publicAccess.public_url);
      setMessage("Linkul public a fost copiat.");
    } catch {
      window.prompt("Copiază linkul:", publicAccess.public_url);
    }
  }

  function handleDownloadQr() {
    if (!publicAccess?.qr_svg) return;
    const blob = new Blob([publicAccess.qr_svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${tracking.device.code}-qr.svg`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function handlePrintLabel() {
    if (!publicAccess?.qr_svg || !tracking) return;
    const { device, current_location: currentLocation } = tracking;
    const printWindow = window.open("", "inventory-label", "width=700,height=520");
    if (!printWindow) {
      setError("Browserul a blocat fereastra de print. Permite pop-up-uri pentru această pagină și încearcă din nou.");
      return;
    }

    printWindow.document.write(`<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8" />
<title>Etichetă ${escapeHtml(device.code)}</title>
<style>
  @page { size: 70mm 40mm; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, Arial, sans-serif; color: #0e2828; background: white; }
  .label { width: 70mm; height: 40mm; padding: 4mm; display: grid; grid-template-columns: 26mm 1fr; gap: 4mm; border: .35mm solid #00868b; overflow: hidden; }
  .qr { width: 26mm; height: 26mm; display: grid; place-items: center; align-self: center; }
  .qr svg { width: 100%; height: 100%; }
  .data { min-width: 0; display: flex; flex-direction: column; justify-content: center; }
  .brand { color: #00868b; font-size: 7pt; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 1.4mm; }
  .code { font: 800 12pt ui-monospace, SFMono-Regular, Consolas, monospace; margin-bottom: 1.2mm; }
  .name { font-size: 9.5pt; line-height: 1.15; font-weight: 800; margin-bottom: 1.5mm; overflow: hidden; }
  .meta { font-size: 7pt; line-height: 1.35; color: #496262; }
  .scan { margin-top: 2mm; font-size: 6.5pt; color: #00868b; font-weight: 700; }
</style>
</head>
<body>
  <div class="label">
    <div class="qr">${publicAccess.qr_svg}</div>
    <div class="data">
      <div class="brand">Inventar · Asset tracking</div>
      <div class="code">${escapeHtml(device.code)}</div>
      <div class="name">${escapeHtml(device.name)}</div>
      <div class="meta">${escapeHtml(device.category)}<br />📍 ${escapeHtml(currentLocation?.name || "Locație nespecificată")}</div>
      <div class="scan">Scanează pentru fișa obiectului</div>
    </div>
  </div>
  <script>window.onload = () => { window.focus(); window.print(); };<\/script>
</body>
</html>`);
    printWindow.document.close();
  }

  if (loading && !tracking) {
    return (
      <section className="page">
        <div className="detail-loading panel"><Icon name="refresh" size={22} /><span>Se încarcă fișa obiectului...</span></div>
      </section>
    );
  }

  if (!tracking) {
    return (
      <section className="page">
        <button className="back-link" type="button" onClick={onBack}><Icon name="back" size={16} /> Înapoi la inventar</button>
        <div className="alert alert-error"><Icon name="alert" size={18} /><span>{error || "Obiectul nu a putut fi încărcat."}</span></div>
      </section>
    );
  }

  const { device, current_location: currentLocation, images = [] } = tracking;
  const selectedLocationChanged = String(device.location_id || "") !== String(locationId || "");

  return (
    <section className="page device-detail-page">
      <button className="back-link" type="button" onClick={onBack}><Icon name="back" size={16} /> Înapoi la inventar</button>

      <div className="device-detail-hero">
        <div className="detail-identity">
          <div className="detail-mark"><Icon name="inventory" size={28} /></div>
          <div>
            <div className="detail-kicker"><code>{device.code}</code><StatusBadge status={device.status} /></div>
            <h2>{device.name}</h2>
            <p>{device.description || "Fără descriere pentru acest obiect."}</p>
          </div>
        </div>
        <div className="detail-current-location">
          <span>LOCAȚIE CURENTĂ</span>
          <strong><Icon name="pin" size={18} /> {currentLocation?.name || "Nesetată"}</strong>
          <small>{currentLocation?.description || "Poți schimba locația din panoul de tracking."}</small>
        </div>
      </div>

      {message && <div className="alert alert-success"><Icon name="check" size={18} /><span>{message}</span></div>}
      {error && <div className="alert alert-error"><Icon name="alert" size={18} /><span>{error}</span></div>}

      <div className="detail-grid">
        <div className="detail-main-column">
          <div className="panel tracking-panel">
            <div className="panel-header"><h3>Responsabil obiect</h3></div>
            <p>Responsabil actual: <strong>{people.find((p) => p.id === device.responsible_person_id)?.name || "Fără responsabil"}</strong></p>
            <p>Împrumutat către: <strong>{currentLoan?.person_name || "Nu există un împrumut activ"}</strong></p>
            <div className="location-editor">
              <label className="field"><span>Asociază o persoană responsabilă</span><select value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}><option value="">Fără responsabil</option>{people.filter((p) => (p.active && p.is_responsible) || p.id === device.responsible_person_id).map((p) => <option key={p.id} value={p.id} disabled={!p.active || !p.is_responsible}>{p.name}{!p.active ? " (inactiv)" : ""}</option>)}</select></label>
              <button type="button" className="btn btn-primary" disabled={savingResponsible || responsibleId === String(device.responsible_person_id || "")} onClick={handleResponsibleChange}>{savingResponsible ? "Se salvează..." : "Salvează responsabilul"}</button>
            </div>
            <p className="location-editor-note">Împrumutarea și returnarea păstrează responsabilul. Schimbarea este înregistrată în jurnal.</p>
          </div>
          <div className="panel tracking-panel">
            <div className="panel-header">
              <div><span className="panel-eyebrow">LOCATION TRACKING</span><h3>Mută obiectul</h3></div>
              <div className="tracking-live"><i /> tracking activ</div>
            </div>

            <div className="location-editor">
              <div className="location-editor-icon"><Icon name="pin" size={22} /></div>
              <label className="field">
                <span>Noua locație</span>
                <select value={locationId} onChange={(event) => setLocationId(event.target.value)}>
                  <option value="">Selectează locația...</option>
                  {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
              </label>
              <button className="btn btn-primary" type="button" disabled={!selectedLocationChanged || savingLocation || !locationId} onClick={handleLocationChange}>
                <Icon name="pin" size={16} /> {savingLocation ? "Se mută..." : "Confirmă mutarea"}
              </button>
            </div>
            <p className="location-editor-note">Fiecare schimbare este salvată separat, cu locația veche, locația nouă și momentul mutării.</p>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div><span className="panel-eyebrow">PHOTO RECORD</span><h3>Fotografii obiect</h3></div>
              <label className={`btn btn-light upload-button ${uploading ? "disabled" : ""}`}>
                <Icon name="upload" size={16} /> {uploading ? "Se încarcă..." : "Adaugă imagini"}
                <input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>

            {images.length ? (
              <div className="device-gallery">
                {images.map((image) => (
                  <article className="device-photo" key={image.id}>
                    <a href={mediaUrl(image.url)} target="_blank" rel="noreferrer">
                      <img src={mediaUrl(image.url)} alt={image.original_name} />
                    </a>
                    <div className="device-photo-meta">
                      <div><strong>{image.original_name}</strong><span>{formatDate(image.uploaded_at)}</span></div>
                      <button type="button" className="icon-action danger" onClick={() => handleDeleteImage(image.id)} title="Șterge imaginea"><Icon name="trash" size={15} /></button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <label className="image-empty-state">
                <input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={handleUpload} disabled={uploading} />
                <span><Icon name="image" size={25} /></span>
                <strong>Nu există încă fotografii</strong>
                <small>Încarcă imagini reale ale obiectului pentru identificare rapidă.</small>
              </label>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <div><span className="panel-eyebrow">LOCATION HISTORY</span><h3>Istoric locații</h3></div>
              <span className="history-count">{sortedHistory.length} evenimente</span>
            </div>

            {sortedHistory.length ? (
              <div className="tracking-timeline">
                {sortedHistory.map((entry, index) => (
                  <div className="timeline-entry" key={entry.id}>
                    <div className="timeline-rail"><span className={index === 0 ? "current" : ""} />{index !== sortedHistory.length - 1 && <i />}</div>
                    <div className="timeline-card">
                      <div className="timeline-title">
                        <strong>{["INITIAL_ASSIGNMENT", "LEGACY_SNAPSHOT"].includes(entry.change_type) ? "Locație inițială" : "Obiect mutat"}</strong>
                        <time>{formatDate(entry.changed_at)}</time>
                      </div>
                      <div className="timeline-route">
                        {entry.from_location_name && <><span>{entry.from_location_name}</span><Icon name="arrow" size={15} /></>}
                        <strong><Icon name="pin" size={14} /> {entry.to_location_name}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-inline">Nu există încă mutări înregistrate pentru acest obiect.</div>
            )}
          </div>
        </div>

        <aside className="detail-side-column">
          <div className="panel detail-facts">
            <div className="panel-header"><div><span className="panel-eyebrow">ASSET DATA</span><h3>Fișa tehnică</h3></div></div>
            <dl>
              <div><dt>Cod inventar</dt><dd><code className="code-pill">{device.code}</code></dd></div>
              <div><dt>Categorie</dt><dd>{device.category}</dd></div>
              <div><dt>Număr serie</dt><dd>{device.serial_number || "-"}</dd></div>
              <div><dt>Status</dt><dd><StatusBadge status={device.status} /></dd></div>
              <div><dt>ID intern</dt><dd>#{device.id}</dd></div>
            </dl>
          </div>

          <div className="panel public-access-panel">
            <div className="panel-header public-access-heading">
              <div><span className="panel-eyebrow">USER ACCESS</span><h3>QR & etichetă</h3></div>
              <span className={`access-dot ${publicAccess ? "active" : ""}`} title={publicAccess ? "Link activ" : "Link inactiv"} />
            </div>

            <label className="public-base-url-field">
              <span>Adresa folosită în QR</span>
              <input type="url" value={publicBaseUrl} onChange={(event) => setPublicBaseUrl(event.target.value)} placeholder="https://inventar.exemplu.ro" />
              <small>Pentru scanare de pe telefon în testare, folosește IP-ul PC-ului, nu localhost.</small>
            </label>

            {!publicAccess ? (
              <div className="public-access-empty">
                <span className="qr-placeholder"><Icon name="qr" size={34} /></span>
                <strong>Fișă read-only pentru utilizator</strong>
                <p>Generează un link greu de ghicit care poate fi pus pe obiect sub formă de QR sau etichetă.</p>
                <button className="btn btn-primary btn-block" type="button" disabled={publicAccessBusy} onClick={handleGeneratePublicAccess}>
                  <Icon name="qr" size={16} /> {publicAccessBusy ? "Se generează..." : "Generează QR"}
                </button>
              </div>
            ) : (
              <div className="public-access-ready">
                <div className="qr-preview" dangerouslySetInnerHTML={{ __html: publicAccess.qr_svg }} />
                <div className="public-link-box">
                  <span>Link utilizator</span>
                  <strong title={publicAccess.public_url}>{publicAccess.public_url}</strong>
                </div>

                <div className="public-access-actions">
                  <button className="btn btn-primary" type="button" onClick={handlePrintLabel}><Icon name="printer" size={15} /> Tipărește eticheta</button>
                  <button className="btn btn-light" type="button" onClick={() => window.open(publicAccess.public_url, "_blank", "noopener,noreferrer")}><Icon name="external" size={15} /> Vezi ca user</button>
                  <button className="btn btn-light" type="button" onClick={handleCopyPublicUrl}><Icon name="copy" size={15} /> Copiază</button>
                  <button className="btn btn-light" type="button" disabled={publicAccessBusy} onClick={handleRefreshPublicAddress}><Icon name="refresh" size={15} /> Actualizează QR</button>
                  <button className="btn btn-light" type="button" onClick={handleDownloadQr}><Icon name="download" size={15} /> QR SVG</button>
                </div>

                <div className="public-access-security">
                  <Icon name="shield" size={16} />
                  <span>Linkul oferă numai vizualizare. Nu expune persoane, împrumuturi, loguri sau controale de admin.</span>
                </div>

                <div className="public-access-danger-actions">
                  <button type="button" disabled={publicAccessBusy} onClick={handleRegeneratePublicAccess}>Regenerează linkul</button>
                  <button type="button" className="danger" disabled={publicAccessBusy} onClick={handleRevokePublicAccess}>Dezactivează</button>
                </div>
              </div>
            )}
          </div>

          <div className="aside-card dark-card tracking-help-card">
            <div className="aside-icon"><Icon name="history" /></div>
            <h3>Urme permanente</h3>
            <p>Schimbarea locației nu suprascrie trecutul. Istoricul rămâne disponibil chiar dacă locația este redenumită ulterior.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
