import {
  getFirestore,
  collection,
  collectionGroup,
  doc,
  setDoc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  orderBy,
} from "firebase/firestore";

import app from "./config";

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
 * authUid?: string
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

const getMonthId = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getDueDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-10`;
};

export const getCurrentMonthId = () => getMonthId();

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

  const newFee = {
    studentId: student.studentId,
    monthId,
    monthlyFee,
    dueDate: getDueDate(),
    paidAmount: 0,
    pendingAmount: monthlyFee,
    status: monthlyFee > 0 ? "pending" : "paid",
    paymentHistory: [],
    createdAt: new Date().toISOString(),
  };

  await setDoc(feeRef, newFee);

  return {
    id: monthId,
    ...newFee,
  };
};

/** @returns {Promise<Fee[]>} */
export const getAllFees = async () => {
  const snapshot = await getDocs(collectionGroup(db, "months"));

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
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
    status: newPendingAmount === 0 ? "paid" : "partial",
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
    status: pending === 0 ? "paid" : paid > 0 ? "partial" : "pending",
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
    status: pending === 0 ? "paid" : paid > 0 ? "partial" : "pending",
    ...(dueDate ? { dueDate } : {}),
    updatedAt: new Date().toISOString(),
  });

  await syncStudentFeeDue(studentId);
};

export default db;
