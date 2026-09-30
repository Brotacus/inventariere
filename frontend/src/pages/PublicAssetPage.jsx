import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import PublicLayout, { PublicStatus } from "../components/PublicLayout";
import AssetImage from "../components/AssetImage";
import { getPublicAsset, getCatalogAsset } from "../services/api";
import { formatDateTime } from "../hooks/dateFormatting";

function formatDate(value) {
  return formatDateTime(value, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PublicAssetPage({ token, code, theme, onToggleTheme }) {
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setAsset(null);
      setError("");
      try {
        const data = await (code ? getCatalogAsset(code, controller.signal) : getPublicAsset(token, controller.signal));
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
    return () => { cancelled = true; controller.abort(); };
  }, [token, code, attempt]);

  return (
    <PublicLayout theme={theme} onToggleTheme={onToggleTheme}>
      <main id="public-content" className="public-asset-stage" tabIndex={-1}>
        <a className="public-back-link" href={`/catalog${code ? window.location.search : ""}`}><Icon name="back" size={18} /> Înapoi la catalog</a>
        {loading && (
          <div className="public-asset-state" role="status" aria-live="polite" aria-atomic="true">
            <span className="public-state-icon"><span className="public-loading-indicator" aria-hidden="true" /></span>
            <h1>Se încarcă fișa…</h1>
            <p>Încărcăm informațiile actuale ale obiectului.</p>
          </div>
        )}

        {!loading && error && (
          <div className="public-asset-state public-asset-error" role="alert">
            <span className="public-state-icon"><Icon name="alert" size={25} /></span>
            <h1>Fișă indisponibilă</h1>
            <p>{error}</p>
            <button type="button" className="catalog-button" onClick={() => setAttempt(value => value + 1)}>Reîncearcă</button>
          </div>
        )}

        {!loading && !error && asset && (
          <article className="public-asset-card">
            <div className="public-asset-cover">
              <AssetImage src={asset.image_url} name={asset.name} />
              <div className="public-cover-chip">{asset.code}</div>
            </div>

            <div className="public-asset-content">
              <div className="public-asset-topline">
                <span className="public-readonly-badge"><Icon name="eye" size={14} /> Doar consultare</span>
                <PublicStatus status={asset.status} />
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
                <p>Informațiile despre acest obiect pot fi consultate în catalog sau prin scanarea etichetei QR.</p>
              </div>
            </div>
          </article>
        )}
      </main>
    </PublicLayout>
  );
}
