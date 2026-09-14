import { useCallback, useEffect, useState } from "react";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import AddDevice from "./pages/AddDevice";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Loans from "./pages/Loans";
import Locations from "./pages/Locations";
import Logs from "./pages/Logs";
import People from "./pages/People";
import { deleteDevice, getDevices } from "./services/api";

export default function App() {
  const [currentPage, setCurrentPage] = useState(() => localStorage.getItem("inventory.currentPage") || "Dashboard");
  const [devices, setDevices] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState("");

  const loadDevices = useCallback(async () => {
    try {
      const data = await getDevices();
      setDevices(data);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    localStorage.setItem("inventory.currentPage", currentPage);
  }, [currentPage]);

  async function handleDeleteDevice(deviceId) {
    if (!window.confirm("Retragi acest obiect din inventar? Datele și istoricul rămân salvate.")) return;

    try {
      await deleteDevice(deviceId);
      await loadDevices();
    } catch (err) {
      setError(err.message);
    }
  }

  function renderPage() {
    if (currentPage === "Dashboard") return <Dashboard devices={devices} />;
    if (currentPage === "Inventory") {
      return <Inventory devices={devices} onDelete={handleDeleteDevice} onUpdated={loadDevices} />;
    }
    if (currentPage === "Add Device") return <AddDevice onDeviceAdded={loadDevices} />;
    if (currentPage === "People") return <People />;
    if (currentPage === "Locations") return <Locations />;
    if (currentPage === "Loans") return <Loans onInventoryChanged={loadDevices} />;
    if (currentPage === "Logs") return <Logs />;
    return null;
  }

  return (
    <>
      <Navbar onToggleSidebar={() => setSidebarOpen(true)} />
      <div className="app-layout">
        <Sidebar
          isOpen={sidebarOpen}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          onClose={() => setSidebarOpen(false)}
        />

        <main>
          {error && <div className="error">Backend indisponibil: {error}</div>}
          {renderPage()}
        </main>
      </div>
    </>
  );
}
