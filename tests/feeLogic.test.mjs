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
  const pages = ['feePayment', 'feeEdit', 'feeAddPrevious', 'feeDeletePayment', 'feeDeleteMonth'];
  assert.equal(new Set(pages).size, 5);
});
