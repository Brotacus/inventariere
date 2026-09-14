export default function Sidebar({ isOpen, currentPage, setCurrentPage, onClose }) {
  const pages = [
    "Dashboard",
    "Inventory",
    "Add Device",
    "People",
    "Locations",
    "Loans",
    "Logs",
  ];

  function selectPage(page) {
    setCurrentPage(page);
    onClose();
  }

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <h3>Meniu admin</h3>
          <button className="close-btn" onClick={onClose} aria-label="Închide meniul">
            ✕
          </button>
        </div>

        {pages.map((page) => (
          <button
            key={page}
            className={currentPage === page ? "active" : ""}
            onClick={() => selectPage(page)}
          >
            {page}
          </button>
        ))}
      </aside>
    </>
  );
}
