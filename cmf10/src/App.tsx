import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, updateDoc, getDocs, collection, query, orderBy, deleteDoc } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

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
  getHomework,
  addHomework,
  updateHomework,
  deleteHomework,
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
  photoUrl?: string;
  fatherName?: string;
  motherName?: string;
  address?: string;
  mobile?: string;
  dob?: string;
  gender?: string;
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

type Homework = {
  id?: string;
  className?: string;
  batch?: string;
  subject?: string;
  title?: string;
  description?: string;
  homeworkDate?: string;
  dueDate?: string;
  day?: string;
  year?: number;
  createdAt?: string;
};

type TestResult = {
  present?: boolean;
  marks?: number | null;
};

type Test = {
  id?: string;
  name?: string;
  subject?: string;
  className?: string;
  batch?: string;
  date?: string;
  total?: number;
  questionPaperUrl?: string;
  questionPaperName?: string;
  answerSheetUrl?: string;
  answerSheetName?: string;
  results?: Record<string, TestResult>;
  createdAt?: string;
};

type AttendanceDay = {
  id?: string;
  date?: string;
  day?: string;
  year?: number;
  records?: Record<string, "present" | "absent">;
  createdAt?: string;
};

type Director = {
  name?: string;
  title?: string;
  mobile?: string;
  email?: string;
  address?: string;
  message?: string;
  photoUrl?: string;
};

type Notice = {
  id?: string;
  title?: string;
  message?: string;
  date?: string;
  priority?: "normal" | "important" | "urgent";
  audience?: string;
  createdAt?: string;
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
  const [directoryStudents, setDirectoryStudents] = useState<Student[]>([]);
  const [director, setDirector] = useState<Director | null>(null);
  const [showStudentProfile, setShowStudentProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Student>({});
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [directorForm, setDirectorForm] = useState<Director>({ name: "", title: "Director", mobile: "", email: "", address: "", message: "" });
  const [directorPhotoFile, setDirectorPhotoFile] = useState<File | null>(null);
  const [directorSaving, setDirectorSaving] = useState(false);
  const [directorMessage, setDirectorMessage] = useState("");

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
     HOMEWORK
  ========================================================= */

  const [homework, setHomework] = useState<Homework[]>([]);
  const [homeworkLoading, setHomeworkLoading] = useState(false);
  const [homeworkMessage, setHomeworkMessage] = useState("");
  const [showHomeworkForm, setShowHomeworkForm] = useState(false);
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null);
  const [homeworkClass, setHomeworkClass] = useState("");
  const [homeworkBatch, setHomeworkBatch] = useState("");
  const [homeworkSubject, setHomeworkSubject] = useState("");
  const [homeworkTitle, setHomeworkTitle] = useState("");
  const [homeworkDescription, setHomeworkDescription] = useState("");
  const [homeworkDate, setHomeworkDate] = useState("");
  const [homeworkDueDate, setHomeworkDueDate] = useState("");
  const [savingHomework, setSavingHomework] = useState(false);

  /* =========================================================
     TESTS & RESULTS
  ========================================================= */
  const [tests, setTests] = useState<Test[]>([]);
  const [testLibraryClass, setTestLibraryClass] = useState("");
  const [testLibrarySubject, setTestLibrarySubject] = useState("");
  const [testsLoading, setTestsLoading] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [showTestForm, setShowTestForm] = useState(false);
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [testName, setTestName] = useState("");
  const [testSubject, setTestSubject] = useState("");
  const [testClass, setTestClass] = useState("");
  const [testBatch, setTestBatch] = useState("");
  const [testDate, setTestDate] = useState("");
  const [testTotal, setTestTotal] = useState("100");
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testQuestionFile, setTestQuestionFile] = useState<File | null>(null);
  const [testAnswerFile, setTestAnswerFile] = useState<File | null>(null);
  const [savingTest, setSavingTest] = useState(false);

  /* =========================================================
     ATTENDANCE
  ========================================================= */
  const [attendanceDays, setAttendanceDays] = useState<AttendanceDay[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, "present" | "absent">>({});
  const [attendanceMessage, setAttendanceMessage] = useState("");
  const [studentCalendarMonth, setStudentCalendarMonth] = useState(new Date().toISOString().slice(0, 7));
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  /* =========================================================
     NOTICES
  ========================================================= */
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [noticePriority, setNoticePriority] = useState<"normal" | "important" | "urgent">("normal");
  const [noticeDate, setNoticeDate] = useState(new Date().toISOString().slice(0, 10));
  const [noticeSaving, setNoticeSaving] = useState(false);
  const [noticeStatus, setNoticeStatus] = useState("");

  const [homeworkAssignedStudents, setHomeworkAssignedStudents] = useState<string[]>([]);
  const [homeworkCompletion, setHomeworkCompletion] = useState<Record<string, boolean>>({});

  /* Admin-only direct Firebase Auth credential change */
  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [credentialStudent, setCredentialStudent] = useState<Student | null>(null);
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [newStudentPassword, setNewStudentPassword] = useState("");
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [credentialMessage, setCredentialMessage] = useState("");

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

  const loadDirector = async () => {
    try {
      const snap = await getDocs(collection(db, "director"));
      const row = snap.docs[0];
      if (row) {
        const data = { ...(row.data() as Director) };
        setDirector(data);
        setDirectorForm(data);
      }
    } catch (error) {
      console.error("Director loading error:", error);
    }
  };

  const saveStudentProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile?.role !== "student" || !studentData?.studentId) return;
    setProfileSaving(true);
    setProfileMessage("");
    try {
      let photoUrl = profileDraft.photoUrl || "";
      if (profilePhotoFile) {
        photoUrl = await uploadAcademicFile(profilePhotoFile, `students/${studentData.studentId}/profile`);
      }
      const allowed = {
        name: (profileDraft.name || "").trim(),
        fatherName: (profileDraft.fatherName || "").trim(),
        motherName: (profileDraft.motherName || "").trim(),
        address: (profileDraft.address || "").trim(),
        mobile: (profileDraft.mobile || "").trim(),
        dob: profileDraft.dob || "",
        gender: profileDraft.gender || "",
        photoUrl,
      };
      await updateDoc(doc(db, "students", studentData.studentId), allowed);
      const updated = await getStudentById(studentData.studentId);
      setStudentData(updated);
      setProfileMessage("Profile updated successfully! ✅");
      setProfilePhotoFile(null);
    } catch (error: any) {
      setProfileMessage(`Unable to update profile: ${error?.message || "Unknown error"}`);
    } finally {
      setProfileSaving(false);
    }
  };

  const saveDirector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setDirectorSaving(true);
    setDirectorMessage("");
    try {
      let photoUrl = directorForm.photoUrl || "";
      if (directorPhotoFile) photoUrl = await uploadAcademicFile(directorPhotoFile, "director/profile");
      const payload = { ...directorForm, name: (directorForm.name || "").trim(), title: (directorForm.title || "Director").trim(), photoUrl, updatedAt: new Date().toISOString() };
      await setDoc(doc(db, "director", "profile"), payload, { merge: true });
      setDirector(payload);
      setDirectorForm(payload);
      setDirectorPhotoFile(null);
      setDirectorMessage("Director details saved successfully! ✅");
    } catch (error: any) {
      setDirectorMessage(`Unable to save director details: ${error?.message || "Unknown error"}`);
    } finally {
      setDirectorSaving(false);
    }
  };

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
          setProfileDraft(ownStudent || {});
          await loadDirector();

          const ownFee = await getFeeByStudentId(userProfile.studentId);

          setStudentFee(ownFee);

          const ownFeeHistory = await getStudentFeeHistory(
            userProfile.studentId
          );

          setStudentFeeHistory(ownFeeHistory);
          const directorySnapshot = await getDocs(collection(db, "studentDirectory"));
          setDirectoryStudents(directorySnapshot.docs.map((item: any) => ({ id: item.id, ...item.data() })) as Student[]);
          setHomework(await getHomework());
        } else {
          await loadDirector();
          const allStudents = await getStudents();

          setStudents(allStudents);
          setDirectoryStudents(allStudents);
          await Promise.all(allStudents.filter((s: Student) => s.studentId).map((s: Student) => setDoc(doc(db, "studentDirectory", s.studentId!), { studentId: s.studentId, name: s.name || "", className: s.className || "", batch: s.batch || "" }, { merge: true })));
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
    setProfileDraft({});
    setProfilePhotoFile(null);
    setShowStudentProfile(false);
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
      await setDoc(doc(db, "studentDirectory", studentId.trim()), { studentId: studentId.trim(), name: studentName.trim(), className: className.trim(), batch: batch.trim() }, { merge: true });

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

  const openCredentialForm = (student: Student) => {
    if (!isAdmin) return;
    setCredentialStudent(student);
    setNewStudentEmail(student.email || "");
    setNewStudentPassword("");
    setCredentialMessage("");
    setShowCredentialForm(true);
  };

  const saveStudentCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !credentialStudent?.authUid) {
      setCredentialMessage("Only the admin can change student login credentials.");
      return;
    }

    if (newStudentPassword && newStudentPassword.length < 6) {
      setCredentialMessage("Password must contain at least 6 characters.");
      return;
    }

    if (!newStudentEmail.trim() && !newStudentPassword) {
      setCredentialMessage("Enter a new email, password, or both.");
      return;
    }

    setSavingCredentials(true);
    setCredentialMessage("");

    try {
      const idToken = await user.getIdToken(true);
      const response = await fetch("/api/admin-student-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          studentAuthUid: credentialStudent.authUid,
          email: newStudentEmail.trim() || undefined,
          password: newStudentPassword || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Unable to change student credentials.");
      }

      const updatedStudents = await getStudents();
      setStudents(updatedStudents);
      setCredentialMessage("Student login credentials updated successfully! ✅");
      setNewStudentPassword("");
      setTimeout(() => {
        setShowCredentialForm(false);
        setCredentialStudent(null);
        setCredentialMessage("");
      }, 900);
    } catch (error: any) {
      console.error("Credential update error:", error);
      setCredentialMessage(
        error?.message || "Unable to change student login credentials."
      );
    } finally {
      setSavingCredentials(false);
    }
  };

  const loadHomework = async () => {
    setHomeworkLoading(true);
    setHomeworkMessage("");
    try {
      setHomework(await getHomework());
    } catch (error: any) {
      console.error("Homework loading error:", error);
      setHomeworkMessage(
        `Firebase Error: ${error?.code || "unknown-error"} | ${
          error?.message || "Unable to load homework"
        }`
      );
    } finally {
      setHomeworkLoading(false);
    }
  };

  const resetHomeworkForm = () => {
    setShowHomeworkForm(false);
    setEditingHomework(null);
    setHomeworkClass("");
    setHomeworkBatch("");
    setHomeworkSubject("");
    setHomeworkTitle("");
    setHomeworkDescription("");
    setHomeworkDate("");
    setHomeworkDueDate("");
    setHomeworkAssignedStudents([]);
    setHomeworkCompletion({});
  };

  const openAddHomework = () => {
    if (!isAdmin) return;
    resetHomeworkForm();
    setHomeworkDate(new Date().toISOString().slice(0, 10));
    setShowHomeworkForm(true);
  };

  const openEditHomework = (item: Homework) => {
    if (!isAdmin) return;
    setEditingHomework(item);
    setHomeworkClass(item.className || "");
    setHomeworkBatch(item.batch || "");
    setHomeworkSubject(item.subject || "");
    setHomeworkTitle(item.title || "");
    setHomeworkDescription(item.description || "");
    setHomeworkDate(item.homeworkDate || "");
    setHomeworkDueDate(item.dueDate || "");
    setHomeworkAssignedStudents((item as any).assignedStudentIds || []);
    setHomeworkCompletion((item as any).completion || {});
    setHomeworkMessage("");
    setShowHomeworkForm(true);
  };

  const saveHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setHomeworkMessage("Only the admin can manage homework.");
      return;
    }
    if (!homeworkClass || !homeworkTitle.trim() || !homeworkDescription.trim() || !homeworkDate) {
      setHomeworkMessage("Select a class and enter title, homework and date.");
      return;
    }

    const selectedDate = new Date(`${homeworkDate}T12:00:00`);
    const payload = {
      className: homeworkClass,
      batch: homeworkBatch.trim(),
      subject: homeworkSubject.trim(),
      title: homeworkTitle.trim(),
      description: homeworkDescription.trim(),
      homeworkDate,
      dueDate: homeworkDueDate || "",
      assignedStudentIds: homeworkAssignedStudents,
      completion: homeworkCompletion,
      day: selectedDate.toLocaleDateString("en-IN", { weekday: "long" }),
      year: selectedDate.getFullYear(),
      createdBy: profile?.name || "Admin",
    };

    setSavingHomework(true);
    setHomeworkMessage("");
    try {
      if (editingHomework?.id) {
        await updateHomework(editingHomework.id, payload);
        setHomeworkMessage("Homework updated successfully! ✅");
      } else {
        await addHomework(payload);
        setHomeworkMessage("Homework added successfully! ✅");
      }
      await loadHomework();
      resetHomeworkForm();
    } catch (error: any) {
      console.error("Homework save error:", error);
      setHomeworkMessage(
        `Firebase Error: ${error?.code || "unknown-error"} | ${
          error?.message || "Unable to save homework"
        }`
      );
    } finally {
      setSavingHomework(false);
    }
  };

  const removeHomework = async (item: Homework) => {
    if (!isAdmin || !item.id) return;
    if (!window.confirm(`Delete homework: ${item.title || "this homework"}?`)) return;
    try {
      await deleteHomework(item.id);
      await loadHomework();
      setHomeworkMessage("Homework deleted successfully. 🗑️");
    } catch (error: any) {
      console.error("Homework delete error:", error);
      setHomeworkMessage(
        `Firebase Error: ${error?.code || "unknown-error"} | ${
          error?.message || "Unable to delete homework"
        }`
      );
    }
  };

  useEffect(() => {
    if (page === "homework" && isAdmin) loadHomework();
  }, [page, isAdmin]);

  /* =========================================================
     SHARED ACADEMIC DATA
  ========================================================= */

  const loadTests = async () => {
    setTestsLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, "tests"), orderBy("date", "desc")));
      setTests(snapshot.docs.map((item: any) => ({ id: item.id, ...item.data() })) as Test[]);
    } catch (error: any) {
      console.error("Test loading error:", error);
      setTestMessage(`Unable to load tests: ${error?.message || "Unknown error"}`);
    } finally { setTestsLoading(false); }
  };

  const loadAttendance = async () => {
    setAttendanceLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, "attendance"), orderBy("date", "desc")));
      const rows = snapshot.docs.map((item: any) => ({ id: item.id, ...item.data() })) as AttendanceDay[];
      setAttendanceDays(rows);
      const selected = rows.find((row) => row.date === attendanceDate);
      setAttendanceRecords(selected?.records || {});
    } catch (error: any) {
      console.error("Attendance loading error:", error);
      setAttendanceMessage(`Unable to load attendance: ${error?.message || "Unknown error"}`);
    } finally { setAttendanceLoading(false); }
  };

  const loadNotices = async () => {
    try {
      const snapshot = await getDocs(query(collection(db, "notices"), orderBy("date", "desc")));
      setNotices(snapshot.docs.map((item: any) => ({ id: item.id, ...item.data() })) as Notice[]);
    } catch (error: any) {
      console.error("Notice loading error:", error);
      setNoticeStatus(`Unable to load notices: ${error?.message || "Unknown error"}`);
    }
  };

  const loadAcademicData = async () => {
    try {
      await Promise.all([loadTests(), loadAttendance(), loadNotices(), loadHomework()]);
    } catch (error) { console.error(error); }
  };

  const resetTestForm = () => {
    setShowTestForm(false); setEditingTest(null); setTestName(""); setTestSubject("");
    setTestClass(""); setTestBatch(""); setTestDate(new Date().toISOString().slice(0,10));
    setTestTotal("100"); setTestResults({}); setTestQuestionFile(null); setTestAnswerFile(null);
  };

  const openAddTest = () => { if (!isAdmin) return; resetTestForm(); setShowTestForm(true); };

  const openEditTest = (test: Test) => {
    if (!isAdmin) return;
    setEditingTest(test); setTestName(test.name || ""); setTestSubject(test.subject || "");
    setTestClass(test.className || ""); setTestBatch(test.batch || ""); setTestDate(test.date || "");
    setTestTotal(String(test.total || 100)); setTestResults(test.results || {}); setTestMessage("");
    setTestQuestionFile(null); setTestAnswerFile(null); setShowTestForm(true);
  };

  const uploadAcademicFile = async (file: File, folder: string) => {
    const storage = getStorage();
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const fileRef = storageRef(storage, `${folder}/${safeName}`);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  };

  const saveTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!testName.trim() || !testSubject.trim() || !testDate) { setTestMessage("Enter test name, subject and date."); return; }
    const total = Number(testTotal);
    if (!Number.isFinite(total) || total <= 0) { setTestMessage("Total marks must be greater than 0."); return; }
    setSavingTest(true); setTestMessage("");
    try {
      let questionPaperUrl = editingTest?.questionPaperUrl || "";
      let questionPaperName = editingTest?.questionPaperName || "";
      let answerSheetUrl = editingTest?.answerSheetUrl || "";
      let answerSheetName = editingTest?.answerSheetName || "";
      if (testQuestionFile) { questionPaperUrl = await uploadAcademicFile(testQuestionFile, "tests/question-papers"); questionPaperName = testQuestionFile.name; }
      if (testAnswerFile) { answerSheetUrl = await uploadAcademicFile(testAnswerFile, "tests/answer-sheets"); answerSheetName = testAnswerFile.name; }
      const payload = { name: testName.trim(), subject: testSubject.trim(), className: testClass.trim(), batch: testBatch.trim(), date: testDate, total, results: testResults, questionPaperUrl, questionPaperName, answerSheetUrl, answerSheetName, updatedAt: new Date().toISOString() };
      if (editingTest?.id) await updateDoc(doc(db, "tests", editingTest.id), payload);
      else await setDoc(doc(collection(db, "tests")), { ...payload, createdAt: new Date().toISOString() });
      await loadTests(); resetTestForm(); setTestMessage("Test and results saved successfully! ✅");
    } catch (error: any) {
      console.error("Test save error:", error);
      setTestMessage(`Unable to save test: ${error?.message || "Unknown error"}`);
    } finally { setSavingTest(false); }
  };

  const deleteTest = async (test: Test) => {
    if (!isAdmin || !test.id) return;
    if (!window.confirm(`Delete ${test.name || "this test"}?`)) return;
    await deleteDoc(doc(db, "tests", test.id));
    await loadTests(); setTestMessage("Test deleted.");
  };

  const saveAttendance = async () => {
    if (!isAdmin || !attendanceDate) return;
    const d = new Date(`${attendanceDate}T12:00:00`);
    try {
      await setDoc(doc(db, "attendance", attendanceDate), {
        date: attendanceDate, day: d.toLocaleDateString("en-IN", { weekday: "long" }), year: d.getFullYear(),
        records: attendanceRecords, updatedAt: new Date().toISOString()
      }, { merge: true });
      await loadAttendance(); setAttendanceMessage("Attendance saved successfully! ✅");
    } catch (error: any) { setAttendanceMessage(`Unable to save attendance: ${error?.message || "Unknown error"}`); }
  };

  const setAllAttendance = (status: "present" | "absent") => {
    const next: Record<string, "present" | "absent"> = {};
    students.forEach((student) => { if (student.studentId) next[student.studentId] = status; });
    setAttendanceRecords(next);
  };

  const saveNotice = async (e: React.FormEvent) => {
    e.preventDefault(); if (!isAdmin) return;
    if (!noticeTitle.trim() || !noticeMessage.trim()) { setNoticeStatus("Enter notice title and message."); return; }
    setNoticeSaving(true); setNoticeStatus("");
    try {
      const ref = doc(collection(db, "notices"));
      await setDoc(ref, { title: noticeTitle.trim(), message: noticeMessage.trim(), priority: noticePriority, date: noticeDate, audience: "all", createdAt: new Date().toISOString() });
      setNoticeTitle(""); setNoticeMessage(""); setNoticePriority("normal"); setNoticeDate(new Date().toISOString().slice(0,10));
      await loadNotices(); setNoticeStatus("Notice published successfully! ✅");
    } catch (error: any) { setNoticeStatus(`Unable to publish notice: ${error?.message || "Unknown error"}`); }
    finally { setNoticeSaving(false); }
  };

  const deleteNotice = async (notice: Notice) => {
    if (!isAdmin || !notice.id) return;
    if (!window.confirm(`Delete notice: ${notice.title || "this notice"}?`)) return;
    await deleteDoc(doc(db, "notices", notice.id));
    await loadNotices(); setNoticeStatus("Notice deleted.");
  };

  const homeworkForStudent = (student: Student | null) => homework.filter((item) => {
    const classMatch = !item.className || item.className === student?.className;
    const batchMatch = !item.batch || item.batch === student?.batch;
    const assigned = Array.isArray((item as any).assignedStudentIds) ? (item as any).assignedStudentIds : null;
    return classMatch && batchMatch && (!assigned || assigned.length === 0 || assigned.includes(student?.studentId));
  });

  const homeworkDefaulters = (item: Homework) => {
    const completion = ((item as any).completion || {}) as Record<string, boolean>;
    const roster = students.length ? students : directoryStudents;
    return roster.filter((s) => s.studentId && completion[s.studentId] !== true && homeworkForStudent(s).some((h) => h.id === item.id));
  };

  const studentAverageMap = () => {
    const sums: Record<string, { total: number; count: number }> = {};
    const roster = students.length ? students : directoryStudents;
    roster.forEach((s) => { if (s.studentId) sums[s.studentId] = { total: 0, count: 0 }; });
    tests.forEach((test) => (Object.entries(test.results || {}) as [string, TestResult][]).forEach(([sid, result]) => {
      if (result?.present && result?.marks !== null && result?.marks !== undefined && sums[sid]) {
        const pct = (Number(result.marks) / Number(test.total || 0)) * 100;
        if (Number.isFinite(pct)) { sums[sid].total += pct; sums[sid].count += 1; }
      }
    }));
    return Object.fromEntries(Object.entries(sums).map(([sid, v]) => [sid, v.count ? v.total / v.count : 0]));
  };

  useEffect(() => {
    if (!user) return;
    loadAcademicData();
  }, [user, isAdmin]);

  useEffect(() => {
    if (!isAdmin && page === "attendance") loadAttendance();
    if (!isAdmin && page === "tests") loadTests();
    if (page === "notices") loadNotices();
  }, [page, isAdmin]);

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
      await setDoc(doc(db, "studentDirectory", editingStudent.studentId), { studentId: editingStudent.studentId, name: editName.trim(), className: editClassName.trim(), batch: editBatch.trim() }, { merge: true });

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
          {showStudentProfile && <div style={styles.card}>
            <div style={styles.formHeader}><div><h2>👤 Edit My Profile</h2><p style={styles.muted}>Update your personal information. Academic records remain controlled by admin.</p></div><button style={styles.closeButton} onClick={() => setShowStudentProfile(false)}>✕</button></div>
            <form onSubmit={saveStudentProfile}>
              <div style={styles.formGrid}>
                <FormField label="Student Name" value={profileDraft.name || ""} onChange={v=>setProfileDraft(p=>({...p,name:v}))} />
                <FormField label="Father's Name" value={profileDraft.fatherName || ""} onChange={v=>setProfileDraft(p=>({...p,fatherName:v}))} required={false} />
                <FormField label="Mother's Name" value={profileDraft.motherName || ""} onChange={v=>setProfileDraft(p=>({...p,motherName:v}))} required={false} />
                <FormField label="Mobile Number" value={profileDraft.mobile || ""} onChange={v=>setProfileDraft(p=>({...p,mobile:v}))} required={false} />
                <FormField label="Date of Birth" value={profileDraft.dob || ""} onChange={v=>setProfileDraft(p=>({...p,dob:v}))} type="date" required={false} />
                <FormField label="Gender" value={profileDraft.gender || ""} onChange={v=>setProfileDraft(p=>({...p,gender:v}))} type="select" required={false} options={[{label:"Select",value:""},{label:"Male",value:"Male"},{label:"Female",value:"Female"},{label:"Other",value:"Other"}]} />
              </div>
              <label style={styles.label}>Address</label><textarea style={{...styles.input,minHeight:80}} value={profileDraft.address || ""} onChange={e=>setProfileDraft(p=>({...p,address:e.target.value}))} />
              <label style={styles.uploadBox}>📷 Profile Picture<input type="file" accept="image/*" onChange={e=>setProfilePhotoFile(e.target.files?.[0] || null)} /><small>{profilePhotoFile?.name || "Choose a photo"}</small></label>
              {profileMessage && <div style={profileMessage.includes("successfully") ? styles.successBox : styles.errorBox}>{profileMessage}</div>}
              <div style={styles.formActions}><button type="button" style={styles.secondaryButton} onClick={()=>setShowStudentProfile(false)}>Cancel</button><button type="submit" style={styles.primaryButtonSmall} disabled={profileSaving}>{profileSaving?"Saving...":"💾 Save Profile"}</button></div>
            </form>
          </div>}
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

            <StatCard title="My Rank" value={(() => { const av = studentAverageMap(); const roster = students.length ? students : directoryStudents; const ranked = roster.map(s => ({ id: s.studentId || "", avg: av[s.studentId || ""] || 0 })).filter(x => x.avg > 0).sort((a,b) => b.avg-a.avg); const idx = ranked.findIndex(x => x.id === studentData?.studentId); return idx >= 0 ? `#${idx + 1}` : "-"; })()} icon="🏆" />
          </div>

          <div style={styles.twoColumn}>
            <div style={styles.card}>
              <div style={styles.profileHero}>
                <div style={styles.avatarLarge}>
                  {studentData?.photoUrl ? <img src={studentData.photoUrl} alt="Student" style={styles.avatarImage} /> : "👤"}
                </div>
                <div style={{flex:1}}>
                  <h2 style={{margin:"0 0 4px"}}>{studentData?.name || profile.name || "Student"}</h2>
                  <p style={styles.muted}>ID: {profile.studentId || studentData?.studentId || "N/A"} · {studentData?.className || "Class not set"}</p>
                </div>
                <button style={styles.secondaryButton} onClick={() => { setProfileDraft(studentData || {}); setProfileMessage(""); setShowStudentProfile(true); }}>✏️ Edit Profile</button>
              </div>
              <InfoRow label="Father's Name" value={studentData?.fatherName || "Not added"} />
              <InfoRow label="Mother's Name" value={studentData?.motherName || "Not added"} />
              <InfoRow label="Mobile" value={studentData?.mobile || "Not added"} />
              <InfoRow label="Address" value={studentData?.address || "Not added"} />
              <InfoRow label="Email" value={profile.email || user.email || "N/A"} />
            </div>

            <div style={styles.card}>
              <h2>🎓 Coaching Director</h2>
              {director ? <div style={styles.directorCard}>
                <div style={styles.avatarDirector}>{director.photoUrl ? <img src={director.photoUrl} alt="Director" style={styles.avatarImage} /> : "🎓"}</div>
                <div><h3 style={{margin:"0 0 4px"}}>{director.name || "Director"}</h3><p style={styles.muted}>{director.title || "Director"}</p>{director.mobile && <div>📞 {director.mobile}</div>}{director.email && <div>✉️ {director.email}</div>}{director.address && <div>📍 {director.address}</div>}</div>
              </div> : <div style={styles.emptyBox}>Director details have not been added yet.</div>}
              {director?.message && <div style={styles.infoNotice}>💬 {director.message}</div>}
            </div>

            <div style={styles.card}>
              <h2>📢 Notices</h2>
              {notices.length === 0 ? <div style={styles.emptyBox}>No notices yet.</div> : notices.slice(0, 5).map((notice) => (
                <div key={notice.id} style={styles.noticeItem}>
                  <div style={styles.homeworkMeta}><strong>{notice.title}</strong><span>{notice.date}</span></div>
                  <p style={{ margin: "7px 0" }}>{notice.message}</p>
                  <span style={styles.noticeBadge}>{(notice.priority || "normal").toUpperCase()}</span>
                </div>
              ))}

              <h2 style={{ marginTop: 25 }}>📚 Homework</h2>

              {homework.filter((item) => {
                const classMatch = !item.className || item.className === studentData?.className;
                const batchMatch = !item.batch || item.batch === studentData?.batch;
                return classMatch && batchMatch;
              }).length === 0 ? (
                <div style={styles.emptyBox}>No homework assigned for your class yet.</div>
              ) : (
                <div>
                  {homeworkForStudent(studentData)
                    .slice(0, 8)
                    .map((item) => (
                      <div key={item.id} style={styles.homeworkItem}>
                        <div style={styles.homeworkMeta}>
                          <strong>{item.subject || "Homework"}</strong>
                          <span>{item.day}, {item.homeworkDate} · {item.year}</span>
                        </div>
                        <h3 style={{ margin: "8px 0" }}>{item.title}</h3>
                        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{item.description}</p>
                        {item.dueDate && <small style={styles.muted}>Due: {item.dueDate}</small>}
                        <div style={{ marginTop: 10 }}><span style={((item as any).completion || {})[studentData?.studentId || ""] ? styles.doneBadge : styles.pendingBadge}>{((item as any).completion || {})[studentData?.studentId || ""] ? "✓ Homework Done" : "⚠ Homework Not Done"}</span></div>
                      </div>
                    ))}
                </div>
              )}
              {homeworkForStudent(studentData).some(item => !((item as any).completion || {})[studentData?.studentId || ""]) && <div style={styles.warningBox}><strong>⚠ Your Pending Homework</strong><div style={{marginTop:6}}>{homeworkForStudent(studentData).filter(item => !((item as any).completion || {})[studentData?.studentId || ""]).slice(0,6).map(item => <div key={item.id}>🔴 {item.title} · Due {item.dueDate || "No due date"}</div>)}</div></div>}
            </div>
          </div>

          <div style={styles.card}>
            <div className="sectionTitleRow"><div><h2 style={{margin:"0 0 4px"}}>📅 My Attendance Calendar</h2><p style={styles.muted}>Green = Present · Red = Absent</p></div></div>
            {(() => { const sid=studentData?.studentId || ""; const rows=attendanceDays.filter(d=>d.records?.[sid]); const present=rows.filter(d=>d.records?.[sid]==="present").length; const pct=rows.length?present/rows.length*100:0; const [ys,ms]=studentCalendarMonth.split("-").map(Number); const y=ys||new Date().getFullYear(), m=(ms||new Date().getMonth()+1)-1; const first=new Date(y,m,1).getDay(); const days=new Date(y,m+1,0).getDate(); const monthKey=`${y}-${String(m+1).padStart(2,"0")}`; const map=Object.fromEntries(rows.filter(r=>(r.date||"").startsWith(monthKey)).map(r=>[Number((r.date||"").slice(-2)),r.records?.[sid]])); return <><div style={styles.feeHistoryGrid}><div><span style={styles.smallLabel}>Present</span><strong>{present}</strong></div><div><span style={styles.smallLabel}>Absent</span><strong>{Math.max(rows.length-present,0)}</strong></div><div><span style={styles.smallLabel}>Attendance</span><strong>{pct.toFixed(0)}%</strong></div><div><span style={styles.smallLabel}>Recorded Days</span><strong>{rows.length}</strong></div></div><div style={styles.calendarCard}><div style={styles.calendarToolbar}><h3 style={{margin:0}}>{new Date(y,m,1).toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</h3><input style={styles.monthInput} type="month" value={studentCalendarMonth} onChange={e=>setStudentCalendarMonth(e.target.value)} /></div><div style={styles.calendarGrid}>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} style={styles.calendarHead}>{d}</div>)}{Array.from({length:first}).map((_,i)=><div key={"e"+i}/>) }{Array.from({length:days},(_,i)=>i+1).map(day=>{const status=map[day];return <div key={day} title={status||"No record"} style={{...styles.calendarDay,...(status==="present"?styles.calendarPresent:status==="absent"?styles.calendarAbsent:{})}}>{day}</div>})}</div></div></>; })()}
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
            <div style={styles.sectionTitleRow}><div><h2 style={{ margin: 0 }}>📝 My Test Results</h2><p style={styles.muted}>Your performance across all tests</p></div></div>
            {tests.length === 0 ? <div style={styles.emptyBox}>No test results published yet.</div> : (
              <div style={styles.tableWrapper}><table style={styles.table}><thead><tr><th style={styles.th}>Test</th><th style={styles.th}>Subject</th><th style={styles.th}>Date</th><th style={styles.th}>Marks</th><th style={styles.th}>Percentage</th></tr></thead><tbody>
                {tests.map((test) => { const r = (test.results || {})[studentData?.studentId || ""]; const pct = r?.present && r?.marks != null ? (Number(r.marks) / Number(test.total || 1)) * 100 : null; return <tr key={test.id}><td style={styles.td}>{test.name}</td><td style={styles.td}>{test.subject}</td><td style={styles.td}>{test.date}</td><td style={styles.td}>{r?.present ? `${r.marks ?? "-"} / ${test.total}` : "Absent"}</td><td style={styles.td}>{pct == null ? "-" : `${pct.toFixed(1)}%`}</td></tr>; })}
              </tbody></table></div>
            )}
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

    const attendanceValues = students.map((s) => {
      if (!s.studentId) return 0;
      const rows = attendanceDays.filter((d) => d.records?.[s.studentId]);
      return rows.length ? (rows.filter((d) => d.records?.[s.studentId] === "present").length / rows.length) * 100 : 0;
    });
    const averageAttendance = totalStudents > 0
      ? Math.round(attendanceValues.reduce((a, b) => a + b, 0) / totalStudents)
      : 0;

    const computedAverages = studentAverageMap();
    const averageMarks = totalStudents > 0
      ? Math.round(Object.values(computedAverages).reduce((a, b) => a + Number(b || 0), 0) / totalStudents)
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
          <div style={styles.sectionTitleRow}><div><h2 style={{margin:"0 0 4px"}}>⚡ Quick Overview</h2><p style={styles.muted}>Your coaching centre at a glance.</p></div></div>
          <div style={styles.quickGrid}>
            {[
              ["👨‍🎓","Students",totalStudents,"students"],
              ["📝","Tests",tests.length,"tests"],
              ["📅","Attendance Records",attendanceDays.length,"attendance"],
              ["📚","Homework",homework.length,"homework"],
              ["📢","Notices",notices.length,"notices"],
              ["💰","Pending Fees",`₹${totalFeesDue}`,"fees"],
            ].map(([icon,label,value,target])=><button key={String(target)} style={styles.quickAction} onClick={()=>setPage(String(target))}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div><b>›</b></button>)}
          </div>
        </div>

        {isAdmin && <div style={styles.card}>
          <div style={styles.sectionTitleRow}><div><h2 style={{margin:"0 0 4px"}}>🎓 Director Profile</h2><p style={styles.muted}>Visible to every student. Only admin can edit it.</p></div></div>
          <form onSubmit={saveDirector}>
            <div style={styles.directorEditor}>
              <div style={styles.avatarDirector}>{directorForm.photoUrl ? <img src={directorForm.photoUrl} alt="Director" style={styles.avatarImage}/> : "🎓"}</div>
              <div style={{flex:1}}>
                <div style={styles.formGrid}>
                  <FormField label="Director Name" value={directorForm.name || ""} onChange={v=>setDirectorForm(d=>({...d,name:v}))}/>
                  <FormField label="Title" value={directorForm.title || ""} onChange={v=>setDirectorForm(d=>({...d,title:v}))} required={false}/>
                  <FormField label="Mobile" value={directorForm.mobile || ""} onChange={v=>setDirectorForm(d=>({...d,mobile:v}))} required={false}/>
                  <FormField label="Email" value={directorForm.email || ""} onChange={v=>setDirectorForm(d=>({...d,email:v}))} required={false}/>
                  <FormField label="Address" value={directorForm.address || ""} onChange={v=>setDirectorForm(d=>({...d,address:v}))} required={false}/>
                </div>
              </div>
            </div>
            <label style={styles.uploadBox}>📷 Director Profile Picture<input type="file" accept="image/*" onChange={e=>setDirectorPhotoFile(e.target.files?.[0] || null)}/><small>{directorPhotoFile?.name || "Choose photo"}</small></label>
            <label style={styles.label}>Director Message</label><textarea style={{...styles.input,minHeight:70}} value={directorForm.message || ""} onChange={e=>setDirectorForm(d=>({...d,message:e.target.value}))} placeholder="Welcome message for students..."/>
            {directorMessage && <div style={directorMessage.includes("successfully")?styles.successBox:styles.errorBox}>{directorMessage}</div>}
            <div style={styles.formActions}><button style={styles.primaryButtonSmall} disabled={directorSaving}>{directorSaving?"Saving...":"💾 Save Director Profile"}</button></div>
          </form>
        </div>}

        <div style={styles.card}>
          <h2>🕒 Recent Activity</h2>
          <p>✅ Student management active</p><p>📝 Test & result management active</p><p>📅 Attendance management active</p><p>💰 Fee management active</p><p>📚 Homework management active</p><p>📢 Notice board active</p>
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

        {showCredentialForm && credentialStudent && isAdmin && (
          <div style={styles.card}>
            <div style={styles.formHeader}>
              <div>
                <h2>🔐 Change Student Login</h2>
                <p style={styles.muted}>
                  {credentialStudent.name} · {credentialStudent.studentId}
                </p>
              </div>
              <button style={styles.closeButton} onClick={() => setShowCredentialForm(false)}>✕</button>
            </div>

            <form onSubmit={saveStudentCredentials}>
              <div style={styles.formGrid}>
                <FormField
                  label="Login Username / Email"
                  value={newStudentEmail}
                  onChange={setNewStudentEmail}
                  placeholder="student@tmail.com"
                  type="email"
                />
                <FormField
                  label="New Password"
                  value={newStudentPassword}
                  onChange={setNewStudentPassword}
                  placeholder="Minimum 6 characters"
                  type="password"
                />
              </div>
              <p style={styles.muted}>Leave a field blank if you do not want to change it.</p>
              {credentialMessage && (
                <div style={credentialMessage.includes("successfully") ? styles.successBox : styles.errorBox}>
                  {credentialMessage}
                </div>
              )}
              <div style={styles.formActions}>
                <button type="button" style={styles.secondaryButton} onClick={() => setShowCredentialForm(false)}>Cancel</button>
                <button type="submit" style={styles.primaryButtonSmall} disabled={savingCredentials}>
                  {savingCredentials ? "Saving..." : "💾 Save Login Changes"}
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
                            {student.authUid && (
                              <button
                                style={styles.historyButton}
                                onClick={() => openCredentialForm(student)}
                              >
                                🔐 Change Login
                              </button>
                            )}
                            {student.email && (
                              <button
                                style={styles.historyButton}
                                onClick={() => handlePasswordReset(student)}
                              >
                                📩 Send Reset Link
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
     HOMEWORK PAGE
  ========================================================= */

  const homeworkPage = () => {
    const classOptions = Array.from(
      new Set(students.map((student) => student.className).filter(Boolean))
    );
    const batchOptions = Array.from(
      new Set(students.map((student) => student.batch).filter(Boolean))
    );

    return (
      <>
        <div style={styles.pageHeader}>
          <div>
            <h1>📚 Homework</h1>
            <p style={styles.muted}>Assign and manage homework by class and batch</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={styles.secondaryButton} onClick={loadHomework}>
              🔄 Refresh
            </button>
            <button style={styles.primaryButtonSmall} onClick={openAddHomework}>
              ➕ Add Homework
            </button>
          </div>
        </div>

        {homeworkMessage && (
          <div style={homeworkMessage.includes("successfully") ? styles.successBox : styles.errorBox}>
            {homeworkMessage}
          </div>
        )}

        {showHomeworkForm && (
          <div style={styles.card}>
            <div style={styles.formHeader}>
              <div>
                <h2>{editingHomework ? "✏️ Edit Homework" : "➕ Add Homework"}</h2>
                <p style={styles.muted}>Date, day and year are saved automatically.</p>
              </div>
              <button style={styles.closeButton} onClick={resetHomeworkForm}>✕</button>
            </div>
            <form onSubmit={saveHomework}>
              <div style={styles.formGrid}>
                <FormField label="Class *" value={homeworkClass} onChange={setHomeworkClass} placeholder="Select class" type="select" options={classOptions.map((value) => ({ label: value as string, value: value as string }))} />
                <FormField label="Batch" value={homeworkBatch} onChange={setHomeworkBatch} placeholder="All batches" type="select" options={[{label:"All batches", value:""}, ...batchOptions.map((value) => ({label:value as string, value:value as string}))]} />
                <FormField label="Subject" value={homeworkSubject} onChange={setHomeworkSubject} placeholder="Physics / Chemistry / Maths" />
                <FormField label="Title *" value={homeworkTitle} onChange={setHomeworkTitle} placeholder="Example: Chapter 3 Questions" />
                <FormField label="Homework Date *" value={homeworkDate} onChange={setHomeworkDate} placeholder="YYYY-MM-DD" type="date" />
                <FormField label="Due Date" value={homeworkDueDate} onChange={setHomeworkDueDate} placeholder="Optional" type="date" />
              </div>
              <label style={styles.label}>Assign to Students</label>
              <div style={styles.studentPicker}>
                <div style={styles.pickerToolbar}>
                  <button type="button" style={styles.secondaryButton} onClick={() => setHomeworkAssignedStudents(students.filter(s => s.studentId && (!homeworkClass || s.className === homeworkClass) && (!homeworkBatch || s.batch === homeworkBatch)).map(s => s.studentId!))}>Select all matching</button>
                  <button type="button" style={styles.secondaryButton} onClick={() => setHomeworkAssignedStudents([])}>Clear</button>
                </div>
                <div style={styles.studentPickerGrid}>
                  {students.filter(s => (!homeworkClass || s.className === homeworkClass) && (!homeworkBatch || s.batch === homeworkBatch)).map(s => s.studentId ? (
                    <label key={s.studentId} style={styles.studentPickerItem}><input type="checkbox" checked={homeworkAssignedStudents.includes(s.studentId)} onChange={(e) => setHomeworkAssignedStudents(prev => e.target.checked ? [...prev, s.studentId!] : prev.filter(id => id !== s.studentId))} /> <span>{s.name} <small>({s.className}{s.batch ? ` · ${s.batch}` : ""})</small></span></label>
                  ) : null)}
                </div>
                <p style={styles.muted}>If no student is selected, the homework is assigned to the whole selected class/batch.</p>
              </div>

              <label style={styles.label}>Homework / Instructions *</label>
              <textarea
                style={{ ...styles.input, minHeight: 130, resize: "vertical" }}
                value={homeworkDescription}
                onChange={(e) => setHomeworkDescription(e.target.value)}
                placeholder="Write the homework, questions, pages, instructions, etc."
                required
              />
              <div style={styles.formActions}>
                <button type="button" style={styles.secondaryButton} onClick={resetHomeworkForm}>Cancel</button>
                <button type="submit" style={styles.primaryButtonSmall} disabled={savingHomework}>
                  {savingHomework ? "Saving..." : editingHomework ? "💾 Update Homework" : "💾 Add Homework"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div style={styles.card}>
          <h2>All Homework</h2>
          {homeworkLoading ? (
            <div style={styles.emptyBox}>Loading homework...</div>
          ) : homework.length === 0 ? (
            <div style={styles.emptyBox}>No homework added yet.</div>
          ) : (
            <div style={styles.homeworkList}>
              {homework.map((item) => (
                <div key={item.id} style={styles.homeworkItem}>
                  <div style={styles.homeworkMeta}>
                    <strong>{item.className}{item.batch ? ` · ${item.batch}` : " · All batches"}</strong>
                    <span>{item.day}, {item.homeworkDate} · {item.year}</span>
                  </div>
                  <h3 style={{ margin: "8px 0 4px" }}>{item.subject ? `${item.subject}: ` : ""}{item.title}</h3>
                  <p style={{ margin: "0 0 8px", whiteSpace: "pre-wrap" }}>{item.description}</p>
                  {item.dueDate && <div style={styles.muted}>Due: {item.dueDate}</div>}
                  <div style={styles.completionSummary}><strong>{homeworkDefaulters(item).length}</strong> not completed · <strong>{students.filter(s => s.studentId && homeworkForStudent(s).some(h => h.id === item.id)).length}</strong> assigned</div>
                  <div style={styles.defaulterList}>
                    {students.filter(s => s.studentId && homeworkForStudent(s).some(h => h.id === item.id)).map(s => { const done = Boolean(((item as any).completion || {})[s.studentId!]); return <button key={s.studentId} type="button" style={done ? styles.doneStudentButton : styles.notDoneStudentButton} onClick={async () => { if (!isAdmin || !item.id) return; const next = { ...(((item as any).completion || {}) as Record<string, boolean>), [s.studentId!]: !done }; await updateHomework(item.id, { ...(item as any), completion: next }); await loadHomework(); }}>{done ? "✓" : "○"} {s.name}</button>; })}
                  </div>
                  {homeworkDefaulters(item).length > 0 && <div style={styles.warningBox}>⚠ Homework Defaulters: {homeworkDefaulters(item).map(s => s.name).join(", ")}</div>}
                  <div style={styles.formActions}>
                    <button style={styles.editButton} onClick={() => openEditHomework(item)}>✏️ Edit</button>
                    <button style={styles.deleteButton} onClick={() => removeHomework(item)}>🗑️ Delete</button>
                  </div>
                </div>
              ))}
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
     TESTS PAGE
  ========================================================= */
  const testsPage = () => {
    const averages = studentAverageMap();
    const ranking = students.map(s => ({ ...s, computedAverage: averages[s.studentId || ""] || 0 })).sort((a,b) => b.computedAverage - a.computedAverage);
    return <>
      <div style={styles.pageHeader}><div><h1>📝 Tests & Results</h1><p style={styles.muted}>Create tests, enter marks, upload papers and rank every student across every class.</p></div>{isAdmin && <button style={styles.primaryButtonSmall} onClick={openAddTest}>➕ Create Test</button>}</div>
      {testMessage && <div style={testMessage.includes("successfully") ? styles.successBox : styles.errorBox}>{testMessage}</div>}
      {showTestForm && <div style={styles.card}><div style={styles.formHeader}><div><h2>{editingTest ? "✏️ Edit Test" : "➕ New Test"}</h2><p style={styles.muted}>Marks and percentages update automatically.</p></div><button style={styles.closeButton} onClick={resetTestForm}>✕</button></div>
        <form onSubmit={saveTest}><div style={styles.formGrid}><FormField label="Test Name *" value={testName} onChange={setTestName} placeholder="Unit Test 1"/><FormField label="Subject *" value={testSubject} onChange={setTestSubject} placeholder="Mathematics"/><FormField label="Class" value={testClass} onChange={setTestClass} placeholder="All classes" type="select" options={[{label:"All classes",value:""}, ...Array.from(new Set(students.map(s=>s.className).filter(Boolean))).map(v=>({label:v as string,value:v as string}))]}/><FormField label="Batch" value={testBatch} onChange={setTestBatch} placeholder="All batches"/><FormField label="Test Date *" value={testDate} onChange={setTestDate} type="date"/><FormField label="Total Marks *" value={testTotal} onChange={setTestTotal} type="number"/></div>
          <div style={styles.uploadGrid}><label style={styles.uploadBox}>📄 Question Paper<input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e=>setTestQuestionFile(e.target.files?.[0] || null)}/><small>{testQuestionFile?.name || editingTest?.questionPaperName || "Choose file"}</small></label><label style={styles.uploadBox}>📝 Answer Sheet / Solution<input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e=>setTestAnswerFile(e.target.files?.[0] || null)}/><small>{testAnswerFile?.name || editingTest?.answerSheetName || "Choose file"}</small></label></div>
          <h3 style={{marginTop:24}}>Student Marks & Attendance</h3><div style={styles.tableWrapper}><table style={styles.table}><thead><tr><th style={styles.th}>Student</th><th style={styles.th}>Class</th><th style={styles.th}>Present?</th><th style={styles.th}>Marks / {Number(testTotal)||0}</th><th style={styles.th}>%</th></tr></thead><tbody>{students.filter(s=>(!testClass || s.className===testClass)&&(!testBatch || s.batch===testBatch)).map(s=>{if(!s.studentId)return null; const r=testResults[s.studentId]||{present:true,marks:null}; const pct=r.present&&r.marks!=null?(Number(r.marks)/Number(testTotal||1))*100:null; return <tr key={s.studentId}><td style={styles.td}>{s.name}</td><td style={styles.td}>{s.className}</td><td style={styles.td}><input type="checkbox" checked={r.present!==false} onChange={e=>setTestResults(prev=>({...prev,[s.studentId!]:{...r,present:e.target.checked,marks:e.target.checked?r.marks:null}}))}/> {r.present===false?"Absent":"Present"}</td><td style={styles.td}><input style={styles.compactInput} type="number" min="0" max={Number(testTotal)||0} disabled={r.present===false} value={r.marks ?? ""} onChange={e=>setTestResults(prev=>({...prev,[s.studentId!]:{...r,present:true,marks:e.target.value===""?null:Number(e.target.value)}}))}/></td><td style={styles.td}>{pct==null?"-":`${pct.toFixed(1)}%`}</td></tr>})}</tbody></table></div>
          <div style={styles.formActions}><button type="button" style={styles.secondaryButton} onClick={resetTestForm}>Cancel</button><button type="submit" style={styles.primaryButtonSmall} disabled={savingTest}>{savingTest?"Saving...":"💾 Save Test & Results"}</button></div>
        </form></div>}
      <div style={styles.card}><div style={styles.sectionTitleRow}><div><h2>📚 Test Library</h2><p style={styles.muted}>Browse tests class-wise and subject-wise.</p></div></div><div style={styles.filterBar}><select style={styles.filterInput} value={testLibraryClass} onChange={e=>setTestLibraryClass(e.target.value)}><option value="">All Classes</option>{Array.from(new Set(students.map(s=>s.className).filter(Boolean))).sort().map(v=><option key={v as string} value={v as string}>{v}</option>)}</select><select style={styles.filterInput} value={testLibrarySubject} onChange={e=>setTestLibrarySubject(e.target.value)}><option value="">All Subjects</option>{Array.from(new Set(tests.map(t=>t.subject).filter(Boolean))).sort().map(v=><option key={v as string} value={v}>{v}</option>)}</select></div>{(() => { const filteredTests=tests.filter(t=>(!testLibraryClass || !t.className || t.className===testLibraryClass)&&(!testLibrarySubject || t.subject===testLibrarySubject)); return testsLoading?<div style={styles.emptyBox}>Loading tests...</div>:filteredTests.length===0?<div style={styles.emptyBox}>No tests match the selected filters.</div>:filteredTests.map(test=>{const results=Object.values(test.results||{}) as TestResult[];const present=results.filter(r=>r?.present).length;const entered=results.filter(r=>r?.present&&r?.marks!=null);const avg=entered.length?entered.reduce((sum,r)=>sum+(Number(r.marks)/Number(test.total||1))*100,0)/entered.length:0;return <div key={test.id} style={styles.testCard}><div><div style={styles.homeworkMeta}><strong>{test.subject} · {test.name}</strong><span>{test.date}</span></div><p style={styles.muted}>{test.className||"All classes"}{test.batch?` · ${test.batch}`:""} · {present} present · {entered.length} marks entered · Test average {avg.toFixed(1)}%</p></div><div style={styles.linkRow}>{test.questionPaperUrl&&<a style={styles.linkButton} href={test.questionPaperUrl} target="_blank" rel="noreferrer">📄 Question Paper</a>}{test.answerSheetUrl&&<a style={styles.linkButton} href={test.answerSheetUrl} target="_blank" rel="noreferrer">📝 Answer Sheet</a>}{isAdmin&&<><button style={styles.editButton} onClick={()=>openEditTest(test)}>✏️ Edit</button><button style={styles.deleteButton} onClick={()=>deleteTest(test)}>🗑️ Delete</button></>}</div></div>})})()}</div>
      <div style={styles.card}><h2>🏆 Overall Ranking · All Classes</h2><p style={styles.muted}>Average percentage across tests where the student was present and marks were entered.</p><div style={styles.tableWrapper}><table style={styles.table}><thead><tr><th style={styles.th}>Rank</th><th style={styles.th}>Student</th><th style={styles.th}>Class</th><th style={styles.th}>Tests Counted</th><th style={styles.th}>Average %</th></tr></thead><tbody>{ranking.filter(s=>s.computedAverage>0).map((s,i)=><tr key={s.studentId||s.id}><td style={styles.td}><strong>#{i+1}</strong></td><td style={styles.td}>{s.name}</td><td style={styles.td}>{s.className}</td><td style={styles.td}>{tests.filter(t=>{const r=(t.results||{})[s.studentId||""];return r?.present&&r.marks!=null}).length}</td><td style={styles.td}><strong>{s.computedAverage.toFixed(2)}%</strong></td></tr>)}</tbody></table></div></div>
    </>;
  };

  const attendancePage = () => {
    const selected = attendanceDays.find(a=>a.date===attendanceDate);
    const historyForStudent = (sid:string) => attendanceDays.filter(d=>d.records?.[sid]).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    return <>
      <div style={styles.pageHeader}><div><h1>📅 Attendance</h1><p style={styles.muted}>Daily present/absent register with student-wise history.</p></div>{isAdmin&&<div style={{display:"flex",gap:8}}><button style={styles.secondaryButton} onClick={()=>setAllAttendance("present")}>✓ Mark All Present</button><button style={styles.secondaryButton} onClick={()=>setAllAttendance("absent")}>✕ Mark All Absent</button><button style={styles.primaryButtonSmall} onClick={saveAttendance}>💾 Save Attendance</button></div>}</div>
      {attendanceMessage&&<div style={attendanceMessage.includes("successfully")?styles.successBox:styles.errorBox}>{attendanceMessage}</div>}
      <div style={styles.card}><div style={styles.formGrid}><FormField label="Attendance Date" value={attendanceDate} onChange={(v)=>{setAttendanceDate(v);const row=attendanceDays.find(a=>a.date===v);setAttendanceRecords(row?.records||{});}} type="date"/></div>{attendanceLoading?<div style={styles.emptyBox}>Loading attendance...</div>:<div style={styles.tableWrapper}><table style={styles.table}><thead><tr><th style={styles.th}>Student</th><th style={styles.th}>Class</th><th style={styles.th}>Batch</th><th style={styles.th}>Status</th></tr></thead><tbody>{students.map(s=>s.studentId?<tr key={s.studentId}><td style={styles.td}>{s.name}</td><td style={styles.td}>{s.className}</td><td style={styles.td}>{s.batch||"-"}</td><td style={styles.td}><button disabled={!isAdmin} style={(attendanceRecords[s.studentId]||"absent")==="present"?styles.doneStudentButton:styles.notDoneStudentButton} onClick={()=>setAttendanceRecords(prev=>({...prev,[s.studentId!]:prev[s.studentId!]==="present"?"absent":"present"}))}>{(attendanceRecords[s.studentId]||"absent")==="present"?"✓ Present":"○ Absent"}</button></td></tr>:null)}</tbody></table></div>}</div>
      <div style={styles.card}><h2>📊 Attendance Summary</h2><div style={styles.grid}>{students.map(s=>{if(!s.studentId)return null;const rows=historyForStudent(s.studentId);const present=rows.filter(r=>r.records?.[s.studentId]==="present").length;const pct=rows.length?present/rows.length*100:0;return <div key={s.studentId} style={styles.summaryMiniCard}><strong>{s.name}</strong><span>{s.className}</span><b>{pct.toFixed(0)}%</b><small>{present}/{rows.length} days present</small></div>})}</div></div>
    </>;
  };

  const noticesPage = () => <>
    <div style={styles.pageHeader}><div><h1>📢 Notice Board</h1><p style={styles.muted}>Publish clear, dated announcements for every student.</p></div></div>
    {noticeStatus&&<div style={noticeStatus.includes("successfully")?styles.successBox:styles.errorBox}>{noticeStatus}</div>}
    {isAdmin&&<div style={styles.card}><h2>➕ Publish Notice</h2><form onSubmit={saveNotice}><div style={styles.formGrid}><FormField label="Title *" value={noticeTitle} onChange={setNoticeTitle} placeholder="Holiday Notice"/><FormField label="Date" value={noticeDate} onChange={setNoticeDate} type="date"/><FormField label="Priority" value={noticePriority} onChange={v=>setNoticePriority(v as any)} type="select" options={[{label:"Normal",value:"normal"},{label:"Important",value:"important"},{label:"Urgent",value:"urgent"}]}/></div><label style={styles.label}>Message *</label><textarea style={{...styles.input,minHeight:120,resize:"vertical"}} value={noticeMessage} onChange={e=>setNoticeMessage(e.target.value)} placeholder="Write the announcement..." required/><div style={styles.formActions}><button type="submit" style={styles.primaryButtonSmall} disabled={noticeSaving}>{noticeSaving?"Publishing...":"📢 Publish Notice"}</button></div></form></div>}
    <div style={styles.card}><div style={styles.sectionTitleRow}><div><h2>📌 Published Notices</h2><p style={styles.muted}>{notices.length} notice{notices.length===1?"":"s"}</p></div></div>{notices.length===0?<div style={styles.emptyBox}>No notices published yet.</div>:notices.map(n=><div key={n.id} style={styles.noticeItem}><div style={styles.homeworkMeta}><strong>{n.title}</strong><span>{n.date}</span></div><span style={styles.noticeBadge}>{(n.priority||"normal").toUpperCase()}</span><p style={{whiteSpace:"pre-wrap",margin:"10px 0 0"}}>{n.message}</p>{isAdmin&&<div style={styles.formActions}><button style={styles.deleteButton} onClick={()=>deleteNotice(n)}>🗑️ Delete</button></div>}</div>)}</div>
  </>;

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

          {isAdmin && (
            <button
              style={
                page === "homework" ? styles.navButtonActive : styles.navButton
              }
              onClick={() => setPage("homework")}
            >
              📚 Homework
            </button>
          )}

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

          {page === "tests" && testsPage()}

          {page === "attendance" && attendancePage()}

          {page === "fees" && feesPage()}

          {page === "homework" && isAdmin && homeworkPage()}

          {page === "notices" && noticesPage()}
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
  options,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
}) {
  return (
    <div>
      <label style={styles.label}>{label}</label>

      {type === "select" ? (
        <select
          style={styles.input}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {(options || []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          style={styles.input}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      )}
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
    background: "radial-gradient(circle at top right, #eef2ff 0, #f8fafc 34%, #f1f5f9 100%)",
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
    background: "radial-gradient(circle at 100% 0%, #eef2ff 0, #f8fafc 35%, #eef2f7 100%)",
    fontFamily: "Arial, sans-serif",
  },

  topbar: {
    minHeight: 74,
    background: "rgba(255,255,255,0.92)",
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
    background: "linear-gradient(180deg,#0f172a,#111827 55%,#172554)",
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
    background: "linear-gradient(135deg,#4f46e5,#2563eb)",
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
    boxShadow: "0 12px 30px rgba(15,23,42,0.07)",
    border: "1px solid rgba(148,163,184,0.16)",
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

  homeworkList: {
    display: "grid",
    gap: 14,
  },

  homeworkItem: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "#fafafa",
  },

  homeworkMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: "#4b5563",
    fontSize: 13,
    flexWrap: "wrap",
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

  filterBar:{display:"flex",gap:10,flexWrap:"wrap",margin:"14px 0"},
  filterInput:{padding:"10px 12px",border:"1px solid #cbd5e1",borderRadius:9,background:"#fff",minWidth:170},
  quickGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginTop:16},
  quickAction:{border:"1px solid #e2e8f0",borderRadius:14,padding:14,background:"linear-gradient(135deg,#fff,#f8fafc)",display:"flex",alignItems:"center",gap:12,cursor:"pointer",textAlign:"left"},
  directorEditor:{display:"flex",gap:18,alignItems:"flex-start"},
  profileHero:{display:"flex",alignItems:"center",gap:14,marginBottom:14},
  avatarLarge:{width:72,height:72,borderRadius:"50%",background:"#eef2ff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,overflow:"hidden",border:"3px solid #fff",boxShadow:"0 8px 22px rgba(37,99,235,.15)"},
  avatarDirector:{width:64,height:64,borderRadius:"50%",background:"#eef2ff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,overflow:"hidden",flexShrink:0},
  avatarImage:{width:"100%",height:"100%",objectFit:"cover"},
  directorCard:{display:"flex",gap:14,alignItems:"center",padding:14,borderRadius:14,background:"linear-gradient(135deg,#f8fafc,#eef2ff)",border:"1px solid #e0e7ff"},
  calendarCard:{padding:16,border:"1px solid #e5e7eb",borderRadius:16,background:"#fbfdff"},
  calendarToolbar:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:12},
  monthInput:{padding:"7px 9px",border:"1px solid #cbd5e1",borderRadius:8,background:"#fff"},
  calendarGrid:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:7},
  calendarHead:{textAlign:"center",fontSize:11,fontWeight:800,color:"#64748b",padding:"5px 0"},
  calendarDay:{aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"50%",background:"#f1f5f9",fontSize:13,fontWeight:700,color:"#334155",maxWidth:42,margin:"auto",width:"100%"},
  calendarPresent:{background:"#dcfce7",color:"#166534",boxShadow:"inset 0 0 0 2px #22c55e"},
  calendarAbsent:{background:"#fee2e2",color:"#991b1b",boxShadow:"inset 0 0 0 2px #ef4444"},
  sectionTitleRow:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12},
  noticeItem:{border:"1px solid #e5e7eb",borderRadius:12,padding:16,marginBottom:12,background:"#fff"},
  noticeBadge:{display:"inline-block",padding:"5px 9px",borderRadius:999,background:"#eef2ff",color:"#3730a3",fontSize:11,fontWeight:800,letterSpacing:.5},
  doneBadge:{display:"inline-block",padding:"6px 9px",borderRadius:999,background:"#dcfce7",color:"#166534",fontWeight:800,fontSize:12},
  studentPicker:{border:"1px solid #e5e7eb",borderRadius:12,padding:12,background:"#fafafa"},
  pickerToolbar:{display:"flex",gap:8,marginBottom:10},
  studentPickerGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8,maxHeight:220,overflowY:"auto"},
  studentPickerItem:{display:"flex",alignItems:"center",gap:8,padding:9,border:"1px solid #e5e7eb",borderRadius:9,background:"white",cursor:"pointer"},
  completionSummary:{marginTop:12,padding:"10px 12px",borderRadius:9,background:"#f8fafc",fontSize:13},
  defaulterList:{display:"flex",flexWrap:"wrap",gap:7,marginTop:10},
  doneStudentButton:{border:"1px solid #bbf7d0",borderRadius:999,padding:"7px 10px",background:"#f0fdf4",color:"#166534",fontWeight:700,cursor:"pointer"},
  notDoneStudentButton:{border:"1px solid #fecaca",borderRadius:999,padding:"7px 10px",background:"#fef2f2",color:"#991b1b",fontWeight:700,cursor:"pointer"},
  warningBox:{marginTop:10,padding:12,borderRadius:10,background:"#fff7ed",color:"#9a3412",fontWeight:600,lineHeight:1.5},
  uploadGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12,marginTop:16},
  uploadBox:{display:"flex",flexDirection:"column",gap:8,border:"1px dashed #cbd5e1",borderRadius:12,padding:16,background:"#f8fafc",fontWeight:700,cursor:"pointer"},
  testCard:{border:"1px solid #e5e7eb",borderRadius:14,padding:16,marginBottom:12,background:"#fff",display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap"},
  linkRow:{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"},
  linkButton:{display:"inline-block",textDecoration:"none",border:"1px solid #c7d2fe",borderRadius:8,padding:"8px 11px",background:"#eef2ff",color:"#3730a3",fontWeight:700,fontSize:13},
  deleteButton:{border:"none",borderRadius:7,padding:"8px 12px",background:"#dc2626",color:"white",fontWeight:700,cursor:"pointer"},
  compactInput:{width:100,padding:"8px 9px",border:"1px solid #d1d5db",borderRadius:8,boxSizing:"border-box"},
  summaryMiniCard:{background:"linear-gradient(135deg,#fff,#f8fafc)",border:"1px solid #e5e7eb",borderRadius:14,padding:15,display:"flex",flexDirection:"column",gap:5},
};
