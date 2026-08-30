const getStatusBadge = (status) => {
  const s = status ? status.toLowerCase() : "";

  if (s === "available" || s === "disponibil") {
    return <span className="badge badge-available">Disponibil</span>;
  }
  if (s === "loaned" || s === "imprumutat") {
    return <span className="badge badge-loaned">Împrumutat</span>;
  }
  if (s === "defective" || s === "defect") {
    return <span className="badge badge-defective">Defect</span>;
  }
  if (s === "lost" || s === "pierdut") {
    return <span className="badge badge-lost">Pierdut</span>;
  }
  if (s === "broken" || s === "stricat") {
    return <span className="badge badge-broken">Stricat</span>;
  }
  if (s === "retired" || s === "scos din uz") {
    return <span className="badge badge-retired">Scos din uz</span>;
  }
  if (s === "in_use" || s === "folosit") {
    return <span className="badge badge-in-use">Folosit</span>;
  }

  return <span className="badge">{status || "N/A"}</span>;
};

export default function DeviceTable({ devices = [], onDelete }) {
  if (!devices || devices.length === 0) {
    return <p>Nu există încă obiecte în inventar.</p>;
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Cod / Serie</th>
            <th>Nume</th>
            <th>Categorie</th>
            <th>Status</th>
            <th>Acțiuni</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={device.id}>
              <td>{device.serial_number || device.code || "-"}</td>
              <td>{device.name}</td>
              <td>{device.category}</td>
              <td>{getStatusBadge(device.status)}</td>
              <td>
                <button
                  type="button"
                  onClick={() => onDelete(device.id)}
                  style={{
                    backgroundColor: "#ef4444",
                    color: "white",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Șterge
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}