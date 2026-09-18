COACHING MANAGEMENT SYSTEM - FEE SECTION V5

This version simplifies the Admin fee module into separate pages:

1. Fee Dashboard
2. Class Tuition Fees
3. Student Fee Details
4. Individual Month Fee page
5. Make Payment page
6. Edit Payment page
7. Delete Payment page
8. Add Previous Due page
9. Delete Previous Due page
10. Edit Month page
11. Delete Month page
12. Payment History page

Billing rules:
- Class tuition is stored in classFees/{className}.
- When a new calendar month is first opened, each student's monthly fee is created from the configured class tuition.
- Existing months and payments are not overwritten by monthly renewal.
- Previous dues are stored with separate document IDs so they cannot overwrite a real month's tuition record.
- Older previous-due records stored at YYYY-MM are migrated automatically when that month is opened.
- Payment add/edit/delete recalculates paid, remaining and the student's total feeDue.
- Previous due deletion recalculates the student's total outstanding balance.
- Class tuition changes update the current month's charge while preserving payments already made.
- Admin-only fee mutations remain protected by Firestore rules.

Deployment:
- Deploy the Vite app to Vercel as before.
- Deploy firestore.rules to Firebase after replacing the rules in the Firebase console/project.
- Do not upload service-account JSON credentials to GitHub/Vercel.

Verification performed locally:
- 20 automated tests pass.
- App.tsx TypeScript/JSX transpile syntax check passes.
- firebase/firestore.js syntax check passes.
- Full npm build could not be executed in this environment because dependencies were not available locally and npm install timed out.
