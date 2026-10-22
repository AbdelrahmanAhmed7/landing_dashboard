import { shippingLabel, shippingFee, shippingMode } from './shipping'
import ActualPreview from './ActualPreview'
import FlavorEditor from './FlavorEditor'
import BundleEditor from './BundleEditor'
import ImageUpload from './ImageUpload'
import { defaultFlavorsForGroup, normalizeFlavors, normalizeSelection } from './flavorCatalog'
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
  selection: null,
  flavors: [],
  image_url: '',
  accent: '#EC4899',
  delivery_note: '',
  free_shipping: false,
  shipping_fee: '',
  shipping_mode: '',
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
    const mode = shippingMode(initial, site)
    const fee = initial.shipping_fee !== '' ? initial.shipping_fee : shippingFee(initial, site)
    const selection = normalizeSelection(initial.selection)
    return { ...initial, selection, shipping_mode: mode, free_shipping: mode === 'free', shipping_fee: fee ?? '', flavors: normalizeFlavors(initial.flavors, site, initial.slug, selection) }
  })
  const [offerPreview, setOfferPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState('') // '' | 'main' | stable flavor ID
  const [error, setError] = useState('')
  const formRef = useRef(null)
  const locked = busy || uploading !== ''
  const originalImage = defaultOfferImage(site, f.slug)
  const previewImage = f.image_url || originalImage
  const isBundle = Boolean(f.selection)
  const bundleUnits = isBundle ? f.selection.items.reduce((sum, item) => sum + Number(item.qty), 0) : 0
  const bundleGroups = isBundle ? [...new Set(f.selection.items.filter(item => item.choose > 0).map(item => item.group))] : []

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

  const setSelectionMode = (mode) => setF((p) => {
    if (mode !== 'components') return { ...p, units: p.selection ? p.selection.items.reduce((sum, item) => sum + Number(item.qty), 0) : p.units, selection: null }
    const units = Math.max(1, Number(p.units) || 1)
    return { ...p, selection: p.selection || { version: 1, mode: 'components', items: [{ key: 'item-1', label: 'المكوّن 1', qty: units, choose: 0, group: null }] } }
  })

  const changeBundleGroup = (key, group) => setF((p) => {
    const items = p.selection.items.map(item => item.key === key ? { ...item, group } : item)
    const seeds = group && !p.flavors.some(fl => fl.group === group) ? defaultFlavorsForGroup(group) : []
    return { ...p, selection: { ...p.selection, items }, flavors: seeds.length ? [...p.flavors, ...seeds] : p.flavors }
  })

  const autoSingleFlavor = (key) => setF((p) => {
    const item = p.selection?.items.find(entry => entry.key === key)
    if (!item) return p
    const group = item.key
    const items = p.selection.items.map(entry => entry.key === key ? { ...entry, choose: 1, group } : entry)
    const hasFlavors = p.flavors.some(fl => fl.group === group)
    const flavors = hasFlavors
      ? p.flavors
      : [...p.flavors, { id: crypto.randomUUID(), group, name: item.label.trim() || 'النكهة', is_active: true }]
    return { ...p, selection: { ...p.selection, items }, flavors }
  })

  const validate = () => {
    if (!f.name.trim()) return 'اسم العرض مطلوب'
    if (!/^[a-z0-9-]+$/.test(f.slug)) return 'الـ slug حروف إنجليزي صغيرة وأرقام وشرطة بس'
    if (f.price === '' || !Number.isFinite(price) || price < 0) return 'السعر مطلوب'
    if (f.original_price === '' || !Number.isFinite(original) || original < 0) return 'السعر قبل الخصم مطلوب (ممكن يساوي السعر)'
    if (original < price) return 'السعر قبل الخصم لازم يكون أكبر من أو يساوي السعر'
    if (!isBundle && (!Number.isInteger(Number(f.units)) || Number(f.units) < 1)) return 'عدد القطع لازم يكون 1 أو أكتر'
    if (isBundle) {
      if (f.selection.items.length === 0) return 'ضيف مكوّن واحد على الأقل للباندل'
      if (f.selection.items.some(item => !item.label.trim())) return 'في مكوّن اسمه فاضي — اكتب اسمه أو امسحه'
      if (new Set(f.selection.items.map(item => item.key)).size !== f.selection.items.length) return 'في مكوّنين بنفس المعرّف — امسح واحد أو غيّر الاسم'
      if (f.selection.items.some(item => !Number.isInteger(Number(item.qty)) || Number(item.qty) < 1)) return 'كمية كل مكوّن لازم تكون 1 أو أكتر'
      if (f.selection.items.some(item => Number(item.choose) > Number(item.qty))) return 'عدد النكهات المطلوبة أكبر من كمية المكوّن'
      if (f.selection.items.some(item => item.choose > 0 && !item.group)) return 'اختار مجموعة نكهات لكل مكوّن فيه اختيار'
      const shortage = f.selection.items.find(item => {
        if (item.choose < 1) return false
        return f.flavors.filter(fl => fl.group === item.group && fl.is_active && fl.name.trim()).length < item.choose
      })
      if (shortage) return `مكوّن «${shortage.label}» محتاج ${shortage.choose} نكهات ظاهرة على الأقل`
    }
    if (f.shipping_mode === 'fixed' && f.shipping_fee === '') return 'اكتب مبلغ الشحن أو اختار يتحدد مع الكول سنتر'
    if (f.shipping_mode === 'fixed' && (!Number.isFinite(Number(f.shipping_fee)) || Number(f.shipping_fee) < 0 || Number(f.shipping_fee) > 99999999.99)) return 'مبلغ الشحن لازم يكون رقم من صفر إلى 99999999.99'
    const usedFlavors = isBundle ? f.flavors.filter(x => bundleGroups.includes(x.group)) : f.flavors
    if (usedFlavors.some((x) => !x.name.trim())) return 'في نكهة اسمها فاضي — اكتب اسمها أو امسحها'
    const keys = usedFlavors.map(x => `${x.group}:${x.name.trim()}`)
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
    units: isBundle ? bundleUnits : Number(f.units),
    units_label: f.units_label.trim() || null,
    selection: isBundle ? {
      version: 1,
      mode: 'components',
      items: f.selection.items.map(({ key, label, qty, choose, group }) => ({
        key,
        label: label.trim(),
        qty: Number(qty),
        choose: Number(choose),
        ...(choose > 0 ? { group } : {}),
      })),
    } : null,
    flavors: f.flavors.filter(x => !isBundle || bundleGroups.includes(x.group)).map((x) => ({
      id: x.id,
      group: x.group,
      is_active: x.is_active,
      name: x.name.trim(),
      ...(x.image ? { image: x.image } : {}),
    })),
    image_url: f.image_url || null,
    accent: f.accent,
    delivery_note: shippingLabel(f, site),
    shipping_fee: f.shipping_mode === 'fixed' ? Number(f.shipping_fee) : null,
    shipping_mode: f.shipping_mode,
    free_shipping: f.shipping_mode === 'free',
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
          {[['offer-details-heading', 'البيانات'], ['offer-price-heading', 'السعر والكمية'], ['offer-image-heading', 'الصورة'], ...(isBundle ? [['offer-bundle-heading', 'المكوّنات']] : []), ['offer-flavors-heading', 'النكهات'], ['offer-settings-heading', 'الإعدادات']].map(([id, label]) => <button type="button" key={id} onClick={() => jumpTo(id)}>{label}</button>)}
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

            <label className="field">
              <span>طريقة اختيار العميل</span>
              <select value={isBundle ? 'components' : 'pool'} disabled={locked} onChange={e => setSelectionMode(e.target.value)}>
                <option value="pool">يوزّع القطع على النكهات</option>
                <option value="components">باندل مكوّنات — كل مكوّن اختياره مستقل</option>
              </select>
              <small className="muted">{isBundle ? 'مناسب لما الباندل فيه أكتر من منتج، وكل منتج له اختيار أو كمية مختلفة.' : 'الوضع الحالي: العميل بيوزّع عدد القطع على نكهات العرض.'}</small>
            </label>

            <div className="grid2">
              <label className="field">
                <span>عدد القطع في العرض *</span>
                <input required type="number" min="1" step="1" value={isBundle ? bundleUnits : f.units} onChange={(e) => set('units', e.target.value)} disabled={isBundle} />
                <small className="muted">{isBundle ? 'محسوب تلقائيًا من كميات المكوّنات.' : 'ده الرقم اللي العميل لازم يوزّع نكهاته عليه'}</small>
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

          {isBundle && <BundleEditor selection={f.selection} flavors={f.flavors} onChange={value => set('selection', value)} onGroupChange={changeBundleGroup} onAutoFlavor={autoSingleFlavor} />}

          <FlavorEditor site={site} slug={f.slug} selection={f.selection} flavors={f.flavors} onChange={value => set('flavors', value)} onUpload={pickFlavorImage} uploading={uploading} />

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
              <span>طريقة الشحن</span>
              <select aria-label="طريقة الشحن" disabled={locked} value={f.shipping_mode} onChange={e => { const mode = e.target.value; setF(previous => ({ ...previous, shipping_mode: mode, free_shipping: mode === 'free' })) }}>
                <option value="free">توصيل مجاني</option>
                <option value="fixed">بمبلغ محدد</option>
                <option value="call_center">يتحدد مع الكول سنتر</option>
              </select>
            </label>
            {f.shipping_mode === 'fixed' && <label className="field">
              <span>مبلغ الشحن (ج)</span>
              <input aria-label="مبلغ الشحن (ج)" aria-describedby="shipping-help" type="number" min="0" max="99999999.99" step="0.01" inputMode="decimal" required disabled={locked} value={f.shipping_fee} onChange={e => set('shipping_fee', e.target.value)} />
              <small id="shipping-help" className="muted">أعلى مبلغ شحن بيتحسب مرة واحدة للطلب مهما زادت الكمية.</small>
            </label>}
            {f.shipping_mode === 'call_center' && <p className="content-hint">مش هنفترض مبلغ للشحن. العميل هيشوف إن الإجمالي مبدئي والشحن يتأكد مع الكول سنتر، والمعلومة هتتبعت مع الطلب.</p>}
            <div className="checks">
              <label><input type="checkbox" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} /> ظاهر في الصفحة</label>
            </div>

            <label className="field">
              <span>الـ slug (معرّف ثابت بالإنجليزي) *</span>
              <input dir="ltr" value={f.slug} onChange={(e) => { const slug = e.target.value.toLowerCase(); setF(p => ({ ...p, slug, flavors: normalizeFlavors(p.flavors.map(({ group, ...fl }) => fl), site, slug, p.selection) })) }} disabled={isEdit} />
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
