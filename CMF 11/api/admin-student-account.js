import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    throw new Error("Firebase Admin environment variables are not configured.");
  }

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authorization = req.headers.authorization || "";
    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing admin authentication token." });
    }

    const idToken = authorization.slice("Bearer ".length);
    const app = getAdminApp();
    const adminAuth = getAuth(app);
    const firestore = getFirestore(app);
    const decoded = await adminAuth.verifyIdToken(idToken);

    const adminProfile = await firestore.collection("users").doc(decoded.uid).get();
    if (!adminProfile.exists || adminProfile.data()?.role !== "admin") {
      return res.status(403).json({ error: "Only an admin can change student login credentials." });
    }

    const { studentAuthUid, password, email } = req.body || {};
    if (!studentAuthUid) {
      return res.status(400).json({ error: "Student Auth UID is required." });
    }

    const studentAuth = await adminAuth.getUser(studentAuthUid);
    const updates = {};

    if (password !== undefined) {
      if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ error: "Password must contain at least 6 characters." });
      }
      updates.password = password;
    }

    if (email !== undefined) {
      if (typeof email !== "string" || !email.trim()) {
        return res.status(400).json({ error: "Login email is required." });
      }
      updates.email = email.trim().toLowerCase();
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "No credential changes were provided." });
    }

    const updatedUser = await adminAuth.updateUser(studentAuthUid, updates);

    const studentSnap = await firestore.collection("students")
      .where("authUid", "==", studentAuthUid)
      .limit(1)
      .get();

    if (!studentSnap.empty && updates.email) {
      const studentRef = studentSnap.docs[0].ref;
      await studentRef.update({ email: updatedUser.email });

      const studentId = studentSnap.docs[0].id;
      await firestore.collection("users").doc(studentAuthUid).set(
        { email: updatedUser.email },
        { merge: true }
      );
    } else if (updates.email) {
      await firestore.collection("users").doc(studentAuthUid).set(
        { email: updatedUser.email },
        { merge: true }
      );
    }

    return res.status(200).json({
      success: true,
      uid: updatedUser.uid,
      email: updatedUser.email,
      passwordChanged: Boolean(updates.password),
      emailChanged: Boolean(updates.email),
    });
  } catch (error) {
    console.error("Admin student account error:", error);
    return res.status(500).json({
      error: error?.message || "Unable to change student login credentials.",
      code: error?.code || "unknown-error",
    });
  }
}
