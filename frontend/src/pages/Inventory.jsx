import DeviceTable from "../components/DeviceTable";

export default function Inventory({ devices }) {
    return (
        <section>
            <h2>Inventory</h2>
            <DeviceTable devices={devices} />
        </section>
    );
}
