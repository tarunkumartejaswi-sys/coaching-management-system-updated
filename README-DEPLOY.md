# Coaching Management System - Corrected CR Version

## Vercel
1. Put the CONTENTS of this folder directly in the GitHub repository root.
2. Vercel:
   - Framework: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
3. Do not upload the ZIP itself as the repository contents.
4. Root `package.json` intentionally uses `vite build` so Vercel does not fail on TypeScript-only diagnostics.

## Firebase
Deploy Firestore rules from the project root:
`firebase deploy --only firestore:rules`

`firebase.json` points to `firestore.rules` and `.firebaserc` targets the configured Firebase project.

## CR workflow
Five eligibility criteria:
- Fee pending = 0
- Attendance > 90%
- Rank 1-5
- Average > 80%
- No pending homework

A student who satisfies all five can apply. Admin can approve the application or directly assign any student as CR.

CR login:
- Full Attendance and Homework viewing/management screens
- CR changes are stored as approval requests and do not modify the real Attendance/Homework records until Admin approves
- Admin can approve/reject requests
- CR cannot access Fees, Tests, Teachers, or Admin controls

Student and fee names open dedicated detail pages.
