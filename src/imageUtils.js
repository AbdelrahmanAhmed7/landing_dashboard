import { supabase, BUCKET } from './supabase'

const MAX_SIDE = 1200

/** يصغّر الصورة (أقصى ضلع 1200px) ويحوّلها WebP عشان الـ landing تفضل سريعة */
async function toWebp(file) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85))
  if (!blob) throw new Error('تعذّر تجهيز الصورة')
  return blob
}

/** يرفع صورة لـ Supabase Storage ويرجّع الـ public URL */
export async function uploadImage(file, folder) {
  if (!file.type.startsWith('image/')) throw new Error('الملف لازم يكون صورة')
  const blob = await toWebp(file)
  const path = `${folder}/${crypto.randomUUID()}.webp`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000' })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
