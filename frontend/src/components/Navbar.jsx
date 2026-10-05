import NotificationCenter from "./NotificationCenter";
import Icon from "./Icon";
import { useEffect, useState } from "react";

const pageLabels = {
  Dashboard: "Prezentare generală",
  Inventory: "Inventar",
  "Device Detail": "Fișa obiectului",
  "Add Device": "Adaugă obiect",
  People: "Persoane",
  Locations: "Locații",
  Loans: "Împrumuturi",
  Journal: "Jurnal operațional",
  Logs: "Loguri tehnice",
  Admin: "Administrare sistem",
};

export default function Navbar({ onToggleSidebar, currentPage, theme, onToggleTheme, onOpenCommand, onNavigate, onLogout, loggingOut = false, admin = null }) {
  const adminName = admin?.admin || "Administrator";
  const [connection, setConnection] = useState("unknown");
  useEffect(() => {
    function update(event) { setConnection(event.detail?.status || "unknown"); }
    function offline() { setConnection("offline"); }
    window.addEventListener("inventory-connection", update);
    window.addEventListener("offline", offline);
    if (!navigator.onLine) offline();
    return () => {
      window.removeEventListener("inventory-connection", update);
      window.removeEventListener("offline", offline);
    };
  }, []);
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-button mobile-menu" onClick={onToggleSidebar} aria-label="Deschide meniul">
          <Icon name="menu" />
        </button>
        <div>
          <div className="eyebrow">Workspace / Inventar</div>
          <h1>{pageLabels[currentPage] || currentPage}</h1>
        </div>
      </div>

      <div className="topbar-actions">
        <button className="command-trigger" onClick={onOpenCommand} title="Navigare rapidă (Ctrl+K)">
          <Icon name="search" size={16} />
          <span>Navigare rapidă</span>
          <kbd>Ctrl K</kbd>
        </button>

        <div className={`system-status connection-${connection}`} role="status" title={connection === "online" ? "Ultima cerere către server a reușit" : connection === "offline" ? "Conexiunea către server este indisponibilă" : "Starea serverului nu a fost confirmată"}>
          <span className="status-dot" />
          {connection === "online" ? "Server conectat" : connection === "offline" ? "Conexiune indisponibilă" : "Se verifică serverul"}
        </div>

        <button
          className="icon-button theme-toggle"
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Activează modul luminos" : "Activează modul întunecat"}
          title={theme === "dark" ? "Mod luminos" : "Dark mode"}
          aria-pressed={theme === "dark"}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </button>

        <NotificationCenter onNavigate={onNavigate} />

        <div className="admin-chip">
          <div className="avatar" aria-hidden="true">{adminName.charAt(0).toUpperCase()}</div>
          <div className="admin-copy">
            <strong>{adminName}</strong>
            <span>{admin?.method === "ldap" ? `LDAP · ${admin.username}` : "Sesiune activă"}</span>
          </div>
        </div>

        <button className="icon-button logout-button" onClick={onLogout} disabled={loggingOut} aria-label="Deconectare" title="Deconectare">
          <Icon name="logout" size={18} />
        </button>
      </div>
    </header>
  );
}
