import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, updateDoc, getDoc, getDocs, collection, query, orderBy, deleteDoc } from "firebase/firestore";

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
  getCrChangeRequests,
  createCrChangeRequest,
  updateCrChangeRequest,
} from "../firebase/firestore";

import { getUserProfile } from "../firebase/user";
import { getCrEligibility, isHomeworkPending } from "./crLogic.js";

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
  isCR?: boolean;
  crSince?: string;
  crEligible?: boolean;
  crEligibleSince?: string;
  crEligibilityCheckedAt?: string;
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
  createdBy?: string;
  createdByUid?: string;
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

type Teacher = {
  id?: string;
  name?: string;
  subject?: string;
  className?: string;
  batch?: string;
  mobile?: string;
  email?: string;
};

/* =========================================================
   APP
========================================================= */

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const isAdmin = profile?.role === "admin";
  const isCR = profile?.role === "cr";
  const isStudentLike = profile?.role === "student" || profile?.role === "cr";

  const [studentData, setStudentData] = useState<Student | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [directoryStudents, setDirectoryStudents] = useState<Student[]>([]);
  const [director, setDirector] = useState<Director | null>(null);
  const [showStudentProfile, setShowStudentProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Student>({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [directorForm, setDirectorForm] = useState<Director>({ name: "", title: "Director", mobile: "", email: "", address: "", message: "" });
  const [directorSaving, setDirectorSaving] = useState(false);
  const [directorMessage, setDirectorMessage] = useState("");

  const [fees, setFees] = useState<Fee[]>([]);
  const [studentFee, setStudentFee] = useState<Fee | null>(null);
  const [studentFeeHistory, setStudentFeeHistory] = useState<Fee[]>([]);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeMessage, setFeeMessage] = useState("");

  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState("dashboard");
  const [studentPage, setStudentPage] = useState("dashboard");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [crRequests, setCrRequests] = useState<any[]>([]);
  const [crMessage, setCrMessage] = useState("");
  const [crLoading, setCrLoading] = useState(false);
  const [crCriteria, setCrCriteria] = useState({
    minAttendance: 90,
    minAverage: 80,
    maxRank: 5,
    maxFeeDue: 0,
    maxPendingHomework: 0,
  });
  const [crCriteriaDraft, setCrCriteriaDraft] = useState({
    minAttendance: 90,
    minAverage: 80,
    maxRank: 5,
    maxFeeDue: 0,
    maxPendingHomework: 0,
  });
  const [crCriteriaMessage, setCrCriteriaMessage] = useState("");
  const [savingCrCriteria, setSavingCrCriteria] = useState(false);

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
  const [homeworkRequestMode, setHomeworkRequestMode] = useState(false);

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
  const [savingTest, setSavingTest] = useState(false);
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState("");

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

  /* TEACHERS */
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [showTeacherForm, setShowTeacherForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [teacherName, setTeacherName] = useState("");
  const [teacherSubject, setTeacherSubject] = useState("");
  const [teacherClass, setTeacherClass] = useState("");
  const [teacherBatch, setTeacherBatch] = useState("");
  const [teacherMobile, setTeacherMobile] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherMessage, setTeacherMessage] = useState("");

  const [homeworkAssignedStudents, setHomeworkAssignedStudents] = useState<string[]>([]);
  const [homeworkCompletion, setHomeworkCompletion] = useState<Record<string, boolean>>({});

  /* Admin-only direct Firebase Auth credential change */
  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [credentialStudent, setCredentialStudent] = useState<Student | null>(null);
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [newStudentPassword, setNewStudentPassword] = useState("");
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [credentialMessage, setCredentialMessage] = useState("");
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);

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
      if (isAdmin) setPage("feeDetail");
    } catch (error: any) {
      setFeeMessage(
        `Firebase Error: ${error?.code || "unknown-error"} | ${
          error?.message || "Unable to load fee history"
        }`
      );
    }
  };

  const openStudentDetails = async (student: Student) => {
    setSelectedStudent(student);
    setSelectedFeeStudent(student);
    if (student.studentId) {
      try { setSelectedFeeHistory(await getStudentFeeHistory(student.studentId)); }
      catch (error) { console.error("Unable to load student fee details:", error); setSelectedFeeHistory([]); }
    }
    setPage("studentDetail");
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  const loadCrCriteria = async () => {
    try {
      const snap = await getDoc(doc(db, "crSettings", "eligibility"));
      const defaults = { minAttendance: 90, minAverage: 80, maxRank: 5, maxFeeDue: 0, maxPendingHomework: 0 };
      const data = snap.exists() ? { ...defaults, ...snap.data() } : defaults;
      setCrCriteria(data);
      setCrCriteriaDraft(data);
    } catch (error) {
      console.error("CR criteria loading error:", error);
    }
  };

  const saveCrCriteria = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isAdmin) return;
    const next = {
      minAttendance: Number(crCriteriaDraft.minAttendance),
      minAverage: Number(crCriteriaDraft.minAverage),
      maxRank: Number(crCriteriaDraft.maxRank),
      maxFeeDue: Number(crCriteriaDraft.maxFeeDue),
      maxPendingHomework: Number(crCriteriaDraft.maxPendingHomework),
    };
    if (![next.minAttendance, next.minAverage, next.maxRank, next.maxFeeDue, next.maxPendingHomework].every(Number.isFinite) || next.minAttendance < 0 || next.minAttendance > 100 || next.minAverage < 0 || next.minAverage > 100 || next.maxRank < 1 || next.maxFeeDue < 0 || next.maxPendingHomework < 0) {
      setCrCriteriaMessage("Enter valid CR eligibility values.");
      return;
    }
    setSavingCrCriteria(true);
    setCrCriteriaMessage("");
    try {
      await setDoc(doc(db, "crSettings", "eligibility"), { ...next, updatedAt: new Date().toISOString(), updatedBy: user?.uid || "" }, { merge: true });
      setCrCriteria(next);
      setCrCriteriaDraft(next);
      setCrCriteriaMessage("CR eligibility criteria updated successfully. ✅");
    } catch (error: any) {
      setCrCriteriaMessage(`Unable to save CR criteria: ${error?.message || "Unknown error"}`);
    } finally {
      setSavingCrCriteria(false);
    }
  };

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
    if (!isStudentLike || !studentData?.studentId) return;
    setProfileSaving(true);
    setProfileMessage("");
    try {
      const photoUrl = profileDraft.photoUrl || "";
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
      // Students may update only their own name/photo in studentDirectory.
      // Class and batch remain admin-controlled.
      await setDoc(doc(db, "studentDirectory", studentData.studentId), {
        name: allowed.name,
        photoUrl: allowed.photoUrl || "",
      }, { merge: true });
      const updated = await getStudentById(studentData.studentId);
      setStudentData(updated);
      setProfileMessage("Profile updated successfully! ✅");
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
      const photoUrl = directorForm.photoUrl || "";
      const payload = {
        ...directorForm,
        name: (directorForm.name || "").trim(),
        title: (directorForm.title || "Director").trim(),
        mobile: (directorForm.mobile || "").trim(),
        email: (directorForm.email || "").trim(),
        address: (directorForm.address || "").trim(),
        message: (directorForm.message || "").trim(),
        photoUrl,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "director", "profile"), payload, { merge: true });
      setDirector(payload);
      setDirectorForm(payload);
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
        await loadCrCriteria();

        if (userProfile?.role === "student" || userProfile?.role === "cr") {
          const ownStudent = await getStudentById(userProfile.studentId);

          setStudentData(ownStudent);
          setProfileDraft(ownStudent || {});
          await loadDirector();

          // Students/CRs are read-only for fee records. The old code attempted
          // to create the current-month fee here, but Firestore correctly
          // reserves fee writes for Admin. That denied write was unnecessary
          // during login and could make the portal appear broken.
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
          await loadTeachers();
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
    if (!isAdmin || !credentialStudent) {
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
          studentAuthUid: credentialStudent.authUid || undefined,
          studentId: credentialStudent.studentId || undefined,
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

  const deleteStudent = async (student: Student) => {
    if (!isAdmin || !student.studentId) return;

    const confirmed = window.confirm(
      `Delete ${student.name || "this student"} (${student.studentId})?\n\nThis will permanently remove the student record, login account, profile, fee history and directory entry. This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingStudentId(student.studentId);
    setStudentMessage("");

    try {
      const idToken = await user.getIdToken(true);
      const response = await fetch("/api/admin-student-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          action: "delete",
          studentId: student.studentId,
          studentAuthUid: student.authUid || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Unable to delete student.");
      }

      setStudents((current) => current.filter((item) => item.studentId !== student.studentId));
      setDirectoryStudents((current) => current.filter((item) => item.studentId !== student.studentId));
      setEditingStudent(null);
      setCredentialStudent(null);
      setShowCredentialForm(false);
      setStudentMessage(`Student ${student.name || student.studentId} deleted successfully. 🗑️`);
    } catch (error: any) {
      console.error("Student deletion error:", error);
      setStudentMessage(error?.message || "Unable to delete student.");
    } finally {
      setDeletingStudentId(null);
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
    if (!isAdmin && !isCR) return;
    resetHomeworkForm();
    setHomeworkDate(new Date().toISOString().slice(0, 10));
    setShowHomeworkForm(true);
  };

  const openEditHomework = (item: Homework) => {
    if (!isAdmin && !isCR) return;
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
    if (!isAdmin && !isCR) {
      setHomeworkMessage("Only Admin or an assigned Class Representative can manage homework.");
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
      createdBy: profile?.name || (isCR ? "Class Representative" : "Admin"),
      createdByUid: user?.uid || "",
    };

    setSavingHomework(true);
    setHomeworkMessage("");
    try {
      if (isCR) {
        await createCrChangeRequest({
          type: editingHomework?.id ? "homework_edit" : "homework_add",
          targetId: editingHomework?.id || "",
          studentId: profile?.studentId || "",
          submittedBy: user?.uid || "",
          submittedByName: profile?.name || "Class Representative",
          payload,
        });
        setHomeworkMessage(editingHomework?.id ? "Homework edit sent to Admin for approval. ⏳" : "Homework request sent to Admin for approval. ⏳");
      } else if (editingHomework?.id) {
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
    if ((!isAdmin && !isCR) || !item.id) return;
    if (!window.confirm(`Delete homework: ${item.title || "this homework"}?`)) return;
    try {
      if (isCR) {
        await createCrChangeRequest({
          type: "homework_delete", targetId: item.id, studentId: profile?.studentId || "",
          submittedBy: user?.uid || "", submittedByName: profile?.name || "Class Representative", payload: { homework: item },
        });
        setHomeworkMessage("Homework deletion sent to Admin for approval. ⏳");
      } else {
        await deleteHomework(item.id);
        await loadHomework();
        setHomeworkMessage("Homework deleted successfully. 🗑️");
      }
    } catch (error: any) {
      console.error("Homework delete error:", error);
      setHomeworkMessage(
        `Firebase Error: ${error?.code || "unknown-error"} | ${
          error?.message || "Unable to delete homework"
        }`
      );
    }
  };

  const loadCrRequests = async () => {
    try {
      const requests = await getCrChangeRequests(isAdmin ? "" : (user?.uid || ""));
      setCrRequests(requests);
    } catch (error: any) {
      console.error("CR request loading error:", error);
      setCrMessage(`Unable to load CR requests: ${error?.message || "Unknown error"}`);
    }
  };

  useEffect(() => {
    if (page === "homework" && (isAdmin || isCR)) loadHomework();
    if ((page === "homework" || page === "attendance" || page === "cr") && (isAdmin || isCR)) loadCrRequests();
  }, [page, isAdmin, isCR]);

  /* =========================================================
     CLASS REPRESENTATIVE WORKFLOW
  ========================================================= */

  const getStudentCrMetrics = (student: Student) => {
    const rank = getStudentRanking().find((item) => item.studentId === student.studentId)?.rank ?? Infinity;
    const average = Number(studentAverageMap()[student.studentId || ""] || student.average || 0);
    const attendanceStats = getAttendanceStats(student.studentId, student.authUid);
    const pendingHomework = homeworkForStudent(student).filter((item) => isHomeworkPending(item, student.studentId || "")).length;
    return {
      rank,
      average,
      attendance: attendanceStats.percentage,
      feeDue: student.studentId === studentData?.studentId
        ? studentFeeHistory.reduce((sum, fee) => sum + Number(fee.pendingAmount || 0), 0)
        : Number(student.feeDue || 0),
      pendingHomework,
    };
  };

  const getStudentCrEligibility = (student: Student) => getCrEligibility(getStudentCrMetrics(student), crCriteria);

  const applyApprovedCrRequest = async (request: any) => {
    if (!isAdmin || !request?.id) return;
    if (request.type === "attendance_update") {
      const payload = request.payload || {};
      await setDoc(doc(db, "attendance", request.targetId), {
        ...payload,
        updatedAt: new Date().toISOString(),
        approvedFromCrRequest: request.id,
      }, { merge: true });
      const attendanceSnapshot = await getDocs(query(collection(db, "attendance"), orderBy("date", "desc")));
      const days = attendanceSnapshot.docs.map((item: any) => item.data()) as AttendanceDay[];
      await Promise.all(students.filter((student) => student.studentId).map(async (student) => {
        const rows = days.filter((row) => row.records && Object.prototype.hasOwnProperty.call(row.records, student.studentId!));
        const present = rows.filter((row) => row.records?.[student.studentId!] === "present").length;
        const percentage = rows.length ? Number(((present / rows.length) * 100).toFixed(1)) : 0;
        await updateDoc(doc(db, "students", student.studentId!), { attendance: percentage });
      }));
    } else if (request.type === "homework_add") {
      await addHomework(request.payload || {});
    } else if (request.type === "homework_edit") {
      await updateHomework(request.targetId, request.payload || {});
    } else if (request.type === "homework_delete") {
      await deleteHomework(request.targetId);
    } else if (request.type === "homework_completion") {
      await updateHomework(request.targetId, request.payload || {});
    } else if (request.type === "cr_application") {
      const student = students.find((item) => item.studentId === request.studentId);
      if (!student?.studentId || !student.authUid) throw new Error("Student account details not found.");
      const crSince = new Date().toISOString();
      await updateDoc(doc(db, "users", student.authUid), { role: "cr" });
      await updateDoc(doc(db, "students", student.studentId), { isCR: true, crSince });
      await setDoc(doc(db, "studentDirectory", student.studentId), {
        studentId: student.studentId, name: student.name || "", className: student.className || "", batch: student.batch || "", photoUrl: student.photoUrl || "",
        isCR: true, crSince, crEligible: true,
      }, { merge: true });
      await setDoc(doc(db, "classRepresentatives", student.studentId), {
        studentId: student.studentId, authUid: student.authUid, name: student.name || "", className: student.className || "", batch: student.batch || "", photoUrl: student.photoUrl || "", isCR: true, crSince, updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  };

  const reviewCrRequest = async (request: any, approved: boolean) => {
    if (!isAdmin || !request?.id) return;
    setCrLoading(true);
    setCrMessage("");
    try {
      if (approved) await applyApprovedCrRequest(request);
      await updateCrChangeRequest(request.id, { status: approved ? "approved" : "rejected", reviewedBy: user?.uid || "", reviewedByName: profile?.name || "Admin" });
      await loadCrRequests();
      await loadHomework();
      await loadAttendance();
      if (approved && request.type === "cr_application") {
        const updatedStudents = await getStudents();
        setStudents(updatedStudents);
      }
      setCrMessage(approved ? "CR request approved successfully. ✅" : "CR request rejected.");
    } catch (error: any) {
      console.error("CR request review error:", error);
      setCrMessage(`Unable to review CR request: ${error?.message || "Unknown error"}`);
    } finally {
      setCrLoading(false);
    }
  };

  const assignCrDirectly = async (student: Student) => {
    if (!isAdmin || !student.studentId || !student.authUid) return;
    if (!window.confirm(`Make ${student.name || student.studentId} a Class Representative?`)) return;
    setCrLoading(true);
    try {
      const crSince = new Date().toISOString();
      await updateDoc(doc(db, "users", student.authUid), { role: "cr" });
      await updateDoc(doc(db, "students", student.studentId), { isCR: true, crSince });
      await setDoc(doc(db, "studentDirectory", student.studentId), {
        studentId: student.studentId, name: student.name || "", className: student.className || "", batch: student.batch || "", photoUrl: student.photoUrl || "",
        isCR: true, crSince, crEligible: getStudentCrEligibility(student).eligible,
      }, { merge: true });
      await setDoc(doc(db, "classRepresentatives", student.studentId), {
        studentId: student.studentId, authUid: student.authUid, name: student.name || "", className: student.className || "", batch: student.batch || "", photoUrl: student.photoUrl || "", isCR: true, crSince, updatedAt: new Date().toISOString()
      }, { merge: true });
      setStudents(await getStudents());
      await loadCrRequests();
      setCrMessage(`${student.name || student.studentId} is now a Class Representative. ⭐`);
    } catch (error: any) {
      setCrMessage(`Unable to assign CR: ${error?.message || "Unknown error"}`);
    } finally { setCrLoading(false); }
  };

  const removeCr = async (student: Student) => {
    if (!isAdmin || !student.studentId || !student.authUid) return;
    if (!window.confirm(`Remove CR role from ${student.name || student.studentId}?`)) return;
    setCrLoading(true);
    try {
      await updateDoc(doc(db, "users", student.authUid), { role: "student" });
      await updateDoc(doc(db, "students", student.studentId), { isCR: false });
      await setDoc(doc(db, "studentDirectory", student.studentId), { isCR: false }, { merge: true });
      await setDoc(doc(db, "classRepresentatives", student.studentId), { isCR: false, updatedAt: new Date().toISOString() }, { merge: true });
      setStudents(await getStudents());
      setCrMessage("CR role removed. The student login remains active.");
    } catch (error: any) { setCrMessage(`Unable to remove CR: ${error?.message || "Unknown error"}`); }
    finally { setCrLoading(false); }
  };

  const applyForCr = async () => {
    const eligibility = studentData ? getStudentCrEligibility(studentData) : { eligible: false, failedCriteria: [] };
    const hasPending = crRequests.some((r: any) => r.type === "cr_application" && r.studentId === studentData?.studentId && r.status === "pending");
    if (!isStudentLike || !studentData?.studentId || !eligibility.eligible || hasPending) return;
    setCrLoading(true);
    try {
      await createCrChangeRequest({
        type: "cr_application", studentId: studentData.studentId, submittedBy: user?.uid || "", submittedByName: profile?.name || studentData.name || "Student",
        payload: { eligibility, appliedAt: new Date().toISOString() },
      });
      await loadCrRequests();
      setCrMessage("Your CR application has been sent to Admin. ⏳");
    } catch (error: any) { setCrMessage(`Unable to submit CR application: ${error?.message || "Unknown error"}`); }
    finally { setCrLoading(false); }
  };

  const syncCrEligibility = async () => {
    if (!isAdmin) return;
    const freshStudents = await getStudents();
    if (freshStudents.length === 0) return;
    setStudents(freshStudents);
    const checkedAt = new Date().toISOString();
    await Promise.all(freshStudents.filter(s => s.studentId).map(async (student) => {
      const eligibility = getStudentCrEligibility(student).eligible;
      const directory = directoryStudents.find(d => d.studentId === student.studentId);
      const patch: any = { crEligible: eligibility, crEligibilityCheckedAt: checkedAt };
      if (eligibility && !directory?.crEligible) patch.crEligibleSince = checkedAt;
      await updateDoc(doc(db, "students", student.studentId!), { crEligible: eligibility, crEligibilityCheckedAt: checkedAt });
      await setDoc(doc(db, "studentDirectory", student.studentId!), {
        studentId: student.studentId, name: student.name || "", className: student.className || "", batch: student.batch || "",
        isCR: Boolean(student.isCR), ...patch,
      }, { merge: true });
    }));
  };

  useEffect(() => {
    if (page === "cr" && isAdmin) { loadFees(); syncCrEligibility().catch((error) => console.error("CR eligibility sync error:", error)); }
  }, [page, isAdmin, students.length]);

  /* =========================================================
     TEACHERS
  ========================================================= */
  const loadTeachers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "teachers"));
      setTeachers(snapshot.docs.map((item: any) => ({ id: item.id, ...item.data() })) as Teacher[]);
    } catch (error: any) {
      console.error("Teacher loading error:", error);
      setTeacherMessage(`Unable to load teachers: ${error?.message || "Unknown error"}`);
    }
  };

  const resetTeacherForm = () => {
    setShowTeacherForm(false); setEditingTeacher(null); setTeacherName(""); setTeacherSubject("");
    setTeacherClass(""); setTeacherBatch(""); setTeacherMobile(""); setTeacherEmail("");
  };

  const openAddTeacher = () => { resetTeacherForm(); setTeacherMessage(""); setShowTeacherForm(true); };
  const openEditTeacher = (t: Teacher) => {
    setEditingTeacher(t); setTeacherName(t.name || ""); setTeacherSubject(t.subject || "");
    setTeacherClass(t.className || ""); setTeacherBatch(t.batch || ""); setTeacherMobile(t.mobile || "");
    setTeacherEmail(t.email || ""); setTeacherMessage(""); setShowTeacherForm(true);
  };

  const saveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!teacherName.trim() || !teacherSubject.trim()) { setTeacherMessage("Enter teacher name and subject."); return; }
    try {
      const payload = { name: teacherName.trim(), subject: teacherSubject.trim(), className: teacherClass.trim(), batch: teacherBatch.trim(), mobile: teacherMobile.trim(), email: teacherEmail.trim(), updatedAt: new Date().toISOString() };
      if (editingTeacher?.id) await setDoc(doc(db, "teachers", editingTeacher.id), payload, { merge: true });
      else await setDoc(doc(collection(db, "teachers")), { ...payload, createdAt: new Date().toISOString() });
      await loadTeachers(); setTeacherMessage("Teacher saved successfully! ✅"); setTimeout(resetTeacherForm, 500);
    } catch (error: any) { setTeacherMessage(`Unable to save teacher: ${error?.message || "Unknown error"}`); }
  };

  const deleteTeacher = async (t: Teacher) => {
    if (!isAdmin || !t.id || !window.confirm(`Delete ${t.name || "this teacher"}?`)) return;
    try { await deleteDoc(doc(db, "teachers", t.id)); await loadTeachers(); setTeacherMessage("Teacher deleted."); }
    catch (error: any) { setTeacherMessage(`Unable to delete teacher: ${error?.message || "Unknown error"}`); }
  };

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
    setTestTotal("100"); setTestResults({});
  };

  const openAddTest = () => { if (!isAdmin) return; resetTestForm(); setShowTestForm(true); };

  const openEditTest = (test: Test) => {
    if (!isAdmin) return;
    setEditingTest(test); setTestName(test.name || ""); setTestSubject(test.subject || "");
    setTestClass(test.className || ""); setTestBatch(test.batch || ""); setTestDate(test.date || "");
    setTestTotal(String(test.total || 100)); setTestResults(test.results || {}); setTestMessage("");
    setShowTestForm(true);
  };


  const saveTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!testName.trim() || !testSubject.trim() || !testDate) { setTestMessage("Enter test name, subject and date."); return; }
    const total = Number(testTotal);
    if (!Number.isFinite(total) || total <= 0) { setTestMessage("Total marks must be greater than 0."); return; }
    setSavingTest(true); setTestMessage("");
    try {
      const payload = { name: testName.trim(), subject: testSubject.trim(), className: testClass.trim(), batch: testBatch.trim(), date: testDate, total, results: testResults, updatedAt: new Date().toISOString() };
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
    if ((!isAdmin && !isCR) || !attendanceDate) return;
    const d = new Date(`${attendanceDate}T12:00:00`);
    try {
      if (isCR) {
        await createCrChangeRequest({
          type: "attendance_update", targetId: attendanceDate, studentId: profile?.studentId || "",
          submittedBy: user?.uid || "", submittedByName: profile?.name || "Class Representative",
          payload: { date: attendanceDate, day: d.toLocaleDateString("en-IN", { weekday: "long" }), year: d.getFullYear(), records: attendanceRecords },
        });
        setAttendanceMessage("Attendance changes sent to Admin for approval. ⏳");
        return;
      }
      await setDoc(doc(db, "attendance", attendanceDate), {
        date: attendanceDate, day: d.toLocaleDateString("en-IN", { weekday: "long" }), year: d.getFullYear(),
        records: attendanceRecords, updatedAt: new Date().toISOString()
      }, { merge: true });

      // Keep the summary stored on each student in sync with the daily register.
      const combinedDays = [...attendanceDays.filter((row) => row.date !== attendanceDate), { date: attendanceDate, records: attendanceRecords }];
      await Promise.all(students.filter((s) => s.studentId).map(async (student) => {
        const rows = combinedDays.filter((row) => row.records && Object.prototype.hasOwnProperty.call(row.records, student.studentId!));
        const present = rows.filter((row) => row.records?.[student.studentId!] === "present").length;
        const percentage = rows.length ? Number(((present / rows.length) * 100).toFixed(1)) : 0;
        await updateDoc(doc(db, "students", student.studentId!), { attendance: percentage });
      }));
      await loadAttendance();
      setStudents(await getStudents());
      setAttendanceMessage("Attendance saved and student dashboards synced successfully! ✅");
    } catch (error: any) { setAttendanceMessage(`Unable to save attendance: ${error?.message || "Unknown error"}`); }
  };

  const setAllAttendance = (status: "present" | "absent") => {
    const next: Record<string, "present" | "absent"> = {};
    const roster = (students.length ? students : directoryStudents).filter((student) => !isCR || student.className === studentData?.className);
    roster.forEach((student) => { if (student.studentId) next[student.studentId] = status; });
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

  const getStudentAttendanceStatus = (day: AttendanceDay, sid?: string, authUid?: string) => {
    const records = day.records || {};
    if (sid && records[sid]) return records[sid];
    if (authUid && records[authUid]) return records[authUid];
    return undefined;
  };

  const getAttendanceStats = (sid?: string, authUid?: string) => {
    if (!sid && !authUid) return { present: 0, absent: 0, recorded: 0, percentage: 0 };
    const rows = attendanceDays.filter((day) => Boolean(getStudentAttendanceStatus(day, sid, authUid)));
    const present = rows.filter((day) => getStudentAttendanceStatus(day, sid, authUid) === "present").length;
    return { present, absent: rows.length - present, recorded: rows.length, percentage: rows.length ? (present / rows.length) * 100 : 0 };
  };

  const getStudentRanking = () => {
    const averages = studentAverageMap();
    const roster = (students.length ? students : directoryStudents)
      .filter((s) => s.studentId)
      .map((s) => ({
        ...s,
        computedAverage: Number(averages[s.studentId || ""] || 0),
        testsCounted: tests.filter((t) => {
          const r = (t.results || {})[s.studentId || ""];
          return Boolean(r?.present && r.marks !== null && r.marks !== undefined);
        }).length,
      }))
      .filter((s) => s.testsCounted > 0)
      .sort((a, b) => b.computedAverage - a.computedAverage || String(a.name || "").localeCompare(String(b.name || "")));
    let lastAverage = -1;
    let rank = 0;
    return roster.map((student, index) => {
      if (student.computedAverage !== lastAverage) rank = index + 1;
      lastAverage = student.computedAverage;
      return { ...student, rank };
    });
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

  if (profile?.role === "student" || profile?.role === "cr") {
    const studentSid = studentData?.studentId || profile.studentId || "";
    const myAttendance = getAttendanceStats(studentSid, studentData?.authUid);
    const ranking = getStudentRanking();
    const myRank = ranking.find((item) => item.studentId === studentSid);
    const myAverage = Number(studentAverageMap()[studentSid] || 0);
    const myTests = tests.filter((test) => {
      const result = (test.results || {})[studentSid];
      return Boolean(result?.present && result.marks !== null && result.marks !== undefined);
    });
    const myHomework = homeworkForStudent(studentData);
    const pendingHomework = myHomework.filter((item) => isHomeworkPending(item, studentSid));
    const totalFeePending = studentFeeHistory.reduce((sum, fee) => sum + Number(fee.pendingAmount || 0), 0);
    const crEligibility = getCrEligibility({
      feeDue: totalFeePending,
      attendance: myAttendance.percentage,
      rank: myRank?.rank ?? Infinity,
      average: myAverage,
      pendingHomework: pendingHomework.length,
    }, crCriteria);
    const hasPendingCrApplication = crRequests.some((r: any) => r.type === "cr_application" && r.studentId === studentSid && r.status === "pending");
    const recordedAttendance = attendanceDays.filter((d) => Boolean(getStudentAttendanceStatus(d, studentSid, studentData?.authUid)));
    const presentDays = recordedAttendance.filter((d) => getStudentAttendanceStatus(d, studentSid, studentData?.authUid) === "present").length;
    const absentDays = recordedAttendance.filter((d) => getStudentAttendanceStatus(d, studentSid, studentData?.authUid) === "absent").length;
    const attendancePct = recordedAttendance.length ? (presentDays / recordedAttendance.length) * 100 : 0;
    const profileFields = ["name", "fatherName", "motherName", "mobile", "dob", "gender", "address"];
    const completedProfile = profileFields.filter((key) => String((studentData as any)?.[key] || "").trim()).length;
    const profileProgress = Math.round((completedProfile / profileFields.length) * 100);

    const goStudent = (next: string) => {
      setStudentPage(next);
      if (next === "profile") {
        setProfileDraft(studentData || {});
        setProfileMessage("");
        setShowStudentProfile(true);
      } else {
        setShowStudentProfile(false);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const monthAttendance = (() => {
      const [ys, ms] = studentCalendarMonth.split("-").map(Number);
      const y = ys || new Date().getFullYear();
      const m = (ms || new Date().getMonth() + 1) - 1;
      const first = new Date(y, m, 1).getDay();
      const days = new Date(y, m + 1, 0).getDate();
      const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;
      const map: Record<number, string> = {};
      attendanceDays.filter((r) => (r.date || "").startsWith(monthKey)).forEach((r) => {
        const status = getStudentAttendanceStatus(r, studentSid, studentData?.authUid);
        if (status) map[Number((r.date || "").slice(-2))] = status;
      });
      return { y, m, first, days, map };
    })();

    const studentPageTitle: Record<string, string> = {
      dashboard: "Dashboard",
      profile: "My Profile",
      attendance: "Attendance",
      results: "Tests & Results",
      homework: "Homework",
      fees: "Fees",
      notices: "Notices",
      director: "Director",
      cr: "Class Representative",
    };

    return (
      <div style={{ ...styles.appPage, minHeight: "100vh" }}>
        <header style={styles.studentTopbar}>
          <div style={styles.brandBlock}>
            <div style={styles.brandMark}>🎓</div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Coaching Management System</h2>
              <p style={styles.topbarSub}>{isCR ? "Class Representative Portal" : "Student Portal"} · {studentData?.className || "Class not set"}</p>
            </div>
          </div>
          <div style={styles.topbarActions}>
            <div style={styles.userPill}>
              <div style={styles.avatarSmall}>
                {studentData?.photoUrl ? <img src={studentData.photoUrl} alt="Student" style={styles.avatarImage} /> : "👤"}
              </div>
              <span>{studentData?.name || profile.name || "Student"}</span>
            </div>
            <button style={styles.logoutButton} onClick={handleLogout}>Logout</button>
          </div>
        </header>

        <div style={styles.studentShell}>
          <aside style={styles.studentSidebar}>
            <div style={styles.studentNavLabel}>STUDENT PORTAL</div>
            {(isCR ? [
              ["dashboard", "🏠", "Dashboard"],
              ["profile", "👤", "My Profile"],
              ["attendance", "📅", "Attendance"],
              ["homework", "📚", "Homework"],
              ["cr", "⭐", "Class Representative"],
            ] : [
              ["dashboard", "🏠", "Dashboard"],
              ["profile", "👤", "My Profile"],
              ["attendance", "📅", "Attendance"],
              ["results", "📝", "Tests & Results"],
              ["homework", "📚", "Homework"],
              ["fees", "💰", "Fees"],
              ["notices", "📢", "Notices"],
              ["director", "🎓", "Director"],
              ["cr", "⭐", "Class Representative"],
            ]).map(([key, icon, label]) => (
              <button key={key} style={studentPage === key ? styles.studentNavActive : styles.studentNav}
                onClick={() => goStudent(key)}>
                <span>{icon}</span><span>{label}</span>
              </button>
            ))}
            <div style={styles.studentSideCard}>
              <span style={styles.smallLabel}>PROFILE COMPLETION</span>
              <strong>{profileProgress}%</strong>
              <div style={styles.progressTrack}><div style={{ ...styles.progressFill, width: `${profileProgress}%` }} /></div>
              <small>Complete your extra details from My Profile.</small>
            </div>
          </aside>

          <main style={styles.studentMain}>
            <div style={styles.studentPageHeader}>
              <div>
                <span style={styles.heroEyebrow}>{isCR ? "CLASS REPRESENTATIVE PORTAL" : "STUDENT PORTAL"}</span>
                <h1 style={{ margin: "5px 0 2px" }}>{studentPageTitle[studentPage]}</h1>
                <p style={styles.muted}>{studentData?.name || "Student"} · {studentData?.className || "Class not set"}{studentData?.batch ? ` · ${studentData.batch}` : ""}</p>
              </div>
              <div style={styles.studentHeaderRank}>
                <span>OVERALL RANK</span><strong>{myRank ? `#${myRank.rank}` : "—"}</strong>
              </div>
            </div>

            {studentPage === "dashboard" && (
              <>
                <div style={styles.studentHero}>
                  <div>
                    <span style={styles.heroEyebrow}>WELCOME BACK</span>
                    <h2 style={{ margin: "8px 0 5px", fontSize: 28 }}>Hello, {studentData?.name || "Student"} 👋</h2>
                    <p style={{ margin: 0, opacity: .84 }}>Your academic snapshot, attendance and pending work in one clean place.</p>
                  </div>
                  <div style={styles.heroAvatar}>
                    {studentData?.photoUrl ? <img src={studentData.photoUrl} alt="Student" style={styles.avatarImage} /> : "👤"}
                  </div>
                </div>
                <div style={styles.grid}>
                  <StatCard title="Overall Average" value={myAverage ? `${myAverage.toFixed(1)}%` : "—"} icon="📊" />
                  <StatCard title="Attendance" value={recordedAttendance.length ? `${attendancePct.toFixed(0)}%` : "—"} icon="📅" />
                  <StatCard title="Tests Counted" value={String(myTests.length)} icon="📝" />
                  <StatCard title="Pending Homework" value={String(pendingHomework.length)} icon="📚" />
                  <StatCard title="Monthly Fee" value={`₹${studentFee?.monthlyFee ?? studentData?.monthlyFee ?? 0}`} icon="💰" />
                  <StatCard title="Fee Due" value={`₹${studentFee?.pendingAmount ?? 0}`} icon="🔴" />
                </div>
                <div style={styles.twoColumn}>
                  <div style={styles.card}>
                    <div style={styles.sectionTitleRow}><div><h2 style={{margin:0}}>📌 Quick Summary</h2><p style={styles.muted}>Your most important updates.</p></div></div>
                    <div style={styles.quickList}>
                      <button style={styles.quickItem} onClick={() => goStudent("attendance")}><span>📅 Attendance</span><strong>{attendancePct.toFixed(0)}%</strong></button>
                      <button style={styles.quickItem} onClick={() => goStudent("results")}><span>📝 Test Results</span><strong>{myTests.length} tests</strong></button>
                      <button style={styles.quickItem} onClick={() => goStudent("homework")}><span>📚 Homework</span><strong>{pendingHomework.length ? `${pendingHomework.length} pending` : "All clear"}</strong></button>
                      <button style={styles.quickItem} onClick={() => goStudent("fees")}><span>💰 Fees</span><strong>{studentFee?.status === "paid" ? "Paid" : `₹${studentFee?.pendingAmount ?? 0} due`}</strong></button>
                    </div>
                  </div>
                  <div style={styles.card}>
                    <div style={styles.profileHero}>
                      <div style={styles.avatarLarge}>{studentData?.photoUrl ? <img src={studentData.photoUrl} alt="Student" style={styles.avatarImage} /> : "👤"}</div>
                      <div style={{flex:1}}><h2 style={{margin:"0 0 4px"}}>{studentData?.name || "Student"}</h2><p style={styles.muted}>ID: {studentSid} · {studentData?.className || "Class not set"}</p></div>
                      <button style={styles.secondaryButton} onClick={() => goStudent("profile")}>✏️ Profile</button>
                    </div>
                    <InfoRow label="Father's Name" value={studentData?.fatherName || "Not added"} />
                    <InfoRow label="Mother's Name" value={studentData?.motherName || "Not added"} />
                    <InfoRow label="Mobile" value={studentData?.mobile || "Not added"} />
                  </div>
                </div>
                <div style={styles.card}>
                  <div style={styles.sectionTitleRow}><div><h2 style={{margin:0}}>📢 Latest Notices</h2><p style={styles.muted}>Tap Notices to view everything.</p></div><button style={styles.secondaryButton} onClick={() => goStudent("notices")}>View all</button></div>
                  {notices.slice(0, 3).map((n) => <div key={n.id} style={styles.noticeItem}><div style={styles.homeworkMeta}><strong>{n.title}</strong><span>{n.date}</span></div><p style={{margin:"7px 0"}}>{n.message}</p></div>)}
                  {!notices.length && <div style={styles.emptyBox}>No notices yet.</div>}
                </div>
              </>
            )}

            {studentPage === "profile" && (
              <>
                <div style={styles.card}>
                  <div style={styles.profileHero}>
                    <div style={styles.avatarLarge}>{studentData?.photoUrl ? <img src={studentData.photoUrl} alt="Student" style={styles.avatarImage} /> : "👤"}</div>
                    <div style={{flex:1}}><h2 style={{margin:0}}>{studentData?.name || "Student"}</h2><p style={styles.muted}>Profile completion: {profileProgress}%</p></div>
                    <button style={styles.primaryButtonSmall} onClick={() => { setProfileDraft(studentData || {}); setShowStudentProfile(true); }}>✏️ Edit Details</button>
                  </div>
                  <div style={styles.progressTrack}><div style={{...styles.progressFill,width:`${profileProgress}%`}} /></div>
                  <div style={styles.formGrid}>
                    <InfoRow label="Student ID" value={studentSid} />
                    <InfoRow label="Class" value={studentData?.className || "Not set"} />
                    <InfoRow label="Batch" value={studentData?.batch || "Not set"} />
                    <InfoRow label="Father's Name" value={studentData?.fatherName || "Not added"} />
                    <InfoRow label="Mother's Name" value={studentData?.motherName || "Not added"} />
                    <InfoRow label="Mobile" value={studentData?.mobile || "Not added"} />
                    <InfoRow label="DOB" value={studentData?.dob || "Not added"} />
                    <InfoRow label="Gender" value={studentData?.gender || "Not added"} />
                  </div>
                  <InfoRow label="Address" value={studentData?.address || "Not added"} />
                  <div style={styles.infoNotice}>💡 You may save a partially completed profile. Academic fields such as class, batch and Student ID remain controlled by admin.</div>
                </div>
                {showStudentProfile && (
                  <div style={styles.card}>
                    <div style={styles.formHeader}><div><h2>✏️ Edit My Profile</h2><p style={styles.muted}>You can save now and complete the remaining details later.</p></div><button style={styles.closeButton} onClick={() => setShowStudentProfile(false)}>✕</button></div>
                    <form onSubmit={saveStudentProfile}>
                      <div style={styles.formGrid}>
                        <FormField label="Student Name" value={profileDraft.name || ""} onChange={v=>setProfileDraft(p=>({...p,name:v}))} required={false}/>
                        <FormField label="Father's Name" value={profileDraft.fatherName || ""} onChange={v=>setProfileDraft(p=>({...p,fatherName:v}))} required={false}/>
                        <FormField label="Mother's Name" value={profileDraft.motherName || ""} onChange={v=>setProfileDraft(p=>({...p,motherName:v}))} required={false}/>
                        <FormField label="Mobile Number" value={profileDraft.mobile || ""} onChange={v=>setProfileDraft(p=>({...p,mobile:v}))} required={false}/>
                        <FormField label="Date of Birth" value={profileDraft.dob || ""} onChange={v=>setProfileDraft(p=>({...p,dob:v}))} type="date" required={false}/>
                        <FormField label="Gender" value={profileDraft.gender || ""} onChange={v=>setProfileDraft(p=>({...p,gender:v}))} type="select" required={false} options={[{label:"Select",value:""},{label:"Male",value:"Male"},{label:"Female",value:"Female"},{label:"Other",value:"Other"}]}/>
                      </div>
                      <label style={styles.label}>Address</label><textarea style={{...styles.input,minHeight:90}} value={profileDraft.address || ""} onChange={e=>setProfileDraft(p=>({...p,address:e.target.value}))} />
                      {profileMessage && <div style={profileMessage.includes("successfully") ? styles.successBox : styles.errorBox}>{profileMessage}</div>}
                      <div style={styles.formActions}><button type="button" style={styles.secondaryButton} onClick={()=>setShowStudentProfile(false)}>Cancel</button><button type="submit" style={styles.primaryButtonSmall} disabled={profileSaving}>{profileSaving?"Saving...":"💾 Save / Submit Profile"}</button></div>
                    </form>
                  </div>
                )}
              </>
            )}

            {studentPage === "attendance" && (
              <div style={styles.card}>
                <div style={styles.sectionTitleRow}><div><h2>📅 My Attendance</h2><p style={styles.muted}>The percentage and calendar below are calculated from the same daily attendance records.</p></div></div>
                <div style={styles.feeHistoryGrid}>
                  <div><span style={styles.smallLabel}>Present</span><strong>{presentDays}</strong></div>
                  <div><span style={styles.smallLabel}>Absent</span><strong>{absentDays}</strong></div>
                  <div><span style={styles.smallLabel}>Attendance</span><strong>{attendancePct.toFixed(0)}%</strong></div>
                  <div><span style={styles.smallLabel}>Recorded Days</span><strong>{recordedAttendance.length}</strong></div>
                </div>
                <div style={styles.calendarCard}>
                  <div style={styles.calendarToolbar}><h3 style={{margin:0}}>{new Date(monthAttendance.y, monthAttendance.m, 1).toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</h3><input style={styles.monthInput} type="month" value={studentCalendarMonth} onChange={e=>setStudentCalendarMonth(e.target.value)} /></div>
                  <div style={styles.calendarGrid}>
                    {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} style={styles.calendarHead}>{d}</div>)}
                    {Array.from({length:monthAttendance.first}).map((_,i)=><div key={"e"+i}/>)}
                    {Array.from({length:monthAttendance.days},(_,i)=>i+1).map(day=>{
                      const status=monthAttendance.map[day];
                      return <div key={day} title={status ? `${day}: ${status}` : `${day}: No record`} style={{...styles.calendarDay,...(status==="present"?styles.calendarPresent:status==="absent"?styles.calendarAbsent:{})}}>{day}</div>;
                    })}
                  </div>
                </div>
                <div style={styles.legendRow}><span>🟢 Present</span><span>🔴 Absent</span><span>⚪ No record</span></div>
              </div>
            )}

            {studentPage === "results" && (
              <>
                <div style={styles.card}>
                  <div style={styles.sectionTitleRow}><div><h2>📝 Tests & Results</h2><p style={styles.muted}>All published tests for you. Test editing is available only to Admin.</p></div><div style={styles.rankBadge}>{myRank ? `#${myRank.rank}` : "—"}</div></div>
                  <div style={styles.grid}>
                    <StatCard title="Average" value={myAverage ? `${myAverage.toFixed(1)}%` : "—"} icon="📊" />
                    <StatCard title="Tests" value={String(myTests.length)} icon="📝" />
                    <StatCard title="Overall Rank" value={myRank ? `#${myRank.rank}` : "—"} icon="🏆" />
                  </div>
                  {tests.length === 0 ? <div style={styles.emptyBox}>No tests published yet.</div> : (
                    <div style={styles.tableWrapper}><table style={styles.table}><thead><tr><th style={styles.th}>Test</th><th style={styles.th}>Class</th><th style={styles.th}>Subject</th><th style={styles.th}>Date</th><th style={styles.th}>Marks</th><th style={styles.th}>%</th></tr></thead><tbody>
                      {tests.filter(t=>!t.className || t.className===studentData?.className).map(test=>{ const r=(test.results||{})[studentSid]; const pct=r?.present&&r.marks!=null?(Number(r.marks)/Number(test.total||1))*100:null; return <tr key={test.id}><td style={styles.td}><strong>{test.name}</strong></td><td style={styles.td}>{test.className||"All"}</td><td style={styles.td}>{test.subject}</td><td style={styles.td}>{test.date}</td><td style={styles.td}>{r?.present?`${r.marks??"—"} / ${test.total}`:"Absent"}</td><td style={styles.td}>{pct==null?"—":`${pct.toFixed(1)}%`}</td></tr>; })}
                    </tbody></table></div>
                  )}
                </div>
                <div style={styles.card}>
                  <div style={styles.sectionTitleRow}><div><h2>🏆 Overall Ranking</h2><p style={styles.muted}>Ranking is calculated across all classes using average percentage.</p></div></div>
                  {ranking.length===0?<div style={styles.emptyBox}>Ranking will appear after marks are entered.</div>:<div style={styles.topRankList}>{ranking.slice(0,10).map(item=><div key={item.studentId} style={{...styles.rankRow,...(item.studentId===studentSid?styles.rankRowCurrent:{})}}><strong>#{item.rank}</strong><span style={{flex:1}}>{item.name}</span><small>{item.className||"—"}</small><b>{item.computedAverage.toFixed(1)}%</b></div>)}</div>}
                </div>
              </>
            )}

            {studentPage === "homework" && (
              <div style={styles.card}>
                <div style={styles.sectionTitleRow}><div><h2>📚 My Homework</h2><p style={styles.muted}>Your assigned work and completion status.</p></div><div style={styles.rankBadge}>{pendingHomework.length} pending</div></div>
                {myHomework.length===0?<div style={styles.emptyBox}>No homework assigned to your class yet.</div>:myHomework.map(item=>{const done=Boolean(((item as any).completion||{})[studentSid]);return <div key={item.id} style={styles.homeworkItem}><div style={styles.homeworkMeta}><strong>{item.subject||"Homework"} · {item.title}</strong><span>{item.day||""}, {item.homeworkDate||""}</span></div><p style={{margin:"6px 0",whiteSpace:"pre-wrap"}}>{item.description}</p><small style={styles.muted}>Due: {item.dueDate||"No due date"}</small><div style={{marginTop:10}}><span style={done?styles.doneBadge:styles.pendingBadge}>{done?"✓ Homework Done":"⚠ Homework Not Done"}</span></div></div>})}
                {pendingHomework.length>0 && <div style={styles.warningBox}><strong>⚠ Pending Work</strong><p style={{margin:"5px 0 0"}}>{pendingHomework.length} homework item(s) still need completion.</p></div>}
              </div>
            )}

            {studentPage === "fees" && (
              <div style={styles.card}>
                <div style={styles.sectionTitleRow}><div><h2>💰 Fee Centre</h2><p style={styles.muted}>Month-by-month fee status and payment history.</p></div><div style={styles.rankBadge}>{studentFee?.status==="paid"?"PAID":`₹${studentFee?.pendingAmount??0} DUE`}</div></div>
                <div style={styles.feeHistoryGrid}>
                  <div><span style={styles.smallLabel}>Current Month</span><strong>{studentFee?.monthId || new Date().toISOString().slice(0,7)}</strong></div>
                  <div><span style={styles.smallLabel}>Monthly Fee</span><strong>₹{studentFee?.monthlyFee??studentData?.monthlyFee??0}</strong></div>
                  <div><span style={styles.smallLabel}>Paid</span><strong>₹{studentFee?.paidAmount??0}</strong></div>
                  <div><span style={styles.smallLabel}>Due</span><strong>₹{studentFee?.pendingAmount??0}</strong></div>
                </div>
                <h3>📜 Payment History</h3>
                {studentFeeHistory.length===0?<div style={styles.emptyBox}>No fee history available.</div>:<div style={styles.tableWrapper}><table style={styles.table}><thead><tr><th style={styles.th}>Month</th><th style={styles.th}>Fee</th><th style={styles.th}>Paid</th><th style={styles.th}>Due</th><th style={styles.th}>Status</th><th style={styles.th}>Payment Date(s)</th></tr></thead><tbody>{studentFeeHistory.map(f=> <tr key={f.id}><td style={styles.td}>{f.monthId||"-"}</td><td style={styles.td}>₹{f.monthlyFee||0}</td><td style={styles.td}>₹{f.paidAmount||0}</td><td style={styles.td}>₹{f.pendingAmount||0}</td><td style={styles.td}><span style={f.status==="paid"?styles.paidBadge:f.status==="partial"?styles.partialBadge:styles.pendingBadge}>{f.status==="paid"?"🟢 Paid":f.status==="partial"?"🟠 Partial":"🔴 Due"}</span></td><td style={styles.td}>{(f.paymentHistory||[]).map((p,i)=><div key={i}>{p.date}{p.method?` · ${p.method}`:""} · ₹{p.amount}</div>)}</td></tr>)}</tbody></table></div>}
              </div>
            )}

            {studentPage === "cr" && (
              <>
                <div style={styles.card}>
                  <div style={styles.sectionTitleRow}><div><h2>⭐ Class Representative</h2><p style={styles.muted}>Current Class Representatives and CR eligibility status.</p></div>{studentData?.isCR && <span style={styles.paidBadge}>⭐ CURRENT CR</span>}</div>
                  {(() => { const classCrs = directoryStudents.filter(s => s.isCR); return classCrs.length ? <div style={styles.crPublicGrid}>{classCrs.map(cr => <div key={cr.studentId} style={styles.crPublicCard}><div style={styles.avatarLarge}>{cr.photoUrl ? <img src={cr.photoUrl} alt="Class Representative" style={styles.avatarImage}/> : "⭐"}</div><div><h3 style={{margin:"0 0 4px"}}>{cr.name}</h3><p style={styles.muted}>{cr.className}{cr.batch ? ` · ${cr.batch}` : ""}</p><span style={styles.paidBadge}>CLASS REPRESENTATIVE</span>{cr.crSince && <small style={{display:"block",marginTop:8,color:"#64748b"}}>CR since {new Date(cr.crSince).toLocaleDateString("en-IN")}</small>}</div></div>)}</div> : <div style={styles.emptyBox}>No Class Representative has been assigned yet.</div>; })()}
                </div>
                <div className="card" style={styles.card}>
                  <div style={styles.sectionTitleRow}><div><h2>📋 My CR Eligibility</h2><p style={styles.muted}>All five criteria must be satisfied before you can apply.</p></div><span style={crEligibility.eligible ? styles.paidBadge : styles.pendingBadge}>{crEligibility.eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}</span></div>
                  <div style={styles.eligibilityList}>
                    <div style={styles.eligibilityRow}><span>{totalFeePending <= crCriteria.maxFeeDue ? "✅" : "❌"}</span><strong>{`Fee pending ≤ ₹${crCriteria.maxFeeDue}`}</strong><small>₹{totalFeePending.toLocaleString("en-IN")} pending</small></div>
                    <div style={styles.eligibilityRow}><span>{myAttendance.percentage > crCriteria.minAttendance ? "✅" : "❌"}</span><strong>{`Attendance > ${crCriteria.minAttendance}%`}</strong><small>{myAttendance.percentage.toFixed(1)}%</small></div>
                    <div style={styles.eligibilityRow}><span>{myRank && myRank.rank >= 1 && myRank.rank <= crCriteria.maxRank ? "✅" : "❌"}</span><strong>{`Rank 1–${crCriteria.maxRank}`}</strong><small>{myRank ? `#${myRank.rank}` : "Not ranked"}</small></div>
                    <div style={styles.eligibilityRow}><span>{myAverage > crCriteria.minAverage ? "✅" : "❌"}</span><strong>{`Average > ${crCriteria.minAverage}%`}</strong><small>{myAverage.toFixed(1)}%</small></div>
                    <div style={styles.eligibilityRow}><span>{pendingHomework.length <= crCriteria.maxPendingHomework ? "✅" : "❌"}</span><strong>{`Pending homework ≤ ${crCriteria.maxPendingHomework}`}</strong><small>{pendingHomework.length <= crCriteria.maxPendingHomework ? "All due work done" : `${pendingHomework.length} pending`}</small></div>
                  </div>
                  {!studentData?.isCR && crEligibility.eligible && <div style={styles.formActions}><button style={styles.primaryButtonSmall} disabled={crLoading || hasPendingCrApplication} onClick={applyForCr}>{hasPendingCrApplication ? "⏳ Application Pending" : "⭐ Apply for CR"}</button></div>}
                  {!studentData?.isCR && !crEligibility.eligible && <div style={styles.infoNotice}>Complete all five criteria to unlock the CR application.</div>}
                  {studentData?.isCR && <div style={styles.paidNotice}>⭐ You are an active Class Representative. Attendance and homework changes you submit require Admin approval.</div>}
                  {crMessage && <div style={crMessage.includes("sent") ? styles.infoNotice : styles.errorBox}>{crMessage}</div>}
                </div>
              </>
            )}

            {studentPage === "notices" && (
              <div style={styles.card}>
                <div style={styles.sectionTitleRow}><div><h2>📢 Notice Board</h2><p style={styles.muted}>Official announcements from the coaching centre.</p></div></div>
                {notices.length===0?<div style={styles.emptyBox}>No notices published yet.</div>:notices.map(n=><div key={n.id} style={styles.noticeItem}><div style={styles.homeworkMeta}><strong>{n.title}</strong><span>{n.date}</span></div><span style={styles.noticeBadge}>{(n.priority||"normal").toUpperCase()}</span><p style={{whiteSpace:"pre-wrap",margin:"9px 0 0"}}>{n.message}</p></div>)}
              </div>
            )}

            {studentPage === "director" && (
              <div style={styles.card}>
                <div style={styles.sectionTitleRow}><div><h2>🎓 Coaching Director</h2><p style={styles.muted}>Official director information.</p></div></div>
                {director?<div style={styles.directorCard}><div style={styles.avatarDirector}>{director.photoUrl?<img src={director.photoUrl} alt="Director" style={styles.avatarImage}/>: "🎓"}</div><div><h2 style={{margin:"0 0 4px"}}>{director.name||"Director"}</h2><p style={styles.muted}>{director.title||"Director"}</p>{director.mobile&&<div>📞 {director.mobile}</div>}{director.email&&<div>✉️ {director.email}</div>}{director.address&&<div>📍 {director.address}</div>}{director.message&&<div style={styles.infoNotice}>💬 {director.message}</div>}</div></div>:<div style={styles.emptyBox}>Director details have not been published yet.</div>}
              </div>
            )}
          </main>
        </div>
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
    const scoredAverages = Object.values(computedAverages).map(Number).filter(v => v > 0);
    const averageMarks = scoredAverages.length > 0
      ? Math.round(scoredAverages.reduce((a, b) => a + b, 0) / scoredAverages.length)
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
          <div style={styles.sectionTitleRow}><div><h2 style={{margin:0}}>Student Directory</h2><p style={styles.muted}>{students.length} registered students</p></div><input style={styles.filterInput} placeholder="Search name, ID or class..." value={studentSearch} onChange={e=>setStudentSearch(e.target.value)} /></div>

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
                    <th style={styles.th}>Rank</th>
                    <th style={styles.th}>CR</th>
                    <th style={styles.th}>Monthly Fee</th>
                    <th style={styles.th}>Fee Due</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {students.filter((student) => { const q=studentSearch.trim().toLowerCase(); if(!q)return true; return [student.studentId,student.name,student.className,student.batch,student.email].some(v=>String(v||"").toLowerCase().includes(q)); }).map((student) => (
                    <tr key={student.studentId || student.id}>
                      <td style={styles.td}>{student.studentId || "-"}</td>

                      <td style={styles.td}>
                        <button type="button" style={styles.feeStudentButton} onClick={() => openStudentDetails(student)} title="Open full student details">
                          <span style={styles.feeAvatar}>{(student.name || "?").trim().charAt(0).toUpperCase()}</span>
                          <span><strong>{student.name || "-"}</strong><small style={styles.feeStudentHint}>View complete profile</small></span>
                        </button>
                      </td>

                      <td style={styles.td}>{student.className || "-"}</td>

                      <td style={styles.td}>{student.batch || "-"}</td>

                      <td style={styles.td}>{student.attendance ?? 0}%</td>
                      <td style={styles.td}>{Number(studentAverageMap()[student.studentId || ""] || student.average || 0).toFixed(1)}%</td>
                      <td style={styles.td}>{(() => { const r=getStudentRanking().find(x=>x.studentId===student.studentId); return r ? `#${r.rank}` : "—"; })()}</td>
                      <td style={styles.td}>{student.isCR ? <span style={styles.paidBadge}>⭐ CR</span> : "—"}</td>
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
                            <button
                              style={styles.deleteButton}
                              onClick={() => deleteStudent(student)}
                              disabled={deletingStudentId === student.studentId}
                              title="Permanently delete this student and their login"
                            >
                              {deletingStudentId === student.studentId ? "Deleting..." : "🗑️ Delete"}
                            </button>
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
     STUDENT / FEE DETAIL PAGES
  ========================================================= */

  const studentDetailPage = (student: Student) => {
    const historyForStudentDetail = selectedStudent?.studentId === student.studentId ? selectedFeeHistory : [];
    const stats = getAttendanceStats(student.studentId, student.authUid);
    const average = Number(studentAverageMap()[student.studentId || ""] || student.average || 0);
    const ranking = getStudentRanking().find((item) => item.studentId === student.studentId);
    const studentHomework = homeworkForStudent(student);
    const pending = studentHomework.filter((item) => isHomeworkPending(item, student.studentId || "")).length;
    const feePendingDetail = historyForStudentDetail.reduce((sum, fee) => sum + Number(fee.pendingAmount || 0), 0);
    const eligibility = getCrEligibility({ ...getStudentCrMetrics(student), feeDue: feePendingDetail, pendingHomework: pending, attendance: stats.percentage, average, rank: ranking?.rank ?? Infinity }, crCriteria);
    return <>
      <div style={styles.pageHeader}>
        <div><button style={styles.textButton} onClick={() => setPage("students")}>← Back to Students</button><h1>👤 {student.name || "Student Details"}</h1><p style={styles.muted}>{student.studentId} · {student.className || "Class not set"}{student.batch ? ` · ${student.batch}` : ""}</p></div>
        {isAdmin && <button style={student.isCR ? styles.deleteButton : styles.primaryButtonSmall} onClick={() => student.isCR ? removeCr(student) : assignCrDirectly(student)}>{student.isCR ? "Remove CR" : "⭐ Make CR"}</button>}
      </div>
      <div style={styles.card}><div style={styles.profileHero}><div style={styles.avatarLarge}>{student.photoUrl ? <img src={student.photoUrl} alt="Student" style={styles.avatarImage}/> : "👤"}</div><div><h2 style={{margin:0}}>{student.name || "Student"}</h2><p style={styles.muted}>{student.email || "No email"} · {student.mobile || "No mobile"}</p>{student.isCR && <span style={styles.noticeBadge}>⭐ CLASS REPRESENTATIVE</span>}</div></div></div>
      <div style={styles.grid}><StatCard title="Attendance" value={`${stats.percentage.toFixed(0)}%`} icon="📅"/><StatCard title="Average" value={average ? `${average.toFixed(1)}%` : "—"} icon="📊"/><StatCard title="Rank" value={ranking ? `#${ranking.rank}` : "—"} icon="🏆"/><StatCard title="Pending Homework" value={String(pending)} icon="📚"/><StatCard title="Fee Pending" value={`₹${feePendingDetail.toLocaleString("en-IN")}`} icon="💰"/></div>
      <div style={styles.twoColumn}>
        <div style={styles.card}><h2>🪪 Personal Details</h2>{[["Student ID",student.studentId],["Father's Name",student.fatherName],["Mother's Name",student.motherName],["Date of Birth",student.dob],["Gender",student.gender],["Mobile",student.mobile],["Email",student.email],["Address",student.address]].map(([label,value])=><div key={label} style={styles.infoRow}><span style={styles.infoLabel}>{label}</span><strong>{value || "Not provided"}</strong></div>)}</div>
        <div style={styles.card}><h2>⭐ CR Eligibility</h2><p style={styles.muted}>All five conditions must be satisfied for student application.</p><div style={styles.eligibilityList}>{[["Fee pending = ₹0",feePendingDetail<=crCriteria.maxFeeDue],[`Attendance > ${crCriteria.minAttendance}%`,stats.percentage>crCriteria.minAttendance],[`Rank 1–${crCriteria.maxRank}`,Boolean(ranking && ranking.rank>=1 && ranking.rank<=crCriteria.maxRank)],[`Average > ${crCriteria.minAverage}%`,average>crCriteria.minAverage],["No pending homework",pending<=crCriteria.maxPendingHomework]].map(([label,ok])=><div key={label} style={styles.eligibilityRow}><span>{ok ? "✅" : "❌"}</span><strong>{label}</strong><small>{ok ? "Satisfied" : "Not satisfied"}</small></div>)}</div>{student.isCR ? <div style={styles.paidNotice}>⭐ This student is currently a Class Representative.</div> : <div style={styles.infoNotice}>{eligibility.eligible ? "Eligible to apply for CR." : `Not eligible yet. ${eligibility.failedCriteria.length} condition(s) remain.`}</div>}</div>
      </div>
      <div style={styles.card}><h2>📝 Test Results</h2><div style={styles.tableWrapper}><table style={styles.table}><thead><tr><th style={styles.th}>Test</th><th style={styles.th}>Subject</th><th style={styles.th}>Date</th><th style={styles.th}>Marks</th><th style={styles.th}>%</th></tr></thead><tbody>{tests.filter(t => (t.results || {})[student.studentId || ""]).map(t=>{const r=(t.results||{})[student.studentId||""];const pct=r?.present&&r.marks!=null?(Number(r.marks)/Number(t.total||1))*100:null;return <tr key={t.id}><td style={styles.td}>{t.name}</td><td style={styles.td}>{t.subject}</td><td style={styles.td}>{t.date}</td><td style={styles.td}>{r?.present?`${r.marks ?? "—"} / ${t.total}`:"Absent"}</td><td style={styles.td}>{pct==null?"—":`${pct.toFixed(1)}%`}</td></tr>})}</tbody></table></div></div>
      <div style={styles.card}><h2>💰 Fee Record</h2>{historyForStudentDetail.length===0?<div style={styles.emptyBox}>No fee history recorded.</div>:<div style={styles.tableWrapper}><table style={styles.table}><thead><tr><th style={styles.th}>Month</th><th style={styles.th}>Fee</th><th style={styles.th}>Paid</th><th style={styles.th}>Pending</th><th style={styles.th}>Status</th></tr></thead><tbody>{historyForStudentDetail.map(f=><tr key={f.id}><td style={styles.td}>{f.monthId}</td><td style={styles.td}>₹{f.monthlyFee||0}</td><td style={styles.td}>₹{f.paidAmount||0}</td><td style={styles.td}>₹{f.pendingAmount||0}</td><td style={styles.td}><span style={f.status==="paid"?styles.paidBadge:f.status==="partial"?styles.partialBadge:styles.pendingBadge}>{f.status==="paid"?"🟢 Paid":f.status==="partial"?"🟠 Partial":"🔴 Due"}</span></td></tr>)}</tbody></table></div>}</div>
      <div style={styles.card}><h2>📚 Homework</h2>{studentHomework.length===0?<div style={styles.emptyBox}>No homework assigned.</div>:studentHomework.map(item=>{const done=Boolean(((item as any).completion||{})[student.studentId||""]);return <div key={item.id} style={styles.noticeCompact}><strong>{item.subject ? `${item.subject}: ` : ""}{item.title}</strong><span style={{marginLeft:10}}>{done ? "✅ Done" : "⚠ Pending"}</span><p style={{margin:"5px 0 0"}}>{item.description}</p></div>})}</div>
    </>;
  };

  const feeDetailPage = (student: Student, history: Fee[]) => {
    const totalCharged = history.reduce((sum, fee) => sum + Number(fee.monthlyFee || 0), 0);
    const totalPaid = history.reduce((sum, fee) => sum + Number(fee.paidAmount || 0), 0);
    const totalPending = history.reduce((sum, fee) => sum + Number(fee.pendingAmount || 0), 0);
    const status = totalPending === 0 ? "paid" : totalPaid > 0 ? "partial" : "pending";
    const percent = totalCharged > 0 ? Math.min(100, Math.round((totalPaid / totalCharged) * 100)) : 100;
    return <>
      <div style={styles.pageHeader}><div><button style={styles.textButton} onClick={() => { setSelectedFeeStudent(null); setPage("fees"); }}>← Back to Fees</button><h1>💰 Fee Details</h1><p style={styles.muted}>{student.name} · {student.studentId} · {student.className}{student.batch ? ` · ${student.batch}` : ""}</p></div><span style={status === "paid" ? styles.paidBadge : status === "partial" ? styles.partialBadge : styles.pendingBadge}>{status === "paid" ? "🟢 PAID" : status === "partial" ? "🟠 PARTIAL" : "🔴 DUE"}</span></div>
      <div style={styles.card}><div style={styles.feeDetailHero}><div><span style={styles.smallLabel}>TOTAL FEE</span><h2 style={{margin:"3px 0"}}>₹{totalCharged.toLocaleString("en-IN")}</h2><p style={styles.muted}>Complete fee record for {student.name}</p></div><div style={styles.feeDetailMetrics}><div><span style={styles.smallLabel}>TOTAL PAID</span><strong style={{color:"#15803d"}}>₹{totalPaid.toLocaleString("en-IN")}</strong></div><div><span style={styles.smallLabel}>TOTAL PENDING</span><strong style={{color:totalPending===0?"#15803d":"#b91c1c"}}>₹{totalPending.toLocaleString("en-IN")}</strong></div><div><span style={styles.smallLabel}>COLLECTION</span><strong>{percent}%</strong></div></div><div style={{...styles.progressTrack,marginTop:14}}><div style={{...styles.progressFill,width:`${percent}%`}}/></div>{totalPending===0&&<div style={styles.paidNotice}>✅ All recorded dues are cleared. Overall status: <strong>PAID</strong>.</div>}</div></div>
      <div style={styles.card}><div style={styles.sectionTitleRow}><div><h2>📅 Month-wise Fee Details</h2><p style={styles.muted}>Every recorded month, payment and remaining balance.</p></div>{isAdmin&&<button style={styles.primaryButtonSmall} onClick={()=>openAddFeeMonth(student)}>➕ Add Month</button>}</div>{history.length===0?<div style={styles.emptyBox}>No fee history available.</div>:history.map(f=><div key={f.id} style={styles.monthFeeCard}><div style={styles.sectionTitleRow}><strong>{f.monthId}</strong><span style={f.status==="paid"?styles.paidBadge:f.status==="partial"?styles.partialBadge:styles.pendingBadge}>{f.status==="paid"?"🟢 Paid":f.status==="partial"?"🟠 Partial":"🔴 Due"}</span></div><div style={styles.feeHistoryGrid}><div><span style={styles.smallLabel}>Fee</span><strong>₹{f.monthlyFee||0}</strong></div><div><span style={styles.smallLabel}>Paid</span><strong>₹{f.paidAmount||0}</strong></div><div><span style={styles.smallLabel}>Pending</span><strong>₹{f.pendingAmount||0}</strong></div><div><span style={styles.smallLabel}>Due Date</span><strong>{f.dueDate||"—"}</strong></div></div><div style={{marginTop:10}}><span style={styles.smallLabel}>Payment History</span>{(f.paymentHistory||[]).length===0?<span style={styles.muted}>No payments recorded.</span>:(f.paymentHistory||[]).map((p,i)=><div key={i} style={styles.paymentHistoryRow}><strong>₹{p.amount}</strong><span>{new Date(p.date).toLocaleString("en-IN")}</span><span>{p.method||"—"}</span><span>{p.note||""}</span></div>)}</div>{isAdmin&&<div style={styles.formActions}><button style={styles.editButton} onClick={()=>openEditHistoryFee(student,f)}>✏️ Edit Month</button></div>}</div>)}</div>
    </>;
  };

  /* =========================================================
     CLASS REPRESENTATIVE ADMIN PAGE
  ========================================================= */

  const crAdminPage = () => {
    const ranking = getStudentRanking();
    const pendingRequests = crRequests.filter((r: any) => r.status === "pending");
    return <>
      <div style={styles.pageHeader}><div><h1>⭐ Class Representative</h1><p style={styles.muted}>Track eligibility, applications and Admin assignments.</p></div></div>
      {crMessage&&<div style={crMessage.includes("successfully")||crMessage.includes("now") ? styles.successBox : styles.errorBox}>{crMessage}</div>}
      <div style={styles.grid}><StatCard title="Current CRs" value={String(students.filter(s=>s.isCR).length)} icon="⭐"/><StatCard title="Eligible" value={String(students.filter(s=>getStudentCrEligibility(s).eligible).length)} icon="✅"/><StatCard title="Applications" value={String(pendingRequests.filter((r:any)=>r.type==="cr_application").length)} icon="📨"/><StatCard title="Approval Requests" value={String(pendingRequests.filter((r:any)=>r.type!=="cr_application").length)} icon="⏳"/></div>
      <div style={styles.card}><h2>📨 Pending CR Requests</h2>{pendingRequests.length===0?<div style={styles.emptyBox}>No pending CR requests.</div>:pendingRequests.map((r:any)=><div key={r.id} style={styles.requestCard}><div><strong>{r.type.replaceAll("_"," ").toUpperCase()}</strong><p style={{margin:"5px 0"}}>{r.submittedByName || r.studentId || "CR"}{r.targetId ? ` · ${r.targetId}` : ""}</p><small style={styles.muted}>{new Date(r.createdAt || Date.now()).toLocaleString("en-IN")}</small></div><div style={styles.formActions}><button style={styles.primaryButtonSmall} disabled={crLoading} onClick={()=>reviewCrRequest(r,true)}>✅ Approve</button><button style={styles.deleteButton} disabled={crLoading} onClick={()=>reviewCrRequest(r,false)}>✕ Reject</button></div></div>)}</div>
      <div style={styles.card}><div style={styles.sectionTitleRow}><div><h2>👑 CR Management</h2><p style={styles.muted}>All students are evaluated against all five criteria. Admin can assign anyone directly.</p></div></div><div style={styles.tableWrapper}><table style={styles.table}><thead><tr><th style={styles.th}>Student</th><th style={styles.th}>Class</th><th style={styles.th}>Fee</th><th style={styles.th}>Attendance</th><th style={styles.th}>Rank</th><th style={styles.th}>Average</th><th style={styles.th}>Homework</th><th style={styles.th}>Eligibility</th><th style={styles.th}>CR</th><th style={styles.th}>Action</th></tr></thead><tbody>{students.map(s=>{const m=getStudentCrMetrics(s);const e=getStudentCrEligibility(s);return <tr key={s.studentId}><td style={styles.td}><button style={styles.textButton} onClick={()=>openStudentDetails(s)}>{s.name}</button></td><td style={styles.td}>{s.className}{s.batch?` · ${s.batch}`:""}</td><td style={styles.td}>{m.feeDue===0?"✅ Clear":`₹${m.feeDue}`}</td><td style={styles.td}>{m.attendance.toFixed(0)}%</td><td style={styles.td}>{Number.isFinite(m.rank)?`#${m.rank}`:"—"}</td><td style={styles.td}>{m.average.toFixed(1)}%</td><td style={styles.td}>{m.pendingHomework===0?"✅ Done":`❌ ${m.pendingHomework} pending`}</td><td style={styles.td}><span style={e.eligible?styles.paidBadge:styles.pendingBadge}>{e.eligible?"ELIGIBLE":"NOT ELIGIBLE"}</span></td><td style={styles.td}>{s.isCR?<span style={styles.paidBadge}>⭐ CR</span>:"—"}</td><td style={styles.td}>{s.isCR?<button style={styles.deleteButton} onClick={()=>removeCr(s)}>Remove</button>:<button style={styles.primaryButtonSmall} onClick={()=>assignCrDirectly(s)}>⭐ Make CR</button>}</td></tr>})}</tbody></table></div></div>
      <div style={styles.card}>
        <div className="sectionTitleRow" style={styles.sectionTitleRow}><div><h2>⚙️ CR Eligibility Settings</h2><p style={styles.muted}>Admin can change the requirements used for student CR applications.</p></div></div>
        {crCriteriaMessage && <div style={crCriteriaMessage.includes("successfully") ? styles.successBox : styles.errorBox}>{crCriteriaMessage}</div>}
        <form onSubmit={saveCrCriteria}>
          <div style={styles.formGrid}>
            <FormField label="Minimum Attendance (strictly above) %" value={String(crCriteriaDraft.minAttendance)} onChange={v => setCrCriteriaDraft(prev => ({ ...prev, minAttendance: Number(v) }))} type="number" />
            <FormField label="Minimum Average (strictly above) %" value={String(crCriteriaDraft.minAverage)} onChange={v => setCrCriteriaDraft(prev => ({ ...prev, minAverage: Number(v) }))} type="number" />
            <FormField label="Maximum Eligible Rank" value={String(crCriteriaDraft.maxRank)} onChange={v => setCrCriteriaDraft(prev => ({ ...prev, maxRank: Number(v) }))} type="number" />
            <FormField label="Maximum Pending Fee ₹" value={String(crCriteriaDraft.maxFeeDue)} onChange={v => setCrCriteriaDraft(prev => ({ ...prev, maxFeeDue: Number(v) }))} type="number" />
            <FormField label="Maximum Pending Homework" value={String(crCriteriaDraft.maxPendingHomework)} onChange={v => setCrCriteriaDraft(prev => ({ ...prev, maxPendingHomework: Number(v) }))} type="number" />
          </div>
          <div style={styles.formActions}><button type="submit" style={styles.primaryButtonSmall} disabled={savingCrCriteria}>{savingCrCriteria ? "Saving..." : "💾 Save Eligibility Criteria"}</button></div>
        </form>
      </div>
      <div style={styles.card}><h2>📌 Eligibility Rules</h2><div style={styles.eligibilityList}><div style={styles.eligibilityRow}><span>1️⃣</span><strong>{`Fee pending ≤ ₹${crCriteria.maxFeeDue}`}</strong><small>Configured by Admin</small></div><div style={styles.eligibilityRow}><span>2️⃣</span><strong>{`Attendance > ${crCriteria.minAttendance}%`}</strong><small>Configured by Admin</small></div><div style={styles.eligibilityRow}><span>3️⃣</span><strong>{`Rank 1–${crCriteria.maxRank}`}</strong><small>Overall ranking</small></div><div style={styles.eligibilityRow}><span>4️⃣</span><strong>{`Average > ${crCriteria.minAverage}%`}</strong><small>Configured by Admin</small></div><div style={styles.eligibilityRow}><span>5️⃣</span><strong>No pending homework</strong><small>Configured by Admin</small></div></div></div>
    </>;
  };

  /* =========================================================
     HOMEWORK PAGE
  ========================================================= */

  const homeworkPage = () => {
    const homeworkRoster = (students.length ? students : directoryStudents).filter(student => !isCR || student.className === studentData?.className);
    const classOptions = Array.from(
      new Set(homeworkRoster.map((student) => student.className).filter(Boolean))
    );
    const batchOptions = Array.from(
      new Set(homeworkRoster.map((student) => student.batch).filter(Boolean))
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
                  <button type="button" style={styles.secondaryButton} onClick={() => setHomeworkAssignedStudents((students.length ? students : directoryStudents).filter(s => s.studentId && (!homeworkClass || s.className === homeworkClass) && (!homeworkBatch || s.batch === homeworkBatch)).map(s => s.studentId!))}>Select all matching</button>
                  <button type="button" style={styles.secondaryButton} onClick={() => setHomeworkAssignedStudents([])}>Clear</button>
                </div>
                <div style={styles.studentPickerGrid}>
                  {(students.length ? students : directoryStudents).filter(s => (!isCR || s.className === studentData?.className) && (!homeworkClass || s.className === homeworkClass) && (!homeworkBatch || s.batch === homeworkBatch)).map(s => s.studentId ? (
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
                  {savingHomework ? "Saving..." : editingHomework ? (isCR ? "⏳ Send Edit for Approval" : "💾 Update Homework") : (isCR ? "⏳ Send for Admin Approval" : "💾 Add Homework")}
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
                  <div style={styles.completionSummary}><strong>{homeworkDefaulters(item).length}</strong> not completed · <strong>{(students.length ? students : directoryStudents).filter(s => s.studentId && homeworkForStudent(s).some(h => h.id === item.id)).length}</strong> assigned</div>
                  <div style={styles.defaulterList}>
                    {(students.length ? students : directoryStudents).filter(s => s.studentId && homeworkForStudent(s).some(h => h.id === item.id)).map(s => { const done = Boolean(((item as any).completion || {})[s.studentId!]); return <button key={s.studentId} type="button" style={done ? styles.doneStudentButton : styles.notDoneStudentButton} onClick={async () => { if ((!isAdmin && !isCR) || !item.id) return; const next = { ...(((item as any).completion || {}) as Record<string, boolean>), [s.studentId!]: !done }; if (isCR) { await createCrChangeRequest({ type: "homework_completion", targetId: item.id, studentId: profile?.studentId || "", submittedBy: user?.uid || "", submittedByName: profile?.name || "Class Representative", payload: { completion: next } }); setHomeworkMessage("Homework completion change sent to Admin for approval. ⏳"); } else { await updateHomework(item.id, { ...(item as any), completion: next }); await loadHomework(); } }}>{done ? "✓" : "○"} {s.name}</button>; })}
                  </div>
                  {homeworkDefaulters(item).length > 0 && <div style={styles.warningBox}>⚠ Homework Defaulters: {homeworkDefaulters(item).map(s => s.name).join(", ")}</div>}
                  <div style={styles.formActions}>
                    {(isAdmin || isCR) && <><button style={styles.editButton} onClick={() => openEditHomework(item)}>✏️ Edit</button>
                    <button style={styles.deleteButton} onClick={() => removeHomework(item)}>🗑️ Delete</button></>}
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
    const collectionPercent = totalMonthlyFees > 0 ? Math.min(100, Math.round((totalPaidThisMonth / totalMonthlyFees) * 100)) : 0;

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
          <div style={styles.sectionTitleRow}><div><h2 style={{margin:0}}>💳 Collection Progress</h2><p style={styles.muted}>Current month payment collection</p></div><strong>{collectionPercent}% collected</strong></div>
          <div style={{...styles.progressTrack,marginTop:14}}><div style={{...styles.progressFill,width:`${collectionPercent}%`}} /></div>
          <div style={{display:"flex",justifyContent:"space-between",gap:12,marginTop:9,fontSize:12,color:"#64748b"}}><span>Collected ₹{totalPaidThisMonth.toLocaleString("en-IN")}</span><span>Expected ₹{totalMonthlyFees.toLocaleString("en-IN")}</span></div>
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

                  const totalStudentPending = Math.max(Number(student.feeDue || 0), 0);

                  // Status is based on the student's TOTAL outstanding balance,
                  // not only the current month's balance. If every pending due
                  // is cleared, the student must always show Paid.
                  const status =
                    totalStudentPending === 0
                      ? "paid"
                      : paid > 0
                      ? "partial"
                      : "pending";

                  return (
                    <tr key={student.studentId || student.id}>
                      <td style={styles.td}>{student.studentId || "-"}</td>

                      <td style={styles.td}>
                        <button
                          type="button"
                          style={styles.feeStudentButton}
                          onClick={() => openFeeHistory(student)}
                          title="View total fee details"
                        >
                          <span style={styles.feeAvatar}>{(student.name || "?").trim().charAt(0).toUpperCase()}</span>
                          <span>
                            <strong>{student.name || "-"}</strong>
                            <small style={styles.feeStudentHint}>View total fee details</small>
                          </span>
                        </button>
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

                      <td style={styles.td}>
                        <strong style={{color: totalStudentPending === 0 ? "#15803d" : "#b91c1c"}}>
                          ₹{totalStudentPending.toLocaleString("en-IN")}
                        </strong>
                      </td>

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
                            📜 View Details
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
              <>
                {(() => {
                  const totalCharged = selectedFeeHistory.reduce((sum, fee) => sum + Number(fee.monthlyFee || 0), 0);
                  const totalPaid = selectedFeeHistory.reduce((sum, fee) => sum + Number(fee.paidAmount || 0), 0);
                  const totalPending = selectedFeeHistory.reduce((sum, fee) => sum + Number(fee.pendingAmount || 0), 0);
                  const overallStatus = totalPending === 0 ? "paid" : totalPaid > 0 ? "partial" : "pending";
                  const paidPercent = totalCharged > 0 ? Math.min(100, Math.round((totalPaid / totalCharged) * 100)) : 100;
                  return (
                    <div style={styles.feeDetailHero}>
                      <div>
                        <span style={styles.smallLabel}>TOTAL FEE SUMMARY</span>
                        <h3 style={{margin:"3px 0 5px",fontSize:22}}>₹{totalCharged.toLocaleString("en-IN")}</h3>
                        <p style={{...styles.muted,margin:0}}>All recorded months for this student</p>
                      </div>
                      <span style={overallStatus === "paid" ? styles.paidBadge : overallStatus === "partial" ? styles.partialBadge : styles.pendingBadge}>
                        {overallStatus === "paid" ? "🟢 Paid" : overallStatus === "partial" ? "🟠 Partial" : "🔴 Due"}
                      </span>
                      <div style={styles.feeDetailMetrics}>
                        <div><span style={styles.smallLabel}>Total Paid</span><strong style={{color:"#15803d"}}>₹{totalPaid.toLocaleString("en-IN")}</strong></div>
                        <div><span style={styles.smallLabel}>Total Pending</span><strong style={{color: totalPending === 0 ? "#15803d" : "#b91c1c"}}>₹{totalPending.toLocaleString("en-IN")}</strong></div>
                        <div><span style={styles.smallLabel}>Collection</span><strong>{paidPercent}%</strong></div>
                      </div>
                      <div style={{...styles.progressTrack,marginTop:12}}><div style={{...styles.progressFill,width:`${paidPercent}%`}} /></div>
                      {totalPending === 0 && <div style={styles.paidNotice}>✅ All recorded fee dues are cleared. Payment status: <strong>PAID</strong>.</div>}
                    </div>
                  );
                })()}

                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,margin:"18px 0 10px",flexWrap:"wrap"}}>
                  <div><h3 style={{margin:0}}>📅 Month-wise Details</h3><p style={{...styles.muted,margin:"4px 0 0"}}>Payments, dues and payment history for every recorded month.</p></div>
                </div>

                {selectedFeeHistory.map((fee) => (
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
                ))}
              </>
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
    const ranking = getStudentRanking();
    const unranked = students.filter((student) => student.studentId && !ranking.some((item) => item.studentId === student.studentId));
    return <>
      <div style={styles.pageHeader}><div><h1>📝 Tests & Results</h1><p style={styles.muted}>Create tests, enter marks, and rank every student across every class.</p></div>{isAdmin && <button style={styles.primaryButtonSmall} onClick={openAddTest}>➕ Create Test</button>}</div>
      {testMessage && <div style={testMessage.includes("successfully") ? styles.successBox : styles.errorBox}>{testMessage}</div>}
      {showTestForm && <div style={styles.card}><div style={styles.formHeader}><div><h2>{editingTest ? "✏️ Edit Test" : "➕ New Test"}</h2><p style={styles.muted}>Marks and percentages update automatically.</p></div><button style={styles.closeButton} onClick={resetTestForm}>✕</button></div>
        <form onSubmit={saveTest}><div style={styles.formGrid}><FormField label="Test Name *" value={testName} onChange={setTestName} placeholder="Unit Test 1"/><FormField label="Subject *" value={testSubject} onChange={setTestSubject} placeholder="Mathematics"/><FormField label="Class" value={testClass} onChange={setTestClass} placeholder="All classes" type="select" options={[{label:"All classes",value:""}, ...Array.from(new Set(students.map(s=>s.className).filter(Boolean))).map(v=>({label:v as string,value:v as string}))]}/><FormField label="Batch" value={testBatch} onChange={setTestBatch} placeholder="All batches"/><FormField label="Test Date *" value={testDate} onChange={setTestDate} type="date"/><FormField label="Total Marks *" value={testTotal} onChange={setTestTotal} type="number"/></div>
          <h3 style={{marginTop:24}}>Student Marks & Attendance</h3><div style={styles.tableWrapper}><table style={styles.table}><thead><tr><th style={styles.th}>Student</th><th style={styles.th}>Class</th><th style={styles.th}>Present?</th><th style={styles.th}>Marks / {Number(testTotal)||0}</th><th style={styles.th}>%</th></tr></thead><tbody>{students.filter(s=>(!testClass || s.className===testClass)&&(!testBatch || s.batch===testBatch)).map(s=>{if(!s.studentId)return null; const r=testResults[s.studentId]||{present:true,marks:null}; const pct=r.present&&r.marks!=null?(Number(r.marks)/Number(testTotal||1))*100:null; return <tr key={s.studentId}><td style={styles.td}>{s.name}</td><td style={styles.td}>{s.className}</td><td style={styles.td}><input type="checkbox" checked={r.present!==false} onChange={e=>setTestResults(prev=>({...prev,[s.studentId!]:{...r,present:e.target.checked,marks:e.target.checked?r.marks:null}}))}/> {r.present===false?"Absent":"Present"}</td><td style={styles.td}><input style={styles.compactInput} type="number" min="0" max={Number(testTotal)||0} disabled={r.present===false} value={r.marks ?? ""} onChange={e=>setTestResults(prev=>({...prev,[s.studentId!]:{...r,present:true,marks:e.target.value===""?null:Number(e.target.value)}}))}/></td><td style={styles.td}>{pct==null?"-":`${pct.toFixed(1)}%`}</td></tr>})}</tbody></table></div>
          <div style={styles.formActions}><button type="button" style={styles.secondaryButton} onClick={resetTestForm}>Cancel</button><button type="submit" style={styles.primaryButtonSmall} disabled={savingTest}>{savingTest?"Saving...":"💾 Save Test & Results"}</button></div>
        </form></div>}
      <div style={styles.card}><div style={styles.sectionTitleRow}><div><h2>📚 Test Library</h2><p style={styles.muted}>Browse tests class-wise and subject-wise.</p></div></div><div style={styles.filterBar}><select style={styles.filterInput} value={testLibraryClass} onChange={e=>setTestLibraryClass(e.target.value)}><option value="">All Classes</option>{Array.from(new Set(students.map(s=>s.className).filter(Boolean))).sort().map(v=><option key={v as string} value={v as string}>{v}</option>)}</select><select style={styles.filterInput} value={testLibrarySubject} onChange={e=>setTestLibrarySubject(e.target.value)}><option value="">All Subjects</option>{Array.from(new Set(tests.map(t=>t.subject).filter(Boolean))).sort().map(v=><option key={v as string} value={v}>{v}</option>)}</select></div>{(() => { const filteredTests=tests.filter(t=>(!testLibraryClass || !t.className || t.className===testLibraryClass)&&(!testLibrarySubject || t.subject===testLibrarySubject)); return testsLoading?<div style={styles.emptyBox}>Loading tests...</div>:filteredTests.length===0?<div style={styles.emptyBox}>No tests match the selected filters.</div>:filteredTests.map(test=>{const results=Object.values(test.results||{}) as TestResult[];const present=results.filter(r=>r?.present).length;const entered=results.filter(r=>r?.present&&r?.marks!=null);const avg=entered.length?entered.reduce((sum,r)=>sum+(Number(r.marks)/Number(test.total||1))*100,0)/entered.length:0;return <div key={test.id} style={styles.testCard}><div><div style={styles.homeworkMeta}><strong>{test.subject} · {test.name}</strong><span>{test.date}</span></div><p style={styles.muted}>{test.className||"All Classes"}{test.batch?` · ${test.batch}`:""} · {present} present · {entered.length} marks entered · Test average {avg.toFixed(1)}%</p></div><div style={styles.linkRow}>{isAdmin&&<button style={styles.secondaryButton} onClick={()=>setExpandedTestId(expandedTestId===test.id?null:(test.id||null))}>{expandedTestId===test.id?"Hide Results":"View Results"}</button>}{isAdmin&&<><button style={styles.editButton} onClick={()=>openEditTest(test)}>✏️ Edit</button><button style={styles.deleteButton} onClick={()=>deleteTest(test)}>🗑️ Delete</button></>}</div>{isAdmin&&expandedTestId===test.id&&<div style={styles.expandedTest}><div style={styles.expandedTestHeader}><strong>Student-wise result sheet</strong><span>{entered.length} marks entered · {present} present</span></div><div style={styles.tableWrapper}><table style={styles.table}><thead><tr><th style={styles.th}>Student</th><th style={styles.th}>Class</th><th style={styles.th}>Status</th><th style={styles.th}>Marks</th><th style={styles.th}>%</th></tr></thead><tbody>{students.filter(s=>s.studentId).filter(s=>!test.className||s.className===test.className).filter(s=>!test.batch||s.batch===test.batch).map(s=>{const r=(test.results||{})[s.studentId!];const pct=r?.present&&r.marks!=null?(Number(r.marks)/Number(test.total||1))*100:null;return <tr key={s.studentId}><td style={styles.td}>{s.name}</td><td style={styles.td}>{s.className}</td><td style={styles.td}>{r?.present===false?"Absent":r?.marks!=null?"Present":"Not entered"}</td><td style={styles.td}>{r?.present&&r.marks!=null?`${r.marks} / ${test.total}`:"—"}</td><td style={styles.td}>{pct==null?"—":`${pct.toFixed(1)}%`}</td></tr>})}</tbody></table></div></div>}</div>})})()}</div>
      <div style={styles.card}><h2>🏆 Overall Ranking · All Classes</h2><p style={styles.muted}>Average percentage across tests where the student was present and marks were entered.</p><div style={styles.tableWrapper}><table style={styles.table}><thead><tr><th style={styles.th}>Rank</th><th style={styles.th}>Student</th><th style={styles.th}>Class</th><th style={styles.th}>Tests Counted</th><th style={styles.th}>Average %</th></tr></thead><tbody>{ranking.map((s)=><tr key={s.studentId||s.id}><td style={styles.td}><strong>#{s.rank}</strong></td><td style={styles.td}>{s.name}</td><td style={styles.td}>{s.className}</td><td style={styles.td}>{s.testsCounted}</td><td style={styles.td}><strong>{s.computedAverage.toFixed(2)}%</strong></td></tr>)}{unranked.map((s)=><tr key={s.studentId||s.id}><td style={styles.td}>—</td><td style={styles.td}>{s.name}</td><td style={styles.td}>{s.className}</td><td style={styles.td}>0</td><td style={styles.td}><span style={styles.muted}>Not ranked yet</span></td></tr>)}</tbody></table></div></div>
    </>;
  };

  const attendancePage = () => {
    const selected = attendanceDays.find(a=>a.date===attendanceDate);
    const historyForStudent = (sid:string) => attendanceDays.filter(d=>d.records?.[sid]).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    return <>
      <div style={styles.pageHeader}><div><h1>📅 Attendance</h1><p style={styles.muted}>{isCR ? "Full attendance register. Every change requires Admin approval." : "Daily present/absent register with student-wise history."}</p></div>{(isAdmin || isCR)&&<div style={{display:"flex",gap:8}}><button style={styles.secondaryButton} onClick={()=>setAllAttendance("present")}>✓ Mark All Present</button><button style={styles.secondaryButton} onClick={()=>setAllAttendance("absent")}>✕ Mark All Absent</button><button style={styles.primaryButtonSmall} onClick={saveAttendance}>💾 {isCR ? "Submit for Admin Approval" : "Save Attendance"}</button></div>}</div>
      {attendanceMessage&&<div style={attendanceMessage.includes("successfully")?styles.successBox:styles.errorBox}>{attendanceMessage}</div>}
      <div style={styles.card}><div style={styles.formGrid}><FormField label="Attendance Date" value={attendanceDate} onChange={(v)=>{setAttendanceDate(v);const row=attendanceDays.find(a=>a.date===v);setAttendanceRecords(row?.records||{});}} type="date"/></div>{attendanceLoading?<div style={styles.emptyBox}>Loading attendance...</div>:<div style={styles.tableWrapper}><table style={styles.table}><thead><tr><th style={styles.th}>Student</th><th style={styles.th}>Class</th><th style={styles.th}>Batch</th><th style={styles.th}>Status</th></tr></thead><tbody>{(students.length ? students : directoryStudents).filter(s => !isCR || s.className === studentData?.className).map(s=>s.studentId?<tr key={s.studentId}><td style={styles.td}>{s.name}</td><td style={styles.td}>{s.className}</td><td style={styles.td}>{s.batch||"-"}</td><td style={styles.td}><button disabled={false} style={(attendanceRecords[s.studentId]||"absent")==="present"?styles.doneStudentButton:styles.notDoneStudentButton} onClick={()=>setAttendanceRecords(prev=>({...prev,[s.studentId!]:prev[s.studentId!]==="present"?"absent":"present"}))}>{(attendanceRecords[s.studentId]||"absent")==="present"?"✓ Present":"○ Absent"}</button></td></tr>:null)}</tbody></table></div>}</div>
      <div style={styles.card}><h2>📊 Attendance Summary</h2><div style={styles.grid}>{(students.length ? students : directoryStudents).map(s=>{if(!s.studentId)return null;const rows=historyForStudent(s.studentId);const present=rows.filter(r=>r.records?.[s.studentId]==="present").length;const pct=rows.length?present/rows.length*100:0;return <div key={s.studentId} style={styles.summaryMiniCard}><strong>{s.name}</strong><span>{s.className}</span><b>{pct.toFixed(0)}%</b><small>{present}/{rows.length} days present</small></div>})}</div></div>
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

          {(isAdmin || isCR) && (
            <button
              style={
                page === "homework" ? styles.navButtonActive : styles.navButton
              }
              onClick={() => setPage("homework")}
            >
              📚 Homework
            </button>
          )}

          {isAdmin && <button
            style={page === "cr" ? styles.navButtonActive : styles.navButton}
            onClick={() => setPage("cr")}
          >
            ⭐ Class Representative
          </button>}

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

          {page === "studentDetail" && selectedStudent && studentDetailPage(selectedStudent)}

          {page === "teachers" && <TeacherPage
            isAdmin={isAdmin}
            teachers={teachers}
            showForm={showTeacherForm}
            editing={editingTeacher}
            name={teacherName}
            subject={teacherSubject}
            className={teacherClass}
            batch={teacherBatch}
            mobile={teacherMobile}
            email={teacherEmail}
            message={teacherMessage}
            setName={setTeacherName}
            setSubject={setTeacherSubject}
            setClassName={setTeacherClass}
            setBatch={setTeacherBatch}
            setMobile={setTeacherMobile}
            setEmail={setTeacherEmail}
            onAdd={openAddTeacher}
            onEdit={openEditTeacher}
            onDelete={deleteTeacher}
            onSave={saveTeacher}
            onClose={resetTeacherForm}
          />}

          {page === "tests" && testsPage()}

          {page === "attendance" && attendancePage()}

          {page === "fees" && feesPage()}

          {page === "feeDetail" && selectedFeeStudent && feeDetailPage(selectedFeeStudent, selectedFeeHistory)}

          {page === "homework" && (isAdmin || isCR) && homeworkPage()}

          {page === "cr" && (isAdmin ? crAdminPage() : null)}

          {page === "notices" && noticesPage()}
        </main>
      </div>
    </div>
  );
}

/* =========================================================
   TEACHER PAGE
========================================================= */
function TeacherPage(props: any) {
  const { isAdmin, teachers, showForm, editing, name, subject, className, batch, mobile, email, message, setName, setSubject, setClassName, setBatch, setMobile, setEmail, onAdd, onEdit, onDelete, onSave, onClose } = props;
  return <React.Fragment>
    <div style={styles.pageHeader}><div><h1>👨‍🏫 Teachers</h1><p style={styles.muted}>Manage faculty, subjects, classes and contact details.</p></div>{isAdmin && <button style={styles.primaryButtonSmall} onClick={onAdd}>➕ Add Teacher</button>}</div>
    {message && <div style={message.includes("successfully") ? styles.successBox : styles.errorBox}>{message}</div>}
    {showForm && isAdmin && <div style={styles.card}><div style={styles.formHeader}><div><h2>{editing ? "✏️ Edit Teacher" : "➕ Add Teacher"}</h2><p style={styles.muted}>Keep faculty information up to date.</p></div><button style={styles.closeButton} onClick={onClose}>✕</button></div>
      <form onSubmit={onSave}><div style={styles.formGrid}>
        <FormField label="Teacher Name *" value={name} onChange={setName} placeholder="Teacher name"/>
        <FormField label="Subject *" value={subject} onChange={setSubject} placeholder="Mathematics"/>
        <FormField label="Class" value={className} onChange={setClassName} placeholder="Class 9" required={false}/>
        <FormField label="Batch" value={batch} onChange={setBatch} placeholder="9 A" required={false}/>
        <FormField label="Mobile" value={mobile} onChange={setMobile} placeholder="Phone number" required={false}/>
        <FormField label="Email" value={email} onChange={setEmail} placeholder="teacher@example.com" required={false}/>
      </div><div style={styles.formActions}><button type="button" style={styles.secondaryButton} onClick={onClose}>Cancel</button><button type="submit" style={styles.primaryButtonSmall}>💾 {editing ? "Update Teacher" : "Save Teacher"}</button></div></form>
    </div>}
    <div style={styles.card}><div style={styles.sectionTitleRow}><div><h2>Faculty Directory</h2><p style={styles.muted}>{teachers.length} teacher{teachers.length===1?"":"s"} registered</p></div></div>{teachers.length===0?<div style={styles.emptyBox}>No teachers added yet.</div>:<div style={styles.tableWrapper}><table style={styles.table}><thead><tr><th style={styles.th}>Teacher</th><th style={styles.th}>Subject</th><th style={styles.th}>Class</th><th style={styles.th}>Batch</th><th style={styles.th}>Contact</th>{isAdmin&&<th style={styles.th}>Action</th>}</tr></thead><tbody>{teachers.map((t:Teacher)=><tr key={t.id}><td style={styles.td}><strong>{t.name||"-"}</strong></td><td style={styles.td}>{t.subject||"-"}</td><td style={styles.td}>{t.className||"All"}</td><td style={styles.td}>{t.batch||"All"}</td><td style={styles.td}>{t.mobile||t.email||"-"}</td>{isAdmin&&<td style={styles.td}><button style={styles.editButton} onClick={()=>onEdit(t)}>✏️ Edit</button> <button style={styles.deleteButton} onClick={()=>onDelete(t)}>🗑️ Delete</button></td>}</tr>)}</tbody></table></div>}</div>
  </React.Fragment>;
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
  studentTopbar:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,padding:"14px 24px",background:"linear-gradient(135deg,#020617,#0f172a 55%,#1d4ed8)",color:"#fff",position:"sticky",top:0,zIndex:20,boxShadow:"0 8px 30px rgba(2,6,23,.18)"},
  studentShell:{display:"grid",gridTemplateColumns:"250px minmax(0,1fr)",minHeight:"calc(100vh - 76px)"},
  studentSidebar:{padding:"22px 14px",background:"rgba(255,255,255,.94)",borderRight:"1px solid #dbe4f0",backdropFilter:"blur(16px)",position:"sticky",top:76,height:"calc(100vh - 76px)",boxSizing:"border-box"},
  studentNavLabel:{fontSize:11,fontWeight:800,letterSpacing:".12em",color:"#64748b",padding:"8px 12px 12px"},
  studentNav:{width:"100%",border:0,background:"transparent",display:"flex",gap:12,alignItems:"center",textAlign:"left",padding:"12px 14px",borderRadius:13,margin:"4px 0",cursor:"pointer",fontWeight:700,color:"#475569"},
  studentNavActive:{width:"100%",border:0,display:"flex",gap:12,alignItems:"center",textAlign:"left",padding:"12px 14px",borderRadius:13,margin:"4px 0",cursor:"pointer",fontWeight:800,background:"linear-gradient(135deg,#eff6ff,#dbeafe)",color:"#1d4ed8",boxShadow:"inset 3px 0 0 #2563eb"},
  studentSideCard:{margin:"22px 4px 0",padding:15,borderRadius:16,background:"linear-gradient(145deg,#020617,#172554)",color:"#fff",boxShadow:"0 12px 28px rgba(15,23,42,.16)"},
  studentMain:{padding:28,minWidth:0,maxWidth:1500,width:"100%",boxSizing:"border-box",margin:"0 auto",background:"radial-gradient(circle at 10% 10%,rgba(37,99,235,.07),transparent 25%),radial-gradient(circle at 90% 20%,rgba(14,165,233,.06),transparent 25%),#f6f8fc"},
  studentPageHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:20,marginBottom:22},
  studentHeaderRank:{background:"#fff",border:"1px solid #dbe4f0",padding:"12px 18px",borderRadius:16,textAlign:"right",boxShadow:"0 8px 24px rgba(15,23,42,.06)"},
  studentHero:{position:"relative",overflow:"hidden",display:"flex",justifyContent:"space-between",alignItems:"center",padding:30,borderRadius:24,color:"#fff",marginBottom:20,background:"linear-gradient(135deg,#020617,#172554 46%,#2563eb)",boxShadow:"0 22px 50px rgba(30,64,175,.20)"},
  heroAvatar:{width:82,height:82,borderRadius:24,background:"rgba(255,255,255,.16)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:34,overflow:"hidden",border:"1px solid rgba(255,255,255,.25)"},
  quickList:{display:"grid",gap:9},
  quickItem:{border:"1px solid #e2e8f0",background:"#fff",borderRadius:13,padding:"13px 15px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",color:"#0f172a",textAlign:"left"},
  centerPage:{minHeight:"100vh",display:"flex",justifyContent:"center",alignItems:"center",background:"linear-gradient(135deg,#eef2ff,#f8fafc 48%,#e0e7ff)",fontFamily:"Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"},
  loadingCard:{background:"#fff",padding:42,borderRadius:24,textAlign:"center",boxShadow:"0 24px 70px rgba(15,23,42,.12)",border:"1px solid #e2e8f0"},
  loginPage:{minHeight:"100vh",display:"flex",justifyContent:"center",alignItems:"center",padding:24,background:"radial-gradient(circle at 12% 10%,#dbeafe 0,#eef2ff 28%,#f8fafc 65%,#e0e7ff 100%)",fontFamily:"Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"},
  loginCard:{width:"100%",maxWidth:460,background:"rgba(255,255,255,.94)",padding:42,borderRadius:28,boxShadow:"0 30px 90px rgba(15,23,42,.16)",border:"1px solid rgba(255,255,255,.8)"},
  logoCircle:{width:76,height:76,borderRadius:22,background:"linear-gradient(135deg,#4f46e5,#2563eb)",display:"flex",justifyContent:"center",alignItems:"center",fontSize:35,margin:"0 auto 20px",boxShadow:"0 16px 30px rgba(37,99,235,.25)"},
  loginTitle:{textAlign:"center",marginBottom:8,fontSize:28,letterSpacing:"-.5px"},
  muted:{color:"#64748b",marginTop:5,lineHeight:1.55},
  loginNote:{textAlign:"center",color:"#64748b",fontSize:13,marginTop:20},
  label:{display:"block",fontWeight:700,marginBottom:7,marginTop:16,color:"#1e293b",fontSize:13},
  input:{width:"100%",boxSizing:"border-box",padding:"13px 14px",border:"1px solid #cbd5e1",borderRadius:12,fontSize:14,outline:"none",background:"#fff",color:"#0f172a"},
  primaryButton:{width:"100%",border:"none",borderRadius:12,padding:"13px 18px",background:"linear-gradient(135deg,#4f46e5,#2563eb)",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",marginTop:20,boxShadow:"0 10px 22px rgba(37,99,235,.22)"},
  primaryButtonSmall:{border:"none",borderRadius:11,padding:"11px 16px",background:"linear-gradient(135deg,#4f46e5,#2563eb)",color:"#fff",fontWeight:800,cursor:"pointer",boxShadow:"0 8px 18px rgba(37,99,235,.18)"},
  secondaryButton:{border:"1px solid #dbe2ea",borderRadius:11,padding:"10px 14px",background:"#fff",color:"#334155",fontWeight:700,cursor:"pointer"},
  editButton:{border:"none",borderRadius:10,padding:"9px 12px",background:"#f59e0b",color:"#fff",fontWeight:800,cursor:"pointer"},
  paidBadge:{display:"inline-block",padding:"6px 10px",borderRadius:999,background:"#dcfce7",color:"#166534",fontWeight:800,fontSize:11},
  partialBadge:{display:"inline-block",padding:"6px 10px",borderRadius:999,background:"#ffedd5",color:"#9a3412",fontWeight:800,fontSize:11},
  pendingBadge:{display:"inline-block",padding:"6px 10px",borderRadius:999,background:"#fee2e2",color:"#991b1b",fontWeight:800,fontSize:11},
  paidButton:{border:"none",borderRadius:10,padding:"9px 12px",background:"#16a34a",color:"#fff",fontWeight:800,cursor:"pointer"},
  logoutButton:{border:"none",borderRadius:11,padding:"10px 15px",background:"#0f172a",color:"#fff",fontWeight:800,cursor:"pointer"},
  closeButton:{border:"1px solid #e2e8f0",background:"#fff",borderRadius:10,width:36,height:36,cursor:"pointer",fontSize:16,color:"#475569"},
  errorBox:{background:"#fff1f2",color:"#be123c",padding:13,borderRadius:12,marginTop:15,wordBreak:"break-word",border:"1px solid #fecdd3"},
  successBox:{background:"#ecfdf5",color:"#047857",padding:13,borderRadius:12,marginTop:15,wordBreak:"break-word",border:"1px solid #a7f3d0"},
  appPage:{minHeight:"100vh",background:"linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%)",fontFamily:"Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",color:"#0f172a"},
  topbar:{position:"sticky",top:0,zIndex:20,minHeight:76,background:"rgba(255,255,255,.88)",backdropFilter:"blur(18px)",borderBottom:"1px solid rgba(148,163,184,.18)",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 28px",boxSizing:"border-box"},
  topbarSub:{margin:"3px 0 0",color:"#64748b",fontSize:12},
  topbarActions:{display:"flex",alignItems:"center",gap:12},
  brandBlock:{display:"flex",alignItems:"center",gap:11},
  brandMark:{width:42,height:42,borderRadius:13,display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#4f46e5,#2563eb)",fontSize:22,boxShadow:"0 10px 22px rgba(37,99,235,.2)"},
  userPill:{display:"flex",alignItems:"center",gap:9,padding:"6px 11px 6px 7px",border:"1px solid #e2e8f0",borderRadius:999,background:"#fff",fontWeight:700,fontSize:13},
  avatarSmall:{width:30,height:30,borderRadius:"50%",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",background:"#eef2ff"},
  layout:{display:"flex",minHeight:"calc(100vh - 76px)"},
  sidebar:{width:238,background:"linear-gradient(180deg,#0b1220 0%,#101827 58%,#172554 100%)",padding:"22px 14px",boxSizing:"border-box",position:"sticky",top:76,height:"calc(100vh - 76px)",overflowY:"auto"},
  navButton:{width:"100%",textAlign:"left",border:"1px solid transparent",background:"transparent",color:"#aab5c7",padding:"12px 13px",borderRadius:12,cursor:"pointer",marginBottom:6,fontSize:13,fontWeight:650},
  navButtonActive:{width:"100%",textAlign:"left",border:"1px solid rgba(255,255,255,.1)",background:"linear-gradient(135deg,#4f46e5,#2563eb)",color:"#fff",padding:"12px 13px",borderRadius:12,cursor:"pointer",marginBottom:6,fontSize:13,fontWeight:800,boxShadow:"0 10px 22px rgba(37,99,235,.24)"},
  main:{flex:1,padding:"32px clamp(18px,3vw,42px)",boxSizing:"border-box",overflow:"auto",maxWidth:1500,margin:"0 auto",width:"100%"},
  pageHeader:{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:18,marginBottom:24},
  grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(205px,1fr))",gap:16,marginBottom:20},
  statCard:{background:"rgba(255,255,255,.9)",borderRadius:18,padding:"18px 19px",display:"flex",alignItems:"center",gap:13,boxShadow:"0 12px 30px rgba(15,23,42,.06)",border:"1px solid #e7edf5"},
  statIcon:{width:48,height:48,borderRadius:15,background:"linear-gradient(135deg,#eef2ff,#dbeafe)",display:"flex",justifyContent:"center",alignItems:"center",fontSize:22},
  statTitle:{margin:0,color:"#64748b",fontSize:12,fontWeight:700},
  statValue:{margin:"5px 0 0",fontSize:23,letterSpacing:"-.4px"},
  card:{background:"rgba(255,255,255,.92)",borderRadius:20,padding:"22px 24px",marginBottom:18,boxShadow:"0 12px 34px rgba(15,23,42,.055)",border:"1px solid #e6ebf2"},
  studentWelcome:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:20,background:"linear-gradient(120deg,#0f172a 0%,#312e81 55%,#2563eb 100%)",color:"#fff",padding:"28px 30px",borderRadius:24,marginBottom:20,boxShadow:"0 20px 50px rgba(37,99,235,.22)"},
  dashboardHero:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:20,background:"linear-gradient(120deg,#0f172a,#1e1b4b 55%,#2563eb)",color:"#fff",padding:"26px 30px",borderRadius:24,marginBottom:20,boxShadow:"0 20px 50px rgba(37,99,235,.16)"},
  heroEyebrow:{fontSize:11,fontWeight:900,letterSpacing:"1.6px",opacity:.75},
  heroMetric:{minWidth:145,textAlign:"right",display:"flex",flexDirection:"column",gap:2},
  heroMetricSpan:{},
  heroDate:{display:"flex",flexDirection:"column",textAlign:"right",gap:3,opacity:.9},
  twoColumn:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(310px,1fr))",gap:18},
  dashboardColumns:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(330px,1fr))",gap:18},
  infoRow:{display:"flex",justifyContent:"space-between",gap:20,padding:"12px 0",borderBottom:"1px solid #eef2f7"},
  infoLabel:{color:"#64748b"},
  emptyBox:{background:"linear-gradient(135deg,#f8fafc,#eef2ff)",borderRadius:15,padding:26,textAlign:"center",color:"#64748b",border:"1px dashed #dbe3ee"},
  formHeader:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:15},
  formGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:4},
  formActions:{display:"flex",justifyContent:"flex-end",gap:9,marginTop:18,flexWrap:"wrap"},
  tableWrapper:{overflowX:"auto",border:"1px solid #e6ebf2",borderRadius:14},
  table:{width:"100%",borderCollapse:"collapse",minWidth:820,background:"#fff"},
  th:{textAlign:"left",padding:"12px 13px",background:"#f8fafc",borderBottom:"1px solid #e2e8f0",fontSize:11,textTransform:"uppercase",letterSpacing:".45px",color:"#64748b",whiteSpace:"nowrap"},
  td:{padding:"12px 13px",borderBottom:"1px solid #eef2f7",fontSize:13,color:"#334155"},
  historyButton:{border:"none",borderRadius:10,padding:"9px 12px",background:"#4f46e5",color:"#fff",fontWeight:800,cursor:"pointer"},
  feeStudentButton:{border:"none",background:"transparent",padding:0,display:"flex",alignItems:"center",gap:9,cursor:"pointer",textAlign:"left",color:"#0f172a"},
  feeAvatar:{width:34,height:34,borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",background:"#eef2ff",color:"#3730a3",fontWeight:900,flexShrink:0},
  feeStudentHint:{display:"block",fontSize:10,color:"#64748b",marginTop:2,fontWeight:600},
  feeDetailHero:{border:"1px solid #c7d2fe",borderRadius:18,padding:18,background:"linear-gradient(135deg,#f8fafc,#eef2ff)",marginBottom:18},
  feeDetailMetrics:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginTop:16},
  eligibilityList:{display:"grid",gap:8,marginTop:12},
  eligibilityRow:{display:"grid",gridTemplateColumns:"28px 1fr auto",alignItems:"center",gap:8,padding:"10px 12px",border:"1px solid #e5eaf1",borderRadius:11,background:"#fbfdff"},
  requestCard:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,padding:14,border:"1px solid #e5eaf1",borderRadius:14,marginTop:10,background:"#fff",flexWrap:"wrap"},
  crPublicGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:12,marginTop:14},
  crPublicCard:{display:"flex",alignItems:"center",gap:14,padding:16,borderRadius:16,border:"1px solid #dbe3ff",background:"linear-gradient(135deg,#f8fafc,#eef2ff)"},
  paidNotice:{marginTop:12,padding:"10px 12px",borderRadius:10,background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#166534",fontSize:12},
  infoNotice:{background:"#eff6ff",color:"#1e40af",padding:14,borderRadius:12,marginTop:15,marginBottom:10,lineHeight:1.55,border:"1px solid #bfdbfe"},
  monthFeeCard:{border:"1px solid #e2e8f0",borderRadius:15,padding:16,background:"#f8fafc"},
  homeworkList:{display:"grid",gap:13},
  homeworkItem:{border:"1px solid #e5eaf1",borderRadius:16,padding:17,background:"#fff",boxShadow:"0 6px 18px rgba(15,23,42,.035)"},
  homeworkMeta:{display:"flex",justifyContent:"space-between",gap:12,color:"#64748b",fontSize:12,flexWrap:"wrap"},
  feeHistoryGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16},
  smallLabel:{display:"block",color:"#64748b",fontSize:11,marginBottom:4,fontWeight:700},
  paymentHistoryRow:{display:"flex",gap:12,flexWrap:"wrap",padding:"11px 0",borderBottom:"1px solid #e5e7eb",fontSize:13},
  filterBar:{display:"flex",gap:9,flexWrap:"wrap",margin:"14px 0"},
  filterInput:{padding:"10px 12px",border:"1px solid #cbd5e1",borderRadius:10,background:"#fff",minWidth:170,outline:"none"},
  quickGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10,marginTop:14},
  quickAction:{border:"1px solid #e2e8f0",borderRadius:14,padding:14,background:"linear-gradient(135deg,#fff,#f8fafc)",display:"flex",alignItems:"center",gap:12,cursor:"pointer",textAlign:"left",color:"#0f172a"},
  directorEditor:{display:"flex",gap:18,alignItems:"flex-start"},
  profileHero:{display:"flex",alignItems:"center",gap:14,marginBottom:14},
  avatarLarge:{width:76,height:76,borderRadius:"50%",background:"#eef2ff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,overflow:"hidden",border:"3px solid #fff",boxShadow:"0 10px 24px rgba(37,99,235,.15)"},
  avatarDirector:{width:66,height:66,borderRadius:"50%",background:"#eef2ff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,overflow:"hidden",flexShrink:0,border:"3px solid #fff",boxShadow:"0 8px 20px rgba(37,99,235,.12)"},
  avatarImage:{width:"100%",height:"100%",objectFit:"cover"},
  directorCard:{display:"flex",gap:14,alignItems:"center",padding:16,borderRadius:16,background:"linear-gradient(135deg,#f8fafc,#eef2ff)",border:"1px solid #dbe3ff"},
  calendarCard:{padding:18,border:"1px solid #e5eaf1",borderRadius:18,background:"#fbfdff"},
  calendarToolbar:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:14},
  monthInput:{padding:"8px 10px",border:"1px solid #cbd5e1",borderRadius:9,background:"#fff"},
  calendarGrid:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:7},
  calendarHead:{textAlign:"center",fontSize:10,fontWeight:900,color:"#94a3b8",padding:"5px 0"},
  calendarDay:{aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"50%",background:"#f1f5f9",fontSize:13,fontWeight:800,color:"#475569",maxWidth:42,margin:"auto",width:"100%"},
  calendarPresent:{background:"#dcfce7",color:"#166534",boxShadow:"inset 0 0 0 2px #22c55e"},
  calendarAbsent:{background:"#fee2e2",color:"#991b1b",boxShadow:"inset 0 0 0 2px #ef4444"},
  sectionTitleRow:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12},
  noticeItem:{border:"1px solid #e5eaf1",borderRadius:15,padding:16,marginBottom:11,background:"#fff"},
  noticeCompact:{padding:"12px 0",borderBottom:"1px solid #eef2f7"},
  noticeBadge:{display:"inline-block",padding:"5px 9px",borderRadius:999,background:"#eef2ff",color:"#3730a3",fontSize:10,fontWeight:900,letterSpacing:.5},
  doneBadge:{display:"inline-block",padding:"6px 10px",borderRadius:999,background:"#dcfce7",color:"#166534",fontWeight:800,fontSize:11},
  studentPicker:{border:"1px solid #e5eaf1",borderRadius:14,padding:12,background:"#f8fafc"},
  pickerToolbar:{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"},
  studentPickerGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8,maxHeight:250,overflowY:"auto"},
  studentPickerItem:{display:"flex",alignItems:"center",gap:8,padding:9,border:"1px solid #e5eaf1",borderRadius:10,background:"#fff",cursor:"pointer"},
  completionSummary:{marginTop:12,padding:"11px 12px",borderRadius:10,background:"#f8fafc",fontSize:12,border:"1px solid #eef2f7"},
  defaulterList:{display:"flex",flexWrap:"wrap",gap:7,marginTop:10},
  doneStudentButton:{border:"1px solid #bbf7d0",borderRadius:999,padding:"7px 10px",background:"#f0fdf4",color:"#166534",fontWeight:800,cursor:"pointer"},
  notDoneStudentButton:{border:"1px solid #fecaca",borderRadius:999,padding:"7px 10px",background:"#fef2f2",color:"#991b1b",fontWeight:800,cursor:"pointer"},
  warningBox:{marginTop:10,padding:12,borderRadius:11,background:"#fff7ed",color:"#9a3412",fontWeight:700,lineHeight:1.5,border:"1px solid #fed7aa"},
  testCard:{border:"1px solid #e5eaf1",borderRadius:16,padding:17,marginBottom:12,background:"#fff",display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap",boxShadow:"0 6px 18px rgba(15,23,42,.035)"},
  linkRow:{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"},
  linkButton:{display:"inline-block",textDecoration:"none",border:"1px solid #c7d2fe",borderRadius:9,padding:"8px 11px",background:"#eef2ff",color:"#3730a3",fontWeight:800,fontSize:12},
  deleteButton:{border:"none",borderRadius:10,padding:"9px 12px",background:"#dc2626",color:"#fff",fontWeight:800,cursor:"pointer"},
  compactInput:{width:100,padding:"8px 9px",border:"1px solid #cbd5e1",borderRadius:9,boxSizing:"border-box"},
  summaryMiniCard:{background:"linear-gradient(135deg,#fff,#f8fafc)",border:"1px solid #e5eaf1",borderRadius:15,padding:15,display:"flex",flexDirection:"column",gap:5},
  liveBadge:{fontSize:10,fontWeight:900,letterSpacing:1,color:"#047857",background:"#ecfdf5",border:"1px solid #a7f3d0",borderRadius:999,padding:"6px 9px"},
  metricList:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginTop:15},
  progressWrap:{marginTop:18},
  progressLabel:{display:"flex",justifyContent:"space-between",fontSize:12,color:"#64748b",fontWeight:700,marginBottom:7},
  progressTrack:{height:9,borderRadius:999,background:"#e2e8f0",overflow:"hidden"},
  progressFill:{height:"100%",borderRadius:999,background:"linear-gradient(90deg,#4f46e5,#22c55e)"},
  textButton:{border:"none",background:"transparent",color:"#4f46e5",fontWeight:800,cursor:"pointer",padding:5},
  topRankList:{display:"grid",gap:7,marginTop:13},
  rankRow:{display:"flex",alignItems:"center",gap:10,padding:"11px 12px",border:"1px solid #edf1f6",borderRadius:12,background:"#fbfdff",fontSize:13},
  rankRowCurrent:{border:"1px solid #c7d2fe",background:"#eef2ff"},
  rankBadge:{width:58,height:58,borderRadius:18,display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#f59e0b,#f97316)",color:"#fff",fontSize:18,fontWeight:900,boxShadow:"0 10px 22px rgba(245,158,11,.22)"},
  expandedTest:{marginTop:14,padding:14,borderRadius:14,background:"#f8fafc",border:"1px solid #e5eaf1",width:"100%"},
  expandedTestHeader:{display:"flex",justifyContent:"space-between",gap:10,marginBottom:10,color:"#475569",fontSize:12},
};

