import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthlyStudentReport, getTestPercentages } from '../src/studentReportLogic.js';

test('monthly student report aggregates attendance, tests, homework and fees', () => {
  const report = buildMonthlyStudentReport({
    monthId: '2026-09',
    attendance: [{date:'2026-09-01', status:'present'}, {date:'2026-09-02', status:'absent'}, {date:'2026-09-03', status:'present'}],
    tests: [{date:'2026-09-05', marks:80, total:100}, {date:'2026-09-12', marks:70, total:100}],
    homework: [{dueDate:'2026-09-10', completed:true}, {dueDate:'2026-09-15', completed:false}],
    fee: {monthlyFee:500, paidAmount:300, pendingAmount:200}
  });
  assert.equal(report.attendance.percentage, 66.67);
  assert.equal(report.tests.averagePercentage, 75);
  assert.equal(report.homework.pending, 1);
  assert.deepEqual(report.fees, {due:500, paid:300, remaining:200});
});

test('test percentages are returned in chronological order for graphs', () => {
  const points = getTestPercentages([
    {date:'2026-09-12', name:'Test 2', results:{S1:{present:true,marks:60}}, total:100},
    {date:'2026-09-05', name:'Test 1', results:{S1:{present:true,marks:80}}, total:100},
  ], 'S1');
  assert.deepEqual(points.map(p => p.percentage), [80,60]);
});
