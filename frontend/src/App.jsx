import { useCallback, useEffect, useState } from "react";
import "./index.css";
import { getDevices, deleteDevice } from "./services/api";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import AddDevice from "./pages/AddDevice";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Logs from "./pages/Logs";
import People from "./pages/People";

export default function App() {
  const [currentPage, setCurrentPage] = useState("Dashboard");
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  const handleDelete = async (id) => {
    if (window.confirm("Sigur vrei să ștergi acest dispozitiv?")) {
      try {
        await deleteDevice(id);
        loadDevices();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  function renderPage() {
    if (currentPage === "Dashboard") {
      return <Dashboard devices={devices} />;
    }
    if (currentPage === "Inventory") {
      return <Inventory devices={devices} onDelete={handleDelete} />;
    }
    if (currentPage === "Add Device") {
      return <AddDevice onDeviceAdded={loadDevices} />;
    }
    if (currentPage === "People") {
      return <People />;
    }
    if (currentPage === "Logs") {
      return <Logs />;
    }
    return null;
  }

  return (
    <>
      <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        {isSidebarOpen && (
            <div 
        className="sidebar-overlay"
        onClick={() => setIsSidebarOpen(false)}
      />
        )}
      <div className="app-layout">
        <Sidebar
        isOpen={isSidebarOpen}
          currentPage={currentPage}
          setCurrentPage={(page) => {
            setCurrentPage(page);
            setIsSidebarOpen(false);
          }}
          onClose={() => setIsSidebarOpen(false)}
        />
    
        <main>
          {error && (
            <div className="error">
              Backend indisponibil: {error}
            </div>
          )}
          {renderPage()}
        </main>
      </div>
    </>
  );
}