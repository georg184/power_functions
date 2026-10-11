/* Behavioral contracts for generation, exact arithmetic and persisted worksheets. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/core.js');
const state = overrides => ({schema: 1, language: 'de', mode: 'numbers', count: 12,
  level: 'progressive', seed: 42, revealed: [], ...overrides});

test('Every family produces a nonzero coefficient and a positive integer degree', () => {
  const families = new Set(), variables = new Set();
  for (const mode of core.MODES) for (const level of core.LEVELS) for (let seed = 0; seed < 100; seed++) {
    const sheet = core.generateSheet(state({mode, level, seed}));
    sheet.forEach((task, index) => {
      const normal = core.normalize(task.expression);
      families.add(task.family); variables.add(task.variable);
      assert.ok(normal.coefficient.n !== 0);
      assert.ok(Number.isInteger(task.degree) && task.degree >= 1 && task.degree <= 12);
      assert.equal(normal.powers[task.variable], task.degree);
      assert.equal(core.normalize(task.coefficient).powers[task.variable], undefined);
      assert.equal(task.parameters.includes(task.variable), false);
      assert.equal(task.parameters.length === 0, mode === 'numbers');
      assert.equal(task.excludedZero, task.family === 'quotient');
      if (level === 'progressive') assert.equal(task.level, Math.floor(index / 4) + 1);
      assert.ok(task.stages.length > 1);
    });
  }
  assert.equal(families.size, 13);
  assert.deepEqual([...variables].sort(), ['s', 't', 'u', 'x']);
});

test('A saved worksheet reconstructs tasks and solutions exactly, independent of language and reveal state', () => {
  for (const mode of core.MODES) {
    const original = state({mode});
    const saved = core.validateState(JSON.parse(JSON.stringify(original)));
    assert.deepEqual(core.generateSheet(saved), core.generateSheet(original));
    assert.deepEqual(core.generateSheet(state({mode, language: 'fr', revealed: [1, 5]})), core.generateSheet(original));
    assert.notDeepEqual(core.generateSheet(state({mode, seed: 43})), core.generateSheet(original));
  }
});

test('Invalid or incompatible state cannot silently replace saved work', () => {
  for (const invalid of [null, [], {}, state({schema: 2}), state({language: 'xx'}), state({mode: 'other'}),
    state({count: 1000}), state({seed: -1}), state({seed: 4294967296}), state({seed: 1.5}),
    state({level: 'expert'}), state({revealed: [1, 1]}), state({revealed: [12]}),
    state({revealed: [-1]}), state({mode: null, revealed: [0]}), {...state(), unexpected: true}]) {
    assert.throws(() => core.validateState(invalid));
  }
  assert.deepEqual(core.generateSheet(state({mode: null})), []);
  const original = state({revealed: [0]});
  const copy = core.validateState(original); copy.revealed.push(1);
  assert.deepEqual(original.revealed, [0]);
});

test('TeX preserves multiplication and the grouping of negative bases', () => {
  const num = n => ({kind: 'number', n, d: 1});
  const sym = name => ({kind: 'symbol', name});
  const product = (...args) => ({kind: 'product', args});
  assert.equal(core.latex(product(num(2), product(num(3), sym('x')))), '2\\cdot 3 x');
  assert.equal(core.latex(product(num(-1), product(num(4), sym('x')))), '-1\\cdot 4 x');
  assert.equal(core.latex(product(num(2), num(-3), sym('x'))), '2\\cdot \\left(-3\\right) x');
  assert.equal(core.latex({kind: 'power', base: num(-3), exponent: 2}), '\\left(-3\\right)^{2}');
  assert.equal(core.latex(product(num(-1), sym('x'))), '- x');
  assert.equal(core.latex(product(sym('s'), {kind: 'power', base: sym('s'), exponent: 2})), 's\\cdot s^{2}');
});

test('All local entry assets, core and manifest share the release token', () => {
  const root = path.join(__dirname, '..');
  const entry = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'muweb/muweave-module.json'), 'utf8'));
  assert.equal(manifest.version, core.VERSION);
  assert.ok(app.includes(`const APP_VERSION = '${core.VERSION}'`));
  assert.ok(entry.includes(`window.GG_APP_VERSION = '${core.VERSION}'`));
  for (const [, url] of entry.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (!url.startsWith('https://')) assert.ok(url.endsWith(`?v=${core.VERSION}`), url);
  }
});
