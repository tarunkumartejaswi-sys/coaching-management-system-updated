import test from 'node:test';
import assert from 'node:assert/strict';
import { getAttendanceStatsFromDays, getAttendanceStatus } from '../src/attendanceLogic.js';

test('holiday is not counted as absent or present', () => {
  const days = [
    { date: '2026-09-10', records: { S1: 'present' } },
    { date: '2026-09-11', holiday: true, holidayNote: 'Festival' },
    { date: '2026-09-12', records: { S1: 'absent' } },
  ];
  const stats = getAttendanceStatsFromDays(days, 'S1');
  assert.equal(stats.present, 1);
  assert.equal(stats.absent, 1);
  assert.equal(stats.recorded, 2);
  assert.equal(stats.percentage, 50);
  assert.equal(getAttendanceStatus(days[1], 'S1'), 'holiday');
});
