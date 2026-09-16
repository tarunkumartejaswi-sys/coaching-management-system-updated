# Admin credential setup

The Admin -> Students -> Change Login feature changes the real Firebase Authentication account.
It requires these Vercel server-side environment variables:

- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY

Create/download a Firebase service-account key for the same Firebase project and copy its `project_id`, `client_email`, and `private_key` into Vercel Environment Variables. Do not commit the service-account JSON file to GitHub and do not paste the private key into chat.

The frontend calls `/api/admin-student-account`. The API verifies the logged-in Firebase ID token, checks the `users/{uid}` profile has `role: "admin"`, and only then updates the selected student's Firebase Auth password/email.

## Academic Modules Added
- Homework can be assigned to selected students or a whole class/batch. Admin can click each student to toggle Done / Not Done. Homework defaulters are visible in admin and student dashboards.
- Tests & Results supports test creation, class/batch selection, student-wise present/absent, marks, automatic percentage, all-class ranking, and optional Question Paper / Answer Sheet uploads.
- Attendance supports daily date-based present/absent marking and student-wise attendance history.
- Notices supports dated priority announcements for all students.

## Firebase Storage
Enable Firebase Storage in the Firebase project. Deploy `storage.rules` from Firebase Console or Firebase CLI so admins can upload test question papers and answer sheets.

## Vercel Admin Password Change
The admin credential API requires `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` environment variables in Vercel. These must be configured in Vercel Project Settings → Environment Variables.
