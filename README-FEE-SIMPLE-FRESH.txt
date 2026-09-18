COACHING MANAGEMENT SYSTEM - SIMPLE FEE MODULE

This build simplifies the Admin Fees section and keeps fee actions on separate pages.

FEE WORKFLOW
1. Open Fees -> Class Tuition.
2. Set the monthly tuition amount for each class.
3. The current month's fee is created for students in that class.
4. When the calendar month changes, a new monthly tuition record is created automatically on the first Fees load.
5. Previous months and their payments are never overwritten by monthly renewal.
6. Open a student -> open a month -> Make Payment.
7. Payment page requires selecting the month before entering the amount.
8. Payment totals update paid, remaining and reports immediately.
9. Payment Edit and Delete are separate pages.
10. Add Previous Due and Delete Previous Due are separate pages.
11. Delete Month is an Admin-only separate page.
12. Monthly Report shows Due, Paid, Remaining and Fully Paid count.
13. Payment History shows all recorded payments and opens Edit/Delete pages.

STARTING FRESH
The dashboard contains "Clear All Fee Data". Use it once before entering real fee data if old fee records exist.
It deletes ONLY:
- fee month records
- payments
- previous dues
- class tuition settings
- student feeDue/monthlyFee fallback values

It does NOT delete students, teachers, tests, attendance, homework, notices or login accounts.

IMPORTANT
Do not automatically clear Firebase on every deployment. The reset action is intentionally Admin-confirmed so a future deployment cannot accidentally erase real fee data.
