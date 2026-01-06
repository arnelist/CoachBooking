import { useEffect, useMemo, useState } from "react";
import {
    collection,
    addDoc,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    updateDoc,
    serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const emptyForm = { pavadinimas: "", adresas: "", order: 1 };

export default function Gyms() {
    const [gyms, setGyms] = useState([]);
    const [loading, setLoading] = useState(true);

    const [mode, setMode] = useState("create"); // "create" | "edit"
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    useEffect(() => {
        const q = query(collection(db, "gyms"), orderBy("order", "asc"));
        const unsub = onSnapshot(
            q,
            (snap) => {
                const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                setGyms(rows);
                setLoading(false);
            },
            (e) => {
                console.log("gyms onSnapshot error:", e);
                setErr("Nepavyko užkrauti gyms (patikrink Firestore rules).");
                setLoading(false);
            }
        );

        return () => unsub();
    }, []);

    const nextOrder = useMemo(() => {
        if (!gyms.length) return 1;
        const max = gyms.reduce((m, g) => Math.max(m, Number(g.order) || 0), 0);
        return max + 1;
    }, [gyms]);

    useEffect(() => {
        if (mode === "create") {
            setForm((f) => ({ ...f, order: nextOrder }));
        }
    }, [mode, nextOrder]);

    const startCreate = () => {
        setMode("create");
        setEditingId(null);
        setErr("");
        setForm({ ...emptyForm, order: nextOrder });
    };

    const startEdit = (gym) => {
        setMode("edit");
        setEditingId(gym.id);
        setErr("");
        setForm({
            pavadinimas: gym.pavadinimas ?? "",
            adresas: gym.adresas ?? "",
            order: Number(gym.order) || 1,
        });
    };

    const validate = () => {
        if (!form.pavadinimas.trim()) return "Trūksta pavadinimo.";
        if (!form.adresas.trim()) return "Trūksta adreso.";
        const ord = Number(form.order);
        if (!Number.isFinite(ord) || ord < 1) return "Order tūri būti skaičius >= 1.";
        return "";
    };

    const onSave = async (e) => {
        e.preventDefault();
        const v = validate();
        if (v) {
            setErr(v);
            return;
        }

        setSaving(true);
        setErr("");

        try {
            const payload = {
                pavadinimas: form.pavadinimas.trim(),
                adresas: form.adresas.trim(),
                order: Number(form.order),
                updatedAt: serverTimestamp(),
            };

            if (mode === "create") {
                await addDoc(collection(db, "gyms"), {
                    ...payload,
                    createdAt: serverTimestamp(),
                });
                startCreate();
            }   
            else {
                await updateDoc(doc(db, "gyms", editingId), payload);
            }
        }
        catch (e2) {
            console.log("save gym error:", e2);
            setErr("Nepavyko išsaugoti. Patikrink Firestore rules.");
        }
        finally {
            setSaving(false);
        }
    };

    const onDelete = async (gym) => {
        const ok = confirm(`Ištrinti gym "${gym.pavadinimas}"?`);
        if (!ok) return;

        try {
            await deleteDoc(doc(db, "gyms", gym.id));
            if (editingId === gym.id) startCreate();
        }
        catch (e) {
            console.log("delete gym error:", e);
            alert("Nepavyko ištrinti (patikrink Firestore rules).");
        }
    };

    return (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
            {/* LEFT: LIST */}
            <div className="card">
                <div className="row" style={{ marginBottom: 10 }}>
                    <h3 style={{ margin: 0 }}>Gyms</h3>
                    <button className="btn" onClick={startCreate}>
                        + Naujas
                    </button>
                </div>

                {loading ? (
                    <div className="muted">Kraunama...</div>
                ) : gyms.length === 0 ? (
                    <div className="muted">Nėra gyms.</div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {gyms.map((g) => {
                            const active = g.id === editingId;
                            return (
                                <div
                                    key={g.id}
                                    style={{
                                        border: "1px solid #333",
                                        borderRadius: 12,
                                        padding: 12,
                                        background: active ? "rgba(255,255,255,0.04)" : "transparent",
                                    }}
                                >
                                    <div className="row">
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 800 }}>
                                                {g.order}. {g.pavadinimas}
                                            </div>
                                            <div className="muted" style={{ fontSize: 13 }}>
                                                {g.adresas}
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", gap: 8 }}>
                                            <button className="btn" onClick={() => startEdit(g)}>
                                                Edit
                                            </button>
                                            <button className="btn" onClick={() => onDelete(g)}>
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* RIGHT: FORM */}
            <div className="card">
                <h3 style={{ marginTop: 0 }}>
                    {mode === "create" ? "Sukurti gym" : "Redaguoti gym"}
                </h3>

                <form onSubmit={onSave} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span className="muted">Pavadinimas</span>
                        <input
                            className="input"
                            value={form.pavadinimas}
                            onChange={(e) => setForm((f) => ({ ...f, pavadinimas: e.target.value }))}
                        />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span className="muted">Adresas</span>
                        <input
                            className="input"
                            value={form.adresas}
                            onChange={(e) => setForm((f) => ({ ...f, adresas: e.target.value }))}
                        />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span className="muted">Order</span>
                        <input
                            className="input"
                            type="number"
                            min={1}
                            value={form.order}
                            onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                        />
                    </label>

                    {err ? <div className="err">{err}</div> : null}

                    <button className="btn" disabled={saving}>
                        {saving ? "Saugo..." : mode === "create" ? "Sukurti" : "Išsaugoti"}
                    </button>

                    {mode === "edit" ? (
                        <button
                            type="button"
                            className="btn"
                            onClick={startCreate}
                            disabled={saving}
                            style={{ opacity: 0.85 }}
                        >
                            Atšaukti
                        </button>
                    ) : null}
                </form>
            </div>
        </div>
    );
}