export function getBillingMonthId(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getFeeDueDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-10`;
}

export function getMonthlyFeeStatus(monthlyFee = 0, pendingAmount = 0, paidAmount = 0) {
  const pending = Math.max(Number(pendingAmount) || 0, 0);
  const paid = Math.max(Number(paidAmount) || 0, 0);
  if (pending === 0) return 'paid';
  if (paid > 0) return 'partial';
  return 'pending';
}

export function buildMonthlyFeeRecord({ studentId, monthlyFee = 0, date = new Date() } = {}) {
  const monthly = Math.max(Number(monthlyFee) || 0, 0);
  return {
    studentId,
    monthId: getBillingMonthId(date),
    monthlyFee: monthly,
    dueDate: getFeeDueDate(date),
    paidAmount: 0,
    pendingAmount: monthly,
    status: getMonthlyFeeStatus(monthly, monthly, 0),
    paymentHistory: [],
    billingCycleStart: `${getBillingMonthId(date)}-01`,
    createdAt: new Date().toISOString(),
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
    dueDate: dueDate || `${monthId}-10`,
    paidAmount: 0,
    pendingAmount: monthly,
    status: getMonthlyFeeStatus(monthly, monthly, 0),
    paymentHistory: [],
    isPreviousDue: true,
    note,
    createdAt: new Date().toISOString(),
  };
}
