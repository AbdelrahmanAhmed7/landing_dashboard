// Null preserves the existing call-centre confirmation flow for ice cream.
export function shippingFee(offer, site) {
  if (offer?.free_shipping ?? offer?.freeShipping) return 0
  const value = offer?.shipping_fee ?? offer?.shippingFee
  if (value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0) return Number(value)
  return site === 'cola' ? 50 : site === 'spread' ? 0 : null
}

export function shippingLabel(offer, site) {
  const fee = shippingFee(offer, site)
  return fee === null ? 'الشحن يُحدد عند تأكيد الطلب' : fee === 0 ? '🚚 التوصيل مجاني' : `🚚 التوصيل ${fee} جنيه`
}

export function cartShipping(items, site) {
  const fees = items.filter(item => item.qty > 0).map(item => shippingFee(item.bundle || item.offer, site))
  return { fee: Math.max(0, ...fees.filter(fee => fee !== null)), deferred: fees.includes(null) }
}

export function cartShippingLabel(items, site) {
  const { fee, deferred } = cartShipping(items, site)
  if (deferred) return fee ? `${fee} ج.م + شحن يُحدد عند التأكيد` : 'يُحدد عند تأكيد الطلب'
  return fee ? `${fee} ج.م` : 'مجاني 🚚'
}

export function shippingSummary(offers, site) {
  if (offers.length && offers.every(offer => shippingFee(offer, site) === 0)) return 'كل العروض بتوصيل مجاني 🚚'
  return 'الشحن حسب العرض؛ تُحسب أعلى رسوم مرة واحدة على الطلب'
}
