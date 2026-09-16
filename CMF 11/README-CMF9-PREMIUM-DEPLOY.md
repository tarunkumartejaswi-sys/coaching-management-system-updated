# CMF9 Premium Management System

This build upgrades the existing CMF9 application with a premium admin/student experience while preserving the existing Firebase data model.

## Included
- Premium admin dashboard and quick actions
- Class/subject test library filters
- Per-test result sheet, marks, percentages and all-class ranking
- Question paper and answer/solution uploads
- Daily attendance register and student monthly calendar
- Homework assignment, student selection and completion/defaulter tracking
- Professional fee dashboard and monthly history
- Student profile editing and profile picture upload
- Admin-controlled director profile and picture
- Notice audience selection
- Admin direct student login credential changes

## Deploy
1. Upload the contents of this folder to the existing GitHub repository root.
2. Commit to `main` and allow Vercel to deploy.
3. Deploy `firestore.rules` and `storage.rules` to the same Firebase project.
4. Keep the existing Vercel environment variables and Firebase config.

## Important
The student profile upload uses `student-profiles/{studentId}/...`; the director image uses `director/...`; test papers use `tests/...`. Storage rules in this package allow the correct authenticated/admin access.
