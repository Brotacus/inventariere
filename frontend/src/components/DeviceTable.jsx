export default function DeviceTable({ devices }) {
    if (devices.length === 0) {
        return <p>Nu există încă obiecte în inventar.</p>;
    }

    return (
        <div className="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Cod</th>
                        <th>Nume</th>
                        <th>Categorie</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {devices.map((device) => (
                        <tr key={device.id}>
                            <td>{device.code}</td>
                            <td>{device.name}</td>
                            <td>{device.category}</td>
                            <td>{device.status}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
