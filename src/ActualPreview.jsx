import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { landingPreviewUrl } from './landingUrls'

export default function ActualPreview({ site, content, onClose }) {
  const frame = useRef(null)
  const dialog = useRef(null)
  const close = useRef(onClose)
  close.current = onClose
  const [nonce] = useState(() => crypto.randomUUID())
  const [device, setDevice] = useState('mobile')
  const [showCart, setShowCart] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const base = landingPreviewUrl(site)
  const target = base ? new URL(base).origin : null
  const src = base ? `${base}#${new URLSearchParams({ nonce, parent: window.location.origin })}` : null
  const send = () => frame.current?.contentWindow?.postMessage({ type: 'ht-content-preview', nonce, site, content, showCart }, target)
  useEffect(() => {
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.querySelector('button')?.focus()
    const shell = document.querySelector('.shell')
    if (shell) shell.inert = true
    return () => { document.body.style.overflow = overflow; if (shell) shell.inert = false; previous?.focus?.() }
  }, [])
  useEffect(() => {
    if (!target) return
    setReady(false); setFailed(false)
    const timer = setTimeout(() => setFailed(true), 12000)
    const listener = event => {
      if (event.source !== frame.current?.contentWindow || event.origin !== target || event.data?.nonce !== nonce) return
      if (event.data.type === 'ht-preview-ready') { clearTimeout(timer); setReady(true); setFailed(false) }
      if (event.data.type === 'ht-preview-close') close.current()
    }
    window.addEventListener('message', listener)
    return () => { clearTimeout(timer); window.removeEventListener('message', listener) }
  }, [target, nonce, attempt])
  useEffect(() => { if (ready) send() }, [ready, content, showCart, attempt])
  const keys = event => {
    if (event.key === 'Escape') onClose()
    if (event.key === 'Tab') {
      const controls = [...dialog.current.querySelectorAll('button, iframe')].filter(el => !el.disabled)
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus() }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus() }
    }
  }
  return createPortal(<div className="modal-backdrop preview-backdrop"><section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="actual-preview-title" className="actual-preview" onKeyDown={keys}>
    <header className="modal-head"><div><h2 id="actual-preview-title">معاينة داخل الصفحة</h2><p className="muted small">تصميم الصفحة الحقيقي بنصوص مسودتك. الطلب والتتبع معطّلين في المعاينة.</p></div><button type="button" className="icon-btn" aria-label="إغلاق المعاينة" onClick={onClose}>✕</button></header>
    <div className="preview-tools"><button type="button" className={`btn ${device === 'mobile' ? 'primary' : 'ghost'}`} onClick={() => setDevice('mobile')}>موبايل</button><button type="button" className={`btn ${device === 'desktop' ? 'primary' : 'ghost'}`} onClick={() => setDevice('desktop')}>كمبيوتر</button><button type="button" className="btn ghost" aria-pressed={showCart} onClick={() => setShowCart(value => !value)}>{showCart ? 'عرض سلة فارغة' : 'عرض شريط السلة'}</button></div>
    {!src ? <p className="error">رابط الصفحة المنشورة لسه محتاج يتضاف لإعدادات المعاينة.</p> : <>
      {!ready && !failed && <p role="status">جاري تحميل الصفحة…</p>}
      {failed && <p className="error" role="alert">تعذّر تشغيل المعاينة. تأكد من نشر آخر نسخة للصفحة. <button type="button" className="btn ghost" onClick={() => setAttempt(value => value + 1)}>أعد المحاولة</button></p>}
      <div className="preview-stage"><iframe key={attempt} ref={frame} src={src} title="معاينة صفحة المنتج" sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" className={`preview-frame is-${device}`} /></div>
    </>}
  </section></div>, document.body)
}
