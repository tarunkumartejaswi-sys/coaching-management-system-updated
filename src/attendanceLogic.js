export function getAttendanceStatus(day = {}, studentId = '', authUid = '') {
  if (day?.holiday) return 'holiday';
  const records = day?.records || {};
  if (studentId && records[studentId]) return records[studentId];
  if (authUid && records[authUid]) return records[authUid];
  return undefined;
}

export function getAttendanceStatsFromDays(days = [], studentId = '', authUid = '') {
  const holidayDays = days.filter((day) => Boolean(day?.holiday)).length;
  const rows = days.filter((day) => !day?.holiday && Boolean(getAttendanceStatus(day, studentId, authUid)));
  const present = rows.filter((day) => getAttendanceStatus(day, studentId, authUid) === 'present').length;
  const absent = rows.filter((day) => getAttendanceStatus(day, studentId, authUid) === 'absent').length;
  const workingDays = present + absent;
  return {
    present,
    absent,
    recorded: workingDays,
    workingDays,
    holidayDays,
    percentage: workingDays ? (present / workingDays) * 100 : 0,
  };
}

/**
 * Overall institute/class attendance statistics for Admin and CR.
 * Working day means a non-holiday attendance date in the register.
 * Present/Absent count is the sum of student attendance marks across those days.
 */
export function getAttendanceOverview(days = [], students = []) {
  const studentIds = students.map((student) => student?.studentId).filter(Boolean);
  const holidayDays = days.filter((day) => Boolean(day?.holiday)).length;
  const workingDays = days.filter((day) => !day?.holiday).length;
  let present = 0;
  let absent = 0;

  days.filter((day) => !day?.holiday).forEach((day) => {
    studentIds.forEach((studentId) => {
      const status = day?.records?.[studentId];
      if (status === 'present') present += 1;
      if (status === 'absent') absent += 1;
    });
  });

  const recorded = present + absent;
  return {
    workingDays,
    holidayDays,
    present,
    absent,
    recorded,
    percentage: recorded ? (present / recorded) * 100 : 0,
  };
}
