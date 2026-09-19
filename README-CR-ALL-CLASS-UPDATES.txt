CR ALL-CLASS MANAGEMENT UPDATE

This version changes the approved Class Representative workspace so a CR remains a normal Student account and also receives an all-class CR control center.

CR can manage, for every class:
- Attendance
- Holidays with note/reason
- Homework by class
- Homework defaulters
- Add, edit, delete and assign homework
- Same homework to every class in one action
- Notices: add, edit and delete

Every CR action is written to crActivityHistory with:
- CR name / UID
- CR student ID
- module
- action
- target
- class / All Classes
- before and after data when applicable
- timestamp

Admin sees this history inside Class Representative > CR Activity History.

CR still cannot manage:
- fees
- tests / marks
- teachers
- student accounts

Firebase rules were updated so approved CR accounts can write Attendance, Homework and Notices and can update only the attendance field of student records. The rules file must be published in Firebase after deployment.
