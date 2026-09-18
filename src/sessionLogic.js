/** @typedef {{uid?:string, studentId?:string, name?:string, role?:string, email?:string, at?:string}} LoginHistoryArgs */

/** @param {LoginHistoryArgs} args */
export function buildLoginHistoryEntry({ uid = '', studentId = '', name = '', role = '', email = '', at = new Date().toISOString() } = {}) {
  return { uid, studentId, name, role, email, loginAt: at };
}

export function calculateFeeAfterPaymentDelete(fee, paymentIndex) {
  const history = Array.isArray(fee?.paymentHistory) ? fee.paymentHistory : [];
  if (paymentIndex < 0 || paymentIndex >= history.length) throw new Error('Payment not found');
  const nextHistory = history.filter((_, index) => index !== paymentIndex);
  const monthlyFee = Math.max(Number(fee?.monthlyFee) || 0, 0);
  const paidAmount = Math.min(nextHistory.reduce((sum, payment) => sum + Math.max(Number(payment?.amount) || 0, 0), 0), monthlyFee);
  const pendingAmount = Math.max(monthlyFee - paidAmount, 0);
  const status = pendingAmount === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'pending';
  return { ...fee, paymentHistory: nextHistory, paidAmount, pendingAmount, status };
}
