NEW FEATURES
- Admin-only fee payment deletion and fee-month deletion.
- Student login history with login count and last login.
- Student active-session tracking.
- Admin Login History tab and dashboard shortcut.
- Admin remote logout: revoke all active refresh tokens and signal all student sessions to sign out.
- Mobile responsive layout preserved.

VERCEL REQUIREMENT
The remote logout API uses the same Firebase Admin environment variables already required by api/admin-student-account.js:
FIREBASE_SERVICE_ACCOUNT_JSON OR FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.
Do not put a Firebase service-account private key in frontend source code or GitHub.

FIRESTORE RULES
Publish the included firestore.rules. It adds loginHistory and userSessions permissions while keeping fees admin-only for writes.
