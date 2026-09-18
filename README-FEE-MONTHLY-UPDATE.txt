FEE MONTHLY UPDATE

Changes:
- Admin fee list now emphasizes Fee Dues, Fee Paid, Remaining.
- Clicking a student opens the dedicated month-wise fee detail page.
- Make Payment opens a dedicated page and supports the selected month.
- Edit Monthly Fee opens a dedicated page.
- Add Previous Dues opens a dedicated page.
- Edit Month opens a dedicated page.
- Delete Payment opens a dedicated confirmation page.
- Delete Fee Month opens a dedicated confirmation page.
- Month-wise details show Fee Dues, Fee Paid, Remaining and payment history.
- Previous months remain separate from the new month's billing cycle.
- Existing Firebase initialization and rules were not changed.
- Mobile responsive fee action pages were added.

Validation:
- node --test tests/*.test.mjs: 12/12 passed.
- npm typecheck/build could not run because npm dependency installation timed out in the build environment.
