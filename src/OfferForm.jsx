import { shippingLabel } from './shipping'
import ActualPreview from './ActualPreview'
import FlavorEditor from './FlavorEditor'
import ImageUpload from './ImageUpload'
import { normalizeFlavors } from './flavorCatalog'
import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { uploadImage } from './imageUtils'
import { defaultOfferImage } from './offerImages'

const emptyOffer = (nextOrder) => ({
  slug: `offer-${Date.now().toString(36)}`,
  name: '',
  badge: '',
  description: '',
  note: '',
  price: '',
  original_price: '',
  units: 1,
  units_label: '',
  flavors: [],
  image_url: '',
  accent: '#EC4899',
  delivery_note: '',
  free_shipping: false,
  shipping_fee: '',
  is_active: true,
  sort_order: nextOrder,
})

/** الحقول الفاضية بترجع من الـ database كـ null، فنستبدلها بالقيمة الافتراضية (نص فاضي مثلاً) */
const fromOffer = (offer, nextOrder) => {
  const base = emptyOffer(nextOrder)
  const out = { ...base }
  for (const key of Object.keys(base)) {
    if (offer[key] !== null && offer[key] !== undefined) out[key] = offer[key]
  }
  if (!Array.isArray(out.flavors)) out.flavors = []
  return out
}

export default function OfferForm({ site, offer, offers = [], nextOrder, onClose, onSaved, initialSection = 'offer-details-heading' }) {
  const isEdit = Boolean(offer)
  const [f, setF] = useState(() => {
    const initial = offer ? fromOffer(offer, nextOrder) : emptyOffer(nextOrder)
    return { ...initial, flavors: normalizeFlavors(initial.flavors, site, initial.slug) }
  })
  const [offerPreview, setOfferPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState('') // '' | 'main' | stable flavor ID
  const [error, setError] = useState('')
  const formRef = useRef(null)
  const locked = busy || uploading !== ''
  const originalImage = defaultOfferImage(site, f.slug)
  const previewImage = f.image_url || originalImage

  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const heading = formRef.current?.querySelector(`#${initialSection}`)
    const section = heading?.closest('.offer-form-section, .flavor-editor')
    if (initialSection !== 'offer-details-heading') heading?.scrollIntoView({ block: 'start' })
    section?.querySelector('input, button')?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.({ preventScroll: true })
    }
  }, [initialSection])

  const handleKeys = e => {
    if (e.key === 'Escape' && !locked) { e.preventDefault(); onClose() }
    if (e.key !== 'Tab') return
    const controls = [...formRef.current.querySelectorAll('button, input, textarea, select, [tabindex="0"]')]
      .filter(el => !el.disabled && el.getClientRects().length)
    const first = controls[0], last = controls.at(-1)
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
  }

  const jumpTo = id => {
    const heading = formRef.current.querySelector(`#${id}`)
    heading?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    heading?.focus({ preventScroll: true })
  }

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const price = Number(f.price)
  const original = Number(f.original_price)
  const saving = original > price ? original - price : 0

  const pickMainImage = async (file) => {
    if (!file) return
    setUploading('main')
    setError('')
    try {
      set('image_url', await uploadImage(file, site))
    } catch (e) {
      setError(`فشل رفع الصورة: ${e.message}`)
    }
    setUploading('')
  }

  const pickFlavorImage = async (id, file) => {
    if (!file) return
    setUploading(id)
    setError('')
    try {
      const url = await uploadImage(file, `${site}/flavors`)
      setFlavor(id, { image: url })
    } catch (e) {
      setError(`فشل رفع الصورة: ${e.message}`)
    }
    setUploading('')
  }

  const setFlavor = (id, patch) =>
    setF((p) => ({ ...p, flavors: p.flavors.map(x => x.id === id ? { ...x, ...patch } : x) }))

  const validate = () => {
    if (!f.name.trim()) return 'اسم العرض مطلوب'
    if (!/^[a-z0-9-]+$/.test(f.slug)) return 'الـ slug حروف إنجليزي صغيرة وأرقام وشرطة بس'
    if (f.price === '' || !Number.isFinite(price) || price < 0) return 'السعر مطلوب'
    if (f.original_price === '' || !Number.isFinite(original) || original < 0) return 'السعر قبل الخصم مطلوب (ممكن يساوي السعر)'
    if (original < price) return 'السعر قبل الخصم لازم يكون أكبر من أو يساوي السعر'
    if (!Number.isInteger(Number(f.units)) || Number(f.units) < 1) return 'عدد القطع لازم يكون 1 أو أكتر'
    if (f.shipping_fee !== '' && (!Number.isFinite(Number(f.shipping_fee)) || Number(f.shipping_fee) < 0 || Number(f.shipping_fee) > 99999999.99)) return 'مبلغ الشحن لازم يكون رقم من صفر إلى 99999999.99'
    if (f.flavors.some((x) => !x.name.trim())) return 'في نكهة اسمها فاضي — اكتب اسمها أو امسحها'
    const keys = f.flavors.map(x => `${x.group}:${x.name.trim()}`)
    if (new Set(keys).size !== keys.length) return 'اسم النكهة متكرر داخل نفس المجموعة'
    return ''
  }

  const toRow = () => ({
    site,
    slug: f.slug,
    name: f.name.trim(),
    badge: f.badge.trim() || null,
    description: f.description.trim() || null,
    note: f.note.trim() || null,
    price,
    original_price: original,
    units: Number(f.units),
    units_label: f.units_label.trim() || null,
    flavors: f.flavors.map((x) => ({
      id: x.id,
      group: x.group,
      is_active: x.is_active,
      name: x.name.trim(),
      ...(x.image ? { image: x.image } : {}),
    })),
    image_url: f.image_url || null,
    accent: f.accent,
    delivery_note: shippingLabel(f, site),
    shipping_fee: f.shipping_fee === '' ? null : Number(f.shipping_fee),
    free_shipping: f.free_shipping,
    is_active: f.is_active,
    sort_order: Number(f.sort_order) || nextOrder,
  })

  const openPreview = () => {
    if (locked) return
    const problem = validate()
    if (problem) return setError(problem)
    if (!isEdit && offers.some(item => item.slug === f.slug)) return setError('الـ slug ده مستخدم قبل كده في نفس الصفحة، غيّره')
    const row = toRow()
    const rows = offers.filter(item => item.site === site && item.is_active && item.id !== offer?.id && item.slug !== row.slug)
    rows.push({ ...row, is_active: true, created_at: offer?.created_at || new Date().toISOString() })
    rows.sort((a, b) => a.sort_order - b.sort_order || String(a.created_at || '').localeCompare(String(b.created_at || '')))
    setError('')
    setOfferPreview({ rows, focusSlug: row.slug, hidden: !row.is_active })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (locked) return
    const problem = validate()
    if (problem) return setError(problem)
    setBusy(true)
    setError('')
    try {
      const row = toRow()
      const { error: err } = isEdit
        ? await supabase.from('offers').update(row).eq('id', offer.id)
        : await supabase.from('offers').insert(row)
      if (err) {
        setError(
          err.code === '23505'
            ? 'الـ slug ده مستخدم قبل كده في نفس الصفحة، غيّره'
            : err.code === '42501'
              ? 'مفيش صلاحية. الحساب لازم يكون مضاف في جدول admins'
              : err.message,
        )
        return
      }
      onSaved()
    } catch (e2) {
      // أي خطأ غير متوقع: رجّع الزرار بدل ما يفضل معلّق
      setError(`حصلت مشكلة غير متوقعة: ${e2.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
    <div inert={Boolean(offerPreview)} className="modal-backdrop" onMouseDown={(e) => !locked && e.target === e.currentTarget && onClose()}>
      <form ref={formRef} className="modal offer-form" role="dialog" aria-modal="true" aria-labelledby="offer-form-title" aria-describedby="offer-form-hint" onKeyDown={handleKeys} onSubmit={submit}>
        <div className="modal-head">
          <div>
            <h2 id="offer-form-title">{isEdit ? 'تعديل العرض' : 'إضافة عرض جديد'}</h2>
            <p id="offer-form-hint" className="muted small">{isEdit ? f.name : 'ابدأ بالاسم والسعر، وبعدها اختار النكهات.'} · الحقول بعلامة * مطلوبة</p>
          </div>
          <button type="button" className="icon-btn" disabled={locked} onClick={onClose} aria-label="إغلاق">✕</button>
        </div>
        <nav className="form-nav" aria-label="أقسام العرض">
          {[['offer-details-heading', 'البيانات'], ['offer-price-heading', 'السعر والكمية'], ['offer-image-heading', 'الصورة'], ['offer-flavors-heading', 'النكهات'], ['offer-settings-heading', 'الإعدادات']].map(([id, label]) => <button type="button" key={id} onClick={() => jumpTo(id)}>{label}</button>)}
        </nav>

        <div className="modal-body">
          <section className="offer-form-section" aria-labelledby="offer-details-heading">
            <h3 id="offer-details-heading" tabIndex={-1}>بيانات العرض</h3>
            <div className="grid2">
              <label className="field">
                <span>اسم العرض *</span>
                <input required value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="مثال: عرض الصيف" />
              </label>
              <label className="field">
                <span>شارة العرض</span>
                <input value={f.badge} onChange={(e) => set('badge', e.target.value)} placeholder="🍨 5 قطع بـ 299 ج" />
              </label>
            </div>

            <label className="field">
              <span>الوصف</span>
              <textarea rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} />
            </label>

            <label className="field">
              <span>ملاحظة صغيرة تحت الوصف</span>
              <input value={f.note} onChange={(e) => set('note', e.target.value)} />
            </label>
          </section>

          <section className="offer-form-section" aria-labelledby="offer-price-heading">
            <h3 id="offer-price-heading" tabIndex={-1}>السعر والكمية</h3>
            <div className="grid3">
              <label className="field">
                <span>السعر (ج) *</span>
                <input required type="number" min="0" step="any" inputMode="decimal" value={f.price} onChange={(e) => set('price', e.target.value)} />
              </label>
              <label className="field">
                <span>السعر قبل الخصم (ج) *</span>
                <input required type="number" min="0" step="any" inputMode="decimal" value={f.original_price} onChange={(e) => set('original_price', e.target.value)} />
              </label>
              <div className="field">
                <span>الوفر (تلقائي)</span>
                <div className="readonly">{saving > 0 ? `${saving} ج` : '—'}</div>
              </div>
            </div>

            <div className="grid2">
              <label className="field">
                <span>عدد القطع في العرض *</span>
                <input required type="number" min="1" step="1" value={f.units} onChange={(e) => set('units', e.target.value)} />
                <small className="muted">ده الرقم اللي العميل لازم يوزّع نكهاته عليه</small>
              </label>
              <label className="field">
                <span>نص عدد القطع</span>
                <input value={f.units_label} onChange={(e) => set('units_label', e.target.value)} placeholder="5 قطع" />
              </label>
            </div>
          </section>

          <div className="field offer-form-section">
            <h3 id="offer-image-heading" tabIndex={-1}>صورة العرض</h3>
            <div className="upload-row">
              <div className="thumb big">
                {previewImage ? <img src={previewImage} alt={f.name || 'صورة العرض'} decoding="async" /> : <span className="muted small">بدون صورة</span>}
              </div>
              <div className="upload-controls">
                <ImageUpload label={previewImage ? 'تغيير صورة العرض' : 'رفع صورة العرض'} onSelect={pickMainImage} disabled={locked} busy={uploading === 'main'} />
                {f.image_url && (
                  <button type="button" className="btn ghost small-btn" disabled={locked} onClick={() => set('image_url', '')}>{originalImage ? 'استعادة الصورة الأصلية' : 'إزالة الصورة المرفوعة'}</button>
                )}
                <p className="muted small">{f.image_url ? 'الصورة المرفوعة هي اللي هتظهر للعملاء بعد الحفظ.' : originalImage ? 'دي الصورة الأصلية للعرض، وتقدر تستبدلها بصورة جديدة.' : 'ارفع صورة واضحة للعرض عشان تظهر هنا وفي صفحة المنتج.'}</p>
              </div>
            </div>
          </div>

          <FlavorEditor site={site} slug={f.slug} flavors={f.flavors} onChange={value => set('flavors', value)} onUpload={pickFlavorImage} uploading={uploading} />

          <section className="offer-form-section" aria-labelledby="offer-settings-heading">
            <h3 id="offer-settings-heading" tabIndex={-1}>التوصيل وإعدادات العرض</h3>
            <div className="grid2">
              <label className="field">
                <span>الشحن اللي هيظهر للعميل</span>
                <div className="readonly" role="status">{shippingLabel(f, site)}</div>
              </label>
              <label className="field">
                <span>لون العرض</span>
                <input type="color" value={f.accent} onChange={(e) => set('accent', e.target.value)} />
              </label>
            </div>

            <label className="field">
              <span>مبلغ الشحن (ج)</span>
              <input aria-label="مبلغ الشحن (ج)" aria-describedby="shipping-help" type="number" min="0" max="99999999.99" step="0.01" inputMode="decimal" disabled={f.free_shipping || locked} value={f.shipping_fee} onChange={e => set('shipping_fee', e.target.value)} placeholder={site === 'cola' ? '50' : site === 'spread' ? '0' : 'يُحدد عند تأكيد الطلب'} />
              <small id="shipping-help" className="muted">اتركه فاضي للإعداد الحالي. التوصيل المجاني يلغي الرسوم، وأعلى مبلغ شحن بيتحسب مرة واحدة للطلب مهما زادت الكمية.</small>
            </label>
            <div className="checks">
              <label><input type="checkbox" checked={f.free_shipping} onChange={(e) => set('free_shipping', e.target.checked)} /> توصيل مجاني</label>
              <label><input type="checkbox" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} /> ظاهر في الصفحة</label>
            </div>

            <label className="field">
              <span>الـ slug (معرّف ثابت بالإنجليزي) *</span>
              <input dir="ltr" value={f.slug} onChange={(e) => { const slug = e.target.value.toLowerCase(); setF(p => ({ ...p, slug, flavors: normalizeFlavors(p.flavors.map(({ group, ...fl }) => fl), site, slug) })) }} disabled={isEdit} />
              <small className="muted">
                {isEdit
                  ? 'مش بيتغيّر بعد الإنشاء، لأن كود الـ landing بيعتمد عليه.'
                  : 'اكتب حاجة مفهومة زي cola-zero أو ice-cream-5. مش هتقدر تغيّره بعدين.'}
              </small>
            </label>
          </section>
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        <div className="modal-foot">
          <button type="button" className="btn ghost" disabled={locked} onClick={openPreview}>معاينة داخل الصفحة</button>
          <button type="button" className="btn ghost" disabled={locked} onClick={onClose}>إلغاء</button>
          <button className="btn primary" disabled={locked}>{busy ? 'جاري الحفظ…' : isEdit ? 'حفظ التعديلات' : 'إضافة العرض'}</button>
        </div>
      </form>
    </div>
    {offerPreview && <ActualPreview site={site} offerPreview={offerPreview} onClose={() => setOfferPreview(null)} />}
    </>
  )
}
