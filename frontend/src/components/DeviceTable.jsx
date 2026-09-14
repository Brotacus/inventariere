import Icon from "./Icon";

export function StatusBadge({ status }) {
  const normalized = (status || "").toUpperCase();
  const labels = {
    AVAILABLE: "Disponibil",
    LOANED: "Împrumutat",
    DEFECTIVE: "Defect",
    BROKEN: "Stricat",
    LOST: "Pierdut",
    RETIRED: "Scos din uz",
    IN_USE: "În uz",
  };
  const css = normalized.toLowerCase().replaceAll("_", "-");
  return <span className={`badge badge-${css}`}>{labels[normalized] || status || "N/A"}</span>;
}

export default function DeviceTable({ devices = [], locationMap = {}, onDelete, onOpen }) {
  if (!devices.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><Icon name="inventory" size={28} /></div>
        <h3>Niciun obiect găsit</h3>
        <p>Schimbă filtrele sau adaugă primul obiect în inventar.</p>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Obiect</th>
            <th>Cod</th>
            <th>Categorie</th>
            <th>Locație curentă</th>
            <th>Status</th>
            <th className="table-actions-heading">Acțiuni</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => {
            const location = locationMap[device.location_id];
            return (
              <tr key={device.id} className="trackable-row" onDoubleClick={() => onOpen?.(device.id)}>
                <td>
                  <div className="object-cell">
                    <div className="object-avatar">{(device.name || "?").charAt(0).toUpperCase()}</div>
                    <div><strong>{device.name}</strong><span>{device.serial_number || "Fără serie"}</span></div>
                  </div>
                </td>
                <td><code className="code-pill">{device.code || "-"}</code></td>
                <td>{device.category}</td>
                <td>
                  <div className={`location-cell ${location ? "" : "missing"}`}>
                    <Icon name="pin" size={15} />
                    <span>{location?.name || "Locație nesetată"}</span>
                  </div>
                </td>
                <td><StatusBadge status={device.status} /></td>
                <td>
                  <div className="row-actions right">
                    <button className="icon-action" type="button" onClick={() => onOpen?.(device.id)} title="Urmărește obiectul">
                      <Icon name="eye" size={17} />
                    </button>
                    <button className="icon-action danger" type="button" onClick={() => onDelete(device.id)} title="Șterge obiectul">
                      <Icon name="trash" size={17} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
