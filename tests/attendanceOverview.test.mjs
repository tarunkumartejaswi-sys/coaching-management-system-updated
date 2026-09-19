import assert from 'node:assert/strict';
import { getAttendanceOverview, getAttendanceStatsFromDays } from '../src/attendanceLogic.js';

const days = [
  { date:'2026-09-01', records:{A:'present',B:'absent'} },
  { date:'2026-09-02', holiday:true, holidayNote:'Festival', records:{} },
  { date:'2026-09-03', records:{A:'absent',B:'present'} },
];
const students = [{studentId:'A'},{studentId:'B'}];
const all = getAttendanceOverview(days, students);
assert.equal(all.workingDays, 2);
assert.equal(all.holidayDays, 1);
assert.equal(all.present, 2);
assert.equal(all.absent, 2);
assert.equal(all.recorded, 4);
assert.equal(all.percentage, 50);

const personal = getAttendanceStatsFromDays(days, 'A');
assert.equal(personal.workingDays, 2);
assert.equal(personal.present, 1);
assert.equal(personal.absent, 1);
assert.equal(personal.holidayDays, 1);
assert.equal(personal.percentage, 50);
console.log('attendance overview tests passed');
