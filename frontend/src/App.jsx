import { Component, lazy, Suspense, useEffect, useState } from "react";
import Icon from "./components/Icon";
import PublicLayout from "./components/PublicLayout";
import PublicAssetPage from "./pages/PublicAssetPage";
import PublicCatalogPage from "./pages/PublicCatalogPage";

// Administrative screens are loaded only for the explicit admin URL.
const AdminApp = lazy(() => import("./AdminApp"));

class RouteErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="route-loading" role="alert">
      <Icon name="alert" size={32} /><h1>Pagina nu a putut fi încărcată</h1>
      <p>Verifică conexiunea și reîncarcă pagina.</p>
      <button className="catalog-button" onClick={() => window.location.reload()}>Reîncarcă pagina</button>
      <a href="/catalog">Înapoi la catalog</a>
    </main>;
  }
}

function initialTheme() {
  let saved;
  try { saved = window.localStorage.getItem("inventory-theme"); } catch {}
  return saved === "light" || saved === "dark" ? saved
    : window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function decodePathPart(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function AppRoutes() {
  const [theme, setTheme] = useState(initialTheme);
  const pathname = window.location.pathname;
  const catalog = pathname.match(/^\/catalog(?:\/([^/]+))?\/?$/);
  const asset = pathname.match(/^\/asset\/([^/]+)\/?$/);
  const admin = /^\/admin\/?$/.test(pathname);
  const onToggleTheme = () => setTheme(value => value === "dark" ? "light" : "dark");
  const shared = { theme, onToggleTheme };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try { window.localStorage.setItem("inventory-theme", theme); } catch {}
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#081112" : "#f4f8f8");
  }, [theme]);

  useEffect(() => {
    document.title = admin ? "Administrare · Inventar" : "Catalog public · Inventar";
  }, [admin]);

  if (admin) return <Suspense fallback={<main className="route-loading" aria-busy="true">
    <Icon name="shield" size={32} /><p role="status">Se încarcă administrarea…</p><a href="/catalog">Înapoi la catalog</a>
  </main>}><AdminApp {...shared} /></Suspense>;

  if (pathname === "/" || (catalog && !catalog[1])) return <PublicCatalogPage {...shared} />;
  if (asset || catalog?.[1]) return <PublicAssetPage {...shared}
    token={asset ? decodePathPart(asset[1]) : undefined}
    code={catalog?.[1] ? decodePathPart(catalog[1]) : undefined} />;

  return <PublicLayout {...shared}><main id="public-content" className="public-asset-stage">
    <section className="public-asset-state"><span className="public-state-icon"><Icon name="search" size={26} /></span>
      <h1>Pagina nu a fost găsită</h1><p>Revino la catalog pentru a consulta obiectele din inventar.</p>
      <a className="catalog-button" href="/catalog">Deschide catalogul</a>
    </section>
  </main></PublicLayout>;
}

export default function App() {
  return <RouteErrorBoundary><AppRoutes /></RouteErrorBoundary>;
}
