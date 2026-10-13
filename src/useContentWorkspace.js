import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { contentFields, defaultPageContent, resolvePageContent, validatePageContent } from './pageContent'

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const conflict = err => ['40001', 'PGRST116', '23505'].includes(err.code)
const hydrate = (site, values) => Object.fromEntries(contentFields(site).map(f => [f.key, typeof values?.[f.key] === 'string' ? values[f.key] : f.value]))

export function useContentWorkspace(site, userId) {
  const [draft, setDraft] = useState(() => defaultPageContent(site))
  const [published, setPublished] = useState(null)
  const [saved, setSaved] = useState(null)
  const [version, setVersion] = useState(null)
  const [baseVersion, setBaseVersion] = useState(null)
  const [savedBase, setSavedBase] = useState(null)
  const [draftVersion, setDraftVersion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [attempt, setAttempt] = useState(0)
  const dirty = saved !== null && (!same(draft, saved) || baseVersion !== savedBase)
  const hasChanges = published !== null && !same(draft, published)
  const stale = published !== null && version !== baseVersion

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    setLoading(true); setError('')
    ;(async () => {
      try {
        const [live, stored] = await Promise.all([
          supabase.from('page_content').select('content,updated_at').eq('site', site).abortSignal(controller.signal).single(),
          supabase.from('page_content_drafts').select('content,base_version,updated_at').eq('site', site).eq('user_id', userId).abortSignal(controller.signal).maybeSingle(),
        ])
        if (live.error || stored.error) throw live.error || stored.error
        if (cancelled) return
        const original = resolvePageContent(site, live.data.content)
        const values = stored.data ? hydrate(site, stored.data.content) : original
        const base = stored.data?.base_version || live.data.updated_at
        setPublished(original); setDraft(values); setSaved(values)
        setVersion(live.data.updated_at); setBaseVersion(base); setSavedBase(base)
        setDraftVersion(stored.data?.updated_at || null)
        setNotice(stored.data ? 'تم استرجاع مسودتك المحفوظة. الزوار لسه بيشوفوا النسخة المنشورة.' : '')
      } catch (err) {
        if (!cancelled) setError(['PGRST205', '42P01'].includes(err.code)
          ? 'المسودات وسجل التعديلات محتاجين تفعيل من مسؤول الموقع.' : 'تعذّر تحميل النصوص ومسودتك. أعد المحاولة.')
      } finally { clearTimeout(timer); if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true; controller.abort(); clearTimeout(timer) }
  }, [site, userId, attempt])

  const saveDraft = async () => {
    if (busy || loading || !published || !dirty) return
    setBusy(true); setError(''); setNotice('')
    try {
      const row = { content: draft, base_version: baseVersion }
      const query = draftVersion
        ? supabase.from('page_content_drafts').update(row).eq('site', site).eq('user_id', userId).eq('updated_at', draftVersion)
        : supabase.from('page_content_drafts').insert({ ...row, site, user_id: userId })
      const { data, error: err } = await query.select('updated_at').single()
      if (err) throw err
      setDraftVersion(data.updated_at); setSaved(draft); setSavedBase(baseVersion)
      setNotice('مسودتك اتحفظت في حسابك. تقدر ترجع لها من جهاز تاني، من غير نشرها للزوار.')
    } catch (err) { setError(conflict(err) ? 'مسودتك اتغيّرت من جلسة تانية. انسخ تعديلاتك وأعد التحميل للمراجعة.' : 'تعذّر حفظ المسودة. تعديلاتك لسه موجودة هنا.') }
    finally { setBusy(false) }
  }

  const publish = async event => {
    event.preventDefault()
    if (busy || loading || !published || !hasChanges || stale) return
    const problem = validatePageContent(site, draft)
    if (problem) return setError(problem)
    setBusy(true); setError(''); setNotice('')
    try {
      const content = resolvePageContent(site, draft)
      const { data, error: err } = await supabase.rpc('publish_page_content', {
        p_site: site, p_content: content, p_expected_version: version, p_expected_draft_version: draftVersion,
      })
      if (err) throw err
      if (!data?.updated_at) throw new Error('Missing confirmation')
      setDraft(content); setPublished(content); setSaved(content)
      setVersion(data.updated_at); setBaseVersion(data.updated_at); setSavedBase(data.updated_at); setDraftVersion(null)
      setNotice('تم النشر وتسجيل التعديل في السجل. المسودة اتشالت بعد نشرها بنجاح.')
    } catch (err) { setError(conflict(err) ? 'النسخة المنشورة أو المسودة اتغيّرت من جلسة تانية. احفظ شغلك وأعد التحميل قبل النشر.' : 'تعذّر تأكيد النشر. احتفظ بتعديلاتك وأعد التحميل للتحقق من آخر نسخة.') }
    finally { setBusy(false) }
  }

  const discard = async () => {
    if (busy || loading || !published) return
    setBusy(true); setError('')
    try {
      if (draftVersion) {
        const { error: err } = await supabase.from('page_content_drafts').delete().eq('site', site).eq('user_id', userId).eq('updated_at', draftVersion).select('site').single()
        if (err) throw err
      }
      setDraft(published); setSaved(published); setBaseVersion(version); setSavedBase(version); setDraftVersion(null)
      setNotice('تم تجاهل المسودة والرجوع للنسخة المنشورة.')
    } catch { setError('تعذّر حذف المسودة أو اتغيّرت من جلسة تانية. أعد التحميل للمراجعة.') }
    finally { setBusy(false) }
  }

  const reload = () => {
    if (dirty && !window.confirm('في تعديلات غير محفوظة. تتجاهلها وتحمّل آخر نسخة ومسودتك المحفوظة؟')) return
    setPublished(null); setAttempt(value => value + 1)
  }
  return { draft, setDraft, published, draftVersion, loading, busy, error, setError, notice, setNotice, dirty, hasChanges, stale,
    saveDraft, publish, discard, reload, rebase: () => setBaseVersion(version) }
}
