import test from 'node:test';
import assert from 'node:assert/strict';
import { getCrEligibility } from '../src/crLogic.js';

test('student is CR eligible only when every criterion is satisfied', () => {
  const result = getCrEligibility({
    feeDue: 0,
    attendance: 91,
    rank: 3,
    average: 84,
    pendingHomework: 0,
  });
  assert.equal(result.eligible, true);
  assert.deepEqual(result.failedCriteria, []);
});

test('pending homework makes an otherwise qualified student ineligible', () => {
  const result = getCrEligibility({
    feeDue: 0,
    attendance: 96,
    rank: 1,
    average: 92,
    pendingHomework: 1,
  });
  assert.equal(result.eligible, false);
  assert.ok(result.failedCriteria.includes('homework'));
});

test('CR eligibility requires rank 1 through 5 and strict thresholds', () => {
  const result = getCrEligibility({
    feeDue: 0,
    attendance: 90,
    rank: 6,
    average: 80,
    pendingHomework: 0,
  });
  assert.equal(result.eligible, false);
  assert.deepEqual(result.failedCriteria.sort(), ['attendance', 'average', 'rank'].sort());
});

test('future-due homework is not counted as pending, but due incomplete work is', async () => {
  const { isHomeworkPending } = await import('../src/crLogic.js');
  assert.equal(isHomeworkPending({ dueDate: '2026-09-20', completion: { S1: false } }, 'S1', '2026-09-18'), false);
  assert.equal(isHomeworkPending({ dueDate: '2026-09-18', completion: { S1: false } }, 'S1', '2026-09-18'), true);
  assert.equal(isHomeworkPending({ dueDate: '2026-09-18', completion: { S1: true } }, 'S1', '2026-09-18'), false);
});
