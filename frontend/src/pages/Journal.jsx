import { useEffect, useMemo, useState } from "react";
import Icon from "../components/Icon";
import { getJournal, getJournalEventTypes } from "../services/api";

function detailsObject(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return { raw: value }; }
}

function labelForCategory(category) {
  const labels = {
    LOAN: "Împrumuturi",
    TRACKING: "Tracking",
    STATUS: "Stare",
    INVENTORY: "Inventar",
    MEDIA: "Media",
    COMMUNICATION: "Comunicare",
    SYSTEM: "Sistem",
  };
  return labels[category] || category;
}

export default function Journal() {
  const [events, setEvents] = useState([]);
  const [types, setTypes] = useState([]);
  const [filters, setFilters] = useState({ eventType: "", category: "", severity: "", deviceId: "", loanId: "" });
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await getJournal(filters);
      setEvents(data);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getJournalEventTypes().then(setTypes).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [filters.eventType, filters.category, filters.severity, filters.deviceId, filters.loanId]);

  const stats = useMemo(() => ({
    total: events.length,
    loans: events.filter((event) => event.category === "LOAN").length,
    tracking: events.filter((event) => event.category === "TRACKING").length,
    warnings: events.filter((event) => event.severity === "WARNING" || event.severity === "ERROR").length,
  }), [events]);

  function setFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  return (
    <section className="page journal-page">
      <div className="page-intro">
        <div>
          <span className="page-kicker">AUDIT TRAIL</span>
          <h2>Jurnal operațional</h2>
          <p>Evenimente explicate în limbaj clar: cine a primit un obiect, de unde a plecat, când s-a întors, când s-a mutat și cum i s-a schimbat starea.</p>
        </div>
        <button className="btn btn-secondary" onClick={load}><Icon name="refresh" size={15} /> Refresh</button>
      </div>

      <div className="journal-metrics">
        <div><span>Evenimente afișate</span><strong>{stats.total}</strong></div>
        <div><span>Împrumuturi / retururi</span><strong>{stats.loans}</strong></div>
        <div><span>Mutări locație</span><strong>{stats.tracking}</strong></div>
        <div><span>Avertizări</span><strong>{stats.warnings}</strong></div>
      </div>

      <div className="panel-toolbar journal-toolbar">
        <div className="toolbar-title"><Icon name="filter" size={15} /> Filtre</div>
        <div className="toolbar-filters grow journal-filters">
          <select value={filters.eventType} onChange={(e) => setFilter("eventType", e.target.value)}>
            <option value="">Toate evenimentele</option>
            {types.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select value={filters.category} onChange={(e) => setFilter("category", e.target.value)}>
            <option value="">Toate categoriile</option>
            {["LOAN", "TRACKING", "STATUS", "INVENTORY", "MEDIA", "COMMUNICATION", "SYSTEM"].map((item) => <option key={item} value={item}>{labelForCategory(item)}</option>)}
          </select>
          <select value={filters.severity} onChange={(e) => setFilter("severity", e.target.value)}>
            <option value="">Orice severitate</option>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="ERROR">Error</option>
          </select>
          <input type="number" min="1" placeholder="Device ID" value={filters.deviceId} onChange={(e) => setFilter("deviceId", e.target.value)} />
          <input type="number" min="1" placeholder="Loan ID" value={filters.loanId} onChange={(e) => setFilter("loanId", e.target.value)} />
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="journal-stream">
        {loading && <div className="journal-empty">Se încarcă jurnalul...</div>}
        {!loading && !events.length && (
          <div className="journal-empty">
            <Icon name="history" size={28} />
            <strong>Niciun eveniment încă</strong>
            <span>Jurnalul va începe să se umple pe măsură ce folosești aplicația.</span>
          </div>
        )}
        {!loading && events.map((event) => {
          const details = detailsObject(event.details_json);
          const isOpen = expanded === event.id;
          return (
            <article key={event.id} className={`journal-event severity-${event.severity.toLowerCase()}`}>
              <div className="journal-event-rail"><span /><i /></div>
              <div className="journal-event-card">
                <div className="journal-event-top">
                  <div className="journal-event-tags">
                    <span className="journal-category">{labelForCategory(event.category)}</span>
                    <span className={`journal-severity ${event.severity.toLowerCase()}`}>{event.severity}</span>
                    <code>{event.event_type}</code>
                  </div>
                  <time>{new Date(event.occurred_at).toLocaleString("ro-RO")}</time>
                </div>
                <h3>{event.title}</h3>
                <p>{event.description}</p>
                <div className="journal-context">
                  {event.device_id && <span>Device <strong>#{event.device_id}</strong></span>}
                  {event.loan_id && <span>Împrumut <strong>#{event.loan_id}</strong></span>}
                  {event.person_id && <span>Persoană <strong>#{event.person_id}</strong></span>}
                  {event.location_id && <span>Locație <strong>#{event.location_id}</strong></span>}
                </div>
                {details && (
                  <>
                    <button className="journal-details-toggle" onClick={() => setExpanded(isOpen ? null : event.id)}>
                      {isOpen ? "Ascunde detaliile tehnice" : "Vezi detaliile complete"}
                      <Icon name="chevron" size={14} />
                    </button>
                    {isOpen && <pre className="journal-json">{JSON.stringify(details, null, 2)}</pre>}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
