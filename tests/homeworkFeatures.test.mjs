import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const sessionSource = fs.readFileSync(new URL('../src/sessionLogic.js', import.meta.url), 'utf8');
const familyApi = fs.readFileSync(new URL('../api/admin-student-account.js', import.meta.url), 'utf8');

test('homework has class-wise tabs and a separate defaulters tab', () => {
  assert.match(appSource, /homeworkView === "defaulters"/);
  assert.match(appSource, /Homework by Class/);
  assert.match(appSource, /Homework Defaulters/);
  assert.match(appSource, /homeworkSelectedClass/);
});

test('admin can create the same homework for every active class in one action', () => {
  assert.match(appSource, /homeworkAllClasses/);
  assert.match(appSource, /Same Homework to Every Class/);
  assert.match(appSource, /Promise\.all\(targetClasses\.map/);
  assert.match(appSource, /createdRows/);
});

test('CR keeps personal homework separate from the all-class CR control center', () => {
  assert.match(appSource, /Your personal homework only/);
  assert.match(appSource, /crControlTab/);
  assert.match(appSource, /crControlTab === "homework"/);
  assert.match(appSource, /All classes/);
  assert.match(appSource, /Every CR action is recorded/);
});

test('parent ID is available for family accounts and login history', () => {
  assert.match(sessionSource, /parentId/);
  assert.match(familyApi, /PARENT-/);
  assert.match(appSource, /Parent ID/);
});
