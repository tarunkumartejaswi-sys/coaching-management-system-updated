CMF ACTUAL FAMILY + STUDENT FEE + HOLIDAY + MOBILE UPDATE

Implemented in this build:

1. Student-wise fee billing
- No class tuition fee is used by the live monthly billing path.
- Each student has Monthly Fee, Fee Renewal Day (1-31), and Fee Start/Joining Date.
- Monthly fee records are created only when that student's own renewal cycle is due.
- Previous month records remain independent and are never overwritten.
- Payments recalculate paid, pending and Paid/Partial/Pending status.
- Previous dues, payment history, edit/delete payment and fee-month tools remain available.

2. Family / sibling login
- Admin can create one family login for multiple student profiles.
- Each student record stays separate.
- Family login can switch between child profiles.
- Removing the family login only unlinks the students; it does not delete student records.
- Family accounts are view-only for student personal profile editing.

3. Attendance holiday
- Admin can mark a date as Holiday and add a note.
- Holiday shows as a red indicator.
- Holiday days are excluded from attendance percentage calculations.

4. Mobile layout
- Admin navigation becomes a hamburger/drawer on small screens.
- Family profile switcher and page controls are mobile friendly.
- Holiday and fee controls have mobile-friendly spacing and wrapping.

5. Firestore rules / server API
- Family accounts are allowed to read only their linked student records and fees.
- Family account creation/update/unlink/delete is handled by the admin server API.

Verification performed:
- npm test: 27/27 tests passed.
- JavaScript syntax checks passed for the changed JS/API files.
- Full Vite build/typecheck could not be executed in the workspace because npm dependencies were unavailable and dependency installation timed out. Do not treat this ZIP as a Vercel deployment verification.

Deployment reminder:
- Deploy the project to Vercel as usual.
- Publish firestore.rules separately to Firebase because Vercel deployment does not publish Firestore security rules.
