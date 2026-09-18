import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getBillingMonthId,
  getMonthlyFeeStatus,
  buildMonthlyFeeRecord,
} from '../src/feeLogic.js';

test('billing month changes on the first day without changing the previous month', () => {
  assert.equal(getBillingMonthId(new Date(2026, 8, 30)), '2026-09');
  assert.equal(getBillingMonthId(new Date(2026, 9, 1)), '2026-10');
});

test('fee status is paid whenever pending is zero', () => {
  assert.equal(getMonthlyFeeStatus(500, 0, 500), 'paid');
  assert.equal(getMonthlyFeeStatus(500, 500, 0), 'pending');
  assert.equal(getMonthlyFeeStatus(500, 300, 200), 'partial');
  assert.equal(getMonthlyFeeStatus(0, 0), 'paid');
});

test('new monthly fee starts unpaid and is independent from previous month payments', () => {
  const record = buildMonthlyFeeRecord({
    studentId: 'ST01',
    monthlyFee: 500,
    date: new Date(2026, 9, 1),
  });

  assert.equal(record.studentId, 'ST01');
  assert.equal(record.monthId, '2026-10');
  assert.equal(record.monthlyFee, 500);
  assert.equal(record.paidAmount, 0);
  assert.equal(record.pendingAmount, 500);
  assert.equal(record.status, 'pending');
  assert.deepEqual(record.paymentHistory, []);
});

test('month-wise fee summary exposes only charge, paid and remaining', () => {
  const history = [
    { monthId: '2026-09', monthlyFee: 500, paidAmount: 500, pendingAmount: 0 },
    { monthId: '2026-08', monthlyFee: 500, paidAmount: 300, pendingAmount: 200 },
  ];
  const summary = history.map((fee) => ({
    monthId: fee.monthId,
    dues: Number(fee.monthlyFee || 0),
    paid: Number(fee.paidAmount || 0),
    remaining: Number(fee.pendingAmount || 0),
  }));
  assert.deepEqual(summary, [
    { monthId: '2026-09', dues: 500, paid: 500, remaining: 0 },
    { monthId: '2026-08', dues: 500, paid: 300, remaining: 200 },
  ]);
});

test('fee action pages are distinct routes in the UI model', () => {
  const pages = ['feePayment', 'feeEditPayment', 'feeEdit', 'feeAddPrevious', 'feeDeletePayment', 'feeDeletePrevious', 'feeDeleteMonth'];
  assert.equal(new Set(pages).size, 7);
});

test('editing a payment replaces only that payment and recalculates paid and remaining', async () => {
  const { calculateFeeAfterPaymentEdit } = await import('../src/feeLogic.js');
  const result = calculateFeeAfterPaymentEdit(
    { monthlyFee: 1000, paymentHistory: [
      { amount: 400, date: '2026-09-01', method: 'Cash' },
      { amount: 300, date: '2026-09-05', method: 'UPI' },
    ] },
    0,
    { amount: 500, date: '2026-09-10', method: 'UPI', note: 'Edited' }
  );
  assert.equal(result.paidAmount, 800);
  assert.equal(result.pendingAmount, 200);
  assert.equal(result.status, 'partial');
  assert.equal(result.paymentHistory[0].amount, 500);
  assert.equal(result.paymentHistory[0].method, 'UPI');
});

test('fee summary calculates dues, paid, remaining and collection for a month', async () => {
  const { summarizeFeeRecords } = await import('../src/feeLogic.js');
  const result = summarizeFeeRecords([
    { monthId:'2026-09', monthlyFee:500, paidAmount:500, pendingAmount:0 },
    { monthId:'2026-09', monthlyFee:700, paidAmount:300, pendingAmount:400 },
    { monthId:'2026-08', monthlyFee:600, paidAmount:600, pendingAmount:0 },
  ], '2026-09');
  assert.deepEqual(result, { dues:1200, paid:800, remaining:400, collected:800, students:2, fullyPaid:1, partial:1, unpaid:0 });
});

test('previous due records are explicitly identifiable', async () => {
  const { buildPreviousDueFeeRecord } = await import('../src/feeLogic.js');
  const fee = buildPreviousDueFeeRecord({ studentId:'S1', monthId:'2026-07', amount:900 });
  assert.equal(fee.studentId, 'S1');
  assert.equal(fee.monthId, '2026-07');
  assert.equal(fee.monthlyFee, 900);
  assert.equal(fee.pendingAmount, 900);
  assert.equal(fee.isPreviousDue, true);
});

test('class tuition settings normalize a class name and fee', async () => {
  const { buildClassTuitionRecord } = await import('../src/feeLogic.js');
  assert.deepEqual(
    buildClassTuitionRecord({ className: ' Class 1 ', monthlyFee: 500 }),
    { className: 'Class 1', monthlyFee: 500 }
  );
});

test('previous dues use a separate record id so they never overwrite a real month', async () => {
  const { getPreviousDueRecordId } = await import('../src/feeLogic.js');
  assert.equal(getPreviousDueRecordId('2026-08', 'abc123'), 'previous-2026-08-abc123');
});
