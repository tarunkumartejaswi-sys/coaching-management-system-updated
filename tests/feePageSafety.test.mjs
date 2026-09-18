import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const start = appSource.indexOf('  const loadFees = async () => {');
const end = appSource.indexOf('\n  const openPayment = async', start);
const loadFees = appSource.slice(start, end);

test('loading the Fees page does not read studentId from paymentStudent before a student is selected', () => {
  assert.ok(start >= 0 && end > start, 'loadFees function should exist');
  const executableSource = loadFees.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(executableSource, /paymentStudent\.studentId/);
  assert.match(executableSource, /selectedFeeStudent\?\.studentId/);
});
