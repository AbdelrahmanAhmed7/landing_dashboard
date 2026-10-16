import assert from 'node:assert/strict'
import { shippingFee, shippingMode, cartShipping, shippingLabel, cartShippingLabel, shippingOrderNote } from '../src/shipping.js'

assert.equal(shippingFee({}, 'cola'), 50)
assert.equal(shippingFee({}, 'spread'), 0)
assert.equal(shippingFee({}, 'ice-cream'), null)
assert.equal(shippingFee({ free_shipping: true, shipping_fee: 75 }, 'cola'), 0)
assert.equal(shippingFee({ freeShipping: false, shippingFee: 32.5 }, 'spread'), 32.5)
assert.equal(shippingFee({ shipping_fee: '25.50' }, 'ice-cream'), 25.5)
for (const site of ['cola', 'ice-cream', 'spread']) {
  const items = [
    { bundle: { shippingFee: 75 }, qty: 3 },
    { bundle: { shippingFee: 25 }, qty: 2 },
    { bundle: { freeShipping: true, shippingFee: 99 }, qty: 1 },
    { bundle: { shippingFee: 500 }, qty: 0 },
  ]
  assert.deepEqual(cartShipping(items, site), { fee: 75, deferred: false })
  assert.deepEqual(cartShipping([], site), { fee: 0, deferred: false })
  assert.deepEqual(cartShipping([{ offer: { freeShipping: true }, qty: 5 }], site), { fee: 0, deferred: false })
  assert.equal(shippingLabel({ shipping_fee: 45 }, site), '🚚 التوصيل 45 جنيه')
}
assert.deepEqual(cartShipping([{ bundle: {}, qty: 1 }, { bundle: { shippingFee: 25 }, qty: 1 }], 'ice-cream'), { fee: 25, deferred: true })
console.log('PASS shipping: legacy defaults, free overrides, highest fee once, quantities, decimals, empty and deferred carts.')

for (const site of ['cola', 'ice-cream', 'spread']) {
  const deferred = { shipping_mode: 'call_center', free_shipping: true, shipping_fee: 80 }
  assert.equal(shippingFee(deferred, site), null)
  assert.equal(shippingFee({ shippingMode: 'call_center', shippingFee: null, freeShipping: false }, site), null)
  assert.equal(shippingFee({ shipping_mode: 'fixed', free_shipping: true, shipping_fee: 45 }, site), 45)
  assert.equal(shippingFee({ shipping_mode: 'free', shipping_fee: 80 }, site), 0)
  assert.equal(shippingFee({ shipping_mode: 'fixed', shipping_fee: '' }, site), null)
  assert.equal(shippingMode(deferred, site), 'call_center')
  const mixed = [{ bundle: deferred, qty: 2 }, { bundle: { shipping_mode: 'fixed', shipping_fee: 45 }, qty: 3 }]
  assert.deepEqual(cartShipping(mixed, site), { fee: 45, deferred: true })
  assert(!cartShippingLabel(mixed, site).includes('مجاني'))
  assert(shippingOrderNote('ملاحظة العميل', mixed, site).includes('ملاحظة العميل\n'))
  assert(shippingOrderNote('', mixed, site).includes('مبدئي'))
  assert.equal(shippingOrderNote('ملاحظة العميل', [{ bundle: { shipping_mode: 'free' }, qty: 1 }], site), 'ملاحظة العميل')
}
assert.equal(shippingMode({}, 'cola'), 'fixed')
assert.equal(shippingMode({}, 'spread'), 'free')
assert.equal(shippingMode({}, 'ice-cream'), 'call_center')
console.log('PASS explicit modes: cross-site call centre, stale-field overrides, partial totals, operator notes and legacy inference.')
