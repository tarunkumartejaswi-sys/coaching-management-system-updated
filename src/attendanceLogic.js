export function getAttendanceStatus(day = {}, studentId = '', authUid = '') {
  if (day?.holiday) return 'holiday';
  const records = day?.records || {};
  if (studentId && records[studentId]) return records[studentId];
  if (authUid && records[authUid]) return records[authUid];
  return undefined;
}

export function getAttendanceStatsFromDays(days = [], studentId = '', authUid = '') {
  const rows = days.filter((day) => !day?.holiday && Boolean(getAttendanceStatus(day, studentId, authUid)));
  const present = rows.filter((day) => getAttendanceStatus(day, studentId, authUid) === 'present').length;
  const absent = rows.filter((day) => getAttendanceStatus(day, studentId, authUid) === 'absent').length;
  return {
    present,
    absent,
    recorded: present + absent,
    percentage: present + absent ? (present / (present + absent)) * 100 : 0,
  };
}
