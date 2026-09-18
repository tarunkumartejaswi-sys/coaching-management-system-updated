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
