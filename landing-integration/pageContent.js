const field = (key, label, value, max = 100, type = 'text') => ({ key, label, value, max, type })
const header = field('headerCta', 'نص زر الطلب العلوي', 'اطلب الآن 🛒', 40)
const checkout = field('checkoutCta', 'نص زر إكمال الطلب', 'أكمل الطلب', 40)
const contact = [
  field('phoneLabel', 'نص رابط الاتصال', 'اتصال', 30),
  field('phone', 'رقم الاتصال', '+201100863802', 20, 'tel'),
  field('emailLabel', 'نص رابط البريد الإلكتروني', 'إيميل', 30),
  field('email', 'البريد الإلكتروني', 'care@healthyandtasty.store', 120, 'email'),
]
const timers = [
  field('timerLabel', 'النص بجانب العدّاد العلوي وداخل العروض', '⏰ العروض تنتهي خلال', 60),
  field('floatingTimerLabel', 'النص بجانب العدّاد السفلي', '⏰ العرض ينتهي خلال', 60),
  field('floatingCta', 'نص زر الطلب بجانب العدّاد السفلي', 'اطلب دلوقتي', 40),
]

export const PAGE_CONTENT_SECTIONS = {
  cola: [
    { id: 'header', title: 'أعلى الصفحة', fields: [header] },
    { id: 'bottom', title: 'شريط الطلب أسفل الصفحة', fields: [field('bottomCta', 'نص الشريط قبل إضافة منتجات للسلة', '🛒 اطلب الآن — التوصيل خلال ساعات من تأكيد الطلب', 120), checkout] },
    { id: 'footer', title: 'التواصل أسفل الصفحة', fields: contact },
  ],
  'ice-cream': [
    { id: 'promo', title: 'شريط الرسائل العلوي', fields: [field('promo1', 'الرسالة الأولى', '💳 الدفع عند الاستلام'), field('promo2', 'الرسالة الثانية', '⚡ التوصيل خلال ساعات من تأكيد الطلب'), field('promo3', 'الرسالة الثالثة', 'بدون سكر 🤍')] },
    { id: 'header', title: 'أزرار وروابط أعلى الصفحة', fields: [header, field('navOffers', 'رابط العروض', 'العروض', 35), field('navBenefits', 'رابط المميزات', 'ليه Healthy & Tasty', 35), field('navFaq', 'رابط الأسئلة الشائعة', 'الأسئلة الشائعة', 35)] },
    { id: 'bottom', title: 'العدّاد وشريط الطلب', fields: [...timers, checkout] },
    { id: 'footer', title: 'التواصل أسفل الصفحة', fields: contact },
  ],
  spread: [
    { id: 'promo', title: 'شريط الرسائل العلوي', fields: [field('promo1', 'الرسالة الأولى', '🚚 توصيل مجاناً'), field('promo2', 'الرسالة الثانية', '🍫 جديد: شيكولاتة بار'), field('promo3', 'الرسالة الثالثة', 'Healthy Spread بدون سكر مضاف')] },
    { id: 'header', title: 'أزرار وروابط أعلى الصفحة', fields: [header, field('navBenefits', 'رابط المميزات', 'المميزات', 35), field('navOffers', 'رابط العروض', 'العروض', 35), field('navOrder', 'رابط الطلب', 'اطلب الآن', 35)] },
    { id: 'bottom', title: 'العدّاد وشريط الطلب', fields: [...timers, checkout] },
    { id: 'footer', title: 'أسفل الصفحة', fields: [field('footerTagline', 'الوصف تحت الشعار', 'Healthy food for all people', 180), field('footerNote', 'النص الختامي', 'Healthy Spread بطعم غني يناسب حياتك الصحية.', 250, 'textarea')] },
  ],
}

export const contentFields = site => (PAGE_CONTENT_SECTIONS[site] || []).flatMap(section => section.fields)
export const defaultPageContent = site => Object.fromEntries(contentFields(site).map(f => [f.key, f.value]))

export function validContentValue(field, value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > field.max) return false
  if (field.type === 'tel') return /^\+?[0-9]{7,15}$/.test(value.trim())
  if (field.type === 'email') return /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(value.trim())
  return true
}

// Only known, valid text fields reach the page. React renders them as text.
export function resolvePageContent(site, values) {
  const source = values && typeof values === 'object' && !Array.isArray(values) ? values : {}
  return Object.fromEntries(contentFields(site).map(f => [f.key, validContentValue(f, source[f.key]) ? source[f.key].trim() : f.value]))
}

export function validatePageContent(site, values) {
  const bad = contentFields(site).find(f => !validContentValue(f, values[f.key]))
  return bad ? `راجع خانة «${bad.label}»؛ اكتب قيمة صحيحة بحد أقصى ${bad.max} حرف.` : ''
}
