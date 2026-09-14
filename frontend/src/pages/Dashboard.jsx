import { useEffect, useMemo, useState } from "react";
import Icon from "../components/Icon";
import { getLoans, getLocations, getPeople } from "../services/api";

function StatCard({ icon, label, value, helper, tone = "default" }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-card-top">
        <div className="stat-icon"><Icon name={icon} size={20} /></div>
        <span className="stat-helper">{helper}</span>
      </div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export default function Dashboard({ devices, onNavigate }) {
  const [activeLoans, setActiveLoans] = useState([]);
  const [people, setPeople] = useState([]);
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    Promise.all([getLoans("ACTIVE"), getPeople(false), getLocations()])
      .then(([loanData, peopleData, locationData]) => {
        setActiveLoans(loanData || []);
        setPeople(peopleData || []);
        setLocations(locationData || []);
      })
      .catch(() => {});
  }, []);

  const counts = useMemo(() => {
    const available = devices.filter((d) => d.status === "AVAILABLE").length;
    const loaned = devices.filter((d) => d.status === "LOANED").length;
    const attention = devices.filter((d) => ["BROKEN", "LOST", "DEFECTIVE"].includes(d.status)).length;
    return { available, loaned, attention };
  }, [devices]);

  const maxStatus = Math.max(devices.length, 1);
  const recentDevices = [...devices].slice(-5).reverse();

  return (
    <section className="page page-dashboard">
      <div className="hero-panel">
        <div>
          <span className="hero-kicker">INVENTORY CONTROL CENTER</span>
          <h2>Tot inventarul, fără haos.</h2>
          <p>Vezi rapid ce există, ce este împrumutat și ce necesită atenție.</p>
        </div>
        <div className="hero-actions">
          <button className="btn btn-secondary" onClick={() => onNavigate("Inventory")}>Vezi inventarul</button>
          <button className="btn btn-primary" onClick={() => onNavigate("Add Device")}>
            <Icon name="plus" size={17} /> Adaugă obiect
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon="inventory" label="Obiecte totale" value={devices.length} helper="Total" />
        <StatCard icon="check" label="Disponibile" value={counts.available} helper="Ready" tone="success" />
        <StatCard icon="loans" label="Împrumuturi active" value={activeLoans.length || counts.loaned} helper="Active" tone="warning" />
        <StatCard icon="alert" label="Necesită atenție" value={counts.attention} helper="Review" tone="danger" />
      </div>

      <div className="dashboard-grid">
        <div className="panel panel-large">
          <div className="panel-header">
            <div>
              <span className="panel-eyebrow">STATUS INVENTAR</span>
              <h3>Distribuție operațională</h3>
            </div>
            <button className="text-button" onClick={() => onNavigate("Inventory")}>Detalii <Icon name="arrow" size={15} /></button>
          </div>

          <div className="status-bars">
            <div className="status-row">
              <div className="status-row-label"><span>Disponibile</span><strong>{counts.available}</strong></div>
              <div className="progress-track"><div className="progress-fill progress-success" style={{ width: `${(counts.available / maxStatus) * 100}%` }} /></div>
            </div>
            <div className="status-row">
              <div className="status-row-label"><span>Împrumutate</span><strong>{counts.loaned}</strong></div>
              <div className="progress-track"><div className="progress-fill progress-warning" style={{ width: `${(counts.loaned / maxStatus) * 100}%` }} /></div>
            </div>
            <div className="status-row">
              <div className="status-row-label"><span>Problemă / pierdute</span><strong>{counts.attention}</strong></div>
              <div className="progress-track"><div className="progress-fill progress-danger" style={{ width: `${(counts.attention / maxStatus) * 100}%` }} /></div>
            </div>
          </div>

          <div className="mini-metrics">
            <div><Icon name="people" size={18} /><span>Persoane active</span><strong>{people.length}</strong></div>
            <div><Icon name="locations" size={18} /><span>Locații</span><strong>{locations.length}</strong></div>
            <div><Icon name="loans" size={18} /><span>În circulație</span><strong>{activeLoans.length}</strong></div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="panel-eyebrow">ACȚIUNI RAPIDE</span>
              <h3>Ce vrei să faci?</h3>
            </div>
          </div>
          <div className="quick-actions">
            <button onClick={() => onNavigate("Add Device")}><span><Icon name="plus" /></span><div><strong>Adaugă obiect</strong><small>Înregistrează echipament nou</small></div><Icon name="chevron" size={16} /></button>
            <button onClick={() => onNavigate("Loans")}><span><Icon name="loans" /></span><div><strong>Împrumut nou</strong><small>Asociază obiect și persoană</small></div><Icon name="chevron" size={16} /></button>
            <button onClick={() => onNavigate("People")}><span><Icon name="people" /></span><div><strong>Gestionează persoane</strong><small>Contacte și responsabili</small></div><Icon name="chevron" size={16} /></button>
          </div>
        </div>
      </div>

      <div className="panel recent-panel">
        <div className="panel-header">
          <div>
            <span className="panel-eyebrow">INVENTAR RECENT</span>
            <h3>Ultimele obiecte</h3>
          </div>
          <button className="text-button" onClick={() => onNavigate("Inventory")}>Vezi toate <Icon name="arrow" size={15} /></button>
        </div>
        {recentDevices.length === 0 ? (
          <div className="empty-state compact"><Icon name="box" size={28} /><p>Nu există încă obiecte în inventar.</p></div>
        ) : (
          <div className="recent-list">
            {recentDevices.map((device) => (
              <div className="recent-item" key={device.id}>
                <div className="object-avatar">{(device.name || "?").charAt(0).toUpperCase()}</div>
                <div className="recent-main"><strong>{device.name}</strong><span>{device.category} · {device.code}</span></div>
                <span className={`badge badge-${(device.status || "").toLowerCase().replace("_", "-")}`}>{device.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
