import assert from 'node:assert/strict';
import { defaultFlavors, defaultFlavorsForGroup, flavorData, flavorGroups, groupLabel, normalizeFlavors, normalizeSelection } from '../src/flavorCatalog.js';

const legacy = flavorData([], 'cola', 'summer');
assert.deepEqual(legacy.flavors, ['كولا', 'أناناس', 'ليمون نعناع', 'برتقال', 'تفاح أخضر', 'توت مشكل']);
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
const bundle = { version: 1, mode: 'components', items: [
  { key: 'spread', label: 'سبريد', qty: 1, choose: 1, group: 'spread' },
  { key: 'halawa', label: 'حلاوة', qty: 1, choose: 0 },
  { key: 'moraba', label: 'مربي', qty: 1, choose: 0 },
] };
const normalized = normalizeSelection(bundle);
assert.deepEqual(normalized.items.map(i => [i.key, i.qty, i.choose, i.group]), [['spread', 1, 1, 'spread'], ['halawa', 1, 0, null], ['moraba', 1, 0, null]]);
assert.equal(normalizeSelection({ mode: 'components', items: [{ key: 'x', qty: 1, choose: 5 }] }).items[0].choose, 1);
assert.equal(normalizeSelection({ mode: 'components', items: [{ key: 'x' }, { key: 'x' }] }).items[1].key, 'x-2');
assert.equal(normalizeSelection(null), null);
assert.deepEqual(flavorGroups('spread', 'bundle-3', bundle), ['spread']);
assert.deepEqual(flavorGroups('spread', 'bundle-3', { mode: 'components', items: [{ key: 'halawa', qty: 1, choose: 0 }] }), []);
assert.equal(groupLabel('spread', bundle), 'سبريد');

const bundleFlavors = defaultFlavorsForGroup('spread');
const bundleData = flavorData(bundleFlavors, 'spread', 'bundle-3', null, bundle);
assert.equal(bundleData.flavorsAvailable, true);
assert.equal(flavorData([], 'spread', 'bundle-3', null, bundle).flavorsAvailable, false);
assert.equal(bundleData.components.length, 3);
assert.equal(bundleData.components[1].flavorOptions.length, 0);
assert.equal(bundleData.components[1].available, true);
assert.equal(bundleData.components[0].flavorOptions.length, 5);
assert.equal(bundleData.selection.mode, 'components');
assert.equal(flavorData(bundleFlavors.map(f => ({ ...f, is_active: false })), 'spread', 'bundle-3', null, bundle).flavorsAvailable, false);
assert.equal(flavorData([{ id: 'kids', group: 'spread', name: 'أطفال', is_active: true }], 'spread', 'bundle-3', null, { ...bundle, items: [{ key: 'spread', label: 'سبريد', qty: 2, choose: 2, group: 'spread' }] }).flavorsAvailable, false);
assert.deepEqual(defaultFlavors('spread', 'bundle-3', bundle).map(f => f.group), defaultFlavorsForGroup('spread').map(f => f.group));
console.log('Flavor contract checks passed: legacy data, hidden groups, stable IDs, image fallback, flavorless offers and bundle components.');
