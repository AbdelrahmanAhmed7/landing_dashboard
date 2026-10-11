import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { PAGE_CONTENT_SECTIONS, defaultPageContent, resolvePageContent, validatePageContent } from './pageContent'

const labels = { cola: 'الكولا', 'ice-cream': 'الآيس كريم', spread: 'السبريد' }

export default function PageContentEditor({ site, notAdmin, onDirtyChange }) {
  const [draft, setDraft] = useState(() => defaultPageContent(site))
  const [published, setPublished] = useState(null)
  const [version, setVersion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const dirty = published !== null && JSON.stringify(draft) !== JSON.stringify(published)
  const locked = loading || busy || notAdmin || published === null

  useEffect(() => { onDirtyChange(dirty || busy) }, [dirty, busy, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])
  useEffect(() => {
    if (!dirty && !busy) return
    const handler = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty, busy])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    setLoading(true)
    setError('')
    ;(async () => {
      try {
        const { data, error: err } = await supabase.from('page_content').select('content,updated_at').eq('site', site).abortSignal(controller.signal).maybeSingle()
        if (err) throw err
        if (cancelled) return
        const values = resolvePageContent(site, data?.content)
        setDraft(values)
        setPublished(values)
        setVersion(data?.updated_at || null)
      } catch (err) {
        if (!cancelled) setError(['PGRST205', '42P01'].includes(err.code)
          ? 'إدارة محتوى الصفحة لسه محتاجة تفعيل. تواصل مع مسؤول الموقع، وبعد التفعيل اضغط إعادة التحميل.'
          : 'تعذّر تحميل النصوص المنشورة. أعد المحاولة قبل التعديل.')
      } finally { clearTimeout(timer); if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true; controller.abort(); clearTimeout(timer) }
  }, [site, attempt])

  const publish = async event => {
    event.preventDefault()
    if (locked || !dirty) return
    const problem = validatePageContent(site, draft)
    if (problem) { setPreview(false); setError(problem); return }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const content = resolvePageContent(site, draft)
      // Optimistic concurrency avoids overwriting another administrator's edits.
      const query = version
        ? supabase.from('page_content').update({ content }).eq('site', site).eq('updated_at', version)
        : supabase.from('page_content').insert({ site, content })
      const { data, error: err } = await query.select('updated_at').single()
      if (err) throw err
      if (!data?.updated_at) throw new Error('Missing publication confirmation')
      setDraft(content)
      setPublished(content)
      setVersion(data.updated_at)
      setNotice('تم نشر النصوص. هتظهر للزائر عند فتح صفحة المنتج أو تحديثها.')
    } catch (err) {
      setError(['PGRST116', '23505'].includes(err.code)
        ? 'النصوص اتغيّرت من جلسة تانية. احتفظ بتعديلاتك، وأعد التحميل لمراجعة آخر نسخة قبل النشر.'
        : 'تعذّر تأكيد النشر. تعديلاتك لسه موجودة هنا؛ أعد التحميل للتحقق من النسخة المنشورة قبل المحاولة تاني.')
    } finally { setBusy(false) }
  }

  const reload = () => {
    if (dirty && !window.confirm('في تعديلات لسه متنشرتش. تحب تتجاهلها وتحمّل النصوص المنشورة؟')) return
    setPublished(null)
    setNotice('')
    setAttempt(value => value + 1)
  }

  return <form className="page-content-editor" onSubmit={publish}>
    <div className="section-head">
      <div><h2>محتوى صفحة {labels[site]}</h2><p className="muted small">عدّل النصوص، راجعها، وبعدها انشرها للزوار.</p></div>
      <button type="button" className="btn ghost" disabled={loading || busy} onClick={reload}>إعادة التحميل</button>
    </div>
    <p className="content-hint">التعديل هنا للكلام فقط. إجمالي السلة وعدد المنتجات وحساب الشحن وتوقيت العدّاد يفضلوا تلقائيين.</p>
    {loading && <p role="status">جاري تحميل النصوص المنشورة…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="content-success" role="status">{notice}</p>}
    {!loading && published !== null && <>
      <div className="content-editor-toolbar">
        <span className="muted small" role="status">{dirty ? 'عندك تعديلات لسه متنشرتش' : 'دي النصوص الحالية للصفحة'}</span>
        <button type="button" className="btn ghost" aria-pressed={preview} onClick={() => setPreview(value => !value)}>{preview ? 'الرجوع للتعديل' : 'معاينة النصوص'}</button>
      </div>
      {preview && <p className="muted small">معاينة للكلام قبل النشر؛ تصميم صفحة المنتج بيظل زي ما هو.</p>}
      {PAGE_CONTENT_SECTIONS[site].map(section => <section key={section.id} className="content-section card" aria-labelledby={`content-${section.id}`}>
        <h3 id={`content-${section.id}`}>{section.title}</h3>
        {preview ? <dl className="content-preview">{section.fields.map(field => <div key={field.key}><dt className="muted small">{field.label}</dt><dd dir="auto">{draft[field.key]}</dd></div>)}</dl>
          : <fieldset disabled={locked} className="content-fields"><div className="grid2">{section.fields.map(field => <label className="field" key={field.key}>
            <span>{field.label}</span>
            {field.type === 'textarea'
              ? <textarea aria-label={field.label} rows={3} required maxLength={field.max} value={draft[field.key]} onChange={e => { setDraft(value => ({ ...value, [field.key]: e.target.value })); setNotice('') }} />
              : <input aria-label={field.label} required type={field.type} dir={['tel', 'email'].includes(field.type) ? 'ltr' : 'auto'} maxLength={field.max} value={draft[field.key]} onChange={e => { setDraft(value => ({ ...value, [field.key]: e.target.value })); setNotice('') }} />}
            <small className="muted">{draft[field.key].length} / {field.max}</small>
          </label>)}</div></fieldset>}
      </section>)}
      <div className="content-publish-bar">
        <button type="submit" className="btn primary" disabled={locked || !dirty}>{busy ? 'جاري النشر…' : 'نشر التعديلات'}</button>
        <button type="button" className="btn ghost" disabled={locked || !dirty} onClick={() => { setDraft(published); setError(''); setNotice('') }}>تجاهل التعديلات</button>
        <button type="button" className="btn ghost" disabled={locked} onClick={() => { setDraft(defaultPageContent(site)); setNotice('تم استرجاع النصوص الأصلية في المحرر. اضغط نشر التعديلات لتطبيقها.') }}>استعادة النصوص الأصلية</button>
      </div>
    </>}
  </form>
}
