import assert from 'node:assert/strict';
import { defaultFlavors, flavorData, normalizeFlavors } from '../src/flavorCatalog.js';

const legacy = flavorData([], 'cola', 'summer');
assert.deepEqual(legacy.flavors, ['كولا', 'ليمون نعناع']);
assert.equal(legacy.flavorsAvailable, true);
const hidden = defaultFlavors('cola', 'summer').map(f => ({ ...f, is_active: false }));
assert.deepEqual(flavorData(hidden, 'cola', 'summer').flavors, []);
assert.equal(flavorData(hidden, 'cola', 'summer').flavorsAvailable, false);

const mixed = defaultFlavors('spread', 'spread-choco-bar');
assert.equal(flavorData(mixed, 'spread', 'spread-choco-bar').flavorsAvailable, true);
assert.equal(flavorData(mixed.filter(f => f.group === 'spread'), 'spread', 'spread-choco-bar').flavorsAvailable, false);
assert.equal(flavorData(mixed.map(f => f.group === 'chocoBar' ? { ...f, is_active: false } : f), 'spread', 'spread-choco-bar').flavorsAvailable, false);
assert.equal(flavorData([], 'spread', 'two-jars').flavorOptions.length, 5);

assert.equal(flavorData([], 'ice-cream', 'halawa').flavorsAvailable, true);
assert.equal(flavorData([], 'ice-cream', 'icecream').flavorsAvailable, false);
assert.equal(normalizeFlavors([{ name: 'فانيليا' }], 'ice-cream', 'icecream')[0].id, 'ice-0');
const renamed = { id: 'ice-0', name: 'فانيليا جديدة', group: 'icecream', is_active: true };
assert.equal(flavorData([renamed], 'ice-cream', 'icecream', { flavorImages: { فانيليا: '/new-build.webp' } }).flavorImages[renamed.name], '/new-build.webp');
assert.equal(flavorData([{ ...renamed, image: '/uploaded.webp' }], 'ice-cream', 'icecream', { flavorImages: { فانيليا: '/new-build.webp' } }).flavorImages[renamed.name], '/uploaded.webp');
assert.deepEqual(flavorData([{ name: 'جديد', id: 'new', group: 'cola' }, ...hidden], 'cola', 'summer').flavors, ['جديد']);
console.log('Flavor contract checks passed: legacy data, hidden groups, stable IDs, image fallback and flavorless offers.');
