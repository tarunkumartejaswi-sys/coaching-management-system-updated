import {
  getFirestore,
  collection,
  collectionGroup,
  doc,
  setDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
} from "firebase/firestore";

import app from "./config";
import { buildMonthlyFeeRecord, getBillingMonthId, getFeeDueDate, getMonthlyFeeStatus } from "../src/feeLogic.js";
import { calculateFeeAfterPaymentDelete } from "../src/sessionLogic.js";

// Firebase docs recommend getFirestore(app) for the default client database.
// The app is initialized once in ./config before this module requests Firestore.
const db = getFirestore(app);

/** @typedef {{
 * id?: string,
 * studentId?: string,
 * name?: string,
 * className?: string,
 * batch?: string,
 * email?: string,
 * attendance?: number,
 * average?: number,
 * monthlyFee?: number,
 * feeDue?: number,
 * authUid?: string,
 * isCR?: boolean,
 * crSince?: string,
 * crEligible?: boolean
 * }} Student
 */

/** @typedef {{
 * amount: number,
 * date: string,
 * method?: string,
 * note?: string
 * }} Payment
 */

/** @typedef {{
 * id?: string,
 * studentId?: string,
 * monthId?: string,
 * monthlyFee?: number,
 * dueDate?: string,
 * paidAmount?: number,
 * pendingAmount?: number,
 * status?: ('pending'|'partial'|'paid'),
 * paymentHistory?: Payment[]
 * }} Fee
 */


/* =========================================
   STUDENTS
========================================= */

/** @param {Student} student */
export const addStudent = async (student) => {
  await setDoc(doc(db, "students", student.studentId), student);
};

/** @returns {Promise<Student[]>} */
export const getStudents = async () => {
  const snapshot = await getDocs(collection(db, "students"));
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
};

/** @returns {Promise<Student|null>} */
export const getStudentById = async (studentId) => {
  if (!studentId) return null;

  const studentSnap = await getDoc(doc(db, "students", studentId));

  if (!studentSnap.exists()) return null;

  return {
    id: studentSnap.id,
    ...studentSnap.data(),
  };
};

/* =========================================
   FEES

   fees/{studentId}/months/{YYYY-MM}
========================================= */

const getMonthId = (date = new Date()) => getBillingMonthId(date);

const getDueDate = (date = new Date()) => getFeeDueDate(date);

export const getCurrentMonthId = () => getBillingMonthId();

/** @returns {Promise<Fee|null>} */
export const getCurrentMonthFee = async (studentId) => {
  if (!studentId) return null;

  const monthId = getMonthId();
  const feeSnap = await getDoc(
    doc(db, "fees", studentId, "months", monthId)
  );

  if (!feeSnap.exists()) return null;

  return {
    id: feeSnap.id,
    ...feeSnap.data(),
  };
};

/** @returns {Promise<Fee[]>} */
export const getStudentFeeHistory = async (studentId) => {
  if (!studentId) return [];

  const snapshot = await getDocs(
    query(
      collection(db, "fees", studentId, "months"),
      orderBy("monthId", "desc")
    )
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
};

/** @returns {Promise<Fee|null>} */
export const getFeeByStudentId = async (studentId) => {
  const history = await getStudentFeeHistory(studentId);
  return history[0] || null;
};

/** @param {Student} student @returns {Promise<Fee|null>} */
export const ensureCurrentMonthFee = async (student) => {
  if (!student?.studentId) return null;

  const monthId = getMonthId();
  const feeRef = doc(db, "fees", student.studentId, "months", monthId);
  const existing = await getDoc(feeRef);

  if (existing.exists()) {
    return {
      id: existing.id,
      ...existing.data(),
    };
  }

  const monthlyFee = Number(
    student.monthlyFee ?? student.feeDue ?? 0
  );

  // Billing is month-based: when the calendar month changes, a fresh fee
  // document is created for the new month. The previous month's payments
  // remain untouched. This makes the renewal deterministic even if the admin
  // opens the portal a few days after the 1st.
  const newFee = buildMonthlyFeeRecord({
    studentId: student.studentId,
    monthlyFee,
  });

  await setDoc(feeRef, newFee);

  return {
    id: monthId,
    ...newFee,
  };
};

/** @returns {Promise<Fee[]>} */
export const ensureCurrentMonthFeesForStudents = async (students = []) => {
  const validStudents = students.filter((student) => student?.studentId);
  let created = 0;

  for (const student of validStudents) {
    const before = await getDoc(doc(db, "fees", student.studentId, "months", getBillingMonthId()));
    if (!before.exists()) created += 1;
    await ensureCurrentMonthFee(student);
    await syncStudentFeeDue(student.studentId);
  }

  return created;
};

export const getAllFees = async () => {
  // Read each student's month subcollection explicitly. This is more
  // reliable with Firestore security rules than a collectionGroup query.
  const studentsSnapshot = await getDocs(collection(db, "students"));
  const groups = await Promise.all(
    studentsSnapshot.docs.map(async (studentDoc) => {
      const monthSnapshot = await getDocs(
        query(
          collection(db, "fees", studentDoc.id, "months"),
          orderBy("monthId", "desc")
        )
      );
      return monthSnapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));
    })
  );
  return groups.flat();
};

export const recordFeePayment = async (
  studentId,
  monthId,
  amount,
  paymentMethod = "Cash",
  note = ""
) => {
  if (!studentId || !monthId) {
    throw new Error("Student ID and month are required");
  }

  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Payment amount must be greater than 0");
  }

  const feeRef = doc(
    db,
    "fees",
    studentId,
    "months",
    monthId
  );

  const feeSnap = await getDoc(feeRef);

  if (!feeSnap.exists()) {
    throw new Error("Fee record not found");
  }

  const fee = feeSnap.data();
  const currentPaid = Number(fee.paidAmount || 0);
  const monthlyFee = Number(fee.monthlyFee || 0);
  const currentPending = Math.max(
    monthlyFee - currentPaid,
    0
  );

  if (numericAmount > currentPending) {
    throw new Error(
      `Payment cannot exceed remaining amount ₹${currentPending}`
    );
  }

  const newPaidAmount = currentPaid + numericAmount;
  const newPendingAmount = Math.max(
    monthlyFee - newPaidAmount,
    0
  );

  const payment = {
    amount: numericAmount,
    date: new Date().toISOString(),
    method: paymentMethod,
    note,
  };

  const history = Array.isArray(fee.paymentHistory)
    ? fee.paymentHistory
    : [];

  await updateDoc(feeRef, {
    paidAmount: newPaidAmount,
    pendingAmount: newPendingAmount,
    status: getMonthlyFeeStatus(monthlyFee, newPendingAmount, newPaidAmount),
    paymentHistory: [...history, payment],
    updatedAt: new Date().toISOString(),
  });
};

export const syncStudentFeeDue = async (studentId) => {
  const history = await getStudentFeeHistory(studentId);

  const totalPending = history.reduce(
    (sum, fee) => sum + Number(fee.pendingAmount || 0),
    0
  );

  await updateDoc(doc(db, "students", studentId), {
    feeDue: totalPending,
  });

  return totalPending;
};

export const deleteFeePayment = async (studentId, monthId, paymentIndex) => {
  if (!studentId || !monthId) throw new Error("Student ID and month are required");
  const feeRef = doc(db, "fees", studentId, "months", monthId);
  const snap = await getDoc(feeRef);
  if (!snap.exists()) throw new Error("Fee record not found");
  const updated = calculateFeeAfterPaymentDelete(snap.data(), Number(paymentIndex));
  await updateDoc(feeRef, {
    paymentHistory: updated.paymentHistory,
    paidAmount: updated.paidAmount,
    pendingAmount: updated.pendingAmount,
    status: updated.status,
    updatedAt: new Date().toISOString(),
  });
  await syncStudentFeeDue(studentId);
  return updated;
};

export const deleteFeeMonth = async (studentId, monthId) => {
  if (!studentId || !monthId) throw new Error("Student ID and month are required");
  await deleteDoc(doc(db, "fees", studentId, "months", monthId));
  await syncStudentFeeDue(studentId);
};

export const saveStudentFee = async (studentId, feeData) => {
  if (!studentId || !feeData?.monthId) {
    throw new Error("Student ID and month are required");
  }

  await setDoc(
    doc(db, "fees", studentId, "months", feeData.monthId),
    {
      ...feeData,
      studentId,
    },
    { merge: true }
  );
};

/* Backward-compatible helper */
export const markFeeAsPaid = async (studentId, paidAmount) => {
  const fee = await getCurrentMonthFee(studentId);
  if (!fee) throw new Error("Current month fee not found");

  await recordFeePayment(
    studentId,
    fee.monthId,
    paidAmount,
    "Cash"
  );

  return syncStudentFeeDue(studentId);
};


/** Create a fee record for a specific month. */
export const createFeeMonth = async (studentId, monthId, monthlyFee, paidAmount = 0, dueDate = "", note = "") => {
  if (!studentId || !monthId) throw new Error("Student ID and month are required");
  const feeRef = doc(db, "fees", studentId, "months", monthId);
  const existing = await getDoc(feeRef);
  if (existing.exists()) throw new Error(`Fee for ${monthId} already exists. Use Edit instead.`);

  const monthly = Math.max(Number(monthlyFee) || 0, 0);
  const paid = Math.min(Math.max(Number(paidAmount) || 0, 0), monthly);
  const pending = Math.max(monthly - paid, 0);

  await setDoc(feeRef, {
    studentId,
    monthId,
    monthlyFee: monthly,
    dueDate: dueDate || `${monthId}-10`,
    paidAmount: paid,
    pendingAmount: pending,
    status: getMonthlyFeeStatus(monthly, pending, paid),
    paymentHistory: [],
    note,
    createdAt: new Date().toISOString(),
  });

  await syncStudentFeeDue(studentId);
  return { id: monthId, studentId, monthId, monthlyFee: monthly, paidAmount: paid, pendingAmount: pending };
};

/** Edit a monthly fee record while preserving its payment history and paid amount. */
export const updateFeeMonth = async (studentId, monthId, monthlyFee, dueDate = "") => {
  if (!studentId || !monthId) throw new Error("Student ID and month are required");
  const feeRef = doc(db, "fees", studentId, "months", monthId);
  const snap = await getDoc(feeRef);
  if (!snap.exists()) throw new Error("Fee record not found");

  const fee = snap.data();
  const monthly = Math.max(Number(monthlyFee) || 0, 0);
  const paid = Math.max(Number(fee.paidAmount) || 0, 0);
  const pending = Math.max(monthly - paid, 0);

  await updateDoc(feeRef, {
    monthlyFee: monthly,
    pendingAmount: pending,
    status: getMonthlyFeeStatus(monthly, pending, paid),
    ...(dueDate ? { dueDate } : {}),
    updatedAt: new Date().toISOString(),
  });

  await syncStudentFeeDue(studentId);
};

export const recordLoginHistory = async (entry) => {
  const ref = doc(collection(db, "loginHistory"));
  await setDoc(ref, { ...entry, createdAt: new Date().toISOString() });
  return ref.id;
};

export const createUserSession = async (uid, data = {}) => {
  if (!uid) return;
  await setDoc(doc(db, "userSessions", uid), {
    uid,
    ...data,
    lastSeenAt: new Date().toISOString(),
    active: true,
  }, { merge: true });
};

export const touchUserSession = async (uid) => {
  if (!uid) return;
  await updateDoc(doc(db, "userSessions", uid), { lastSeenAt: new Date().toISOString(), active: true });
};

export const getLoginHistory = async () => {
  const snapshot = await getDocs(query(collection(db, "loginHistory"), orderBy("loginAt", "desc")));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
};

export const getUserSessions = async () => {
  const snapshot = await getDocs(collection(db, "userSessions"));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
};

export const getUserSession = async (uid) => {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "userSessions", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export default db;


/* =========================================
   HOMEWORK
========================================= */

export const getHomework = async () => {
  const snapshot = await getDocs(
    query(collection(db, "homework"), orderBy("homeworkDate", "desc"))
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
};

export const addHomework = async (homework) => {
  const ref = doc(collection(db, "homework"));
  await setDoc(ref, {
    ...homework,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
};

export const updateHomework = async (homeworkId, homework) => {
  if (!homeworkId) throw new Error("Homework ID is required");
  await updateDoc(doc(db, "homework", homeworkId), {
    ...homework,
    updatedAt: new Date().toISOString(),
  });
};

export const deleteHomework = async (homeworkId) => {
  if (!homeworkId) throw new Error("Homework ID is required");
  await deleteDoc(doc(db, "homework", homeworkId));
};

/* =========================================
   CR CHANGE REQUESTS
========================================= */

export const getCrChangeRequests = async (submittedBy = "") => {
  const base = collection(db, "crChangeRequests");
  const requestQuery = submittedBy
    ? query(base, where("submittedBy", "==", submittedBy))
    : query(base, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(requestQuery);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
};

export const createCrChangeRequest = async (request) => {
  const ref = doc(collection(db, "crChangeRequests"));
  await setDoc(ref, {
    ...request,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  return ref.id;
};

export const updateCrChangeRequest = async (requestId, patch) => {
  if (!requestId) throw new Error("Request ID is required");
  await updateDoc(doc(db, "crChangeRequests", requestId), {
    ...patch,
    reviewedAt: new Date().toISOString(),
  });
};
