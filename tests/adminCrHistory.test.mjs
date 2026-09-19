import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('admin has a dedicated CR activity history page and entry point', () => {
  assert.match(app, /page === "crHistory"/);
  assert.match(app, /🧾 CR Activity History/);
  assert.match(app, /Open CR History/);
});

test('admin CR history explains audit fields and shows before/after changes', () => {
  assert.match(app, /Before:/);
  assert.match(app, /After:/);
  assert.match(app, /CR ID:/);
});
