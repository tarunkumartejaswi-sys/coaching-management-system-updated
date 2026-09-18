export function getCrEligibility({
  feeDue = 0,
  attendance = 0,
  rank = Infinity,
  average = 0,
  pendingHomework = 0,
} = {}) {
  const failedCriteria = [];
  if (Number(feeDue) > 0) failedCriteria.push('fee');
  if (Number(attendance) <= 90) failedCriteria.push('attendance');
  if (Number(rank) < 1 || Number(rank) > 5) failedCriteria.push('rank');
  if (Number(average) <= 80) failedCriteria.push('average');
  if (Number(pendingHomework) > 0) failedCriteria.push('homework');
  return { eligible: failedCriteria.length === 0, failedCriteria };
}

export function isHomeworkPending(item, studentId, today = new Date().toISOString().slice(0, 10)) {
  const assigned = Array.isArray(item?.assignedStudentIds) ? item.assignedStudentIds : null;
  if (assigned && assigned.length > 0 && !assigned.includes(studentId)) return false;
  const completion = item?.completion || {};
  if (completion[studentId] === true) return false;
  const dueDate = item?.dueDate || '';
  if (dueDate && dueDate > today) return false;
  return true;
}
