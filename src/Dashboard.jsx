import { flavorData } from './flavorCatalog'
import { useCallback, useEffect, useState } from 'react'
import { supabase, SITES } from './supabase'
import OfferForm from './OfferForm.jsx'
import { useOfferListMotion } from './useOfferListMotion'

const fmt = (n) => Number(n).toLocaleString('en-US')
const siteLabels = { cola: 'الكولا', 'ice-cream': 'الآيس كريم', spread: 'السبريد' }

export default function Dashboard({ session }) {
  const [site, setSite] = useState(SITES[0].key)
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | offer
  const [editingSection, setEditingSection] = useState('offer-details-heading')
  const [notAdmin, setNotAdmin] = useState(false)
  const [search, setSearch] = useState('')
  const [visibility, setVisibility] = useState('all')
  const [notice, setNotice] = useState('')
  const [acting, setActing] = useState(false)
  const openEditor = (offer, section = 'offer-details-heading') => {
    setEditingSection(section)
    setEditing(offer)
  }

  const load = useCallback(async ({ background = false } = {}) => {
    if (!background) {
      setLoading(true)
      setError('')
    }
    try {
      const { data, error: err } = await supabase
        .from('offers')
        .select('*')
        .eq('site', site)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (err) throw err
      setOffers(data || [])
      return true
    } catch (err) {
      setError(err.message || 'تعذّر تحميل العروض. حاول مرة تانية.')
      return false
    } finally {
      if (!background) setLoading(false)
    }
  }, [site])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    supabase.rpc('is_admin').then(({ data }) => setNotAdmin(data === false))
  }, [session])

  const run = async (action, message) => {
    if (acting) return false
    setActing(true)
    setNotice('')
    setError('')
    try {
      const { error: err } = await action()
      if (err) throw err
      const refreshed = await load({ background: true })
      if (refreshed) setNotice(message)
      else setError('تم حفظ التغيير، لكن تعذّر تحديث القائمة. حدّث الصفحة للمراجعة.')
      return true
    } catch (err) {
      // A reorder can partly succeed; reconcile without hiding the old cards.
      await load({ background: true })
      setError(err.message)
      return false
    } finally {
      setActing(false)
    }
  }

  const toggleActive = (o) => run(() => supabase.from('offers').update({ is_active: !o.is_active }).eq('id', o.id), o.is_active ? 'تم إخفاء العرض.' : 'تم إظهار العرض.')

  const move = async (index, dir) => {
    const a = offers[index]
    const b = offers[index + dir]
    if (!a || !b || acting) return
    // نعيد ترقيم الكل 1..n عشان نتفادى تساوي الـ sort_order
    const next = [...offers]
    next[index] = b
    next[index + dir] = a
    await run(async () => {
      const results = await Promise.all(next.map((o, i) => supabase.from('offers').update({ sort_order: i + 1 }).eq('id', o.id)))
      return results.find(r => r.error) || { error: null }
    }, 'تم تحديث ترتيب العروض.')
  }

  const remove = async (o) => {
    if (!window.confirm(`تحذف العرض "${o.name}" نهائياً؟`)) return
    await run(() => supabase.from('offers').delete().eq('id', o.id), 'تم حذف العرض.')
  }

  const current = SITES.find((s) => s.key === site)
  const activeCount = offers.filter(o => o.is_active).length
  const query = search.trim().toLocaleLowerCase('ar')
  const filtered = offers.filter(o =>
    (!query || `${o.name} ${o.slug} ${o.badge || ''}`.toLocaleLowerCase('ar').includes(query)) &&
    (visibility === 'all' || Boolean(o.is_active) === (visibility === 'active')),
  )
  const isFiltered = Boolean(query) || visibility !== 'all'
  const listRef = useOfferListMotion(offers, query, visibility)

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  return (
    <div className="shell">
      <header className="topbar" inert={Boolean(editing)}>
        <div className="dashboard-brand">
          <strong>إدارة صفحات الهبوط</strong>
          <span className="muted small" dir="ltr">Healthy &amp; Tasty · Landing Pages</span>
        </div>
        <div className="topbar-end">
          <span className="muted small" dir="ltr">{session.user.email}</span>
          <button className="btn ghost" onClick={() => supabase.auth.signOut()}>خروج</button>
        </div>
      </header>

      <main className="content" inert={Boolean(editing)}>
        {notAdmin && (
          <div className="banner warn" role="alert">
            الحساب ده مش مضاف كأدمن، فمش هتقدر تضيف أو تعدّل. شغّل الـ SQL الأخير في <code>schema.sql</code> بإيميلك.
          </div>
        )}

        <div className="tabs" role="group" aria-label="اختار الصفحة">
          {SITES.map((s) => (
            <button
              key={s.key}
              aria-pressed={s.key === site}
              disabled={loading || acting}
              className={`tab ${s.key === site ? 'active' : ''}`}
              onClick={() => { if (s.key === site) return; setOffers([]); setLoading(true); setSite(s.key); setSearch(''); setVisibility('all'); setNotice('') }}
            >
              <span aria-hidden="true">{s.emoji}</span> {siteLabels[s.key] || s.label}
            </button>
          ))}
        </div>

        <div className="section-head">
          <div>
            <h2>عروض {siteLabels[site] || current.label}</h2>
            <p className="muted small section-description">عدّل الأسعار والنكهات، واختار العروض اللي تظهر للعملاء.</p>
          </div>
          <button className="btn primary" disabled={loading || acting || notAdmin} onClick={() => openEditor('new')}>+ عرض جديد</button>
        </div>

        <div className="offer-overview" aria-label="ملخص العروض">
          <div><strong>{loading ? '—' : offers.length}</strong><span>إجمالي العروض</span></div>
          <div><strong>{loading ? '—' : activeCount}</strong><span>ظاهرة للعملاء</span></div>
          <div><strong>{loading ? '—' : offers.length - activeCount}</strong><span>مخفية</span></div>
        </div>

        <div className="offer-toolbar">
          <label className="field"><span>ابحث عن عرض</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="اسم العرض أو الشارة أو المعرّف…" /></label>
          <label className="field"><span>حالة الظهور</span><select value={visibility} onChange={e => setVisibility(e.target.value)}><option value="all">كل العروض</option><option value="active">الظاهرة فقط</option><option value="hidden">المخفية فقط</option></select></label>
        </div>

        {(error || notice) && <div className={`dashboard-feedback ${error ? 'is-error' : ''}`}>
          <p role={error ? 'alert' : 'status'}>{error || `✓ ${notice}`}</p>
          <button type="button" className="icon-btn" aria-label="إغلاق الرسالة" onClick={() => { setError(''); setNotice('') }}>✕</button>
        </div>}
        {loading && <p className="muted" role="status">جاري تحميل العروض…</p>}
        {!loading && offers.length > 0 && <div className="results-summary"><span className="muted small" role="status">{acting ? 'جاري حفظ التغيير…' : `عرض ${filtered.length} من ${offers.length}`}</span>{isFiltered && <button className="btn ghost small-btn" onClick={() => { setSearch(''); setVisibility('all') }}>مسح البحث والفلتر</button>}</div>}

        {!loading && offers.length === 0 && (
          <div className="empty">
            مفيش عروض للصفحة دي لسه. دوس «عرض جديد» وابدأ.
          </div>
        )}
        {!loading && offers.length > 0 && filtered.length === 0 && <div className="empty">مفيش عروض مطابقة. جرّب اسم تاني أو غيّر فلتر الظهور.</div>}

        <ul className="offer-list" ref={listRef} aria-busy={acting}>
          {!loading && filtered.map(o => {
            const i = offers.findIndex(item => item.id === o.id)
            const flavors = flavorData(o.flavors, site, o.slug)
            return (
            <li key={o.id} data-offer-id={o.id} className={`offer-card ${o.is_active ? '' : 'inactive'}`} style={{ '--accent': o.accent }}>
              <div className="thumb">
                {o.image_url ? <img src={o.image_url} alt="" /> : <span className="muted small">بدون صورة</span>}
              </div>
              <div className="info">
                <div className="title-row">
                  <h3>{o.name}</h3>
                  <span className={`pill ${o.is_active ? 'on' : 'off'}`}>{o.is_active ? 'ظاهر' : 'مخفي'}</span>
                </div>
                {o.badge && <div className="badge">{o.badge}</div>}
                <div className="prices">
                  <strong>{fmt(o.price)} ج</strong>
                  {Number(o.original_price) > Number(o.price) && (
                    <>
                      <s>{fmt(o.original_price)} ج</s>
                      <span className="save">وفر {fmt(o.original_price - o.price)} ج</span>
                    </>
                  )}
                </div>
                <div className="offer-meta muted small">
                  <span>{o.units_label || `${o.units} قطعة`}</span>
                  <span>{flavors.flavorOptions.length} نكهة ظاهرة</span>
                  {o.free_shipping && <span>توصيل مجاني</span>}
                  <span dir="ltr">{o.slug}</span>
                </div>
                {!flavors.flavorsAvailable && <p className="inline-notice">غير متاح للطلب: راجع النكهات الظاهرة داخل العرض.</p>}
              </div>
              <div className="offer-shortcuts" aria-label={`تعديل سريع — ${o.name}`}>
                <button className="btn ghost" disabled={acting || notAdmin} onClick={() => openEditor(o, 'offer-price-heading')}>تعديل السعر والكمية</button>
                <button className="btn ghost" disabled={acting || notAdmin} onClick={() => openEditor(o, 'offer-flavors-heading')}>إدارة النكهات</button>
              </div>
              <div className="actions">
                <button className="btn primary" disabled={acting || notAdmin} onClick={() => openEditor(o)}>تعديل العرض</button>
                <button className="btn ghost" disabled={acting || notAdmin} onClick={() => toggleActive(o)}>{o.is_active ? 'إخفاء' : 'إظهار'}</button>
                <div className="order-controls" aria-label="ترتيب العرض">
                  <span className="muted small">ترتيب {i + 1}</span>
                  <button className="icon-btn" title={isFiltered ? 'امسح الفلتر لتغيير الترتيب' : 'تقديم العرض'} aria-label={`تقديم ${o.name}`} disabled={acting || notAdmin || isFiltered || i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button className="icon-btn" title={isFiltered ? 'امسح الفلتر لتغيير الترتيب' : 'تأخير العرض'} aria-label={`تأخير ${o.name}`} disabled={acting || notAdmin || isFiltered || i === offers.length - 1} onClick={() => move(i, 1)}>↓</button>
                </div>
                <button className="btn danger" disabled={acting || notAdmin} onClick={() => remove(o)}>حذف</button>
              </div>
            </li>
          )})}
        </ul>
      </main>

      {editing && (
        <OfferForm
          site={site}
          offer={editing === 'new' ? null : editing}
          initialSection={editingSection}
          nextOrder={offers.length + 1}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setActing(true)
            setNotice('')
            setError('')
            setEditing(null)
            try {
              const refreshed = await load({ background: true })
              if (refreshed) setNotice(editing === 'new' ? 'تمت إضافة العرض.' : 'تم حفظ تعديلات العرض.')
              else setError('تم الحفظ، لكن تعذّر تحديث القائمة. حدّث الصفحة للمراجعة.')
            } finally {
              setActing(false)
            }
          }}
        />
      )}
    </div>
  )
}
