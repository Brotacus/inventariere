import { useCallback, useEffect, useState } from "react";

import CommandPalette from "./components/CommandPalette";
import LoginScreen from "./components/LoginScreen";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import AddDevice from "./pages/AddDevice";
import Admin from "./pages/Admin";
import Dashboard from "./pages/Dashboard";
import DeviceDetail from "./pages/DeviceDetail";
import Inventory from "./pages/Inventory";
import Journal from "./pages/Journal";
import Loans from "./pages/Loans";
import Locations from "./pages/Locations";
import Logs from "./pages/Logs";
import People from "./pages/People";
import PublicAssetPage from "./pages/PublicAssetPage";
import {
  clearAdminSession,
  deleteDevice,
  getCurrentAdmin,
  getDevices,
  hasAdminSession,
  loginAdmin,
  logoutAdmin,
} from "./services/api";

function getInitialTheme() {
  const saved = window.localStorage.getItem("inventory-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}


function getPublicAssetToken() {
  const match = window.location.pathname.match(/^\/asset\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function App() {
  const publicAssetToken = getPublicAssetToken();
  const [authState, setAuthState] = useState("checking");
  const [currentPage, setCurrentPage] = useState("Dashboard");
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);
  const [error, setError] = useState("");

  const loadDevices = useCallback(async () => {
    try {
      const data = await getDevices();
      setDevices(data);
      setError("");
    } catch (err) {
      if (err.status !== 401) setError(err.message);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      if (!hasAdminSession()) {
        if (!cancelled) setAuthState("unauthenticated");
        return;
      }

      try {
        await getCurrentAdmin();
        if (!cancelled) setAuthState("authenticated");
      } catch {
        clearAdminSession();
        if (!cancelled) setAuthState("unauthenticated");
      }
    }

    verifySession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function requireAuthentication() {
      setAuthState("unauthenticated");
      setDevices([]);
      setError("");
      setCommandOpen(false);
      setSidebarOpen(false);
    }

    window.addEventListener("inventory-auth-required", requireAuthentication);
    return () => window.removeEventListener("inventory-auth-required", requireAuthentication);
  }, []);

  useEffect(() => {
    if (authState === "authenticated") loadDevices();
  }, [authState, loadDevices]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("inventory-theme", theme);

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute("content", theme === "dark" ? "#081112" : "#f4f8f8");
  }, [theme]);

  useEffect(() => {
    if (authState !== "authenticated") return undefined;

    function handleShortcut(event) {
      const isCommand = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (isCommand) {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
      if (event.key === "Escape") setCommandOpen(false);
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [authState]);

  async function handleLogin(password) {
    await loginAdmin(password);
    setAuthState("authenticated");
    setCurrentPage("Dashboard");
    setError("");
  }

  async function handleLogout() {
    try {
      await logoutAdmin();
    } catch {
      clearAdminSession();
    }
    setAuthState("unauthenticated");
    setDevices([]);
    setCurrentPage("Dashboard");
    setSelectedDeviceId(null);
    setSidebarOpen(false);
    setCommandOpen(false);
    setError("");
  }

  async function handleDeleteDevice(deviceId) {
    if (!window.confirm("Sigur vrei să ștergi acest obiect?")) return;

    try {
      await deleteDevice(deviceId);
      if (selectedDeviceId === deviceId) {
        setSelectedDeviceId(null);
        setCurrentPage("Inventory");
      }
      await loadDevices();
    } catch (err) {
      if (err.status !== 401) setError(err.message);
    }
  }

  function navigate(page) {
    setCurrentPage(page);
    if (page !== "Device Detail") setSelectedDeviceId(null);
    setCommandOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openDevice(deviceId) {
    setSelectedDeviceId(deviceId);
    setCurrentPage("Device Detail");
    setCommandOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderPage() {
    if (currentPage === "Dashboard") return <Dashboard devices={devices} onNavigate={navigate} />;
    if (currentPage === "Inventory") return <Inventory devices={devices} onDelete={handleDeleteDevice} onOpen={openDevice} />;
    if (currentPage === "Device Detail" && selectedDeviceId) {
      return <DeviceDetail deviceId={selectedDeviceId} onBack={() => navigate("Inventory")} onChanged={loadDevices} />;
    }
    if (currentPage === "Add Device") return <AddDevice onDeviceAdded={loadDevices} onNavigate={navigate} />;
    if (currentPage === "People") return <People />;
    if (currentPage === "Locations") return <Locations />;
    if (currentPage === "Loans") return <Loans onInventoryChanged={loadDevices} />;
    if (currentPage === "Journal") return <Journal />;
    if (currentPage === "Logs") return <Logs />;
    if (currentPage === "Admin") return <Admin onCleared={loadDevices} />;
    return null;
  }

  if (publicAssetToken) {
    return (
      <PublicAssetPage
        token={publicAssetToken}
        theme={theme}
        onToggleTheme={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
      />
    );
  }

  if (authState !== "authenticated") {
    return (
      <LoginScreen
        theme={theme}
        onToggleTheme={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
        onLogin={handleLogin}
        checking={authState === "checking"}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        isOpen={sidebarOpen}
        currentPage={currentPage}
        setCurrentPage={navigate}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="content-shell">
        <Navbar
          currentPage={currentPage}
          theme={theme}
          onToggleTheme={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
          onToggleSidebar={() => setSidebarOpen(true)}
          onOpenCommand={() => setCommandOpen(true)}
          onNavigate={navigate}
          onLogout={handleLogout}
        />

        <main className="main-content">
          {error && (
            <div className="alert alert-error global-alert">
              <strong>Backend indisponibil.</strong>
              <span>{error}</span>
            </div>
          )}
          {renderPage()}
        </main>
      </div>

      <CommandPalette
        isOpen={commandOpen}
        currentPage={currentPage}
        onClose={() => setCommandOpen(false)}
        onNavigate={navigate}
      />
    </div>
  );
}
