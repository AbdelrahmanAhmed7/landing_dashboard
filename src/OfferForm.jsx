import { useState } from 'react'
import { supabase } from './supabase'
import { uploadImage } from './imageUtils'

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

export default function OfferForm({ site, offer, nextOrder, onClose, onSaved }) {
  const isEdit = Boolean(offer)
  const [f, setF] = useState(() => (offer ? fromOffer(offer, nextOrder) : emptyOffer(nextOrder)))
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState('') // '' | 'main' | flavor index
  const [error, setError] = useState('')

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

  const pickFlavorImage = async (i, file) => {
    if (!file) return
    setUploading(i)
    setError('')
    try {
      const url = await uploadImage(file, `${site}/flavors`)
      setFlavor(i, { image: url })
    } catch (e) {
      setError(`فشل رفع الصورة: ${e.message}`)
    }
    setUploading('')
  }

  const setFlavor = (i, patch) =>
    setF((p) => ({ ...p, flavors: p.flavors.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) }))
  const addFlavor = () => setF((p) => ({ ...p, flavors: [...p.flavors, { name: '' }] }))
  const removeFlavor = (i) => setF((p) => ({ ...p, flavors: p.flavors.filter((_, idx) => idx !== i) }))

  const validate = () => {
    if (!f.name.trim()) return 'اسم العرض مطلوب'
    if (!/^[a-z0-9-]+$/.test(f.slug)) return 'الـ slug حروف إنجليزي صغيرة وأرقام وشرطة بس'
    if (f.price === '' || price < 0) return 'السعر مطلوب'
    if (f.original_price === '' || original < 0) return 'السعر قبل الخصم مطلوب (ممكن يساوي السعر)'
    if (original < price) return 'السعر قبل الخصم لازم يكون أكبر من أو يساوي السعر'
    if (!Number.isInteger(Number(f.units)) || Number(f.units) < 1) return 'عدد القطع لازم يكون 1 أو أكتر'
    if (f.flavors.some((x) => !x.name.trim())) return 'في نكهة اسمها فاضي — اكتب اسمها أو امسحها'
    return ''
  }

  const submit = async (e) => {
    e.preventDefault()
    const problem = validate()
    if (problem) return setError(problem)
    setBusy(true)
    setError('')
    try {
      const row = {
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
          name: x.name.trim(),
          ...(x.image ? { image: x.image } : {}),
        })),
        image_url: f.image_url || null,
        accent: f.accent,
        delivery_note: f.delivery_note.trim() || null,
        free_shipping: f.free_shipping,
        is_active: f.is_active,
        sort_order: Number(f.sort_order) || nextOrder,
      }
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
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <h2>{isEdit ? 'تعديل العرض' : 'عرض جديد'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">✕</button>
        </div>

        <div className="modal-body">
          <div className="grid2">
            <label className="field">
              <span>اسم العرض *</span>
              <input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="عرض الآيس كريم" />
            </label>
            <label className="field">
              <span>الشارة (Badge)</span>
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

          <div className="grid3">
            <label className="field">
              <span>السعر (ج) *</span>
              <input type="number" min="0" step="any" inputMode="decimal" value={f.price} onChange={(e) => set('price', e.target.value)} />
            </label>
            <label className="field">
              <span>السعر قبل الخصم (ج) *</span>
              <input type="number" min="0" step="any" inputMode="decimal" value={f.original_price} onChange={(e) => set('original_price', e.target.value)} />
            </label>
            <div className="field">
              <span>الوفر (تلقائي)</span>
              <div className="readonly">{saving > 0 ? `${saving} ج` : '—'}</div>
            </div>
          </div>

          <div className="grid2">
            <label className="field">
              <span>عدد القطع في العرض *</span>
              <input type="number" min="1" step="1" value={f.units} onChange={(e) => set('units', e.target.value)} />
              <small className="muted">ده الرقم اللي العميل لازم يوزّع نكهاته عليه</small>
            </label>
            <label className="field">
              <span>نص عدد القطع</span>
              <input value={f.units_label} onChange={(e) => set('units_label', e.target.value)} placeholder="5 قطع" />
            </label>
          </div>

          <div className="field">
            <span>صورة العرض</span>
            <div className="upload-row">
              <div className="thumb big">
                {f.image_url ? <img src={f.image_url} alt="" /> : <span className="muted small">بدون صورة</span>}
              </div>
              <div>
                <input type="file" accept="image/*" onChange={(e) => pickMainImage(e.target.files?.[0])} disabled={uploading === 'main'} />
                {uploading === 'main' && <p className="muted small">جاري الرفع…</p>}
                {f.image_url && (
                  <button type="button" className="btn ghost small-btn" onClick={() => set('image_url', '')}>شيل الصورة</button>
                )}
                <p className="muted small">لو سبتها فاضية، الـ landing هتستخدم الصورة المحلية.</p>
              </div>
            </div>
          </div>

          <div className="field">
            <span>النكهات <small className="muted">(سيبها فاضية لو العرض من غير اختيار نكهات)</small></span>
            <div className="flavor-list">
              {f.flavors.map((fl, i) => (
                <div className="flavor-item" key={i}>
                  <div className="thumb small">
                    {fl.image ? <img src={fl.image} alt="" /> : <span className="muted tiny">—</span>}
                  </div>
                  <input
                    value={fl.name}
                    onChange={(e) => setFlavor(i, { name: e.target.value })}
                    placeholder="اسم النكهة"
                  />
                  <label className="btn ghost small-btn file-btn">
                    {uploading === i ? '…' : 'صورة'}
                    <input type="file" accept="image/*" hidden onChange={(e) => pickFlavorImage(i, e.target.files?.[0])} />
                  </label>
                  {fl.image && (
                    <button type="button" className="icon-btn" title="شيل الصورة" onClick={() => setFlavor(i, { image: undefined })}>⌫</button>
                  )}
                  <button type="button" className="icon-btn" title="امسح النكهة" onClick={() => removeFlavor(i)}>✕</button>
                </div>
              ))}
              <button type="button" className="btn ghost" onClick={addFlavor}>+ نكهة</button>
            </div>
          </div>

          <div className="grid2">
            <label className="field">
              <span>ملاحظة التوصيل</span>
              <input value={f.delivery_note} onChange={(e) => set('delivery_note', e.target.value)} placeholder="🚚 التوصيل مجاني" />
            </label>
            <label className="field">
              <span>لون العرض</span>
              <input type="color" value={f.accent} onChange={(e) => set('accent', e.target.value)} />
            </label>
          </div>

          <div className="checks">
            <label><input type="checkbox" checked={f.free_shipping} onChange={(e) => set('free_shipping', e.target.checked)} /> توصيل مجاني</label>
            <label><input type="checkbox" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} /> ظاهر في الصفحة</label>
          </div>

          <label className="field">
            <span>الـ slug (معرّف ثابت بالإنجليزي) *</span>
            <input dir="ltr" value={f.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} disabled={isEdit} />
            <small className="muted">
              {isEdit
                ? 'مش بيتغيّر بعد الإنشاء، لأن كود الـ landing بيعتمد عليه.'
                : 'اكتب حاجة مفهومة زي cola-zero أو ice-cream-5. مش هتقدر تغيّره بعدين.'}
            </small>
          </label>
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>إلغاء</button>
          <button className="btn primary" disabled={busy || uploading !== ''}>{busy ? 'جاري الحفظ…' : 'حفظ'}</button>
        </div>
      </form>
    </div>
  )
}