export function getTestPercentages(tests = [], studentId) {
  return tests
    .map(test => {
      const result = (test.results || {})[studentId];
      if (!result?.present || result.marks === null || result.marks === undefined || !Number(test.total)) return null;
      return { name: test.name || test.subject || 'Test', date: test.date || '', percentage: Math.round((Number(result.marks) / Number(test.total)) * 10000) / 100 };
    })
    .filter(Boolean)
    .sort((a,b) => String(a.date).localeCompare(String(b.date)));
}

export function buildMonthlyStudentReport({ monthId, attendance = [], tests = [], homework = [], fee = {} }) {
  const attendanceCount = attendance.length;
  const present = attendance.filter(x => x.status === 'present').length;
  const attendancePercentage = attendanceCount ? Math.round((present / attendanceCount) * 10000) / 100 : 0;
  const testPoints = tests.filter(x => x && (!monthId || String(x.date || '').startsWith(monthId))).map(x => x);
  const testPercentages = getTestPercentages(testPoints, '__direct__');
  const directTests = tests
    .filter(x => x && (!monthId || String(x.date || '').startsWith(monthId)) && Number(x.total) > 0 && x.marks !== null && x.marks !== undefined)
    .map(x => Math.round((Number(x.marks) / Number(x.total)) * 10000) / 100);
  const averagePercentage = directTests.length ? Math.round((directTests.reduce((a,b)=>a+b,0)/directTests.length)*100)/100 : 0;
  const dueHomework = homework.filter(x => !monthId || String(x.dueDate || x.homeworkDate || '').startsWith(monthId));
  const completed = dueHomework.filter(x => x.completed).length;
  const monthlyFee = Number(fee.monthlyFee || 0);
  const paid = Number(fee.paidAmount || 0);
  const remaining = Number(fee.pendingAmount ?? Math.max(monthlyFee - paid, 0));
  return {
    monthId,
    attendance: { present, absent: Math.max(attendanceCount-present,0), total: attendanceCount, percentage: attendancePercentage },
    tests: { count: directTests.length, averagePercentage, percentages: testPercentages },
    homework: { total: dueHomework.length, completed, pending: Math.max(dueHomework.length-completed,0) },
    fees: { due: monthlyFee, paid, remaining },
  };
}
