import { useEffect, useState } from "react";
import { getAdminDashboard } from "../services/api";

export default function Dashboard({ devices = [] }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminDashboard()
      .then((data) => {
        setStats(data);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, [devices.length]);

  const fallback = {
    devices_total: devices.length,
    devices_available: devices.filter((d) => d.status === "AVAILABLE").length,
    devices_loaned: devices.filter((d) => d.status === "LOANED").length,
    devices_broken: devices.filter((d) => d.status === "BROKEN").length,
    people_active: "-",
    active_loans: "-",
    locations_total: "-",
    logs_total: "-",
  };

  const data = stats || fallback;

  return (
    <section>
      <div className="page-heading">
        <div>
          <h2>Dashboard admin</h2>
          <p>Rezumatul inventarului și al activității.</p>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="stats admin-stats">
        <div><strong>{data.devices_total}</strong><span>Obiecte</span></div>
        <div><strong>{data.devices_available}</strong><span>Disponibile</span></div>
        <div><strong>{data.devices_loaned}</strong><span>Împrumutate</span></div>
        <div><strong>{data.devices_broken}</strong><span>Defecte</span></div>
        <div><strong>{data.people_active}</strong><span>Persoane active</span></div>
        <div><strong>{data.active_loans}</strong><span>Împrumuturi active</span></div>
        <div><strong>{data.locations_total}</strong><span>Locații</span></div>
        <div><strong>{data.logs_total}</strong><span>Loguri</span></div>
      </div>
    </section>
  );
}
