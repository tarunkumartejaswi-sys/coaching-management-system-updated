CR FEATURE FIX

This build fixes the Class Representative login path.

CR now has a real management workspace inside the CR portal:
- Full Attendance Management
  - View all students
  - View class and batch
  - Select date
  - Mark individual students Present/Absent
  - Mark all Present/Absent
  - Submit changes to Admin for approval
  - View attendance summary
- Full Homework Management
  - Add homework
  - Edit homework
  - Delete homework
  - Assign to class/batch or selected students
  - Track completion for every student
  - Submit all CR changes to Admin for approval
- CR loads the full student roster after login, so management screens are populated.
- Firestore rules also recognize an assigned CR through the student record as a fallback.

Admin remains the only role that directly writes official Attendance/Homework records.
CR changes are stored as pending requests until Admin approves them.
