export default function DeviceCard({ device }) {
    return (
        <article className="device-card">
            <strong>{device.name}</strong>
            <span>{device.code}</span>
            <small>{device.status}</small>
        </article>
    );
}
