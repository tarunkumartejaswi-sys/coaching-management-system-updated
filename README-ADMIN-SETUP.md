# Admin credential setup

The Admin -> Students -> Change Login feature changes the real Firebase Authentication account.
It requires these Vercel server-side environment variables:

- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY

Create/download a Firebase service-account key for the same Firebase project and copy its `project_id`, `client_email`, and `private_key` into Vercel Environment Variables. Do not commit the service-account JSON file to GitHub and do not paste the private key into chat.

The frontend calls `/api/admin-student-account`. The API verifies the logged-in Firebase ID token, checks the `users/{uid}` profile has `role: "admin"`, and only then updates the selected student's Firebase Auth password/email.
