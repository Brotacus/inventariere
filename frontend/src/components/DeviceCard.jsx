const getStatusBadge = (status) => {
  const s = status ? status.toLowerCase() : "";

  if (s === "available") return <span className="badge badge-available">Disponibil</span>;
  if (s === "loaned") return <span className="badge badge-loaned">Împrumutat</span>;
  if (s === "broken") return <span className="badge badge-broken">Stricat</span>;
  if (s === "lost") return <span className="badge badge-lost">Pierdut</span>;
  if (s === "retired") return <span className="badge badge-retired">Scos din uz</span>;
  if (s === "in_use") return <span className="badge badge-in-use">În uz</span>;

  return <span className="badge">{status || "N/A"}</span>;
};

export default function DeviceTable({ devices = [], onDelete, onEdit }) {
  if (devices.length === 0) {
    return <div className="empty-state">Nu există încă obiecte în inventar.</div>;
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Cod</th>
            <th>Serie</th>
            <th>Nume</th>
            <th>Categorie</th>
            <th>Status</th>
            <th>Locație ID</th>
            <th>Responsabil ID</th>
            <th>Acțiuni</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={device.id}>
              <td>{device.code}</td>
              <td>{device.serial_number || "-"}</td>
              <td>{device.name}</td>
              <td>{device.category}</td>
              <td>{getStatusBadge(device.status)}</td>
              <td>{device.location_id ?? "-"}</td>
              <td>{device.responsible_person_id ?? "-"}</td>
              <td>
                <div className="row-actions">
                  <button className="btn-secondary" onClick={() => onEdit(device)}>
                    Editează
                  </button>
                  <button className="btn-danger" onClick={() => onDelete(device.id)}>
                    Șterge
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
