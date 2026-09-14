export default function Navbar({ onToggleSidebar }) {
  return (
    <header className="navbar">
      <div className="navbar-left">
        <button
          className="menu-toggle-btn"
          onClick={onToggleSidebar}
          aria-label="Deschide meniul"
        >
          ☰
        </button>
        <div>
          <h1>Inventar</h1>
          <span className="navbar-subtitle">Panou administrare</span>
        </div>
      </div>
    </header>
  );
}
