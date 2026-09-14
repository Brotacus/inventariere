import { useEffect, useMemo, useState } from "react";
import DeviceTable from "../components/DeviceTable";
import Icon from "../components/Icon";
import { getLocations } from "../services/api";

export default function Inventory({ devices, onDelete, onOpen }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    getLocations(true).then(setLocations).catch(() => setLocations([]));
  }, [devices]);

  const locationMap = useMemo(
    () => Object.fromEntries((locations || []).map((location) => [location.id, location])),
    [locations]
  );

  const categories = useMemo(
    () => [...new Set(devices.map((d) => d.category).filter(Boolean))].sort(),
    [devices]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return devices.filter((device) => {
      const locationName = locationMap[device.location_id]?.name || "";
      const matchesSearch = !needle || [device.name, device.code, device.serial_number, device.category, locationName]
        .some((value) => String(value || "").toLowerCase().includes(needle));
      const matchesStatus = !status || device.status === status;
      const matchesCategory = !category || device.category === category;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [devices, search, status, category, locationMap]);

  return (
    <section className="page">
      <div className="page-intro">
        <div>
          <span className="page-kicker">ASSET REGISTRY</span>
          <h2>Inventar</h2>
          <p>Fiecare obiect are acum o locație curentă și un istoric de mutări care poate fi urmărit individual.</p>
        </div>
        <div className="count-chip"><strong>{filtered.length}</strong><span>din {devices.length}</span></div>
      </div>

      <div className="toolbar panel-toolbar">
        <div className="search-box">
          <Icon name="search" size={18} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Caută după nume, cod, serie sau locație..." />
        </div>
        <div className="toolbar-filters">
          <div className="select-wrap"><Icon name="filter" size={16} /><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Toate statusurile</option><option value="AVAILABLE">Disponibile</option><option value="LOANED">Împrumutate</option><option value="IN_USE">În uz</option><option value="BROKEN">Stricate</option><option value="LOST">Pierdute</option><option value="RETIRED">Scoase din uz</option></select></div>
          <select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Toate categoriile</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </div>
      </div>

      <DeviceTable devices={filtered} locationMap={locationMap} onDelete={onDelete} onOpen={onOpen} />
    </section>
  );
}
