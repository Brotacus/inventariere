import { useCallback, useEffect, useState } from "react";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import AddDevice from "./pages/AddDevice";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Logs from "./pages/Logs";
import People from "./pages/People";
import { getDevices } from "./services/api";

export default function App() {
    const [currentPage, setCurrentPage] = useState("Dashboard");
    const [devices, setDevices] = useState([]);
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

    function renderPage() {
        if (currentPage === "Dashboard") {
            return <Dashboard devices={devices} />;
        }

        if (currentPage === "Inventory") {
            return <Inventory devices={devices} />;
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
            <Navbar />

            <div className="app-layout">
                <Sidebar
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
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
