import assert from 'node:assert/strict'
import { shippingFee, cartShipping, shippingLabel } from '../src/shipping.js'

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
