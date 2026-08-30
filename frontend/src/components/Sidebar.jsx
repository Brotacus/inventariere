export default function Sidebar({ isOpen, currentPage, setCurrentPage, onClose }) {
    const pages = ["Dashboard", "Inventory", "Add Device", "People", "Logs"];

    return (
        <aside className={`sidebar ${isOpen ? "open" : ""}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ margin: 0 }}>Meniu</h3>
        <button className="close-btn" onClick={onClose}>
          ✕
        </button>
      </div>
            {pages.map((page) => (
                <button
                    key={page}
                    className={currentPage === page ? "active" : ""}
                    onClick={() => setCurrentPage(page)}
                >
                    {page}
                </button>
            ))}
        </aside>
    );
}
