import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && key)

export const supabase = createClient(url || 'http://localhost', key || 'missing-key')

export const BUCKET = 'offer-images'

/** الصفحات اللي الداشبورد بتديرها — الـ key هو قيمة عمود site */
export const SITES = [
  { key: 'cola', label: 'Healthy Cola', emoji: '🥤' },
  { key: 'ice-cream', label: 'Healthy Ice Cream', emoji: '🍨' },
  { key: 'spread', label: 'Healthy Spread', emoji: '🥄' },
]
