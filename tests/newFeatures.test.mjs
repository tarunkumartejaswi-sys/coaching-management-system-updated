import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLoginHistoryEntry, calculateFeeAfterPaymentDelete } from '../src/sessionLogic.js';

test('login history entry records student login time and identity', () => {
  const entry = buildLoginHistoryEntry({ uid: 'u1', studentId: 'S1', name: 'Aman', role: 'student', email: 'a@x.com', at: '2026-09-18T10:00:00.000Z' });
  assert.deepEqual(entry, { uid:'u1', studentId:'S1', name:'Aman', role:'student', email:'a@x.com', loginAt:'2026-09-18T10:00:00.000Z' });
});

test('deleting a payment recalculates paid, pending and status', () => {
  const result = calculateFeeAfterPaymentDelete({ monthlyFee: 1000, paidAmount: 1000, pendingAmount: 0, status:'paid', paymentHistory:[{amount:600},{amount:400}] }, 1);
  assert.equal(result.paidAmount, 600);
  assert.equal(result.pendingAmount, 400);
  assert.equal(result.status, 'partial');
  assert.equal(result.paymentHistory.length, 1);
});

test('deleting the last payment makes a fee pending', () => {
  const result = calculateFeeAfterPaymentDelete({ monthlyFee: 1000, paidAmount: 1000, pendingAmount: 0, status:'paid', paymentHistory:[{amount:1000}] }, 0);
  assert.equal(result.paidAmount, 0);
  assert.equal(result.pendingAmount, 1000);
  assert.equal(result.status, 'pending');
});
