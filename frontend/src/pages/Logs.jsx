import { useEffect, useState } from "react";
import { getLogActions, getLogs } from "../services/api";

function prettyValue(value) {
  if (!value) return "-";

  try {
    const parsed = JSON.parse(value);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [actions, setActions] = useState([]);
  const [action, setAction] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState("");

  async function loadLogs() {
    try {
      setLogs(await getLogs({ action, deviceId, limit: 300 }));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    getLogActions().then(setActions).catch(() => {});
  }, []);

  useEffect(() => {
    loadLogs();
  }, [action, deviceId]);

  return (
    <section>
      <div className="page-heading page-heading-row">
        <div>
          <h2>Loguri</h2>
          <p>Istoricul acțiunilor administrative și al operațiilor din inventar.</p>
        </div>
        <button className="btn-secondary" onClick={loadLogs}>Refresh</button>
      </div>

      <div className="filters">
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Toate acțiunile</option>
          {actions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input
          type="number"
          min="1"
          placeholder="Filtru device ID"
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
        />
      </div>

      {error && <div className="error">{error}</div>}

      <div className="table-wrapper logs-table">
        <table>
          <thead>
            <tr><th>ID</th><th>Data</th><th>Acțiune</th><th>Device ID</th><th>Înainte</th><th>După</th></tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{log.id}</td>
                <td>{new Date(log.timestamp).toLocaleString("ro-RO")}</td>
                <td><strong>{log.action}</strong></td>
                <td>{log.device_id ?? "-"}</td>
                <td><pre>{prettyValue(log.old_value)}</pre></td>
                <td><pre>{prettyValue(log.new_value)}</pre></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
