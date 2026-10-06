import { useCallback, useEffect, useState } from 'react'
import { supabase, SITES } from './supabase'
import OfferForm from './OfferForm.jsx'

const fmt = (n) => Number(n).toLocaleString('en-US')

export default function Dashboard({ session }) {
  const [site, setSite] = useState(SITES[0].key)
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | offer
  const [notAdmin, setNotAdmin] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('offers')
      .select('*')
      .eq('site', site)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (err) setError(err.message)
    else setOffers(data)
    setLoading(false)
  }, [site])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    supabase.rpc('is_admin').then(({ data }) => setNotAdmin(data === false))
  }, [session])

  const run = async (promise) => {
    const { error: err } = await promise
    if (err) {
      setError(err.message)
      return false
    }
    await load()
    return true
  }

  const toggleActive = (o) => run(supabase.from('offers').update({ is_active: !o.is_active }).eq('id', o.id))

  const move = async (index, dir) => {
    const a = offers[index]
    const b = offers[index + dir]
    if (!a || !b) return
    // نعيد ترقيم الكل 1..n عشان نتفادى تساوي الـ sort_order
    const next = [...offers]
    next[index] = b
    next[index + dir] = a
    const results = await Promise.all(
      next.map((o, i) => supabase.from('offers').update({ sort_order: i + 1 }).eq('id', o.id)),
    )
    const failed = results.find((r) => r.error)
    if (failed) setError(failed.error.message)
    await load()
  }

  const remove = async (o) => {
    if (!window.confirm(`تحذف العرض "${o.name}" نهائياً؟`)) return
    await run(supabase.from('offers').delete().eq('id', o.id))
  }

  const current = SITES.find((s) => s.key === site)

  return (
    <div className="shell">
      <header className="topbar">
        <strong>Healthy &amp; Tasty · إدارة العروض</strong>
        <div className="topbar-end">
          <span className="muted small" dir="ltr">{session.user.email}</span>
          <button className="btn ghost" onClick={() => supabase.auth.signOut()}>خروج</button>
        </div>
      </header>

      <main className="content">
        {notAdmin && (
          <div className="banner warn" role="alert">
            الحساب ده مش مضاف كأدمن، فمش هتقدر تضيف أو تعدّل. شغّل الـ SQL الأخير في <code>schema.sql</code> بإيميلك.
          </div>
        )}

        <div className="tabs" role="tablist" aria-label="اختار الصفحة">
          {SITES.map((s) => (
            <button
              key={s.key}
              role="tab"
              aria-selected={s.key === site}
              className={`tab ${s.key === site ? 'active' : ''}`}
              onClick={() => setSite(s.key)}
            >
              <span aria-hidden="true">{s.emoji}</span> {s.label}
            </button>
          ))}
        </div>

        <div className="section-head">
          <h2>عروض {current.label} <span className="count">{offers.length}</span></h2>
          <button className="btn primary" onClick={() => setEditing('new')}>+ عرض جديد</button>
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        {loading && <p className="muted">جاري التحميل…</p>}

        {!loading && offers.length === 0 && (
          <div className="empty">
            مفيش عروض للصفحة دي لسه. دوس «عرض جديد» وابدأ.
          </div>
        )}

        <ul className="offer-list">
          {offers.map((o, i) => (
            <li key={o.id} className={`offer-card ${o.is_active ? '' : 'inactive'}`} style={{ '--accent': o.accent }}>
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
                <div className="muted small">
                  {o.units_label || `${o.units} قطعة`}
                  {o.flavors?.length > 0 && ` · ${o.flavors.length} نكهة`}
                  {o.free_shipping && ' · توصيل مجاني'}
                  <span dir="ltr"> · {o.slug}</span>
                </div>
              </div>
              <div className="actions">
                <button className="icon-btn" title="لفوق" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
                <button className="icon-btn" title="لتحت" disabled={i === offers.length - 1} onClick={() => move(i, 1)}>▼</button>
                <button className="btn ghost" onClick={() => toggleActive(o)}>{o.is_active ? 'إخفاء' : 'إظهار'}</button>
                <button className="btn" onClick={() => setEditing(o)}>تعديل</button>
                <button className="btn danger" onClick={() => remove(o)}>حذف</button>
              </div>
            </li>
          ))}
        </ul>
      </main>

      {editing && (
        <OfferForm
          site={site}
          offer={editing === 'new' ? null : editing}
          nextOrder={offers.length + 1}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await load()
          }}
        />
      )}
    </div>
  )
}
