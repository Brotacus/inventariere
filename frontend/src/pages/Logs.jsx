import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import useLatestRequest from "../hooks/useLatestRequest";
import { formatDateTime } from "../hooks/dateFormatting";
import { getLogActions, getLogs } from "../services/api";

function prettyValue(value) {
  if (!value) return "—";
  try { return JSON.stringify(JSON.parse(value), null, 2); }
  catch { return value; }
}

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [actions, setActions] = useState([]);
  const [action, setAction] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const requests = useLatestRequest();

  async function loadLogs() {
    const request = requests.begin();
    if (deviceId && !/^[1-9]\d*$/.test(deviceId)) { setError("ID-ul obiectului trebuie să fie un număr întreg pozitiv."); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await getLogs({ action, deviceId, limit: 300 });
      if (requests.isCurrent(request)) { setLogs(data); setError(""); }
    }
    catch (err) { if (requests.isCurrent(request)) setError(err.message); }
    finally { if (requests.isCurrent(request)) setLoading(false); }
  }
  useEffect(() => { getLogActions().then(setActions).catch(() => {}); }, []);
  useEffect(() => { loadLogs(); }, [action, deviceId]);

  return (
    <section className="page">
      <div className="page-intro">
        <div><span className="page-kicker">AUDIT TRAIL</span><h2>Jurnal activitate</h2><p>Urme complete pentru operațiile administrative și modificările din inventar.</p></div>
        <button className="btn btn-secondary" disabled={loading} onClick={loadLogs}><Icon name="refresh" size={16} /> Actualizează</button>
      </div>

      <div className="toolbar panel-toolbar">
        <div className="toolbar-title"><Icon name="filter" size={18} /><span>Filtre</span></div>
        <div className="toolbar-filters grow"><select aria-label="Tipul acțiunii" value={action} onChange={(e) => setAction(e.target.value)}><option value="">Toate acțiunile</option>{actions.map((item) => <option key={item} value={item}>{item}</option>)}</select><input type="number" min="1" step="1" aria-label="ID obiect" placeholder="ID obiect" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} /></div>
      </div>
      {loading && <p role="status">Se încarcă logurile…</p>}
      {error && <div className="alert alert-error" role="alert"><Icon name="alert" size={17} />{error}</div>}

      <div className="table-wrapper logs-table" aria-busy={loading}>
        <table>
          <thead><tr><th>Eveniment</th><th>Data</th><th>Device</th><th>Înainte</th><th>După</th></tr></thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td><div className="log-action"><span className="log-dot" /><div><strong>{log.action}</strong><small>Event #{log.id}</small></div></div></td>
                <td>{formatDateTime(log.timestamp)}</td>
                <td>{log.device_id ? <code className="code-pill">#{log.device_id}</code> : <span className="muted">—</span>}</td>
                <td><pre>{prettyValue(log.old_value)}</pre></td><td><pre>{prettyValue(log.new_value)}</pre></td>
              </tr>
            ))}
            {!loading && !error && !logs.length && <tr><td colSpan="5"><div className="empty-inline">Nu există evenimente pentru filtrele selectate.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
