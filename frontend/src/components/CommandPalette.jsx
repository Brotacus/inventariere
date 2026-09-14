import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";

const destinations = [
  { page: "Dashboard", label: "Dashboard", description: "Prezentare generală și indicatori", icon: "dashboard" },
  { page: "Inventory", label: "Inventar", description: "Caută și gestionează obiectele", icon: "inventory" },
  { page: "Add Device", label: "Adaugă obiect", description: "Înregistrează echipament nou", icon: "plus" },
  { page: "People", label: "Persoane", description: "Contacte și responsabili", icon: "people" },
  { page: "Locations", label: "Locații", description: "Spații și puncte de inventar", icon: "locations" },
  { page: "Loans", label: "Împrumuturi", description: "Predări, retururi și evidență", icon: "loans" },
  { page: "Journal", label: "Jurnal operațional", description: "Împrumuturi, retururi, mutări și schimbări de stare", icon: "activity" },
  { page: "Logs", label: "Loguri tehnice", description: "Date brute pentru diagnostic", icon: "logs" },
  { page: "Admin", label: "Administrare", description: "Backup, stare sistem și reset date", icon: "shield" },
];

export default function CommandPalette({ isOpen, currentPage, onClose, onNavigate }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return destinations;
    return destinations.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(needle));
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="command-backdrop" onMouseDown={onClose}>
      <div className="command-palette" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Navigare rapidă">
        <div className="command-search">
          <Icon name="search" size={19} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Caută o secțiune..."
          />
          <kbd>ESC</kbd>
        </div>

        <div className="command-section-label">NAVIGARE RAPIDĂ</div>
        <div className="command-results">
          {filtered.map((item) => (
            <button
              key={item.page}
              className={`command-item ${currentPage === item.page ? "active" : ""}`}
              onClick={() => onNavigate(item.page)}
            >
              <span className="command-item-icon"><Icon name={item.icon} size={18} /></span>
              <span className="command-item-copy">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
              {currentPage === item.page ? <span className="command-current">Aici</span> : <Icon name="chevron" size={16} />}
            </button>
          ))}

          {!filtered.length && (
            <div className="command-empty">
              <Icon name="search" size={22} />
              <strong>Nicio secțiune găsită</strong>
              <span>Încearcă alt termen.</span>
            </div>
          )}
        </div>

        <div className="command-footer">
          <span><kbd>↵</kbd> selectează</span>
          <span><kbd>Ctrl</kbd><kbd>K</kbd> deschide oriunde</span>
        </div>
      </div>
    </div>
  );
}
