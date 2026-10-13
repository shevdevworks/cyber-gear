import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePriceRange } from '../js/utils/price-range.js';

test('price inputs cannot escape the supported range or invert the handles', () => {
  assert.deepEqual(normalizePriceRange(-200, 900), { min: 0, max: 500 });
  assert.deepEqual(normalizePriceRange(600, 500, 'min'), { min: 495, max: 500 });
  assert.deepEqual(normalizePriceRange(0, -50, 'max'), { min: 0, max: 5 });
  assert.deepEqual(normalizePriceRange(250, 100, 'min'), { min: 95, max: 100 });
  assert.deepEqual(normalizePriceRange(250, 100, 'max'), { min: 250, max: 255 });
});

test('empty and invalid input recovers, while exact typed prices are retained', () => {
  assert.deepEqual(normalizePriceRange('', ''), { min: 0, max: 500 });
  assert.deepEqual(normalizePriceRange(NaN, Infinity), { min: 0, max: 500 });
  assert.deepEqual(normalizePriceRange('89', '199'), { min: 89, max: 199 });
});
