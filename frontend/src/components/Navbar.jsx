import NotificationCenter from "./NotificationCenter";
import Icon from "./Icon";

const pageLabels = {
  Dashboard: "Prezentare generală",
  Inventory: "Inventar",
  "Add Device": "Adaugă obiect",
  People: "Persoane",
  Locations: "Locații",
  Loans: "Împrumuturi",
  Journal: "Jurnal operațional",
  Logs: "Loguri tehnice",
  Admin: "Administrare sistem",
};

export default function Navbar({ onToggleSidebar, currentPage, theme, onToggleTheme, onOpenCommand, onNavigate, onLogout }) {
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

        <div className="system-status" title="Backend conectat">
          <span className="status-dot" />
          Sistem online
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
          <div className="avatar">A</div>
          <div className="admin-copy">
            <strong>Administrator</strong>
            <span>Sesiune activă</span>
          </div>
        </div>

        <button className="icon-button logout-button" onClick={onLogout} aria-label="Deconectare" title="Deconectare">
          <Icon name="logout" size={18} />
        </button>
      </div>
    </header>
  );
}
