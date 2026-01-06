import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../services/firebase";

export function useMyProfile() {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }

    const ref = doc(db, "users", u.uid);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoadingProfile(false);
      },
      (e) => {
        console.log("useMyProfile error:", e);
        setProfile(null);
        setLoadingProfile(false);
      }
    );

    return () => unsub();
  }, []);

  return { profile, loadingProfile };
}