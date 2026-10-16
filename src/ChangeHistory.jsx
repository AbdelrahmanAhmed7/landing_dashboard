import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { contentFields, resolvePageContent } from './pageContent'

const fieldNames = { name: 'اسم العرض', badge: 'الشارة', description: 'الوصف', note: 'الملاحظة', price: 'السعر', original_price: 'السعر قبل الخصم', units: 'عدد القطع', units_label: 'نص عدد القطع', flavors: 'النكهات', image_url: 'الصورة', accent: 'اللون', delivery_note: 'ملاحظة التوصيل', free_shipping: 'الشحن المجاني', shipping_fee: 'مبلغ الشحن', is_active: 'ظهور العرض', sort_order: 'الترتيب' }
const operations = { baseline: 'النسخة عند تفعيل السجل', insert: 'إضافة', update: 'تعديل', delete: 'حذف' }
const display = value => value === null || value === undefined || value === '' ? '—' : typeof value === 'boolean' ? value ? 'نعم' : 'لا' : Array.isArray(value) ? value.map(f => `${f.name}${f.is_active === false ? ' (مخفية)' : ''}${f.image ? ' · صورة مرفوعة' : ''}`).join('، ') : String(value)

export function revisionChanges(site, type, previous, next) {
  const before = type === 'page_content' && previous ? resolvePageContent(site, previous.content) : previous || {}
  const after = type === 'page_content' && next ? resolvePageContent(site, next.content) : next || {}
  const fields = type === 'page_content' ? contentFields(site).map(f => [f.key, f.label]) : Object.entries(fieldNames)
  return fields.filter(([key]) => JSON.stringify(before[key]) !== JSON.stringify(after[key])).map(([key, label]) => ({ key, label, before: display(before[key]), after: display(after[key]) }))
}

export default function ChangeHistory({ site, notAdmin, onRestored }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [limit, setLimit] = useState(30)
  const [selection, setSelection] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    supabase.from('change_history').select('*').eq('site', site).order('id', { ascending: false }).limit(limit).then(({ data, error: err }) => {
      if (cancelled) return
      if (err) setError('تعذّر تحميل السجل. تأكد من تفعيل الميزة وصلاحيات الحساب، ثم أعد المحاولة.')
      else setEntries(data || [])
      setLoading(false)
    }).catch(() => { if (!cancelled) { setError('تعذّر الاتصال لتحميل السجل.'); setLoading(false) } })
    return () => { cancelled = true }
  }, [site, attempt, limit])

  const inspect = async revision => {
    setBusy(true); setError(''); setNotice(''); setSelection(null)
    try {
      const key = revision.entity_type === 'offers' ? 'id' : 'site'
      const { data, error: err } = await supabase.from(revision.entity_type).select('*').eq(key, revision.entity_id).maybeSingle()
      if (err) throw err
      const target = revision.after_data || revision.before_data
      setSelection({ revision, version: data?.updated_at || null, changes: revisionChanges(site, revision.entity_type, data, target) })
    } catch { setError('تعذّر قراءة النسخة الحالية للمقارنة. أعد المحاولة.') }
    finally { setBusy(false) }
  }

  const restore = async () => {
    if (!selection || busy || notAdmin) return
    setBusy(true); setError('')
    try {
      const { error: err } = await supabase.rpc('restore_landing_revision', { p_revision_id: selection.revision.id, p_expected_version: selection.version })
      if (err) throw err
      await onRestored?.()
      setSelection(null); setNotice('تمت استعادة النسخة وتسجيلها كتعديل جديد.'); setAttempt(value => value + 1)
    } catch (err) { setError(err.code === '40001' ? 'حصل تعديل أحدث أثناء المراجعة. اختار النسخة تاني للمقارنة قبل الاستعادة.' : 'تعذّرت الاستعادة. لو العرض اتحذف، تأكد إن معرّفه مش مستخدم في عرض تاني.') }
    finally { setBusy(false) }
  }

  return <section className="change-history">
    <div className="section-head"><div><h2>سجل التعديلات</h2><p className="muted small">التغييرات من وقت تفعيل السجل. استعادة نسخة بتتسجّل كتعديل جديد.</p></div><button className="btn ghost" disabled={busy || loading} onClick={() => setAttempt(value => value + 1)}>تحديث السجل</button></div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="content-success" role="status">{notice}</p>}
    {selection && <div className="card revision-review" role="region" aria-label="مراجعة الاستعادة">
      <h3>استعادة «{selection.revision.entity_label}»</h3>
      <p className="muted small">دي التغييرات اللي هتظهر فور الاستعادة:</p>
      <ChangeList changes={selection.changes} />
      <div className="content-editor-toolbar"><button className="btn primary" disabled={busy || notAdmin || selection.changes.length === 0} onClick={restore}>استعادة هذه النسخة</button><button className="btn ghost" disabled={busy} onClick={() => setSelection(null)}>إلغاء</button></div>
    </div>}
    {loading ? <p role="status">جاري تحميل السجل…</p> : entries.length === 0 ? <p className="empty">مفيش تعديلات مسجلة لسه.</p> : <ol className="history-list">{entries.map(entry => <li key={entry.id} className="card">
      <div className="section-head"><strong>{entry.entity_label} · {operations[entry.operation]}</strong><button className="btn ghost" disabled={busy || notAdmin} onClick={() => inspect(entry)}>مراجعة واستعادة</button></div>
      <p className="muted small">{entry.actor_email || 'إعداد النظام'} · <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString('ar-EG')}</time></p>
      <details><summary>تفاصيل التغيير</summary><ChangeList changes={revisionChanges(site, entry.entity_type, entry.before_data, entry.after_data)} /></details>
    </li>)}</ol>}
    {!loading && entries.length === limit && <button className="btn ghost" onClick={() => setLimit(value => value + 30)}>عرض تعديلات أقدم</button>}
  </section>
}

export function ChangeList({ changes }) {
  return changes.length === 0 ? <p className="muted">النسخة دي مطابقة للنسخة الحالية.</p> : <dl className="revision-changes">{changes.map(change => <div key={change.key}><dt>{change.label}</dt><dd><span className="muted">قبل: </span>{change.before}</dd><dd><span className="muted">بعد: </span>{change.after}</dd></div>)}</dl>
}
