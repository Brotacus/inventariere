import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import useDialogFocus from "../hooks/useDialogFocus";

const groups = [
  {
    label: "OVERVIEW",
    items: [{ page: "Dashboard", label: "Dashboard", icon: "dashboard" }],
  },
  {
    label: "MANAGEMENT",
    items: [
      { page: "Inventory", label: "Inventar", icon: "inventory" },
      { page: "Add Device", label: "Adaugă obiect", icon: "plus" },
      { page: "People", label: "Persoane", icon: "people" },
      { page: "Locations", label: "Locații", icon: "locations" },
      { page: "Loans", label: "Împrumuturi", icon: "loans" },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { page: "Journal", label: "Jurnal operațional", icon: "activity" },
      { page: "Logs", label: "Loguri tehnice", icon: "logs" },
      { page: "Admin", label: "Administrare", icon: "shield" },
    ],
  },
];

export default function Sidebar({ isOpen, currentPage, setCurrentPage, onClose, inert = false }) {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 900px)").matches);
  const sidebarRef = useRef(null);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const updateViewport = () => {
      setIsMobile(media.matches);
      if (!media.matches) onCloseRef.current();
    };
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

  useDialogFocus({ active: isOpen && isMobile && !inert, dialogRef: sidebarRef, initialFocusRef: closeRef, onClose });

  function selectPage(page) {
    setCurrentPage(page);
    onClose();
  }

  return (
    <>
      {isOpen && isMobile && <div className="sidebar-overlay" onPointerDown={onClose} aria-hidden="true" />}
      <aside
        ref={sidebarRef}
        id="admin-sidebar"
        className={`sidebar ${isOpen ? "open" : ""}`}
        inert={inert || (isMobile && !isOpen) ? true : undefined}
        aria-hidden={inert || (isMobile && !isOpen) ? true : undefined}
        role={isMobile && isOpen ? "dialog" : undefined}
        aria-modal={isMobile && isOpen ? true : undefined}
        aria-label="Meniu de administrare"
        tabIndex={-1}
      >
        <div className="sidebar-brand">
          <div className="brand-mark brand-logo-wrap">
            <img src="/inventory-logo.png" alt="" className="brand-logo" />
          </div>
          <div>
            <strong>Inventar</strong>
            <span>Asset Management</span>
          </div>
          <button ref={closeRef} type="button" className="icon-button sidebar-close" onClick={onClose} aria-label="Închide meniul">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="workspace-chip">
          <span className="workspace-mark">UPB</span>
          <div><strong>Inventory workspace</strong><small>Laboratory assets</small></div>
          <span className="workspace-live">ADMIN</span>
        </div>

        <nav className="sidebar-nav" aria-label="Secțiuni de administrare">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((item) => (
                <button
                  key={item.page}
                  type="button"
                  className={`nav-item ${currentPage === item.page ? "active" : ""}`}
                  aria-current={currentPage === item.page ? "page" : undefined}
                  onClick={() => selectPage(item.page)}
                >
                  <Icon name={item.icon} size={19} />
                  <span>{item.label}</span>
                  {currentPage === item.page && <span className="nav-active-dot" />}
                </button>
              ))}
            </div>
          ))}
          <a className="nav-item" href="/catalog"><Icon name="inventory" size={19} /><span>Catalog public</span><Icon name="external" size={15} /></a>
        </nav>

        <div className="sidebar-footer">
          <div className="footer-icon"><Icon name="server" size={18} /></div>
          <div>
            <strong>Inventory API</strong>
            <span>Operații autentificate</span>
          </div>
          <span className="api-pill">API</span>
        </div>
      </aside>
    </>
  );
}
