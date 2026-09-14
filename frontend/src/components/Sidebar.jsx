import Icon from "./Icon";

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

export default function Sidebar({ isOpen, currentPage, setCurrentPage, onClose }) {
  function selectPage(page) {
    setCurrentPage(page);
    onClose();
  }

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark brand-logo-wrap">
            <img src="/inventory-logo.png" alt="" className="brand-logo" />
          </div>
          <div>
            <strong>Inventar</strong>
            <span>Asset Management</span>
          </div>
          <button className="icon-button sidebar-close" onClick={onClose} aria-label="Închide meniul">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="workspace-chip">
          <span className="workspace-mark">UPB</span>
          <div><strong>Inventory workspace</strong><small>Laboratory assets</small></div>
          <span className="workspace-live">LIVE</span>
        </div>

        <nav className="sidebar-nav">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((item) => (
                <button
                  key={item.page}
                  className={`nav-item ${currentPage === item.page ? "active" : ""}`}
                  onClick={() => selectPage(item.page)}
                >
                  <Icon name={item.icon} size={19} />
                  <span>{item.label}</span>
                  {currentPage === item.page && <span className="nav-active-dot" />}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="footer-icon"><Icon name="server" size={18} /></div>
          <div>
            <strong>Inventory API</strong>
            <span><i /> localhost:8000</span>
          </div>
          <span className="api-pill">API</span>
        </div>
      </aside>
    </>
  );
}
