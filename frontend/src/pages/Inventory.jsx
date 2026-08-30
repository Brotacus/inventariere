
import DeviceTable from "../components/DeviceTable";

export default function Inventory({ devices, onDelete }) {
    return (
        <section>
            <h2>Inventory</h2>
            <DeviceTable devices={devices} onDelete={onDelete} />
        </section>
    );
}
