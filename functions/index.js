const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/** Admin check per users/{uid}.role === "admin" */
async function assertAdmin(context) {
  if (!context.auth || !context.auth.uid) {
    throw new HttpsError("unauthenticated", "Reikia prisijungti.");
  }

  const uid = context.auth.uid;

  const uSnap = await db.collection("users").doc(uid).get();

  if (!uSnap.exists) {
    throw new HttpsError("permission-denied", "Naudotojas nerastas.");
  }

  const data = uSnap.data();
  const role = data && data.role ? data.role : null;

  if (role !== "admin") {
    throw new HttpsError("permission-denied", "Tik adminas gali atlikti veiksmą.");
  }
}

/** Firestore batch delete helper (paginacija po 400/500) */
async function deleteQueryInBatches(query, batchSize = 400) {
  while (true) {
    const snap = await query.limit(batchSize).get();
    if (snap.empty) return;

    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    // jei buvo mažiau nei batchSize – baigiam
    if (snap.size < batchSize) return;
  }
}

/**
 * createTrainer
 * data: {
 *   email, tempPassword,
 *   vardas, pavarde,
 *   gymId, kaina, specializacija, aprasymas, order, active
 * }
 */
exports.createTrainer = onCall(async (request) => {
  await assertAdmin(request);

  const data = request.data || {};
  const email = String(data.email || "").trim().toLowerCase();
  const tempPassword = String(data.tempPassword || "").trim();

  const vardas = String(data.vardas || "").trim();
  const pavarde = String(data.pavarde || "").trim();

  const gymId = String(data.gymId || "").trim();
  const specializacija = String(data.specializacija || "").trim();

  if (!email) throw new HttpsError("invalid-argument", "Trūksta email.");
  if (tempPassword.length < 6) throw new HttpsError("invalid-argument", "Laikinas slaptažodis min 6 simboliai.");
  if (!vardas || !pavarde) throw new HttpsError("invalid-argument", "Trūksta vardo/pavardės.");
  if (!gymId) throw new HttpsError("invalid-argument", "Trūksta gymId.");
  if (!specializacija) throw new HttpsError("invalid-argument", "Trūksta specializacijos.");

  const kaina = Number(data.kaina != null ? data.kaina : 45);
  const order = Number(data.order != null ? data.order : 1);
  const active = data.active === false ? false : true;
  const aprasymas = String(data.aprasymas || "").trim();

  // 1) sukurti Auth user
  let userRecord;
  try {
    userRecord = await admin.auth().createUser({
      email,
      password: tempPassword,
      displayName: `${vardas} ${pavarde}`,
      disabled: false,
    });
  } catch (e) {
    throw new HttpsError("already-exists", e?.message || "Nepavyko sukurti Auth user.");
  }

  const uid = userRecord.uid;
  const now = admin.firestore.FieldValue.serverTimestamp();

  // 2) sukurti users/{uid}
  await db.collection("users").doc(uid).set(
    {
      vardas,
      pavarde,
      email,
      role: "trainer",
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  // 3) sukurti trainers doc
  const trainerRef = await db.collection("trainers").add({
    userId: uid,
    gymId,
    kaina,
    specializacija,
    aprasymas,
    order,
    active,
    // display (kad nereiktų join’int)
    vardas,
    pavarde,
    email,
    createdAt: now,
    updatedAt: now,
  });

  await admin.auth().setCustomUserClaims(uid, { role: "trainer" });

  return { ok: true, uid, trainerId: trainerRef.id };
});

/**
 * deleteTrainerCompletely
 * data: { uid }
 */
exports.deleteTrainerCompletely = onCall(async (request) => {
  await assertAdmin(request);

  const uid = String(request.data?.uid || "").trim();
  if (!uid) throw new HttpsError("invalid-argument", "Trūksta uid.");

  // surandam trainer doc pagal userId
  const tSnap = await db.collection("trainers").where("userId", "==", uid).limit(1).get();
  if (tSnap.empty) throw new HttpsError("not-found", "Trenerio doc nerastas (trainers.userId).");

  const trainerDoc = tSnap.docs[0];
  const trainerId = trainerDoc.id;

  // 1) delete timeslots kur trainerId == trenerio docId
  await deleteQueryInBatches(db.collection("timeslots").where("trainerId", "==", trainerId));

  // 2) delete reservations kur trainerId == trenerio docId
  await deleteQueryInBatches(db.collection("reservations").where("trainerId", "==", trainerId));

  await deleteQueryInBatches(db.collection("reservations").where("trainerUserId", "==", uid));

  // 3) delete trainer doc
  await trainerDoc.ref.delete();

  // 4) delete users doc
  await db.collection("users").doc(uid).delete();

  // 5) delete auth user
  try {
    await admin.auth().deleteUser(uid);
  } catch (e) {
    console.log("deleteUser warning:", e?.message);
  }

  return { ok: true, uid, trainerId };
});