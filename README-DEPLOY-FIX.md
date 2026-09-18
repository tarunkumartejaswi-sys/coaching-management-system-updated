# Coaching Management System - Final Deployment Fix

## 1. Vercel

Upload the CONTENTS of this folder to the GitHub repository root.

Required root files include:
- package.json
- index.html
- src/
- api/
- firebase/
- firestore.rules
- firebase.json
- vercel.json

Vercel settings:
- Framework: Vite
- Build Command: npm run build
- Output Directory: dist

The root build is intentionally `vite build`; TypeScript checking is available separately as `npm run typecheck`.

## 2. Firebase Firestore rules - REQUIRED

Vercel deployment does NOT deploy Firestore rules.

From this project root run:

    firebase login
    firebase use <YOUR_FIREBASE_PROJECT_ID>
    firebase deploy --only firestore:rules

The included rules fix the student-profile permission problem by authorizing a student/CR using the `users/{uid}.studentId` mapping, while keeping admin-only writes for protected data.

If your Firebase project uses a different ID, update `.firebaserc` before running `firebase use`.

## 3. Profile permissions

Student and CR users can edit only:
- name
- fatherName
- motherName
- address
- mobile
- dob
- gender
- photoUrl

They cannot edit class, batch, fee, attendance, marks, role, CR status, or other admin-controlled fields.

## 4. CR workflow

Eligibility requires ALL five:
- fee pending = ₹0
- attendance > 90%
- rank 1-5
- average > 80%
- no pending due homework

Eligible students can apply. Admin can also directly assign CR to any student.
CR attendance/homework changes are submitted as requests and require admin approval before the real record changes.
