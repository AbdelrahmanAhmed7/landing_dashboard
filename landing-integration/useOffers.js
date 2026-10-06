// src/useOffers.js — حطه في كل landing page (نفس الملف، بس الـ site بيختلف)
//
// بيجيب العروض الظاهرة من Supabase ويرجّعها بنفس شكل مصفوفة `bundles` اللي الكود بيستخدمها.
// - بيعرض آخر نسخة متخزنة (localStorage) أو الداتا المحلية فوراً، وبيحدّث في الخلفية.
// - لو الـ API وقع أو اتأخر: الصفحة تكمّل بالمخزّن/المحلي ومفيش حاجة تبوظ.
// - لو الطلب نجح والصفحة معندهاش عروض ظاهرة: بيرجّع قايمة فاضية (احترام لإخفاء الأدمن).
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

const CACHE_PREFIX = 'ht_offers_v1_'
const TIMEOUT_MS = 6000

/** صف من Supabase → شكل الـ bundle اللي الـ landing شغّال بيه */
export function mapOffer(row, local) {
  const price = Number(row.price)
  const originalPrice = Number(row.original_price)
  const flavorList = Array.isArray(row.flavors) ? row.flavors : []

  const flavorImages = {}
  flavorList.forEach((fl) => {
    const img = fl.image || local?.flavorImages?.[fl.name]
    if (img) flavorImages[fl.name] = img
  })

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
    flavors: flavorList.map((fl) => fl.name),
    flavorImages,
    image: row.image_url || local?.image || null,
    accent: row.accent,
    deliveryNote: row.delivery_note || undefined,
    freeShipping: row.free_shipping,
  }
}

const readCache = (site) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_PREFIX + site))
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * @param {'cola'|'ice-cream'|'spread'} site
 * @param {Array} localBundles الداتا المحلية الحالية (fallback + مصدر الصور المحلية)
 */
export function useOffers(site, localBundles) {
  const [bundles, setBundles] = useState(() => readCache(site) ?? localBundles)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    supabase
      .from('offers')
      .select('*')
      .eq('site', site)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .abortSignal(controller.signal)
      .then(({ data, error }) => {
        if (error || !data) return
        const localBySlug = Object.fromEntries(localBundles.map((b) => [b.id, b]))
        const mapped = data.map((row) => mapOffer(row, localBySlug[row.slug]))
        setBundles(mapped)
        try {
          localStorage.setItem(CACHE_PREFIX + site, JSON.stringify(mapped))
        } catch { /* ignore */ }
      })
      .catch(() => { /* fallback شغّال */ })
      .finally(() => {
        clearTimeout(timer)
        setReady(true)
      })

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site])

  return { bundles, ready }
}
