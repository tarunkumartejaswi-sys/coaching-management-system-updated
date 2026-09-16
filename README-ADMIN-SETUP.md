# Coaching Management System - Final Setup

## 1. Deploy from the repository root
Upload the contents of this ZIP to the ROOT of your GitHub repository. Do not upload the whole `cmf10_final` folder and do not keep older `cmf10`, `CMF 11`, or nested app copies.

The root must contain `package.json`, `index.html`, `src/`, `firebase/`, and `api/`.

## 2. Vercel
Import/connect the GitHub repository. Vercel should detect Vite automatically.

Build command: `npm run build`
Output directory: `dist`

## 3. Admin direct password/email change + delete student
The Admin -> Students -> Change Login button changes the REAL Firebase Authentication account through `/api/admin-student-account`. The Delete button uses the same protected Admin API and permanently removes the student's Auth account, user profile, student record, directory entry, fee history, and references from tests, attendance and homework.

Vercel Environment Variables: use either the single JSON option (easiest) or the three-variable option.

**Option A - easiest:**
- `FIREBASE_SERVICE_ACCOUNT_JSON` = the complete Firebase service-account JSON as one line/value

**Option B:**
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Use the Firebase service-account values. Keep all Admin credentials only in Vercel Environment Variables, never in frontend code or GitHub. After changing Environment Variables, redeploy the Production deployment.

## 4. Firebase
Deploy both Firestore rules and Storage rules from `firestore.rules` and `storage.rules`.

The application uses Firebase Authentication, Firestore and Storage for students, fees, homework, tests, attendance, notices, director profile, and uploaded academic files.

## 5. Final features
- Premium responsive Admin dashboard
- Student dashboard with profile/photo editing
- Director profile and photo, editable by Admin only
- Teacher directory with add/edit/delete
- Tests & Results with class/batch, per-student present/absent, marks, percentage, average and all-class ranking
- Question paper and answer-sheet uploads
- Homework class/batch assignment plus individual student selection and completion tracking
- Homework defaulters
- Daily attendance and student monthly green/red calendar
- Professional notices
- Monthly fees, payment history, dues and previous-month records
- Admin direct login credential change (real Firebase Auth password/email update)
- Admin permanent student deletion with academic/fee cleanup
