import { useEffect, useState } from 'react'
import { PAGE_CONTENT_SECTIONS, defaultPageContent, validatePageContent } from './pageContent'
import { useContentWorkspace } from './useContentWorkspace'
import { ChangeList, revisionChanges } from './ChangeHistory'
import ActualPreview from './ActualPreview'

const labels = { cola: 'الكولا', 'ice-cream': 'الآيس كريم', spread: 'السبريد' }

export default function PageContentEditor({ site, userId, notAdmin, onDirtyChange }) {
  const workspace = useContentWorkspace(site, userId)
  const { draft, setDraft, published, draftVersion, loading, busy, error, setError, notice, setNotice, dirty, hasChanges, stale, saveDraft, publish, discard, reload, rebase } = workspace
  const [preview, setPreview] = useState(false)
  const [actualPreview, setActualPreview] = useState(false)
  const locked = loading || busy || notAdmin || published === null
  useEffect(() => { onDirtyChange(dirty || busy) }, [dirty, busy, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])
  useEffect(() => {
    if (!dirty && !busy) return
    const handler = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty, busy])
  const edit = (key, value) => { setDraft(previous => ({ ...previous, [key]: value })); setNotice('') }
  const openPreview = () => {
    const problem = validatePageContent(site, draft)
    if (problem) return setError(problem)
    setActualPreview(true)
  }

  return <>
    <form className="page-content-editor" onSubmit={publish}>
      <div className="section-head"><div><h2>محتوى صفحة {labels[site]}</h2><p className="muted small">احفظ مسودتك، راجع شكل الصفحة، وانشر لما تكون جاهز.</p></div><button type="button" className="btn ghost" disabled={loading || busy} onClick={reload}>إعادة التحميل</button></div>
      <p className="content-hint">المسودة خاصة بحسابك. الزوار بيشوفوا النسخة المنشورة فقط؛ حسابات السلة والشحن وتوقيت العدّاد تفضل تلقائية.</p>
      {loading && <p role="status">جاري تحميل النصوص ومسودتك…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="content-success" role="status">{notice}</p>}
      {!loading && published !== null && <>
        {stale && <div className="card revision-review"><h3>اتنشرت نسخة أحدث من اللي بدأت عليها مسودتك</h3><p>راجع الفرق بين النسخة المنشورة ومسودتك قبل اعتمادها.</p><ChangeList changes={revisionChanges(site, 'page_content', { content: published }, { content: draft })} /><button type="button" className="btn ghost" disabled={locked} onClick={rebase}>راجعت الفرق — اعتمد مسودتي على النسخة الحالية</button></div>}
        <div className="content-editor-toolbar"><span className="muted small" role="status">{dirty ? 'تغييرات غير محفوظة' : draftVersion ? 'مسودة محفوظة — لم تُنشر' : 'النسخة المنشورة'}</span><div className="preview-buttons"><button type="button" className="btn ghost" aria-pressed={preview} onClick={() => setPreview(value => !value)}>{preview ? 'الرجوع للتعديل' : 'معاينة النصوص'}</button><button type="button" className="btn primary" disabled={locked} onClick={openPreview}>معاينة داخل الصفحة</button></div></div>
        {PAGE_CONTENT_SECTIONS[site].map(section => <section key={section.id} className="content-section card" aria-labelledby={`content-${section.id}`}>
          <h3 id={`content-${section.id}`}>{section.title}</h3>
          {preview ? <dl className="content-preview">{section.fields.map(field => <div key={field.key}><dt className="muted small">{field.label}</dt><dd dir="auto">{draft[field.key]}</dd></div>)}</dl>
            : <fieldset disabled={locked} className="content-fields"><div className="grid2">{section.fields.map(field => <label className="field" key={field.key}><span>{field.label}</span>
              {field.type === 'textarea' ? <textarea aria-label={field.label} rows={3} required maxLength={field.max} value={draft[field.key]} onChange={e => edit(field.key, e.target.value)} /> : <input aria-label={field.label} required type={field.type} dir={['tel', 'email'].includes(field.type) ? 'ltr' : 'auto'} maxLength={field.max} value={draft[field.key]} onChange={e => edit(field.key, e.target.value)} />}
              <small className="muted" dir="ltr">{draft[field.key].length} / {field.max}</small>
            </label>)}</div></fieldset>}
        </section>)}
        <div className="content-publish-bar">
          <button type="button" className="btn ghost" disabled={locked || !dirty} onClick={saveDraft}>حفظ المسودة</button>
          <button type="submit" className="btn primary" disabled={locked || !hasChanges || stale}>{busy ? 'جاري الحفظ…' : 'نشر التعديلات'}</button>
          <button type="button" className="btn ghost" disabled={locked || (!dirty && !draftVersion)} onClick={discard}>تجاهل المسودة</button>
          <button type="button" className="btn ghost" disabled={locked} onClick={() => { setDraft(defaultPageContent(site)); setNotice('النصوص الأصلية جاهزة في المحرر. احفظها كمسودة أو انشرها لتطبيقها.') }}>استعادة النصوص الأصلية</button>
        </div>
      </>}
    </form>
    {actualPreview && <ActualPreview site={site} content={draft} onClose={() => setActualPreview(false)} />}
  </>
}
