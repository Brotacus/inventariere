export default function Navbar({ onToggleSidebar }) {
  return (
    <header className="navbar">
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <button
          className="menu-toggle-btn"
          onClick={onToggleSidebar}
          aria-label="Deschide Meniul"
        >
          ☰
        </button>
        <h1 style={{ color: "white" }}>Inventar</h1>
      </div>
    </header>
  );
}