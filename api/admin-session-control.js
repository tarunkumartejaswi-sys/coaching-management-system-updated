import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
  if (json.trim()) {
    const serviceAccount = JSON.parse(json);
    if (serviceAccount.private_key) serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    return initializeApp({ credential: cert(serviceAccount) });
  }
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    throw new Error("Firebase Admin is not configured. Add Firebase Admin environment variables in Vercel.");
  }
  return initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey }) });
}

async function requireAdmin(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    const error = new Error("Missing admin authentication token."); error.statusCode = 401; throw error;
  }
  const app = getAdminApp();
  const adminAuth = getAuth(app);
  const firestore = getFirestore(app);
  const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
  const profile = await firestore.collection("users").doc(decoded.uid).get();
  if (!profile.exists || !["admin", "Admin", "ADMIN"].includes(profile.data()?.role)) {
    const error = new Error("Only an admin can remotely log out students."); error.statusCode = 403; throw error;
  }
  return { adminAuth, firestore };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { adminAuth, firestore } = await requireAdmin(req);
    const { action, studentAuthUid } = req.body || {};
    if (action !== "logoutAll" || !studentAuthUid) return res.status(400).json({ error: "logoutAll and studentAuthUid are required." });
    await adminAuth.revokeRefreshTokens(studentAuthUid);
    const now = new Date().toISOString();
    await firestore.collection("users").doc(studentAuthUid).set({ forceLogoutAt: now }, { merge: true });
    await firestore.collection("userSessions").doc(studentAuthUid).set({ active: false, forceLogoutAt: now, lastRemoteLogoutAt: now }, { merge: true });
    return res.status(200).json({ success: true, forceLogoutAt: now });
  } catch (error) {
    console.error("Admin session control error:", error);
    return res.status(error?.statusCode || 500).json({ error: error?.message || "Unable to control student session." });
  }
}
