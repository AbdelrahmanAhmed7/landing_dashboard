import { useEffect, useState } from 'react'
import { PageContentPreview } from './PageContent.jsx'
import { defaultPageContent, resolvePageContent } from './pageContent.js'

export default function PreviewHost({ site, Landing }) {
  const [values, setValues] = useState(null)
  const [showCart, setShowCart] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    const nonce = params.get('nonce')
    let origin
    try { origin = new URL(params.get('parent')).origin } catch { return }
    if (window.parent === window || !nonce || !/^https?:\/\//.test(origin)) return
    const ready = () => window.parent.postMessage({ type: 'ht-preview-ready', nonce }, origin)
    const listener = event => {
      if (event.source !== window.parent || event.origin !== origin || event.data?.nonce !== nonce || event.data?.site !== site || event.data?.type !== 'ht-content-preview') return
      setValues(resolvePageContent(site, event.data.content)); setShowCart(event.data.showCart === true); clearInterval(timer)
    }
    const keyListener = event => { if (event.key === 'Escape') window.parent.postMessage({ type: 'ht-preview-close', nonce }, origin) }
    const timer = setInterval(ready, 500)
    window.addEventListener('message', listener); window.addEventListener('keydown', keyListener); ready()
    return () => { clearInterval(timer); window.removeEventListener('message', listener); window.removeEventListener('keydown', keyListener) }
  }, [site])
  const blockActions = event => {
    const anchor = event.target.closest('a')
    event.preventDefault(); event.stopPropagation()
    if (anchor?.getAttribute('href')?.startsWith('#')) {
      const id = anchor.getAttribute('href').slice(1)
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    }
  }
  if (!values) return <p dir="rtl" role="status">المعاينة بتفتح من زر «معاينة داخل الصفحة» في الداشبورد.</p>
  return <div onClickCapture={blockActions} onKeyDownCapture={event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); event.stopPropagation() } }} onSubmitCapture={event => { event.preventDefault(); event.stopPropagation() }}>
    <PageContentPreview content={values || defaultPageContent(site)}><Landing key={showCart ? 'cart' : 'empty'} showCart={showCart} /></PageContentPreview>
  </div>
}
