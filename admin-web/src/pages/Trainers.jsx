import { useEffect, useMemo, useState } from "react";
import {
    collection,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

export default function Trainers() {
    const [trainers, setTrainers] = useState([]);
    const [gyms, setGyms] = useState([]);
    const [loading, setLoading] = useState(true);

    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({
    gymId: "",
    kaina: "",
    specializacija: "",
    aprasymas: "",
    active: true,
    });

    useEffect(() => {
        const unsubGyms = onSnapshot(
        query(collection(db, "gyms"), orderBy("order", "asc")),
        (snap) => setGyms(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        );

        const unsubTrainers = onSnapshot(
        query(collection(db, "trainers"), orderBy("order", "asc")),
        (snap) => {
            setTrainers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }
        );

        return () => {
        unsubGyms();
        unsubTrainers();
        };
    }, []);

    const gymsById = useMemo(() => {
        const m = {};
        gyms.forEach((g) => (m[g.id] = g));
        return m;
    }, [gyms]);

    const startEdit = (t) => {
        setEditingId(t.id);
        setForm({
        gymId: t.gymId ?? "",
        kaina: t.kaina ?? "",
        specializacija: t.specializacija ?? "",
        aprasymas: t.aprasymas ?? "",
        active: typeof t.active === "boolean" ? t.active : true,
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setForm({ gymId: "", kaina: "", specializacija: "", aprasymas: "", active: true });
    };

    const save = async () => {
        if (!editingId) return;

        if (!form.gymId) return alert("Pasirink gym.");
        if (!form.kaina || Number(form.kaina) <= 0) return alert("Įvesk kainą (>0).");
        if (!form.specializacija.trim()) return alert("Įvesk specializaciją.");

        await updateDoc(doc(db, "trainers", editingId), {
        gymId: form.gymId,
        kaina: Number(form.kaina),
        specializacija: form.specializacija.trim(),
        aprasymas: form.aprasymas.trim(),
        active: !!form.active,
        });

        cancelEdit();
    };

    const syncFromUser = async (t) => {
        if (!t.userId) return alert("Trūksta trainer.userId.");
        const uSnap = await getDoc(doc(db, "users", t.userId));
        if (!uSnap.exists()) return alert("users/{uid} nerastas.");

        const u = uSnap.data();
        await updateDoc(doc(db, "trainers", t.id), {
        vardas: u.vardas ?? "",
        pavarde: u.pavarde ?? "",
        email: u.email ?? "",
        });

        alert("Sync done ✅");
    };

    return (
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr", gap: 16 }}>
        {/* LIST */}
        <div className="card">
            <h3 style={{ marginTop: 0 }}>Trainers</h3>

            {loading ? (
            <div className="muted">Kraunama...</div>
            ) : trainers.length === 0 ? (
            <div className="muted">Nėra trenerių.</div>
            ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {trainers.map((t) => {
                const fullName = [t.vardas, t.pavarde].filter(Boolean).join(" ") || "(be vardo)";
                const gymName = t.gymId ? gymsById[t.gymId]?.pavadinimas : "";
                const active = t.active !== false;

                return (
                    <div
                    key={t.id}
                    style={{
                        border: "1px solid #333",
                        borderRadius: 12,
                        padding: 12,
                        background: t.id === editingId ? "rgba(255,255,255,0.04)" : "transparent",
                    }}
                    >
                    <div className="row">
                        <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800 }}>
                            {fullName} {!active ? <span className="muted">(inactive)</span> : null}
                        </div>
                        <div className="muted" style={{ fontSize: 13 }}>
                            {t.email || "—"} • {gymName || "Gym: —"} • {t.kaina ? `${t.kaina}€` : "—"}
                        </div>
                        <div className="muted" style={{ fontSize: 13 }}>
                            {t.specializacija || "—"}
                        </div>
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn" onClick={() => startEdit(t)}>Edit</button>
                        <button className="btn" onClick={() => syncFromUser(t)}>Sync</button>
                        </div>
                    </div>
                    </div>
                );
                })}
            </div>
            )}
        </div>

        {/* EDIT FORM */}
        <div className="card">
            <h3 style={{ marginTop: 0 }}>Priskirti / redaguoti trenerį</h3>

            {!editingId ? (
            <div className="muted">Pasirink trenerį iš sąrašo ir spausk Edit.</div>
            ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="muted">Gym</span>
                <select
                    className="input"
                    value={form.gymId}
                    onChange={(e) => setForm((f) => ({ ...f, gymId: e.target.value }))}
                >
                    <option value="">-- pasirink --</option>
                    {gyms.map((g) => (
                    <option key={g.id} value={g.id}>
                        {g.order}. {g.pavadinimas}
                    </option>
                    ))}
                </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="muted">Kaina (€)</span>
                <input
                    className="input"
                    type="number"
                    min={1}
                    value={form.kaina}
                    onChange={(e) => setForm((f) => ({ ...f, kaina: e.target.value }))}
                />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="muted">Specializacija</span>
                <input
                    className="input"
                    value={form.specializacija}
                    onChange={(e) => setForm((f) => ({ ...f, specializacija: e.target.value }))}
                />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="muted">Aprašymas</span>
                <input
                    className="input"
                    value={form.aprasymas}
                    onChange={(e) => setForm((f) => ({ ...f, aprasymas: e.target.value }))}
                />
                </label>

                <label className="row" style={{ justifyContent: "flex-start", gap: 10 }}>
                <input
                    type="checkbox"
                    checked={!!form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                <span className="muted">Active</span>
                </label>

                <div className="row" style={{ justifyContent: "flex-start", gap: 10 }}>
                <button className="btn" onClick={save}>Išsaugoti</button>
                <button className="btn" onClick={cancelEdit} style={{ opacity: 0.85 }}>
                    Atšaukti
                </button>
                </div>
            </div>
            )}
        </div>
        </div>
    );
}