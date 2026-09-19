ATTENDANCE UPDATE
=================

Added:
- Admin and CR attendance overview with Total Working Days, Total Present, Total Absent and Holidays.
- Student and Family/Parent-profile attendance view now shows the same four personal attendance counters.
- Holiday count is excluded from attendance percentage.
- Holiday register uses a red circular indicator and shows the holiday note/reason.
- Existing CR Activity History remains available in the Admin CR tab and in the CR portal.

Validation:
- All existing Node test files passed, including the new attendanceOverview.test.mjs.
- Production build was not run because the ZIP does not include node_modules and Vite was unavailable in the workspace.
