import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, updateDoc } from "firebase/firestore";

import auth, {
  loginUser,
  logoutUser,
  createStudentAccount,
  sendStudentPasswordReset,
} from "../firebase/auth";

import db, {
  addStudent,
  getStudents,
  getStudentById,
  getAllFees,
  getFeeByStudentId,
  getCurrentMonthFee,
  getStudentFeeHistory,
  ensureCurrentMonthFee,
  recordFeePayment,
  syncStudentFeeDue,
  createFeeMonth,
  updateFeeMonth,
} from "../firebase/firestore";

import { getUserProfile } from "../firebase/user";

/* =========================================================
   TYPES
========================================================= */

type UserProfile = {
  id?: string;
  name?: string;
  role?: string;
  studentId?: string;
  email?: string;
};

type Student = {
  id?: string;
  studentId?: string;
  name?: string;
  className?: string;
  batch?: string;
  email?: string;
  attendance?: number;
  average?: number;
  monthlyFee?: number;
  feeDue?: number;
  authUid?: string;
};

type Payment = {
  amount: number;
  date: string;
  method?: string;
  note?: string;
};

type Fee = {
  id?: string;
  studentId?: string;
  monthId?: string;
  monthlyFee?: number;
  dueDate?: string;
  paidAmount?: number;
  pendingAmount?: number;
  status?: "pending" | "partial" | "paid";
  paymentHistory?: Payment[];
};

/* =========================================================
   APP
========================================================= */

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const isAdmin = profile?.role === "admin";

  const [studentData, setStudentData] = useState<Student | null>(null);

  const [students, setStudents] = useState<Student[]>([]);

  const [fees, setFees] = useState<Fee[]>([]);
  const [studentFee, setStudentFee] = useState<Fee | null>(null);
  const [studentFeeHistory, setStudentFeeHistory] = useState<Fee[]>([]);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeMessage, setFeeMessage] = useState("");

  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState("dashboard");

  /* =========================================================
     LOGIN
  ========================================================= */

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [loginError, setLoginError] = useState("");

  /* =========================================================
     MONTHLY FEE SYSTEM
  ========================================================= */

  const [showPayment, setShowPayment] = useState(false);
  const [paymentStudent, setPaymentStudent] = useState<Student | null>(null);
  const [paymentFee, setPaymentFee] = useState<Fee | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentNote, setPaymentNote] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [selectedFeeStudent, setSelectedFeeStudent] = useState<Student | null>(
    null
  );
  const [selectedFeeHistory, setSelectedFeeHistory] = useState<Fee[]>([]);

  /* =========================================================
     EDIT MONTHLY FEE FROM FEES PAGE
  ========================================================= */

  const [showEditFee, setShowEditFee] = useState(false);
  const [editFeeStudent, setEditFeeStudent] = useState<Student | null>(null);
  const [editMonthlyFee, setEditMonthlyFee] = useState("0");
  const [savingFeeEdit, setSavingFeeEdit] = useState(false);

  /* =========================================================
     ADD / EDIT PREVIOUS MONTH FEES
  ========================================================= */

  const [showAddFeeMonth, setShowAddFeeMonth] = useState(false);
  const [addFeeStudent, setAddFeeStudent] = useState<Student | null>(null);
  const [addFeeMonth, setAddFeeMonth] = useState("");
  const [addFeeAmount, setAddFeeAmount] = useState("0");
  const [addFeeDueDate, setAddFeeDueDate] = useState("");
  const [addFeeNote, setAddFeeNote] = useState("");
  const [savingAddFee, setSavingAddFee] = useState(false);

  const [showEditHistoryFee, setShowEditHistoryFee] = useState(false);
  const [editHistoryFeeStudent, setEditHistoryFeeStudent] = useState<Student | null>(null);
  const [editHistoryFee, setEditHistoryFee] = useState<Fee | null>(null);
  const [editHistoryAmount, setEditHistoryAmount] = useState("0");
  const [editHistoryDueDate, setEditHistoryDueDate] = useState("");
  const [savingHistoryEdit, setSavingHistoryEdit] = useState(false);

  const loadFees = async () => {
    if (!isAdmin) return;

    setFeeLoading(true);
    setFeeMessage("");

    try {
      for (const student of students) {
        await ensureCurrentMonthFee(student);
        await syncStudentFeeDue(student.studentId!);
      }

      const allFees = await getAllFees();
      setFees(allFees);

      const updatedStudents = await getStudents();
      setStudents(updatedStudents);
    } catch (error: any) {
      console.error("Fee loading error:", error);
      setFeeMessage(
        `Firebase Error: ${error?.code || "unknown-error"} | ${
          error?.message || "Unable to load fees"
        }`
      );
    } finally {
      setFeeLoading(false);
    }
  };

  const openPayment = async (student: Student) => {
    if (!student.studentId) return;

    try {
      await ensureCurrentMonthFee(student);
      const fee = await getCurrentMonthFee(student.studentId);
      setPaymentStudent(student);
      setPaymentFee(fee);
      setPaymentAmount(String(fee?.pendingAmount || 0));
      setPaymentMethod("Cash");
      setPaymentNote("");
      setShowPayment(true);
    } catch (error: any) {
      setFeeMessage(
        `Firebase Error: ${error?.code || "unknown-error"} | ${
          error?.message || "Unable to open payment"
        }`
      );
    }
  };

  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!paymentStudent?.studentId || !paymentFee?.monthId) return;

    const amount = Number(paymentAmount);
    const remaining = Number(paymentFee.pendingAmount || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      setFeeMessage("Enter a valid payment amount.");
      return;
    }

    if (amount > remaining) {
      setFeeMessage(`Payment cannot exceed remaining amount ₹${remaining}.`);
      return;
    }

    setSavingPayment(true);
    setFeeMessage("");

    try {
      await recordFeePayment(
        paymentStudent.studentId,
        paymentFee.monthId,
        amount,
        paymentMethod,
        paymentNote
      );

      await syncStudentFeeDue(paymentStudent.studentId);

      const allFees = await getAllFees();
      setFees(allFees);

      const updatedStudents = await getStudents();
      setStudents(updatedStudents);

      setShowPayment(false);
      setPaymentStudent(null);
      setPaymentFee(null);
      setFeeMessage("Payment recorded successfully! ✅");
    } catch (error: any) {
      console.error("Payment error:", error);
      setFeeMessage(
        `Firebase Error: ${error?.code || "unknown-error"} | ${
          error?.message || "Unable to record payment"
        }`
      );
    } finally {
      setSavingPayment(false);
    }
  };

  const openFeeHistory = async (student: Student) => {
    if (!student.studentId) return;

    try {
      const history = await getStudentFeeHistory(student.studentId);
      setSelectedFeeStudent(student);
      setSelectedFeeHistory(history);
    } catch (error: any) {
      setFeeMessage(
        `Firebase Error: ${error?.code || "unknown-error"} | ${
          error?.message || "Unable to load fee history"
        }`
      );
    }
  };

  const openEditMonthlyFee = (student: Student) => {
    if (!isAdmin) return;
    setEditFeeStudent(student);
    setEditMonthlyFee(String(student.monthlyFee ?? student.feeDue ?? 0));
    setFeeMessage("");
    setShowEditFee(true);
  };

  const saveMonthlyFeeEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setFeeMessage("Only the admin can edit monthly fees.");
      return;
    }

    if (!editFeeStudent?.studentId) {
      return;
    }

    const newMonthlyFee = Number(editMonthlyFee);

    if (!Number.isFinite(newMonthlyFee) || newMonthlyFee < 0) {
      setFeeMessage("Enter a valid monthly fee.");
      return;
    }

    setSavingFeeEdit(true);
    setFeeMessage("");

    try {
      /* Update the student's normal monthly fee. */
      await updateDoc(doc(db, "students", editFeeStudent.studentId), {
        monthlyFee: newMonthlyFee,
      });

      /*
        If the current month already exists, update only the
        current month's charge. Previous months are untouched.
        Any amount already paid remains preserved.
      */
      const currentFee = await getCurrentMonthFee(editFeeStudent.studentId);

      if (currentFee?.monthId) {
        const paid = Number(currentFee.paidAmount || 0);
        const pending = Math.max(newMonthlyFee - paid, 0);

        await setDoc(
          doc(
            db,
            "fees",
            editFeeStudent.studentId,
            "months",
            currentFee.monthId
          ),
          {
            monthlyFee: newMonthlyFee,
            pendingAmount: pending,
            status: pending === 0 ? "paid" : paid > 0 ? "partial" : "pending",
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      await syncStudentFeeDue(editFeeStudent.studentId);

      const updatedStudents = await getStudents();
      setStudents(updatedStudents);

      const allFees = await getAllFees();
      setFees(allFees);

      setShowEditFee(false);
      setEditFeeStudent(null);
      setFeeMessage(
        "Monthly fee updated successfully! Previous months were kept unchanged. ✅"
      );
    } catch (error: any) {
      console.error("Monthly fee update error:", error);
      setFeeMessage(
        `Firebase Error: ${error?.code || "unknown-error"} | ${
          error?.message || "Unable to update monthly fee"
        }`
      );
    } finally {
      setSavingFeeEdit(false);
    }
  };

  useEffect(() => {
    if (page === "fees" && isAdmin && students.length > 0) {
      loadFees();
    }
  }, [page, isAdmin, students.length]);

  /* =========================================================
     ADD STUDENT
  ========================================================= */

  const [showAddStudent, setShowAddStudent] = useState(false);

  const [studentId, setStudentId] = useState("");

  const [studentName, setStudentName] = useState("");

  const [className, setClassName] = useState("");

  const [batch, setBatch] = useState("");

  const [studentEmail, setStudentEmail] = useState("");

  const [studentPassword, setStudentPassword] = useState("");

  const [attendance, setAttendance] = useState("0");

  const [average, setAverage] = useState("0");

  const [monthlyFee, setMonthlyFee] = useState("0");

  const [feeDue, setFeeDue] = useState("0");

  const [savingStudent, setSavingStudent] = useState(false);

  const [studentMessage, setStudentMessage] = useState("");

  /* =========================================================
     EDIT STUDENT
  ========================================================= */

  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const [editName, setEditName] = useState("");

  const [editClassName, setEditClassName] = useState("");

  const [editBatch, setEditBatch] = useState("");

  const [editAttendance, setEditAttendance] = useState("0");

  const [editAverage, setEditAverage] = useState("0");

  const [editStudentMonthlyFee, setEditStudentMonthlyFee] = useState("0");

  const [editFeeDue, setEditFeeDue] = useState("0");

  const [savingEdit, setSavingEdit] = useState(false);

  const [editMessage, setEditMessage] = useState("");

  /* =========================================================
     AUTH LISTENER
  ========================================================= */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setProfile(null);
        setStudentData(null);
        setStudentFee(null);
        setStudentFeeHistory([]);
        setStudents([]);
        setLoading(false);

        return;
      }

      try {
        const userProfile = await getUserProfile(currentUser.uid);

        setProfile(userProfile);

        if (userProfile?.role === "student") {
          const ownStudent = await getStudentById(userProfile.studentId);

          setStudentData(ownStudent);

          const ownFee = await getFeeByStudentId(userProfile.studentId);

          setStudentFee(ownFee);

          const ownFeeHistory = await getStudentFeeHistory(
            userProfile.studentId
          );

          setStudentFeeHistory(ownFeeHistory);
        } else {
          const allStudents = await getStudents();

          setStudents(allStudents);
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  /* =========================================================
     LOGIN
  ========================================================= */

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoginError("");
    setLoading(true);

    try {
      await loginUser(email.trim(), password);
    } catch (error: any) {
      console.error("Login error:", error);

      setLoginError(`Login failed: ${error?.code || "unknown-error"}`);

      setLoading(false);
    }
  };

  /* =========================================================
     LOGOUT
  ========================================================= */

  const handleLogout = async () => {
    await logoutUser();

    setPage("dashboard");

    setEmail("");
    setPassword("");

    setProfile(null);
    setStudentData(null);
    setStudentFee(null);
    setStudentFeeHistory([]);
    setStudents([]);
  };

  /* =========================================================
     ADD STUDENT
  ========================================================= */

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();

    setStudentMessage("");

    if (!studentId.trim()) {
      setStudentMessage("Please enter Student ID.");

      return;
    }

    if (!studentName.trim()) {
      setStudentMessage("Please enter student name.");

      return;
    }

    if (!studentEmail.trim()) {
      setStudentMessage("Please enter student email.");

      return;
    }

    if (studentPassword.length < 6) {
      setStudentMessage("Password must contain at least 6 characters.");

      return;
    }

    setSavingStudent(true);

    try {
      /* CREATE OR RECOVER AUTH ACCOUNT */

      setStudentMessage("Creating Firebase login account...");

      const newUser = await createStudentAccount(
        studentEmail.trim(),
        studentPassword
      );

      console.log("Student Firebase UID:", newUser.uid);

      /* CREATE USER PROFILE */

      setStudentMessage("Creating student profile...");

      await setDoc(doc(db, "users", newUser.uid), {
        name: studentName.trim(),

        role: "student",

        studentId: studentId.trim(),

        email: studentEmail.trim(),
      });

      /* CREATE STUDENT RECORD */

      setStudentMessage("Creating student record...");

      await addStudent({
        studentId: studentId.trim(),

        name: studentName.trim(),

        className: className.trim(),

        batch: batch.trim(),

        email: studentEmail.trim(),

        attendance: Number(attendance) || 0,

        average: Number(average) || 0,

        monthlyFee: Number(monthlyFee) || 0,

        feeDue: Number(monthlyFee) || 0,

        authUid: newUser.uid,
      });

      /* REFRESH */

      setStudentMessage("Refreshing student list...");

      const updatedStudents = await getStudents();

      setStudents(updatedStudents);

      /* SUCCESS */

      setStudentMessage("Student account created successfully! ✅");

      setStudentId("");
      setStudentName("");
      setClassName("");
      setBatch("");
      setStudentEmail("");
      setStudentPassword("");
      setAttendance("0");
      setAverage("0");
      setMonthlyFee("0");
      setFeeDue("0");
    } catch (error: any) {
      console.error("Student creation error:", error);

      setStudentMessage(
        `Firebase Error: ${error?.code || "unknown-error"} | ${
          error?.message || "Unknown Firebase error"
        }`
      );
    } finally {
      setSavingStudent(false);
    }
  };

  const handlePasswordReset = async (student: Student) => {
    if (!isAdmin) {
      setStudentMessage("Only the admin can change or reset a student password.");
      return;
    }

    if (!student.email) {
      setStudentMessage("This student does not have a login email.");
      return;
    }

    try {
      await sendStudentPasswordReset(student.email);
      setStudentMessage(`Password reset link sent to ${student.email}. 📩`);
    } catch (error: any) {
      console.error("Password reset error:", error);
      setStudentMessage(
        `Firebase Error: ${error?.code || "unknown-error"} | ${
          error?.message || "Unable to send password reset"
        }`
      );
    }
  };

  const openAddFeeMonth = (student: Student) => {
    if (!isAdmin) return;
    setAddFeeStudent(student);
    setAddFeeMonth("");
    setAddFeeAmount(String(student.monthlyFee ?? 0));
    setAddFeeDueDate("");
    setAddFeeNote("");
    setFeeMessage("");
    setShowAddFeeMonth(true);
  };

  const saveAddedFeeMonth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setFeeMessage("Only the admin can add previous month fees.");
      return;
    }
    if (!addFeeStudent?.studentId || !addFeeMonth) {
      setFeeMessage("Select a month and enter the fee amount.");
      return;
    }

    const currentMonth = new Date().toISOString().slice(0, 7);
    const amount = Number(addFeeAmount);
    if (addFeeMonth > currentMonth) {
      setFeeMessage("You can add only the current or previous months.");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setFeeMessage("Enter a valid fee amount.");
      return;
    }

    setSavingAddFee(true);
    setFeeMessage("");
    try {
      await createFeeMonth(
        addFeeStudent.studentId,
        addFeeMonth,
        amount,
        0,
        addFeeDueDate,
        addFeeNote.trim()
      );
      const history = await getStudentFeeHistory(addFeeStudent.studentId);
      setSelectedFeeStudent(addFeeStudent);
      setSelectedFeeHistory(history);
      const allFees = await getAllFees();
      setFees(allFees);
      const updatedStudents = await getStudents();
      setStudents(updatedStudents);
      setShowAddFeeMonth(false);
      setAddFeeStudent(null);
      setFeeMessage(`Fee for ${addFeeMonth} added successfully! ✅`);
    } catch (error: any) {
      console.error("Add fee month error:", error);
      setFeeMessage(
        `Firebase Error: ${error?.code || "unknown-error"} | ${
          error?.message || "Unable to add fee month"
        }`
      );
    } finally {
      setSavingAddFee(false);
    }
  };

  const openEditHistoryFee = (student: Student, fee: Fee) => {
    if (!isAdmin) return;
    setEditHistoryFeeStudent(student);
    setEditHistoryFee(fee);
    setEditHistoryAmount(String(fee.monthlyFee ?? 0));
    setEditHistoryDueDate(fee.dueDate || "");
    setFeeMessage("");
    setShowEditHistoryFee(true);
  };

  const saveHistoryFeeEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setFeeMessage("Only the admin can edit previous month fees.");
      return;
    }
    if (!editHistoryFeeStudent?.studentId || !editHistoryFee?.monthId) return;

    const amount = Number(editHistoryAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setFeeMessage("Enter a valid fee amount.");
      return;
    }

    setSavingHistoryEdit(true);
    setFeeMessage("");
    try {
      await updateFeeMonth(
        editHistoryFeeStudent.studentId,
        editHistoryFee.monthId,
        amount,
        editHistoryDueDate
      );
      const history = await getStudentFeeHistory(editHistoryFeeStudent.studentId);
      setSelectedFeeHistory(history);
      const allFees = await getAllFees();
      setFees(allFees);
      const updatedStudents = await getStudents();
      setStudents(updatedStudents);
      setShowEditHistoryFee(false);
      setEditHistoryFee(null);
      setEditHistoryFeeStudent(null);
      setFeeMessage(`Fee for ${editHistoryFee.monthId} updated successfully! ✅`);
    } catch (error: any) {
      console.error("History fee edit error:", error);
      setFeeMessage(
        `Firebase Error: ${error?.code || "unknown-error"} | ${
          error?.message || "Unable to edit fee"
        }`
      );
    } finally {
      setSavingHistoryEdit(false);
    }
  };

  /* =========================================================
     START EDIT
  ========================================================= */

  const startEditStudent = (student: Student) => {
    setEditingStudent(student);

    setEditName(student.name || "");

    setEditClassName(student.className || "");

    setEditBatch(student.batch || "");

    setEditAttendance(String(student.attendance ?? 0));

    setEditAverage(String(student.average ?? 0));

    setEditStudentMonthlyFee(String(student.monthlyFee ?? student.feeDue ?? 0));

    setEditFeeDue(String(student.feeDue ?? 0));

    setEditMessage("");
  };

  /* =========================================================
     SAVE EDIT
  ========================================================= */

  const saveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingStudent) {
      return;
    }

    if (!editingStudent.studentId) {
      setEditMessage("Student ID is missing.");

      return;
    }

    setSavingEdit(true);
    setEditMessage("");

    try {
      /* UPDATE STUDENT DOCUMENT */

      await updateDoc(doc(db, "students", editingStudent.studentId), {
        name: editName.trim(),

        className: editClassName.trim(),

        batch: editBatch.trim(),

        attendance: Number(editAttendance) || 0,

        average: Number(editAverage) || 0,

        monthlyFee: Number(editStudentMonthlyFee) || 0,
      });

      /* UPDATE USER PROFILE NAME TOO */

      if (editingStudent.authUid) {
        await updateDoc(doc(db, "users", editingStudent.authUid), {
          name: editName.trim(),
        });
      }

      /* REFRESH LIST */

      const updatedStudents = await getStudents();

      setStudents(updatedStudents);

      setEditMessage("Student updated successfully! ✅");

      setTimeout(() => {
        setEditingStudent(null);
        setEditMessage("");
      }, 800);
    } catch (error: any) {
      console.error("Student update error:", error);

      setEditMessage(
        `Firebase Error: ${error?.code || "unknown-error"} | ${
          error?.message || "Unknown Firebase error"
        }`
      );
    } finally {
      setSavingEdit(false);
    }
  };

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div style={styles.centerPage}>
        <div style={styles.loadingCard}>
          <h2>Loading...</h2>

          <p>Please wait.</p>
        </div>
      </div>
    );
  }

  /* =========================================================
     LOGIN
  ========================================================= */

  if (!user) {
    return (
      <div style={styles.loginPage}>
        <div style={styles.loginCard}>
          <div style={styles.logoCircle}>🎓</div>

          <h1 style={styles.loginTitle}>Coaching Management System</h1>

          <p style={styles.muted}>
            Secure login for Admin, Teachers and Students
          </p>

          <form onSubmit={handleLogin}>
            <label style={styles.label}>Email</label>

            <input
              style={styles.input}
              type="email"
              placeholder="Enter email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label style={styles.label}>Password</label>

            <input
              style={styles.input}
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {loginError && <div style={styles.errorBox}>❌ {loginError}</div>}

            <button style={styles.primaryButton} type="submit">
              🔐 Login
            </button>
          </form>

          <p style={styles.loginNote}>
            Your account role is automatically detected after login.
          </p>
        </div>
      </div>
    );
  }

  /* =========================================================
     STUDENT DASHBOARD
  ========================================================= */

  if (profile?.role === "student") {
    return (
      <div style={styles.appPage}>
        <header style={styles.topbar}>
          <div>
            <h2 style={{ margin: 0 }}>🎓 Student Dashboard</h2>

            <p style={styles.topbarSub}>
              Welcome, {studentData?.name || profile.name}
            </p>
          </div>

          <button style={styles.logoutButton} onClick={handleLogout}>
            Logout
          </button>
        </header>

        <main style={styles.main}>
          <div style={styles.studentWelcome}>
            <h1>Welcome, {studentData?.name || profile.name}! 👋</h1>

            <p>
              Student ID: <strong>{profile.studentId}</strong>
            </p>
          </div>

          <div style={styles.grid}>
            <StatCard
              title="My Average"
              value={
                studentData?.average !== undefined
                  ? `${studentData.average}%`
                  : "N/A"
              }
              icon="📊"
            />

            <StatCard
              title="My Attendance"
              value={
                studentData?.attendance !== undefined
                  ? `${studentData.attendance}%`
                  : "N/A"
              }
              icon="📅"
            />

            <StatCard
              title="My Monthly Fee"
              value={`₹${
                studentFee?.monthlyFee ??
                studentData?.monthlyFee ??
                studentData?.feeDue ??
                0
              }`}
              icon="💰"
            />

            <StatCard
              title="My Total Due"
              value={`₹${studentData?.feeDue ?? 0}`}
              icon="🔴"
            />

            <StatCard title="My Rank" value="Coming soon" icon="🏆" />
          </div>

          <div style={styles.twoColumn}>
            <div style={styles.card}>
              <h2>👤 My Information</h2>

              <InfoRow
                label="Name"
                value={studentData?.name || profile.name || "N/A"}
              />

              <InfoRow
                label="Student ID"
                value={profile.studentId || studentData?.studentId || "N/A"}
              />

              <InfoRow label="Class" value={studentData?.className || "N/A"} />

              <InfoRow label="Batch" value={studentData?.batch || "N/A"} />

              <InfoRow
                label="Email"
                value={profile.email || user.email || "N/A"}
              />
            </div>

            <div style={styles.card}>
              <h2>📢 Notices</h2>

              <div style={styles.emptyBox}>No notices yet.</div>

              <h2 style={{ marginTop: 25 }}>📚 Homework</h2>

              <div style={styles.emptyBox}>Homework will appear here.</div>
            </div>
          </div>

          <div style={styles.card}>
            <h2>💰 My Fee Details</h2>

            <div style={styles.feeHistoryGrid}>
              <div>
                <span style={styles.smallLabel}>Current Month</span>
                <strong>
                  {studentFee?.monthId || new Date().toISOString().slice(0, 7)}
                </strong>
              </div>
              <div>
                <span style={styles.smallLabel}>Monthly Fee</span>
                <strong>
                  ₹
                  {studentFee?.monthlyFee ??
                    studentData?.monthlyFee ??
                    studentData?.feeDue ??
                    0}
                </strong>
              </div>
              <div>
                <span style={styles.smallLabel}>Paid This Month</span>
                <strong>₹{studentFee?.paidAmount || 0}</strong>
              </div>
              <div>
                <span style={styles.smallLabel}>Due This Month</span>
                <strong>
                  ₹
                  {studentFee?.pendingAmount ??
                    studentFee?.monthlyFee ??
                    studentData?.monthlyFee ??
                    studentData?.feeDue ??
                    0}
                </strong>
              </div>
            </div>

            <h3>📜 Fee History</h3>

            {studentFeeHistory.length === 0 ? (
              <div style={styles.emptyBox}>No fee history available yet.</div>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Month</th>
                      <th style={styles.th}>Monthly Fee</th>
                      <th style={styles.th}>Paid</th>
                      <th style={styles.th}>Due</th>
                      <th style={styles.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentFeeHistory.map((fee) => (
                      <tr key={fee.id}>
                        <td style={styles.td}>{fee.monthId || "-"}</td>
                        <td style={styles.td}>₹{fee.monthlyFee || 0}</td>
                        <td style={styles.td}>₹{fee.paidAmount || 0}</td>
                        <td style={styles.td}>
                          <strong>₹{fee.pendingAmount || 0}</strong>
                        </td>
                        <td style={styles.td}>
                          <span
                            style={
                              fee.status === "paid"
                                ? styles.paidBadge
                                : fee.status === "partial"
                                ? styles.partialBadge
                                : styles.pendingBadge
                            }
                          >
                            {fee.status === "paid"
                              ? "🟢 Paid"
                              : fee.status === "partial"
                              ? "🟠 Partial"
                              : "🔴 Due"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={styles.card}>
            <h2>📝 My Test Results</h2>

            <div style={styles.emptyBox}>Test results will appear here.</div>
          </div>
        </main>
      </div>
    );
  }

  /* =========================================================
     ADMIN / TEACHER
  ========================================================= */

  /* =========================================================
     DASHBOARD
  ========================================================= */

  const dashboardPage = () => {
    const totalStudents = students.length;

    const averageAttendance =
      totalStudents > 0
        ? Math.round(
            students.reduce((sum, s) => sum + Number(s.attendance || 0), 0) /
              totalStudents
          )
        : 0;

    const averageMarks =
      totalStudents > 0
        ? Math.round(
            students.reduce((sum, s) => sum + Number(s.average || 0), 0) /
              totalStudents
          )
        : 0;

    const totalFeesDue = students.reduce(
      (sum, s) => sum + Number(s.feeDue || 0),
      0
    );

    return (
      <>
        <div style={styles.pageHeader}>
          <div>
            <h1>{isAdmin ? "Admin Dashboard" : "Teacher Dashboard"}</h1>

            <p style={styles.muted}>Welcome, {profile?.name || "User"}</p>
          </div>
        </div>

        <div style={styles.grid}>
          <StatCard
            title="Total Students"
            value={String(totalStudents)}
            icon="👨‍🎓"
          />

          <StatCard
            title="Average Attendance"
            value={`${averageAttendance}%`}
            icon="📅"
          />

          <StatCard
            title="Average Marks"
            value={`${averageMarks}%`}
            icon="📊"
          />

          <StatCard title="Pending Fees" value={`₹${totalFeesDue}`} icon="💰" />
        </div>

        <div style={styles.card}>
          <h2>🕒 Recent Activity</h2>

          <p>✅ Student management active</p>

          <p>📝 Test & result management</p>

          <p>📅 Attendance management</p>

          <p>💰 Fee management</p>

          <p>📚 Homework management</p>

          <p>📢 Notice board</p>
        </div>
      </>
    );
  };

  /* =========================================================
     STUDENTS PAGE
  ========================================================= */

  const studentsPage = () => {
    return (
      <>
        <div style={styles.pageHeader}>
          <div>
            <h1>👨‍🎓 Students</h1>

            <p style={styles.muted}>Manage student accounts and records</p>
          </div>

          {isAdmin && (
            <button
              style={styles.primaryButtonSmall}
              onClick={() => {
                setShowAddStudent(true);
                setStudentMessage("");
              }}
            >
              ➕ Add Student
            </button>
          )}
        </div>

        {/* =================================================
           EDIT STUDENT FORM
        ================================================= */}

        {editingStudent && (
          <div style={styles.card}>
            <div style={styles.formHeader}>
              <div>
                <h2>✏️ Edit Student</h2>

                <p style={styles.muted}>
                  Student ID: <strong>{editingStudent.studentId}</strong>
                </p>
              </div>

              <button
                style={styles.closeButton}
                onClick={() => setEditingStudent(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveStudentEdit}>
              <div style={styles.formGrid}>
                <FormField
                  label="Student Name"
                  value={editName}
                  onChange={setEditName}
                  placeholder="Student name"
                />

                <FormField
                  label="Class"
                  value={editClassName}
                  onChange={setEditClassName}
                  placeholder="Class 12"
                />

                <FormField
                  label="Batch"
                  value={editBatch}
                  onChange={setEditBatch}
                  placeholder="12 A"
                />

                <FormField
                  label="Attendance %"
                  value={editAttendance}
                  onChange={setEditAttendance}
                  placeholder="0"
                  type="number"
                />

                <FormField
                  label="Average %"
                  value={editAverage}
                  onChange={setEditAverage}
                  placeholder="0"
                  type="number"
                />

                <FormField
                  label="Monthly Fee ₹"
                  value={editStudentMonthlyFee}
                  onChange={setEditStudentMonthlyFee}
                  placeholder="Example: 1000"
                  type="number"
                />
              </div>

              {editMessage && (
                <div
                  style={
                    editMessage.includes("successfully")
                      ? styles.successBox
                      : styles.errorBox
                  }
                >
                  {editMessage}
                </div>
              )}

              <div style={styles.formActions}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => setEditingStudent(null)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={styles.primaryButtonSmall}
                  disabled={savingEdit}
                >
                  {savingEdit ? "Saving..." : "💾 Save Changes"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* =================================================
           ADD STUDENT FORM
        ================================================= */}

        {showAddStudent && (
          <div style={styles.card}>
            <div style={styles.formHeader}>
              <div>
                <h2>➕ Create Student Account</h2>

                <p style={styles.muted}>
                  This creates the Firebase login and student profile
                  automatically.
                </p>
              </div>

              <button
                style={styles.closeButton}
                onClick={() => setShowAddStudent(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStudent}>
              <div style={styles.formGrid}>
                <FormField
                  label="Student ID"
                  value={studentId}
                  onChange={setStudentId}
                  placeholder="Example: ST006"
                />

                <FormField
                  label="Student Name"
                  value={studentName}
                  onChange={setStudentName}
                  placeholder="Example: Amit Kumar"
                />

                <FormField
                  label="Class"
                  value={className}
                  onChange={setClassName}
                  placeholder="Example: Class 12"
                />

                <FormField
                  label="Batch"
                  value={batch}
                  onChange={setBatch}
                  placeholder="Example: 12 A"
                />

                <FormField
                  label="Login Email"
                  value={studentEmail}
                  onChange={setStudentEmail}
                  placeholder="student@email.com"
                  type="email"
                />

                <FormField
                  label="Login Password"
                  value={studentPassword}
                  onChange={setStudentPassword}
                  placeholder="Minimum 6 characters"
                  type="password"
                />

                <FormField
                  label="Attendance %"
                  value={attendance}
                  onChange={setAttendance}
                  placeholder="0"
                  type="number"
                />

                <FormField
                  label="Average %"
                  value={average}
                  onChange={setAverage}
                  placeholder="0"
                  type="number"
                />

                <FormField
                  label="Monthly Fee ₹"
                  value={monthlyFee}
                  onChange={setMonthlyFee}
                  placeholder="Example: 1000"
                  type="number"
                />
              </div>

              {studentMessage && (
                <div
                  style={
                    studentMessage.includes("successfully")
                      ? styles.successBox
                      : styles.errorBox
                  }
                >
                  {studentMessage}
                </div>
              )}

              <div style={styles.formActions}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => setShowAddStudent(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={styles.primaryButtonSmall}
                  disabled={savingStudent}
                >
                  {savingStudent ? "Creating..." : "Create Student Account"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* =================================================
           STUDENT TABLE
        ================================================= */}

        <div style={styles.card}>
          <h2>All Students</h2>

          {students.length === 0 ? (
            <div style={styles.emptyBox}>No students found.</div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>ID</th>

                    <th style={styles.th}>Name</th>

                    <th style={styles.th}>Class</th>

                    <th style={styles.th}>Batch</th>

                    <th style={styles.th}>Attendance</th>

                    <th style={styles.th}>Average</th>

                    <th style={styles.th}>Fee Due</th>

                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {students.map((student) => (
                    <tr key={student.studentId || student.id}>
                      <td style={styles.td}>{student.studentId || "-"}</td>

                      <td style={styles.td}>{student.name || "-"}</td>

                      <td style={styles.td}>{student.className || "-"}</td>

                      <td style={styles.td}>{student.batch || "-"}</td>

                      <td style={styles.td}>{student.attendance ?? 0}%</td>

                      <td style={styles.td}>{student.average ?? 0}%</td>

                      <td style={styles.td}>
                        ₹{student.monthlyFee ?? student.feeDue ?? 0}
                      </td>

                      <td style={styles.td}>₹{student.feeDue ?? 0}</td>

                      <td style={styles.td}>
                        {isAdmin && (
                          <>
                            <button
                              style={styles.editButton}
                              onClick={() => startEditStudent(student)}
                            >
                              ✏️ Edit
                            </button>
                            {student.email && (
                              <button
                                style={styles.historyButton}
                                onClick={() => handlePasswordReset(student)}
                              >
                                🔑 Reset Password
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  };

  /* =========================================================
     FEES PAGE
  ========================================================= */

  const feesPage = () => {
    const currentMonth = new Date().toISOString().slice(0, 7);

    const currentFees = students.map((student) => ({
      student,
      fee: fees.find(
        (item) =>
          item.studentId === student.studentId && item.monthId === currentMonth
      ),
    }));

    const totalMonthlyFees = currentFees.reduce(
      (sum, item) =>
        sum +
        Number(
          item.fee?.monthlyFee ??
            item.student.monthlyFee ??
            item.student.feeDue ??
            0
        ),
      0
    );

    const totalPending = students.reduce(
      (sum, student) => sum + Number(student.feeDue || 0),
      0
    );

    const totalPaidThisMonth = currentFees.reduce(
      (sum, item) => sum + Number(item.fee?.paidAmount || 0),
      0
    );

    return (
      <>
        <div style={styles.pageHeader}>
          <div>
            <h1>💰 Fees</h1>
            <p style={styles.muted}>Monthly fees, payments, dues and history</p>
          </div>

          <button
            style={styles.primaryButtonSmall}
            onClick={loadFees}
            disabled={feeLoading}
          >
            {feeLoading ? "Checking..." : "🔄 Refresh Fees"}
          </button>
        </div>

        {feeMessage && (
          <div
            style={
              feeMessage.includes("successfully")
                ? styles.successBox
                : styles.errorBox
            }
          >
            {feeMessage}
          </div>
        )}

        <div style={styles.grid}>
          <StatCard
            title="Monthly Fees"
            value={`₹${totalMonthlyFees}`}
            icon="💵"
          />
          <StatCard
            title="Paid This Month"
            value={`₹${totalPaidThisMonth}`}
            icon="🟢"
          />
          <StatCard
            title="Total Pending"
            value={`₹${totalPending}`}
            icon="🔴"
          />
          <StatCard
            title="Students"
            value={String(students.length)}
            icon="👨‍🎓"
          />
        </div>

        <div style={styles.card}>
          <h2>📅 Current Month: {currentMonth}</h2>
          <p style={styles.muted}>
            Each student has a separate monthly fee. You can edit a student's
            monthly fee at any time. Previous months remain unchanged.
          </p>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Student</th>
                  <th style={styles.th}>Class</th>
                  <th style={styles.th}>Batch</th>
                  <th style={styles.th}>Monthly Fee</th>
                  <th style={styles.th}>Paid This Month</th>
                  <th style={styles.th}>Due This Month</th>
                  <th style={styles.th}>Total Pending</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {currentFees.map(({ student, fee }) => {
                  const monthly = Number(
                    fee?.monthlyFee ?? student.monthlyFee ?? student.feeDue ?? 0
                  );

                  const paid = Number(fee?.paidAmount || 0);

                  const remaining = Number(
                    fee?.pendingAmount ?? Math.max(monthly - paid, 0)
                  );

                  const totalStudentPending = Number(student.feeDue || 0);

                  const status =
                    fee?.status ||
                    (remaining === 0
                      ? "paid"
                      : paid > 0
                      ? "partial"
                      : "pending");

                  return (
                    <tr key={student.studentId || student.id}>
                      <td style={styles.td}>{student.studentId || "-"}</td>

                      <td style={styles.td}>
                        <strong>{student.name || "-"}</strong>
                      </td>

                      <td style={styles.td}>{student.className || "-"}</td>

                      <td style={styles.td}>{student.batch || "-"}</td>

                      <td style={styles.td}>
                        <strong>₹{monthly}</strong>
                      </td>

                      <td style={styles.td}>₹{paid}</td>

                      <td style={styles.td}>
                        <strong>₹{remaining}</strong>
                      </td>

                      <td style={styles.td}>₹{totalStudentPending}</td>

                      <td style={styles.td}>
                        <span
                          style={
                            status === "paid"
                              ? styles.paidBadge
                              : status === "partial"
                              ? styles.partialBadge
                              : styles.pendingBadge
                          }
                        >
                          {status === "paid"
                            ? "🟢 Paid"
                            : status === "partial"
                            ? "🟠 Partial"
                            : "🔴 Due"}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <div
                          style={{
                            display: "flex",
                            gap: 7,
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            style={styles.historyButton}
                            onClick={() => openAddFeeMonth(student)}
                          >
                            📅 Add Month / Previous Due
                          </button>

                          <button
                            style={styles.editButton}
                            onClick={() => openEditMonthlyFee(student)}
                          >
                            ✏️ Edit Fee
                          </button>

                          {remaining > 0 && (
                            <button
                              style={styles.paidButton}
                              onClick={() => openPayment(student)}
                            >
                              💵 Receive Payment
                            </button>
                          )}

                          <button
                            style={styles.historyButton}
                            onClick={() => openFeeHistory(student)}
                          >
                            📜 History
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {showEditFee && editFeeStudent && (
          <div style={styles.card}>
            <div style={styles.formHeader}>
              <div>
                <h2>✏️ Edit Monthly Fee</h2>
                <p style={styles.muted}>
                  {editFeeStudent.name} · {editFeeStudent.studentId} ·{" "}
                  {editFeeStudent.className}
                </p>
              </div>

              <button
                style={styles.closeButton}
                onClick={() => {
                  setShowEditFee(false);
                  setEditFeeStudent(null);
                }}
              >
                ✕
              </button>
            </div>

            <div style={styles.infoNotice}>
              💡 Changing the fee updates the student's current monthly charge
              and future monthly charges. Previous months and their payment
              history are kept unchanged.
            </div>

            <form onSubmit={saveMonthlyFeeEdit}>
              <div style={styles.formGrid}>
                <FormField
                  label="Student Name"
                  value={editFeeStudent.name || ""}
                  onChange={() => {}}
                  placeholder="Student name"
                />

                <FormField
                  label="Class"
                  value={editFeeStudent.className || ""}
                  onChange={() => {}}
                  placeholder="Class"
                />

                <FormField
                  label="New Monthly Fee ₹"
                  value={editMonthlyFee}
                  onChange={setEditMonthlyFee}
                  placeholder="Example: 1500"
                  type="number"
                />
              </div>

              <div style={styles.formActions}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => {
                    setShowEditFee(false);
                    setEditFeeStudent(null);
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={styles.primaryButtonSmall}
                  disabled={savingFeeEdit}
                >
                  {savingFeeEdit ? "Saving..." : "💾 Update Monthly Fee"}
                </button>
              </div>
            </form>
          </div>
        )}

        {showAddFeeMonth && addFeeStudent && (
          <div style={styles.card}>
            <div style={styles.formHeader}>
              <div>
                <h2>📅 Add Previous Month / Due</h2>
                <p style={styles.muted}>
                  {addFeeStudent.name} · {addFeeStudent.studentId}
                </p>
              </div>
              <button
                style={styles.closeButton}
                onClick={() => { setShowAddFeeMonth(false); setAddFeeStudent(null); }}
              >✕</button>
            </div>

            <div style={styles.infoNotice}>
              Add any unpaid or paid month from the current month or earlier, including a previous year. The fee becomes part of the student's total due automatically.
            </div>

            <form onSubmit={saveAddedFeeMonth}>
              <div style={styles.formGrid}>
                <div>
                  <label style={styles.label}>Month</label>
                  <input
                    style={styles.input}
                    type="month"
                    value={addFeeMonth}
                    onChange={(e) => setAddFeeMonth(e.target.value)}
                    required
                  />
                </div>
                <FormField label="Monthly Fee ₹" value={addFeeAmount} onChange={setAddFeeAmount} type="number" placeholder="1000" />
                <div>
                  <label style={styles.label}>Due Date (optional)</label>
                  <input
                    style={styles.input}
                    type="date"
                    value={addFeeDueDate}
                    onChange={(e) => setAddFeeDueDate(e.target.value)}
                  />
                </div>
                <FormField label="Note (optional)" value={addFeeNote} onChange={setAddFeeNote} placeholder="Previous dues" />
              </div>
              <div style={styles.formActions}>
                <button type="button" style={styles.secondaryButton} onClick={() => { setShowAddFeeMonth(false); setAddFeeStudent(null); }}>Cancel</button>
                <button type="submit" style={styles.primaryButtonSmall} disabled={savingAddFee}>
                  {savingAddFee ? "Saving..." : "➕ Add Fee Month"}
                </button>
              </div>
            </form>
          </div>
        )}

        {showEditHistoryFee && editHistoryFeeStudent && editHistoryFee && (
          <div style={styles.card}>
            <div style={styles.formHeader}>
              <div>
                <h2>✏️ Edit Fee: {editHistoryFee.monthId}</h2>
                <p style={styles.muted}>{editHistoryFeeStudent.name} · {editHistoryFeeStudent.studentId}</p>
              </div>
              <button style={styles.closeButton} onClick={() => setShowEditHistoryFee(false)}>✕</button>
            </div>

            <div style={styles.infoNotice}>
              The paid amount and payment history are preserved. Changing the monthly fee recalculates that month's due amount and the student's total pending balance.
            </div>

            <form onSubmit={saveHistoryFeeEdit}>
              <div style={styles.formGrid}>
                <FormField label="Month" value={editHistoryFee.monthId || ""} onChange={() => {}} placeholder="YYYY-MM" />
                <FormField label="Monthly Fee ₹" value={editHistoryAmount} onChange={setEditHistoryAmount} type="number" placeholder="1000" />
                <div>
                  <label style={styles.label}>Due Date</label>
                  <input style={styles.input} type="date" value={editHistoryDueDate} onChange={(e) => setEditHistoryDueDate(e.target.value)} />
                </div>
              </div>
              <div style={styles.feeHistoryGrid}>
                <div><span style={styles.smallLabel}>Already Paid</span><strong>₹{editHistoryFee.paidAmount || 0}</strong></div>
                <div><span style={styles.smallLabel}>Current Due</span><strong>₹{editHistoryFee.pendingAmount || 0}</strong></div>
              </div>
              <div style={styles.formActions}>
                <button type="button" style={styles.secondaryButton} onClick={() => setShowEditHistoryFee(false)}>Cancel</button>
                <button type="submit" style={styles.primaryButtonSmall} disabled={savingHistoryEdit}>
                  {savingHistoryEdit ? "Saving..." : "💾 Save Month"}
                </button>
              </div>
            </form>
          </div>
        )}

        {showPayment && paymentStudent && paymentFee && (
          <div style={styles.card}>
            <div style={styles.formHeader}>
              <div>
                <h2>💵 Record Payment</h2>
                <p style={styles.muted}>
                  {paymentStudent.name} · {paymentStudent.studentId} ·{" "}
                  {paymentFee.monthId}
                </p>
              </div>

              <button
                style={styles.closeButton}
                onClick={() => setShowPayment(false)}
              >
                ✕
              </button>
            </div>

            <div style={styles.grid}>
              <StatCard
                title="Monthly Fee"
                value={`₹${paymentFee.monthlyFee || 0}`}
                icon="💰"
              />
              <StatCard
                title="Already Paid"
                value={`₹${paymentFee.paidAmount || 0}`}
                icon="🟢"
              />
              <StatCard
                title="Remaining"
                value={`₹${paymentFee.pendingAmount || 0}`}
                icon="🔴"
              />
            </div>

            <form onSubmit={savePayment}>
              <div style={styles.formGrid}>
                <FormField
                  label="Payment Amount ₹"
                  value={paymentAmount}
                  onChange={setPaymentAmount}
                  placeholder="Enter amount paid"
                  type="number"
                />

                <div>
                  <label style={styles.label}>Payment Method</label>
                  <select
                    style={styles.input}
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option>Cash</option>
                    <option>UPI</option>
                    <option>Bank Transfer</option>
                    <option>Card</option>
                  </select>
                </div>

                <FormField
                  label="Note (optional)"
                  value={paymentNote}
                  onChange={setPaymentNote}
                  placeholder="Example: September fee"
                />
              </div>

              <div style={styles.formActions}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => setShowPayment(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={styles.primaryButtonSmall}
                  disabled={savingPayment}
                >
                  {savingPayment ? "Saving..." : "✅ Save Payment"}
                </button>
              </div>
            </form>
          </div>
        )}

        {selectedFeeStudent && (
          <div style={styles.card}>
            <div style={styles.formHeader}>
              <div>
                <h2>📜 Payment History</h2>
                <p style={styles.muted}>
                  {selectedFeeStudent.name} · {selectedFeeStudent.studentId} ·{" "}
                  {selectedFeeStudent.className}
                </p>
              </div>

              <button
                style={styles.closeButton}
                onClick={() => setSelectedFeeStudent(null)}
              >
                ✕
              </button>
            </div>

            {selectedFeeHistory.length === 0 ? (
              <div style={styles.emptyBox}>No fee history yet.</div>
            ) : (
              selectedFeeHistory.map((fee) => (
                <div key={fee.id} style={{ marginBottom: 20 }}>
                  <h3 style={{ marginBottom: 8 }}>📅 {fee.monthId}</h3>

                  <div style={styles.monthFeeCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <strong>📅 {fee.monthId}</strong>
                      <button
                        style={styles.editButton}
                        onClick={() => openEditHistoryFee(selectedFeeStudent, fee)}
                      >
                        ✏️ Edit This Month
                      </button>
                    </div>

                    <div style={styles.feeHistoryGrid}>
                      <div>
                        <span style={styles.smallLabel}>Monthly Fee</span>
                        <strong>₹{fee.monthlyFee || 0}</strong>
                      </div>
                      <div>
                        <span style={styles.smallLabel}>Paid</span>
                        <strong>₹{fee.paidAmount || 0}</strong>
                      </div>
                      <div>
                        <span style={styles.smallLabel}>Due</span>
                        <strong>₹{fee.pendingAmount || 0}</strong>
                      </div>
                      <div>
                        <span style={styles.smallLabel}>Status</span>
                        <strong>
                          {fee.status === "paid"
                            ? "🟢 Paid"
                            : fee.status === "partial"
                            ? "🟠 Partial"
                            : "🔴 Due"}
                        </strong>
                      </div>
                    </div>

                    <h4>Payments</h4>

                    {(fee.paymentHistory || []).length === 0 ? (
                      <div style={styles.emptyBox}>
                        No payment recorded for this month.
                      </div>
                    ) : (
                      (fee.paymentHistory || []).map((payment, index) => (
                        <div key={index} style={styles.paymentHistoryRow}>
                          <strong>₹{payment.amount}</strong>
                          <span>{payment.method || "Cash"}</span>
                          <span>
                            {new Date(payment.date).toLocaleDateString()}
                          </span>
                          {payment.note && <span>{payment.note}</span>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </>
    );
  };

  /* =========================================================
     SIMPLE PAGES
  ========================================================= */

  const simplePage = (title: string, icon: string, description: string) => {
    return (
      <>
        <div style={styles.pageHeader}>
          <div>
            <h1>
              {icon} {title}
            </h1>

            <p style={styles.muted}>{description}</p>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.emptyBox}>
            <h2>Coming soon 🚀</h2>

            <p>This module will be connected to Firebase next.</p>
          </div>
        </div>
      </>
    );
  };

  /* =========================================================
     MAIN UI
  ========================================================= */

  return (
    <div style={styles.appPage}>
      <header style={styles.topbar}>
        <div>
          <h2 style={{ margin: 0 }}>🎓 Coaching Management System</h2>

          <p style={styles.topbarSub}>
            {profile?.name || "User"}
            {" · "}
            {profile?.role || "user"}
          </p>
        </div>

        <button style={styles.logoutButton} onClick={handleLogout}>
          Logout
        </button>
      </header>

      <div style={styles.layout}>
        <aside style={styles.sidebar}>
          <button
            style={
              page === "dashboard" ? styles.navButtonActive : styles.navButton
            }
            onClick={() => setPage("dashboard")}
          >
            🏠 Dashboard
          </button>

          <button
            style={
              page === "students" ? styles.navButtonActive : styles.navButton
            }
            onClick={() => setPage("students")}
          >
            👨‍🎓 Students
          </button>

          <button
            style={
              page === "teachers" ? styles.navButtonActive : styles.navButton
            }
            onClick={() => setPage("teachers")}
          >
            👨‍🏫 Teachers
          </button>

          <button
            style={page === "tests" ? styles.navButtonActive : styles.navButton}
            onClick={() => setPage("tests")}
          >
            📝 Tests & Results
          </button>

          <button
            style={
              page === "attendance" ? styles.navButtonActive : styles.navButton
            }
            onClick={() => setPage("attendance")}
          >
            📅 Attendance
          </button>

          <button
            style={page === "fees" ? styles.navButtonActive : styles.navButton}
            onClick={() => setPage("fees")}
          >
            💰 Fees
          </button>

          <button
            style={
              page === "homework" ? styles.navButtonActive : styles.navButton
            }
            onClick={() => setPage("homework")}
          >
            📚 Homework
          </button>

          <button
            style={
              page === "notices" ? styles.navButtonActive : styles.navButton
            }
            onClick={() => setPage("notices")}
          >
            📢 Notices
          </button>
        </aside>

        <main style={styles.main}>
          {page === "dashboard" && dashboardPage()}

          {page === "students" && studentsPage()}

          {page === "teachers" &&
            simplePage("Teachers", "👨‍🏫", "Manage teachers and batches")}

          {page === "tests" &&
            simplePage(
              "Tests & Results",
              "📝",
              "Create tests, enter marks and calculate rankings"
            )}

          {page === "attendance" &&
            simplePage("Attendance", "📅", "Manage daily student attendance")}

          {page === "fees" && feesPage()}

          {page === "homework" &&
            simplePage("Homework", "📚", "Assign homework to batches")}

          {page === "notices" &&
            simplePage("Notices", "📢", "Publish notices for students")}
        </main>
      </div>
    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: string;
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statIcon}>{icon}</div>

      <div>
        <p style={styles.statTitle}>{title}</p>

        <h2 style={styles.statValue}>{value}</h2>
      </div>
    </div>
  );
}

/* =========================================================
   INFO ROW
========================================================= */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>

      <strong>{value}</strong>
    </div>
  );
}

/* =========================================================
   FORM FIELD
========================================================= */

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label style={styles.label}>{label}</label>

      <input
        style={styles.input}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </div>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles: {
  [key: string]: React.CSSProperties;
} = {
  centerPage: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f5f7fb",
    fontFamily: "Arial, sans-serif",
  },

  loadingCard: {
    background: "white",
    padding: 40,
    borderRadius: 16,
    textAlign: "center",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  },

  loginPage: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    background: "#f5f7fb",
    fontFamily: "Arial, sans-serif",
  },

  loginCard: {
    width: "100%",
    maxWidth: 430,
    background: "white",
    padding: 35,
    borderRadius: 18,
    boxShadow: "0 12px 35px rgba(0,0,0,0.1)",
  },

  logoCircle: {
    width: 70,
    height: 70,
    borderRadius: "50%",
    background: "#eef2ff",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: 35,
    margin: "0 auto 20px",
  },

  loginTitle: {
    textAlign: "center",
    marginBottom: 8,
  },

  muted: {
    color: "#6b7280",
    marginTop: 5,
  },

  loginNote: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: 13,
    marginTop: 20,
  },

  label: {
    display: "block",
    fontWeight: 600,
    marginBottom: 7,
    marginTop: 16,
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    border: "1px solid #d1d5db",
    borderRadius: 9,
    fontSize: 15,
    outline: "none",
  },

  primaryButton: {
    width: "100%",
    border: "none",
    borderRadius: 9,
    padding: "13px 18px",
    background: "#2563eb",
    color: "white",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    marginTop: 20,
  },

  primaryButtonSmall: {
    border: "none",
    borderRadius: 9,
    padding: "11px 16px",
    background: "#2563eb",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },

  secondaryButton: {
    border: "1px solid #d1d5db",
    borderRadius: 9,
    padding: "11px 16px",
    background: "white",
    cursor: "pointer",
  },

  editButton: {
    border: "none",
    borderRadius: 7,
    padding: "8px 12px",
    background: "#f59e0b",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },

  paidBadge: {
    display: "inline-block",
    padding: "6px 9px",
    borderRadius: 20,
    background: "#dcfce7",
    color: "#166534",
    fontWeight: 700,
    fontSize: 12,
  },

  partialBadge: {
    display: "inline-block",
    padding: "6px 9px",
    borderRadius: 20,
    background: "#ffedd5",
    color: "#9a3412",
    fontWeight: 700,
    fontSize: 12,
  },

  pendingBadge: {
    display: "inline-block",
    padding: "6px 9px",
    borderRadius: 20,
    background: "#fee2e2",
    color: "#991b1b",
    fontWeight: 700,
    fontSize: 12,
  },

  paidButton: {
    border: "none",
    borderRadius: 7,
    padding: "8px 12px",
    background: "#16a34a",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },

  logoutButton: {
    border: "none",
    borderRadius: 9,
    padding: "10px 15px",
    background: "#ef4444",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },

  closeButton: {
    border: "none",
    background: "#f3f4f6",
    borderRadius: 8,
    width: 35,
    height: 35,
    cursor: "pointer",
    fontSize: 16,
  },

  errorBox: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
    wordBreak: "break-word",
  },

  successBox: {
    background: "#dcfce7",
    color: "#166534",
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    wordBreak: "break-word",
  },

  appPage: {
    minHeight: "100vh",
    background: "#f5f7fb",
    fontFamily: "Arial, sans-serif",
  },

  topbar: {
    minHeight: 70,
    background: "white",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 22px",
    boxSizing: "border-box",
  },

  topbarSub: {
    margin: "4px 0 0",
    color: "#6b7280",
    fontSize: 13,
  },

  layout: {
    display: "flex",
    minHeight: "calc(100vh - 70px)",
  },

  sidebar: {
    width: 220,
    background: "#111827",
    padding: 15,
    boxSizing: "border-box",
  },

  navButton: {
    width: "100%",
    textAlign: "left",
    border: "none",
    background: "transparent",
    color: "#d1d5db",
    padding: "12px 13px",
    borderRadius: 8,
    cursor: "pointer",
    marginBottom: 5,
    fontSize: 14,
  },

  navButtonActive: {
    width: "100%",
    textAlign: "left",
    border: "none",
    background: "#2563eb",
    color: "white",
    padding: "12px 13px",
    borderRadius: 8,
    cursor: "pointer",
    marginBottom: 5,
    fontSize: 14,
    fontWeight: 700,
  },

  main: {
    flex: 1,
    padding: 25,
    boxSizing: "border-box",
    overflow: "auto",
  },

  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 18,
    marginBottom: 22,
  },

  statCard: {
    background: "white",
    borderRadius: 14,
    padding: 20,
    display: "flex",
    alignItems: "center",
    gap: 15,
    boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
  },

  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: "#eef2ff",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: 24,
  },

  statTitle: {
    margin: 0,
    color: "#6b7280",
    fontSize: 13,
  },

  statValue: {
    margin: "5px 0 0",
  },

  card: {
    background: "white",
    borderRadius: 14,
    padding: 22,
    marginBottom: 22,
    boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
  },

  studentWelcome: {
    background: "white",
    padding: 25,
    borderRadius: 14,
    marginBottom: 22,
    boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
  },

  twoColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 20,
  },

  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    padding: "12px 0",
    borderBottom: "1px solid #f0f0f0",
  },

  infoLabel: {
    color: "#6b7280",
  },

  emptyBox: {
    background: "#f9fafb",
    borderRadius: 10,
    padding: 25,
    textAlign: "center",
    color: "#6b7280",
  },

  formHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 5,
  },

  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 800,
  },

  th: {
    textAlign: "left",
    padding: 12,
    background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
    fontSize: 13,
  },

  td: {
    padding: 12,
    borderBottom: "1px solid #f0f0f0",
    fontSize: 14,
  },

  historyButton: {
    border: "none",
    borderRadius: 7,
    padding: "8px 12px",
    background: "#6366f1",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },

  infoNotice: {
    background: "#eff6ff",
    color: "#1e40af",
    padding: 14,
    borderRadius: 9,
    marginTop: 18,
    marginBottom: 10,
    lineHeight: 1.5,
  },

  monthFeeCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "#fafafa",
  },

  feeHistoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 12,
    marginBottom: 16,
  },

  smallLabel: {
    display: "block",
    color: "#6b7280",
    fontSize: 12,
    marginBottom: 4,
  },

  paymentHistoryRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    padding: "10px 0",
    borderBottom: "1px solid #e5e7eb",
    fontSize: 14,
  },
};
