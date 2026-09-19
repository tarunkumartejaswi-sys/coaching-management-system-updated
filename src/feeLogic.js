export function getLocalDateString(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getBillingMonthId(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getDaysInMonth(year, monthOneBased) {
  return new Date(year, monthOneBased, 0).getDate();
}

export function normalizeRenewalDay(value, fallback = 1) {
  const day = Number(value);
  if (!Number.isFinite(day)) return fallback;
  return Math.min(31, Math.max(1, Math.floor(day)));
}

export function getFeeRenewalDate(date = new Date(), renewalDay = 1) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = Math.min(normalizeRenewalDay(renewalDay), getDaysInMonth(year, month));
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isFeeCycleDue(student = {}, date = new Date()) {
  const today = getLocalDateString(date);
  const startDate = String(student.feeStartDate || '').slice(0, 10);
  if (startDate && today < startDate) return false;
  return today >= getStudentFeeDueDate(student, date);
}


export function getStudentFeeDueDate(student = {}, date = new Date()) {
  const renewalDate = getFeeRenewalDate(date, student.feeRenewalDay || 1);
  const startDate = String(student.feeStartDate || '').slice(0, 10);
  const monthId = getBillingMonthId(date);
  if (startDate && startDate.startsWith(monthId) && startDate > renewalDate) return startDate;
  return renewalDate;
}

export function getFeeDueDate(date = new Date(), renewalDay = 1) {
  return getFeeRenewalDate(date, renewalDay);
}

export function getMonthlyFeeStatus(monthlyFee = 0, pendingAmount = 0, paidAmount = 0) {
  const pending = Math.max(Number(pendingAmount) || 0, 0);
  const paid = Math.max(Number(paidAmount) || 0, 0);
  if (pending === 0) return 'paid';
  if (paid > 0) return 'partial';
  return 'pending';
}

export function buildMonthlyFeeRecord({ studentId, monthlyFee = 0, date = new Date(), renewalDay = 1, dueDate = '' } = {}) {
  const monthly = Math.max(Number(monthlyFee) || 0, 0);
  const resolvedDue = dueDate || getFeeDueDate(date, renewalDay);
  return {
    studentId,
    monthId: getBillingMonthId(date),
    monthlyFee: monthly,
    dueDate: resolvedDue,
    paidAmount: 0,
    pendingAmount: monthly,
    status: getMonthlyFeeStatus(monthly, monthly, 0),
    paymentHistory: [],
    billingCycleStart: resolvedDue,
    createdAt: new Date().toISOString(),
    source: 'automatic',
  };
}

export function calculateFeeAfterPaymentEdit(fee, paymentIndex, replacementPayment) {
  const history = Array.isArray(fee?.paymentHistory) ? [...fee.paymentHistory] : [];
  if (paymentIndex < 0 || paymentIndex >= history.length) throw new Error('Payment not found');
  const amount = Number(replacementPayment?.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be greater than 0');
  history[paymentIndex] = { ...history[paymentIndex], ...replacementPayment, amount };
  const monthlyFee = Math.max(Number(fee?.monthlyFee) || 0, 0);
  const paidAmount = Math.min(history.reduce((sum, payment) => sum + Math.max(Number(payment?.amount) || 0, 0), 0), monthlyFee);
  const pendingAmount = Math.max(monthlyFee - paidAmount, 0);
  return { ...fee, paymentHistory: history, paidAmount, pendingAmount, status: getMonthlyFeeStatus(monthlyFee, pendingAmount, paidAmount) };
}

export function summarizeFeeRecords(records = [], monthId = '') {
  const scoped = monthId ? records.filter((fee) => fee?.monthId === monthId) : records;
  const dues = scoped.reduce((sum, fee) => sum + Math.max(Number(fee?.monthlyFee) || 0, 0), 0);
  const paid = scoped.reduce((sum, fee) => sum + Math.max(Number(fee?.paidAmount) || 0, 0), 0);
  const remaining = scoped.reduce((sum, fee) => sum + Math.max(Number(fee?.pendingAmount) || 0, 0), 0);
  return {
    dues,
    paid,
    remaining,
    collected: paid,
    students: scoped.length,
    fullyPaid: scoped.filter((fee) => Number(fee?.pendingAmount || 0) <= 0 && Number(fee?.monthlyFee || 0) > 0).length,
    partial: scoped.filter((fee) => Number(fee?.paidAmount || 0) > 0 && Number(fee?.pendingAmount || 0) > 0).length,
    unpaid: scoped.filter((fee) => Number(fee?.paidAmount || 0) <= 0 && Number(fee?.pendingAmount || 0) > 0).length,
  };
}

export function buildPreviousDueFeeRecord({ studentId, monthId, amount = 0, dueDate = '', note = '' } = {}) {
  const monthly = Math.max(Number(amount) || 0, 0);
  return {
    studentId,
    monthId,
    monthlyFee: monthly,
    dueDate: dueDate || `${monthId}-01`,
    paidAmount: 0,
    pendingAmount: monthly,
    status: getMonthlyFeeStatus(monthly, monthly, 0),
    paymentHistory: [],
    isPreviousDue: true,
    source: 'previous_due',
    note,
    createdAt: new Date().toISOString(),
  };
}

export function buildClassTuitionRecord({ className = '', monthlyFee = 0 } = {}) {
  return { className: String(className).trim(), monthlyFee: Math.max(Number(monthlyFee) || 0, 0) };
}

export function getPreviousDueRecordId(monthId, suffix = '') {
  const cleanMonth = String(monthId || '').trim();
  const cleanSuffix = String(suffix || '').trim();
  return `previous-${cleanMonth}-${cleanSuffix}`;
}

export function getPaymentMonthOptions(history = []) {
  return history.filter((fee) => fee?.isPreviousDue !== true && fee?.monthId).sort((a, b) => String(b.monthId).localeCompare(String(a.monthId)));
}
