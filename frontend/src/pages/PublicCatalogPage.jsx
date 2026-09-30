import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon";
import AssetImage from "../components/AssetImage";
import PublicLayout, { PublicStatus, STATUS_LABELS } from "../components/PublicLayout";
import { getPublicCatalog } from "../services/api";

function initialFilters() {
  const params = new URLSearchParams(window.location.search);
  return {
    q: (params.get("q") || "").slice(0, 200), category: (params.get("category") || "").slice(0, 200),
    location: (params.get("location") || "").slice(0, 200), status: (params.get("status") || "").slice(0, 30),
    sort: ["name", "code"].includes(params.get("sort")) ? params.get("sort") : "newest",
    page: Math.min(1000000, Math.max(1, parseInt(params.get("page"), 10) || 1)),
  };
}

export default function PublicCatalogPage({ theme, onToggleTheme }) {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const resultsRef = useRef(null);
  const scrollAfterPageChange = useRef(false);
  const historyMode = useRef("replace");
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== ""));
  const query = params.toString();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    if (historyMode.current !== "none") {
      window.history[historyMode.current === "push" ? "pushState" : "replaceState"](null, "", `/catalog?${query}`);
    }
    historyMode.current = "replace";
    const timer = setTimeout(async () => {
      try {
        const result = await getPublicCatalog(query, controller.signal);
        if (!controller.signal.aborted) {
          const lastPage = Math.max(1, Math.ceil(result.filtered_total / result.page_size));
          if (filters.page > lastPage) {
            setFilters(current => ({ ...current, page: lastPage }));
            return;
          }
          // Keep the last successful query with its cards while another request
          // is pending, including the filters used by their return links.
          setData({ ...result, query });
          setLoading(false);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
          setLoading(false);
        }
      }
    }, filters.q ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, refresh]);

  useEffect(() => {
    function restoreFilters() {
      historyMode.current = "none";
      scrollAfterPageChange.current = false;
      setFilters(initialFilters());
    }
    window.addEventListener("popstate", restoreFilters);
    return () => window.removeEventListener("popstate", restoreFilters);
  }, []);

  useEffect(() => {
    function update() { setRefresh(value => value + 1); }
    window.addEventListener("focus", update);
    return () => window.removeEventListener("focus", update);
  }, []);

  useEffect(() => {
    if (!data || loading || error || !scrollAfterPageChange.current) return;
    scrollAfterPageChange.current = false;
    resultsRef.current?.focus({ preventScroll: true });
    resultsRef.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, [data, loading, error]);

  function change(field, value) {
    scrollAfterPageChange.current = false;
    historyMode.current = field === "q" ? "replace" : "push";
    setFilters(current => ({ ...current, [field]: value, page: 1 }));
  }
  function reset() {
    scrollAfterPageChange.current = false;
    historyMode.current = "push";
    setFilters({ q: "", category: "", location: "", status: "", sort: "newest", page: 1 });
  }
  function reload() {
    if (loading) return;
    setLoading(true);
    setRefresh(value => value + 1);
  }
  function goToPage(page) {
    if (loading || error || page < 1 || page > pages) return;
    scrollAfterPageChange.current = true;
    historyMode.current = "push";
    setLoading(true);
    setFilters(current => ({ ...current, page }));
  }
  const hasFilters = Boolean(filters.q || filters.category || filters.location || filters.status);
  const loadedHasFilters = data ? ["q", "category", "location", "status"].some(key => new URLSearchParams(data.query).get(key)) : hasFilters;
  const pages = data ? Math.max(1, Math.ceil(data.filtered_total / data.page_size)) : 1;

  return <PublicLayout theme={theme} onToggleTheme={onToggleTheme} catalog>
    <main id="public-content" className="catalog-main" tabIndex={-1}>
      <section className="catalog-intro">
        <div><span className="catalog-eyebrow">INVENTARUL, LA ÎNDEMÂNĂ</span><h1>Descoperă catalogul.</h1>
          <p>Toate obiectele înregistrate, într-un singur loc. Consultă fotografiile, starea și locația fiecărui obiect.</p></div>
        <div className="catalog-total"><Icon name="inventory" size={26} /><strong>{data ? data.total : "—"}</strong><span>obiecte în inventar</span></div>
      </section>

      <section className="catalog-toolbar" aria-label="Căutare și filtre">
        <label className="catalog-search"><span>Caută un obiect</span><div><Icon name="search" size={21} />
          <input type="search" maxLength={200} placeholder="Nume, cod inventar sau număr de serie" value={filters.q} onChange={event => change("q", event.target.value)} />
        </div></label>
        <div className="catalog-filters">
          {[ ["category", "Categorie", "Toate categoriile", data?.categories || []], ["status", "Stare", "Toate stările", data?.statuses || []], ["location", "Locație", "Toate locațiile", data?.locations || []] ].map(([key, label, empty, values]) =>
            <label key={key}><span>{label}</span><select aria-label={label} value={filters[key]} onChange={event => change(key, event.target.value)}>
              <option value="">{empty}</option>
              {Array.from(new Set([...values, ...(filters[key] ? [filters[key]] : [])])).map(value => <option key={value} value={value}>{key === "status" ? STATUS_LABELS[value] || value : value}</option>)}
            </select></label>)}
          <label><span>Ordonează după</span><select aria-label="Ordonează după" value={filters.sort} onChange={event => change("sort", event.target.value)}><option value="newest">Cele mai noi</option><option value="name">Nume A–Z</option><option value="code">Cod inventar</option></select></label>
        </div>
      </section>

      <div className="catalog-results-bar">
        <p className="catalog-result-status" role="status" aria-live="polite" aria-atomic="true">{loading ? <><span className="public-loading-indicator" aria-hidden="true" />{data ? "Se actualizează rezultatele…" : "Se încarcă obiectele…"}</> : error ? (data ? "Sunt afișate ultimele rezultate încărcate" : "Catalog indisponibil") : `${data?.filtered_total || 0} ${data?.filtered_total === 1 ? "obiect" : "obiecte"}${loadedHasFilters ? (data?.filtered_total === 1 ? " găsit" : " găsite") : " în catalog"}`}</p>
        <div>{hasFilters && <button type="button" className="catalog-button" onClick={reset}>Resetează filtrele</button>}
          <button type="button" className="catalog-button" aria-disabled={loading} onClick={reload}><Icon name="refresh" size={17} /> Actualizează</button></div>
      </div>

      {error && <section className={data ? "catalog-error-banner" : "catalog-empty"} role="alert"><Icon name="alert" size={data ? 22 : 36} /><div><h2>Nu am putut încărca inventarul</h2><p>{error}</p></div><button type="button" className="catalog-button" aria-disabled={loading} onClick={reload}>Reîncearcă</button></section>}
      <div ref={resultsRef} className="catalog-results" role="region" aria-label="Rezultate catalog" tabIndex={-1} aria-busy={loading}>
      {!data && loading ? <div className="catalog-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div key={index} className="catalog-skeleton" />)}</div>
        : data?.items.length ? <>
          <section className="catalog-grid" aria-label="Obiecte din inventar">
            {data.items.map(asset => <a className="catalog-card" key={asset.code} href={`/catalog/${encodeURIComponent(asset.code)}?${data.query}`}>
              <div className="catalog-image"><AssetImage src={asset.image_url} name={asset.name} lazy /><span className="catalog-code">{asset.code}</span></div>
              <div className="catalog-card-body"><div className="catalog-card-meta"><span>{asset.category}</span><PublicStatus status={asset.status} /></div>
                <h2>{asset.name}</h2><p className="catalog-description">{asset.description || "Deschide fișa pentru informațiile obiectului."}</p>
                <div className="catalog-card-footer"><span><Icon name="pin" size={16} />{asset.location_name || "Locație nespecificată"}</span><Icon name="arrow" size={19} /></div>
              </div>
            </a>)}
          </section>
          <nav className="catalog-pagination" aria-label="Pagini catalog"><button type="button" className="catalog-button" disabled={data.page <= 1} aria-disabled={loading || Boolean(error) || data.page <= 1} onClick={() => goToPage(data.page - 1)}><Icon name="back" size={17} /> Anterior</button>
            <span>Pagina {data.page} din {pages}</span><button type="button" className="catalog-button" disabled={data.page >= pages} aria-disabled={loading || Boolean(error) || data.page >= pages} onClick={() => goToPage(data.page + 1)}>Următor <Icon name="arrow" size={17} /></button></nav>
        </> : data && <section className="catalog-empty"><Icon name="inventory" size={40} /><h2>{loadedHasFilters ? "Niciun obiect găsit" : "Catalogul este încă gol"}</h2><p>{loadedHasFilters ? "Încearcă alt nume sau modifică filtrele selectate." : "Obiectele vor apărea aici imediat ce sunt înregistrate în inventar."}</p>{loadedHasFilters && <button type="button" className="catalog-button" onClick={reset}>Vezi toate obiectele</button>}</section>}
      </div>
    </main>
  </PublicLayout>;
}
