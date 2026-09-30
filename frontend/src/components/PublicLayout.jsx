import Icon from "./Icon";

export const STATUS_LABELS = {
  AVAILABLE: "Disponibil", LOANED: "Împrumutat", IN_USE: "În utilizare",
  BROKEN: "Defect", LOST: "Pierdut", RETIRED: "Retras",
};

export function PublicStatus({ status }) {
  return <span className={`public-status public-status-${status.toLowerCase()}`}>{STATUS_LABELS[status] || status}</span>;
}

export default function PublicLayout({ children, theme, onToggleTheme, catalog = false }) {
  return <div className="public-asset-shell">
    <a className="public-skip-link" href="#public-content">Sari la conținut</a>
    <header className="public-asset-header">
      <a className="public-brand" href="/catalog" aria-label="Inventar — catalog public">
        <img src="/inventory-logo.png" alt="" />
        <div><strong>Inventar</strong><span>Catalog public · acces utilizator</span></div>
      </a>
      <nav className="public-navigation" aria-label="Navigare publică">
        <a href="/catalog" aria-current={catalog ? "page" : undefined}>Catalog</a>
        <button className="public-theme-toggle" type="button" onClick={onToggleTheme} aria-pressed={theme === "dark"}
          aria-label={theme === "dark" ? "Activează modul luminos" : "Activează modul întunecat"}>
          <Icon name={theme === "dark" ? "sun" : "moon"} size={19} />
        </button>
      </nav>
    </header>
    {children}
    <footer className="public-asset-footer"><span>Inventar · catalog și fișe QR</span><span>Acces public, doar pentru consultare</span></footer>
  </div>;
}
