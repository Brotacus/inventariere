export default function Dashboard({ devices }) {
    const available = devices.filter((d) => d.status === "AVAILABLE").length;
    const loaned = devices.filter((d) => d.status === "LOANED").length;
    const broken = devices.filter((d) => d.status === "BROKEN").length;

    return (
        <section>
            <h2>Dashboard</h2>

            <div className="stats">
                <div>
                    <strong>{devices.length}</strong>
                    <span>Total</span>
                </div>

                <div>
                    <strong>{available}</strong>
                    <span>Disponibile</span>
                </div>

                <div>
                    <strong>{loaned}</strong>
                    <span>Împrumutate</span>
                </div>

                <div>
                    <strong>{broken}</strong>
                    <span>Defecte</span>
                </div>
            </div>
        </section>
    );
}
