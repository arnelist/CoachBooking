import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";

const emptyCreate = {
  email: "",
  tempPassword: "",
  vardas: "",
  pavarde: "",
  gymId: "",
  kaina: 45,
  specializacija: "",
  aprasymas: "",
  order: 1,
  active: true,
};

export default function Trainers() {
  const [gyms, setGyms] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const [form, setForm] = useState(emptyCreate);

  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({
    gymId: "",
    kaina: 45,
    specializacija: "",
    aprasymas: "",
    order: 1,
    active: true,
  });
  const [savingEdit, setSavingEdit] = useState(false);

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
      },
      (e) => {
        console.log("TRAINERS SNAP ERROR:", e);
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

  const createTrainerFn = httpsCallable(functions, "createTrainer");

  const deleteTrainerFn = useMemo(
    () => httpsCallable(functions, "deleteTrainerCompletely"),
    []
  );

  const nextOrder = useMemo(() => {
    const max = trainers.reduce((acc, t) => Math.max(acc, Number(t.order) || 0), 0);
    return max + 1;
  }, [trainers]);

  useEffect(() => {
    setForm((f) => ({ ...f, order: f.order ? f.order : nextOrder }));
  }, [nextOrder]);

  const validateCreate = () => {
    if (!form.email.trim()) return "Trūksta email.";
    if ((form.tempPassword || "").trim().length < 6) return "Laikinas slaptažodis min 6 simboliai.";
    if (!form.vardas.trim()) return "Trūksta vardo.";
    if (!form.pavarde.trim()) return "Trūksta pavardės.";
    if (!form.gymId) return "Pasirink gym.";
    if (!form.specializacija.trim()) return "Trūksta specializacijos.";
    if (!Number(form.kaina) || Number(form.kaina) <= 0) return "Kaina turi būti > 0.";
    return "";
  };

  const onCreate = async (e) => {
    e.preventDefault();
    setCreateErr("");

    const v = validateCreate();
    if (v) {
      setCreateErr(v);
      return;
    }

    setCreating(true);
    try {
      const res = await createTrainerFn({
        email: form.email.trim().toLowerCase(),
        tempPassword: form.tempPassword.trim(),
        vardas: form.vardas.trim(),
        pavarde: form.pavarde.trim(),
        gymId: form.gymId,
        kaina: Number(form.kaina),
        specializacija: form.specializacija.trim(),
        aprasymas: form.aprasymas.trim(),
        order: Number(form.order) || nextOrder,
        active: !!form.active,
      });

      console.log("createTrainer result:", res.data);
      alert(`Treneris sukurtas ✅\nUID: ${res.data.uid}`);

      setForm({ ...emptyCreate, order: nextOrder });
    } catch (e2) {
      console.log("createTrainer error:", e2);
      setCreateErr(e2?.message || "Nepavyko sukurti trenerio.");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setEdit({
      gymId: t.gymId ?? "",
      kaina: Number(t.kaina) || 45,
      specializacija: t.specializacija ?? "",
      aprasymas: t.aprasymas ?? "",
      order: Number(t.order) || 1,
      active: t.active !== false,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEdit({ gymId: "", kaina: 45, specializacija: "", aprasymas: "", order: 1, active: true });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!edit.gymId) return alert("Pasirink gym.");
    if (!edit.specializacija.trim()) return alert("Įvesk specializaciją.");

    setSavingEdit(true);
    try {
      await updateDoc(doc(db, "trainers", editingId), {
        gymId: edit.gymId,
        kaina: Number(edit.kaina) || 45,
        specializacija: edit.specializacija.trim(),
        aprasymas: edit.aprasymas.trim(),
        order: Number(edit.order) || 1,
        active: !!edit.active,
      });
      cancelEdit();
    } catch (e) {
      console.log("saveEdit error:", e);
      alert("Nepavyko išsaugoti (rules/index).");
    } finally {
      setSavingEdit(false);
    }
  };

  const onDeleteCompletely = async (t) => {
    const uid = t.userId;
    if (!uid) return alert("Trūksta trainer.userId (uid).");

    const ok = confirm(
      `Tikrai ištrinti trenerį VISUR?\n\n${t.vardas || ""} ${t.pavarde || ""}\n${t.email || ""}\n\nBus ištrinta: Auth + users + trainers + timeslots + reservations.`
    );
    if (!ok) return;

    try {
      const res = await deleteTrainerFn({ uid });
      console.log("deleteTrainerCompletely result:", res.data);
      alert("Ištrinta ✅");
      if (editingId === t.id) cancelEdit();
    } catch (e) {
      console.log("deleteTrainerCompletely error:", e);
      alert(e?.message || "Nepavyko ištrinti.");
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
      {/* LIST */}
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Trainers</h3>
        </div>

        {loading ? (
          <div className="muted">Kraunama...</div>
        ) : trainers.length === 0 ? (
          <div className="muted">Nėra trenerių.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {trainers.map((t) => {
              const fullName =
                [t.vardas, t.pavarde].filter(Boolean).join(" ") || "(be vardo)";
              const gymName = t.gymId ? gymsById[t.gymId]?.pavadinimas : "";
              const active = t.active !== false;

              return (
                <div
                  key={t.id}
                  style={{
                    border: "1px solid #333",
                    borderRadius: 12,
                    padding: 12,
                    opacity: active ? 1 : 0.65,
                    background:
                      t.id === editingId ? "rgba(255,255,255,0.04)" : "transparent",
                  }}
                >
                  <div className="row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800 }}>
                        {fullName}{" "}
                        {!active ? <span className="muted">(inactive)</span> : null}
                      </div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {t.email || "—"} • {gymName || "Gym: —"} •{" "}
                        {t.kaina ? `${t.kaina}€` : "—"} • order: {t.order ?? "—"}
                      </div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {t.specializacija || "—"}
                      </div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        uid: {t.userId || "—"}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn" onClick={() => startEdit(t)}>
                        Edit
                      </button>
                      <button className="btn" onClick={() => onDeleteCompletely(t)}>
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

      {/* RIGHT: CREATE + EDIT */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* EDIT */}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Redaguoti trenerį</h3>

          {!editingId ? (
            <div className="muted">Pasirink trenerį iš sąrašo ir spausk Edit.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="muted">Gym</span>
                <select
                  className="input"
                  value={edit.gymId}
                  onChange={(e) => setEdit((f) => ({ ...f, gymId: e.target.value }))}
                >
                  <option value="">-- pasirink --</option>
                  {gyms.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.order}. {g.pavadinimas}
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: "flex", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <span className="muted">Kaina (€)</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={edit.kaina}
                    onChange={(e) => setEdit((f) => ({ ...f, kaina: e.target.value }))}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <span className="muted">Order</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={edit.order}
                    onChange={(e) => setEdit((f) => ({ ...f, order: e.target.value }))}
                  />
                </label>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="muted">Specializacija</span>
                <input
                  className="input"
                  value={edit.specializacija}
                  onChange={(e) => setEdit((f) => ({ ...f, specializacija: e.target.value }))}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="muted">Aprašymas</span>
                <input
                  className="input"
                  value={edit.aprasymas}
                  onChange={(e) => setEdit((f) => ({ ...f, aprasymas: e.target.value }))}
                />
              </label>

              <label className="row" style={{ justifyContent: "flex-start", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={!!edit.active}
                  onChange={(e) => setEdit((f) => ({ ...f, active: e.target.checked }))}
                />
                <span className="muted">Active</span>
              </label>

              <div className="row" style={{ justifyContent: "flex-start", gap: 10 }}>
                <button className="btn" onClick={saveEdit} disabled={savingEdit}>
                  {savingEdit ? "Saugoma..." : "Išsaugoti"}
                </button>
                <button className="btn" onClick={cancelEdit} style={{ opacity: 0.85 }}>
                  Atšaukti
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* CREATE */}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Sukurti trenerį (per Cloud)</h3>

          <form onSubmit={onCreate} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="muted">Email</span>
              <input
                className="input"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="trainer@trainer.com"
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="muted">Laikinas slaptažodis</span>
              <input
                className="input"
                value={form.tempPassword}
                onChange={(e) => setForm((f) => ({ ...f, tempPassword: e.target.value }))}
                placeholder="min 6 simboliai"
              />
            </label>

            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                <span className="muted">Vardas</span>
                <input
                  className="input"
                  value={form.vardas}
                  onChange={(e) => setForm((f) => ({ ...f, vardas: e.target.value }))}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                <span className="muted">Pavardė</span>
                <input
                  className="input"
                  value={form.pavarde}
                  onChange={(e) => setForm((f) => ({ ...f, pavarde: e.target.value }))}
                />
              </label>
            </div>

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

            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                <span className="muted">Kaina (€)</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={form.kaina}
                  onChange={(e) => setForm((f) => ({ ...f, kaina: e.target.value }))}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                <span className="muted">Order</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={form.order}
                  onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                />
              </label>
            </div>

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

            {createErr ? <div className="err">{createErr}</div> : null}

            <button className="btn" disabled={creating} type="submit">
              {creating ? "Kuriama..." : "Sukurti trenerį"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}