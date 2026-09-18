# Coaching Management System • Premium Renovation

This package is the renovated CMF build. It keeps the Firebase data model already used by the project and adds a cleaner, more professional interface plus consistency fixes.

## What was renovated

### Admin dashboard
- Premium command-centre layout
- Live student / attendance / marks / fee cards
- Fee collection progress
- Top-performer ranking
- Latest notices
- Quick actions
- Director profile editor with photo

### Students
- Searchable student directory
- Edit student information
- Real Firebase login change from Admin
- Permanent student deletion through protected Admin API
- Cleaner student profile presentation

### Homework
- Class + batch assignment
- Individual student selection
- Select all / clear
- Date, day, year and due date
- Click student names to toggle Done / Not Done
- Homework defaulter list
- Student portal shows own pending work and class homework status

### Tests & Results
- Class / batch / subject aware tests
- Per-student Present / Absent
- Marks and percentage
- Question paper upload
- Answer sheet / solution upload
- Expandable student-wise result sheet for each test
- Overall average across all counted tests
- Competition-style ranking across every class
- Students with no marks remain visible as "Not ranked yet"
- Student portal shows personal test results and overall rank

### Attendance
- Daily register
- Mark all Present / Absent
- Individual toggle
- Student-wise attendance summary
- Student monthly calendar: green = Present, red = Absent
- Attendance percentage is recalculated and written back to the student record after saving, keeping the admin table and student dashboard consistent

### Fees
- Current-month fee tracking
- Collection progress
- Paid / partial / due status
- Receive payment
- Payment history
- Previous-month fee creation
- Previous-month editing
- Student total pending amount

### Notices / Teachers / Director
- Cleaner notice board and priority badges
- Faculty directory with add/edit/delete
- Director details and profile photo controlled by Admin and visible to students

## IMPORTANT: upload the project correctly

When uploading to GitHub, upload the **contents of this project folder to the repository root**.

The repository root must directly contain:

- `package.json`
- `index.html`
- `src/`
- `firebase/`
- `api/`
- `firestore.rules`
- `storage.rules`

Do **not** upload a parent folder such as `cmf10_final/` and do not keep older folders such as `cmf10`, `CMF 11`, or `CMF 9` beside the new app. Vercel must build this exact root project.

## Vercel

Use:

- Build command: `npm run build`
- Output directory: `dist`

Redeploy after every GitHub upload.

## Admin password change + student deletion

These two operations use `/api/admin-student-account`, which runs with Firebase Admin SDK on Vercel.

### Required Vercel Environment Variables

Recommended single-variable method:

- `FIREBASE_SERVICE_ACCOUNT_JSON` = the complete Firebase service-account JSON

OR use:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Get these from the Firebase service account credentials. Keep them only in Vercel Environment Variables. Never commit the private key to GitHub.

After adding/changing the variables:

1. Open Vercel → Project → Settings → Environment Variables.
2. Add the variables for **Production**.
3. Redeploy the latest Production deployment.
4. Log in as Admin.
5. Go to **Students → Change Login**.
6. Enter a new password, or a new login email, or both.
7. Save.

The Delete button uses the same protected server endpoint and removes the Firebase Auth account plus the student Firestore record and related academic references.

If the Change Login screen says that Firebase Admin environment variables are not configured, the frontend is working but the Vercel server credentials are still missing.

## Firebase rules

Deploy both:

- `firestore.rules`
- `storage.rules`

The app uses Firebase Authentication, Firestore and Storage.

## Recommended first test after deployment

1. Admin login
2. Students → change one test student's password
3. Students → delete a temporary test student
4. Attendance → mark today's attendance → save
5. Log in as that student and verify the calendar
6. Tests & Results → create a test → enter marks → upload papers
7. Expand the test's result sheet
8. Check the all-class ranking
9. Homework → assign students → toggle Done / Not Done
10. Student login → verify homework, attendance, fees, notices and results


## Final renovation notes

- The student attendance summary and monthly calendar use the same student-status resolver so the two views stay consistent.
- The duplicate `numericAmount` declaration in `firebase/firestore.js` has been removed.
- Keep `FIREBASE_SERVICE_ACCOUNT_JSON` in Vercel as a Secret for Production, Preview, and Development, and redeploy after changing it.


### Profile image uploads
Student and director profile photos use the protected `/api/admin-upload-image` endpoint. This requires the same Firebase Admin environment variable already used for Change Login/Delete Student.
