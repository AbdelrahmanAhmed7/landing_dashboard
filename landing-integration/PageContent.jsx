import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { resolvePageContent } from './pageContent.js'

const ContentContext = createContext(null)
const CACHE_PREFIX = 'ht_page_content_v1_'
let clientPromise
function getClient() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return Promise.resolve(null)
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }))
  return clientPromise
}

function readCache(site) {
  try { return JSON.parse(localStorage.getItem(CACHE_PREFIX + site)) } catch { return null }
}

export function PageContentProvider({ site, children }) {
  const [snapshot, setSnapshot] = useState(() => ({ site, values: readCache(site) }))
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    ;(async () => {
      try {
        const client = await getClient()
        if (!client || cancelled || controller.signal.aborted) return
        const { data, error } = await client.from('page_content').select('content').eq('site', site).abortSignal(controller.signal).maybeSingle()
        if (cancelled || error) return
        // A missing row deliberately restores the original copy, even with an old cache.
        const values = resolvePageContent(site, data?.content)
        setSnapshot({ site, values })
        try { localStorage.setItem(CACHE_PREFIX + site, JSON.stringify(values)) } catch { /* Storage may be disabled. */ }
      } catch { /* Use cached or original text without delaying the page. */ }
      finally { clearTimeout(timer) }
    })()
    return () => { cancelled = true; clearTimeout(timer); controller.abort() }
  }, [site])
  const content = useMemo(() => resolvePageContent(site, snapshot.site === site ? snapshot.values : readCache(site)), [site, snapshot])
  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>
}

export function usePageContent() {
  const content = useContext(ContentContext)
  if (!content) throw new Error('PageContentProvider is required')
  return content
}
