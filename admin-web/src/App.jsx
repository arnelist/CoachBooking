import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import Login from "./pages/Login";
import Gyms from "./pages/Gyms";
import Trainers from "./pages/Trainers";

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState("gyms");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setChecking(true);

      if (!u) {
        setUser(null);
        setIsAdmin(false);
        setChecking(false);
        return;
      }

      const adminRef = doc(db, "admins", u.uid);
      const snap = await getDoc(adminRef);
      const ok = snap.exists() && snap.data()?.enabled === true;

      if (!ok) {
        await signOut(auth);
        alert("Neturi admin teisių.");
        setUser(null);
        setIsAdmin(false);
      } else {
        setUser(u);
        setIsAdmin(true);
      }

        setChecking(false);
    });

    return () => unsub();
  }, []);

  if (checking) return <div style={{ padding: 16 }}>Loading...</div>;

  if (!user || !isAdmin) return <Login />;

  return (
    <div className="page">
      <div className="container">
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Admin Dashboard</h2>

          <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
            <span className="muted">{user.email}</span>
            <button className="btn" onClick={() => signOut(auth)}>Logout</button>
          </div>
        </div>

        {/* Tabs */}
        <div 
          className="row" 
          style={{ 
            justifyContent: "flex-start",
            gap: 10, 
            marginBottom: 12,
            flexWrap: "wrap", 
          }}
        >
          <button
            className="btn"
            onClick={() => setTab("gyms")}
            style={{ 
              opacity: tab === "gyms" ? 1 : 0.7,
              borderColor: tab === "gyms" ? "#555" : "#333", 
            }}
          >
            Gyms
          </button>

          <button
            className="btn"
            onClick={() => setTab("trainers")}
            style={{ 
              opacity: tab === "trainers" ? 1 : 0.7,
              borderColor: tab === "gyms" ? "#555" : "#333", 
            }}
          >
            Trainers
          </button>
        </div>

        {/* Page */}
        {tab === "gyms" ? <Gyms /> : <Trainers />}
      </div>
    </div>
  );
}