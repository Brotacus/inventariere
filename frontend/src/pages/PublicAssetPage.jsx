import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import { getPublicAsset, mediaUrl } from "../services/api";

const STATUS_LABELS = {
  AVAILABLE: "Disponibil",
  LOANED: "Împrumutat",
  IN_USE: "În utilizare",
  BROKEN: "Defect",
  LOST: "Pierdut",
  RETIRED: "Retras",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PublicAssetPage({ token, theme, onToggleTheme }) {
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await getPublicAsset(token);
        if (!cancelled) {
          setAsset(data);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <main className="public-asset-shell">
      <header className="public-asset-header">
        <div className="public-brand">
          <img src="/inventory-logo.png" alt="Inventar" />
          <div>
            <strong>Inventar</strong>
            <span>Fișă obiect · acces utilizator</span>
          </div>
        </div>
        <button className="theme-toggle public-theme-toggle" type="button" onClick={onToggleTheme} title="Schimbă tema">
          <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
        </button>
      </header>

      <section className="public-asset-stage">
        {loading && (
          <div className="public-asset-state">
            <span className="public-state-icon"><Icon name="refresh" size={25} /></span>
            <h1>Se verifică eticheta...</h1>
            <p>Încărcăm informațiile actuale ale obiectului.</p>
          </div>
        )}

        {!loading && error && (
          <div className="public-asset-state public-asset-error">
            <span className="public-state-icon"><Icon name="alert" size={25} /></span>
            <h1>Etichetă indisponibilă</h1>
            <p>{error}</p>
            <small>Dacă obiectul aparține organizației, cere administratorului o etichetă nouă.</small>
          </div>
        )}

        {!loading && asset && (
          <article className="public-asset-card">
            <div className="public-asset-cover">
              {asset.image_url ? (
                <img src={mediaUrl(asset.image_url)} alt={asset.name} />
              ) : (
                <div className="public-asset-no-image">
                  <Icon name="inventory" size={48} />
                  <span>Fără fotografie</span>
                </div>
              )}
              <div className="public-cover-chip">{asset.code}</div>
            </div>

            <div className="public-asset-content">
              <div className="public-asset-topline">
                <span className="public-readonly-badge"><Icon name="eye" size={14} /> Vizualizare read-only</span>
                <span className={`public-status public-status-${asset.status.toLowerCase()}`}>{STATUS_LABELS[asset.status] || asset.status}</span>
              </div>

              <div className="public-asset-title">
                <span>{asset.category}</span>
                <h1>{asset.name}</h1>
                <p>{asset.description || "Nu există o descriere publică pentru acest obiect."}</p>
              </div>

              <div className="public-location-card">
                <span className="public-location-icon"><Icon name="pin" size={20} /></span>
                <div>
                  <small>Locație curentă</small>
                  <strong>{asset.location_name || "Locație nespecificată"}</strong>
                  {asset.location_description && <p>{asset.location_description}</p>}
                </div>
              </div>

              <dl className="public-asset-facts">
                <div><dt>Cod inventar</dt><dd><code>{asset.code}</code></dd></div>
                <div><dt>Categorie</dt><dd>{asset.category}</dd></div>
                <div><dt>Număr serie</dt><dd>{asset.serial_number || "-"}</dd></div>
                <div><dt>Fotografii asociate</dt><dd>{asset.image_count}</dd></div>
                <div><dt>Ultima actualizare</dt><dd>{formatDate(asset.updated_at || asset.created_at)}</dd></div>
              </dl>

              <div className="public-asset-footnote">
                <Icon name="shield" size={17} />
                <p>Această pagină afișează numai informații de identificare și stare. Datele administrative, persoanele și istoricul intern nu sunt publice.</p>
              </div>
            </div>
          </article>
        )}
      </section>

      <footer className="public-asset-footer">
        <span><i /> informație sincronizată cu inventarul</span>
        <span>Asset tracking · Inventar</span>
      </footer>
    </main>
  );
}
