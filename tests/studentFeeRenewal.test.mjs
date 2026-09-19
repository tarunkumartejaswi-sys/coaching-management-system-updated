import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getFeeRenewalDate,
  getStudentFeeDueDate,
  isFeeCycleDue,
  normalizeRenewalDay,
  buildMonthlyFeeRecord,
} from '../src/feeLogic.js';

test('student fee renewal uses the individual renewal day', () => {
  const student = { monthlyFee: 500, feeRenewalDay: 10, feeStartDate: '2026-09-10' };
  assert.equal(isFeeCycleDue(student, new Date('2026-09-09T12:00:00')), false);
  assert.equal(isFeeCycleDue(student, new Date('2026-09-10T12:00:00')), true);
  assert.equal(isFeeCycleDue(student, new Date('2026-10-10T12:00:00')), true);
});

test('student fee does not renew before the joining date', () => {
  const student = { monthlyFee: 500, feeRenewalDay: 5, feeStartDate: '2026-09-20' };
  assert.equal(isFeeCycleDue(student, new Date('2026-09-19T12:00:00')), false);
  assert.equal(isFeeCycleDue(student, new Date('2026-09-20T12:00:00')), true);
  assert.equal(getStudentFeeDueDate(student, new Date('2026-09-20T12:00:00')), '2026-09-20');
});

test('renewal day is clamped to the last day of short months', () => {
  assert.equal(normalizeRenewalDay(31), 31);
  assert.equal(getFeeRenewalDate(new Date('2026-02-15T12:00:00'), 31), '2026-02-28');
});

test('monthly fee record stores the per-student renewal due date', () => {
  const record = buildMonthlyFeeRecord({
    studentId: 'S1',
    monthlyFee: 500,
    renewalDay: 10,
    date: new Date('2026-09-10T12:00:00'),
  });
  assert.equal(record.monthId, '2026-09');
  assert.equal(record.dueDate, '2026-09-10');
  assert.equal(record.source, 'automatic');
});
