import assert from 'node:assert/strict'
import { contentFields, defaultPageContent, resolvePageContent, validatePageContent } from '../src/pageContent.js'

for (const site of ['cola', 'ice-cream', 'spread']) {
  const defaults = defaultPageContent(site)
  assert.equal(validatePageContent(site, defaults), '')
  assert.equal(new Set(contentFields(site).map(field => field.key)).size, contentFields(site).length)
  for (const invalid of [null, [], 'text']) assert.deepEqual(resolvePageContent(site, invalid), defaults)
  assert.deepEqual(resolvePageContent(site, { headerCta: '', unknown: 'ignore', footerNote: null }), defaults)
  assert.equal(resolvePageContent(site, { headerCta: '  اطلب هنا  ' }).headerCta, 'اطلب هنا')
  assert.equal(resolvePageContent(site, { headerCta: 'x'.repeat(41) }).headerCta, defaults.headerCta)
  assert(validatePageContent(site, { ...defaults, headerCta: ' ' }))
  assert(validatePageContent(site, { ...defaults, checkoutCta: 10 }))
}
const cola = defaultPageContent('cola')
assert(validatePageContent('cola', { ...cola, phone: 'javascript:alert(1)' }))
assert(validatePageContent('cola', { ...cola, email: 'care@example.test?subject=bad' }))
assert.equal(resolvePageContent('cola', { phone: 'bad' }).phone, cola.phone)
assert.equal(resolvePageContent('spread', { phone: cola.phone }).phone, undefined)
console.log('Page content checks passed: defaults, site boundaries, validation and contact links.')
