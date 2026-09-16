import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
  if (json.trim()) {
    try {
      const serviceAccount = JSON.parse(json);
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
      }
      return initializeApp({ credential: cert(serviceAccount) });
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON.");
    }
  }

  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    throw new Error(
      "Firebase Admin is not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in Vercel Environment Variables, then redeploy."
    );
  }

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

async function requireAdmin(req) {
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) {
    const error = new Error("Missing admin authentication token.");
    error.statusCode = 401;
    throw error;
  }

  const app = getAdminApp();
  const adminAuth = getAuth(app);
  const firestore = getFirestore(app);
  const decoded = await adminAuth.verifyIdToken(authorization.slice("Bearer ".length));
  const adminProfile = await firestore.collection("users").doc(decoded.uid).get();

  if (!adminProfile.exists || adminProfile.data()?.role !== "admin") {
    const error = new Error("Only an admin can manage student accounts.");
    error.statusCode = 403;
    throw error;
  }

  return { adminAuth, firestore };
}

async function deleteCollectionDocs(firestore, collectionRef) {
  const snap = await collectionRef.get();
  for (const document of snap.docs) {
    await document.ref.delete();
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { adminAuth, firestore } = await requireAdmin(req);
    const body = req.body || {};
    const action = body.action || (req.method === "DELETE" ? "delete" : "update");
    const studentAuthUid = body.studentAuthUid;
    const studentId = body.studentId;

    if (!studentAuthUid && !studentId) {
      return res.status(400).json({ error: "Student Auth UID or Student ID is required." });
    }

    let authUid = studentAuthUid;
    let studentRef = studentId ? firestore.collection("students").doc(studentId) : null;
    let studentSnap = studentRef ? await studentRef.get() : null;

    if (!authUid && studentSnap?.exists) {
      authUid = studentSnap.data()?.authUid;
    }

    if (action === "delete") {
      // Resolve the student document even when only the Auth UID was supplied.
      if (!studentRef && authUid) {
        const snap = await firestore.collection("students").where("authUid", "==", authUid).limit(1).get();
        if (!snap.empty) {
          studentRef = snap.docs[0].ref;
          studentSnap = snap.docs[0];
        }
      }

      if (!studentRef || !studentSnap?.exists) {
        return res.status(404).json({ error: "Student record not found." });
      }

      const data = studentSnap.data();
      const resolvedStudentId = studentSnap.id;
      const resolvedAuthUid = authUid || data?.authUid;

      // Remove monthly fee subcollection first.
      await deleteCollectionDocs(
        firestore,
        firestore.collection("fees").doc(resolvedStudentId).collection("months")
      );
      await firestore.collection("fees").doc(resolvedStudentId).delete().catch(() => {});

      // Remove the student from shared academic records so deleted students
      // do not remain in rankings, attendance or homework lists.
      const [testsSnap, attendanceSnap, homeworkSnap] = await Promise.all([
        firestore.collection("tests").get(),
        firestore.collection("attendance").get(),
        firestore.collection("homework").get(),
      ]);

      await Promise.all(testsSnap.docs.map(async (testDoc) => {
        const results = { ...(testDoc.data()?.results || {}) };
        if (Object.prototype.hasOwnProperty.call(results, resolvedStudentId)) {
          delete results[resolvedStudentId];
          await testDoc.ref.update({ results });
        }
      }));

      await Promise.all(attendanceSnap.docs.map(async (attendanceDoc) => {
        const records = { ...(attendanceDoc.data()?.records || {}) };
        if (Object.prototype.hasOwnProperty.call(records, resolvedStudentId)) {
          delete records[resolvedStudentId];
          await attendanceDoc.ref.update({ records });
        }
      }));

      await Promise.all(homeworkSnap.docs.map(async (homeworkDoc) => {
        const data = homeworkDoc.data() || {};
        const assigned = Array.isArray(data.assignedStudentIds) ? data.assignedStudentIds : [];
        const completion = { ...(data.completion || {}) };
        const nextAssigned = assigned.filter((id) => id !== resolvedStudentId);
        const hadCompletion = Object.prototype.hasOwnProperty.call(completion, resolvedStudentId);
        if (nextAssigned.length !== assigned.length || hadCompletion) {
          delete completion[resolvedStudentId];
          await homeworkDoc.ref.update({ assignedStudentIds: nextAssigned, completion });
        }
      }));

      // Remove the student record and directory profile.
      await studentRef.delete();
      await firestore.collection("studentDirectory").doc(resolvedStudentId).delete().catch(() => {});

      // Remove the Firebase Authentication account and user profile.
      if (resolvedAuthUid) {
        await firestore.collection("users").doc(resolvedAuthUid).delete().catch(() => {});
        try {
          await adminAuth.deleteUser(resolvedAuthUid);
        } catch (error) {
          // A missing Auth account should not leave the Firestore record behind.
          if (error?.code !== "auth/user-not-found") throw error;
        }
      }

      return res.status(200).json({
        success: true,
        deleted: true,
        studentId: resolvedStudentId,
        authUid: resolvedAuthUid || null,
      });
    }

    // UPDATE LOGIN CREDENTIALS
    if (!authUid) {
      return res.status(400).json({ error: "Student Auth UID is required to change login credentials." });
    }

    const { password, email } = body;
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

    const updatedUser = await adminAuth.updateUser(authUid, updates);

    const studentSnapByAuth = await firestore.collection("students")
      .where("authUid", "==", authUid)
      .limit(1)
      .get();

    if (!studentSnapByAuth.empty && updates.email) {
      await studentSnapByAuth.docs[0].ref.update({ email: updatedUser.email });
    }

    await firestore.collection("users").doc(authUid).set(
      { email: updatedUser.email },
      { merge: true }
    );

    return res.status(200).json({
      success: true,
      uid: updatedUser.uid,
      email: updatedUser.email,
      passwordChanged: Boolean(updates.password),
      emailChanged: Boolean(updates.email),
    });
  } catch (error) {
    console.error("Admin student account error:", error);
    return res.status(error?.statusCode || 500).json({
      error: error?.message || "Unable to manage student account.",
      code: error?.code || "unknown-error",
    });
  }
}
