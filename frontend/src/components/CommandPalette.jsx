import { useEffect, useId, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import useDialogFocus from "../hooks/useDialogFocus";

const destinations = [
  { page: "Dashboard", label: "Dashboard", description: "Prezentare generală și indicatori", icon: "dashboard" },
  { page: "Inventory", label: "Inventar", description: "Caută și gestionează obiectele", icon: "inventory" },
  { page: "Add Device", label: "Adaugă obiect", description: "Înregistrează echipament nou", icon: "plus" },
  { page: "Tags", label: "Etichete", description: "Tipărește loturi de etichete cu cod de bare", icon: "tag" },
  { page: "People", label: "Persoane", description: "Contacte și responsabili", icon: "people" },
  { page: "Locations", label: "Locații", description: "Spații și puncte de inventar", icon: "locations" },
  { page: "Loans", label: "Împrumuturi", description: "Predări, retururi și evidență", icon: "loans" },
  { page: "Journal", label: "Jurnal operațional", description: "Împrumuturi, retururi, mutări și schimbări de stare", icon: "activity" },
  { page: "Logs", label: "Loguri tehnice", description: "Date brute pentru diagnostic", icon: "logs" },
  { page: "Admin", label: "Administrare", description: "Backup, stare sistem și reset date", icon: "shield" },
];

export default function CommandPalette({ isOpen, currentPage, onClose, onNavigate }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const resultsRef = useRef(null);
  const resultsId = useId();

  useDialogFocus({ active: isOpen, dialogRef, initialFocusRef: inputRef, onClose });

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setActiveIndex(0);
  }, [isOpen]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return destinations;
    return destinations.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(needle));
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    resultsRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [activeIndex, isOpen, filtered]);

  function selectDestination(item) {
    if (!item) return;
    onNavigate(item.page);
    onClose();
  }

  function handleSearchKey(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!filtered.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + step + filtered.length) % filtered.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectDestination(filtered[activeIndex]);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="command-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="command-palette" role="dialog" aria-modal="true" aria-label="Navigare rapidă" tabIndex={-1}>
        <div className="command-search">
          <Icon name="search" size={19} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
            onKeyDown={handleSearchKey}
            placeholder="Caută o secțiune..."
            aria-label="Caută o secțiune de administrare"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={resultsId}
            aria-activedescendant={filtered[activeIndex] ? `${resultsId}-${activeIndex}` : undefined}
          />
          <kbd>ESC</kbd>
          <button type="button" className="icon-button command-close" onClick={onClose} aria-label="Închide navigarea rapidă" title="Închide navigarea rapidă">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="command-section-label">NAVIGARE RAPIDĂ</div>
        <div className="command-results" id={resultsId} ref={resultsRef} role="listbox" aria-label="Secțiuni de administrare">
          {filtered.map((item, index) => (
            <button
              key={item.page}
              type="button"
              id={`${resultsId}-${index}`}
              role="option"
              aria-selected={activeIndex === index}
              tabIndex={-1}
              className={`command-item ${currentPage === item.page ? "active" : ""} ${activeIndex === index ? "selected" : ""}`}
              onPointerMove={() => setActiveIndex(index)}
              onClick={() => selectDestination(item)}
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
            <div className="command-empty" role="status">
              <Icon name="search" size={22} />
              <strong>Nicio secțiune găsită</strong>
              <span>Încearcă alt termen.</span>
            </div>
          )}
        </div>

        <div className="command-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navighează</span>
          <span><kbd>↵</kbd> selectează</span>
          <span><kbd>Ctrl</kbd><kbd>K</kbd> deschide oriunde</span>
        </div>
      </div>
    </div>
  );
}
