import { flavorData } from './flavorCatalog.js'
import { useEffect, useMemo, useState } from 'react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const CACHE_PREFIX = 'ht_offers_v2_'
const TIMEOUT_MS = 6000

let clientPromise
function getClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return Promise.resolve(null)
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  )
  return clientPromise
}

export function mapOffer(row, local, site = row.site) {
  const price = Number(row.price)
  const originalPrice = Number(row.original_price)

  return {
    id: row.slug,
    name: row.name,
    badge: row.badge || '',
    description: row.description || '',
    note: row.note || '',
    price,
    originalPrice,
    saving: Math.max(0, originalPrice - price),
    units: row.units,
    unitsLabel: row.units_label || `${row.units} قطعة`,
    ...flavorData(row.flavors, site, row.slug, local),
    image: row.image_url || local?.image || null,
    accent: row.accent,
    deliveryNote: row.delivery_note || undefined,
    freeShipping: row.free_shipping,
  }
}

function readCache(site) {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_PREFIX + site))
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

// Keep localBundles stable at module scope. Cache raw rows so local image URLs
// always come from the current build, including after a deployment.
export function useOffers(site, localBundles) {
  const [rows, setRows] = useState(() => readCache(site))
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    ;(async () => {
      try {
        const client = await getClient()
        if (!client) return
        const { data, error } = await client
          .from('offers')
          .select('*')
          .eq('site', site)
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .abortSignal(controller.signal)
        if (cancelled || error || !Array.isArray(data)) return
        setRows(data)
        try {
          localStorage.setItem(CACHE_PREFIX + site, JSON.stringify(data))
        } catch { /* Storage can be disabled or full. */ }
      } catch {
        // Keep cached or local offers if configuration or the request fails.
      } finally {
        clearTimeout(timer)
        if (!cancelled) setReady(true)
      }
    })()

    return () => {
      cancelled = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [site])

  const bundles = useMemo(() => {
    if (!rows) return localBundles.map(b => ({ ...b, ...flavorData(b.flavors, site, b.id, b) }))
    const localBySlug = Object.fromEntries(localBundles.map((b) => [b.id, b]))
    return rows.map((row) => mapOffer(row, localBySlug[row.slug], site))
  }, [rows, localBundles, site])

  return { bundles, ready }
}
