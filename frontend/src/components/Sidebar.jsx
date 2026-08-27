export default function Sidebar({ currentPage, setCurrentPage }) {
    const pages = ["Dashboard", "Inventory", "Add Device", "People", "Logs"];

    return (
        <aside className="sidebar">
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
