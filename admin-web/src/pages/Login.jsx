import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setErr("");
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email.trim(), password);
        }   catch (e2) {
            setErr(e2?.message ?? "Login failed");
        }   finally {
            setLoading(false);
        }
    };

    return (
        <div className="page">
            <div className="container" style={{ maxWidth: 420 }}>
                <form onSubmit={submit} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <h2 style={{ margin: 0 }}>CoachBooking Admin Panel</h2>
                    <p className="muted" style={{ marginTop: 6 }}>Prisijunk su admin paskyra</p>

                    <input
                        className="input"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                        className="input"
                        placeholder="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    {err ? <div className="err">{err}</div> : null}

                    <button className="btn" disabled={loading}>
                        {loading ? "Jungiu..." : "Prisijungti"}
                    </button>
                </form>
            </div>
        </div>
    );
}