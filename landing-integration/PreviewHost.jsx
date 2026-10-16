import { useEffect, useState } from 'react'
import { OffersPreviewContext } from './useOffers.js'
import { PageContentProvider, PageContentPreview } from './PageContent.jsx'
import { resolvePageContent } from './pageContent.js'

export default function PreviewHost({ site, Landing }) {
  const [values, setValues] = useState(null)
  const [offerPreview, setOfferPreview] = useState(null)
  const [showCart, setShowCart] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    const nonce = params.get('nonce')
    let origin
    try { origin = new URL(params.get('parent')).origin } catch { return }
    if (window.parent === window || !nonce || !/^https?:\/\//.test(origin)) return
    const ready = () => window.parent.postMessage({ type: 'ht-preview-ready', nonce, capabilities: ['offers'] }, origin)
    const listener = event => {
      if (event.source !== window.parent || event.origin !== origin || event.data?.nonce !== nonce || event.data?.site !== site || event.data?.type !== 'ht-content-preview') return
      const draft = event.data.offerPreview
      if (draft && (!Array.isArray(draft.rows) || typeof draft.focusSlug !== 'string' || draft.rows.some(row => !row || row.site !== site || typeof row.slug !== 'string' || !Array.isArray(row.flavors)))) return
      setOfferPreview(draft ? { site, rows: draft.rows, focusSlug: draft.focusSlug } : null)
      setValues(resolvePageContent(site, event.data.content)); setShowCart(event.data.showCart === true); clearInterval(timer)
    }
    const keyListener = event => { if (event.key === 'Escape') window.parent.postMessage({ type: 'ht-preview-close', nonce }, origin) }
    const timer = setInterval(ready, 500)
    window.addEventListener('message', listener); window.addEventListener('keydown', keyListener); ready()
    return () => { clearInterval(timer); window.removeEventListener('message', listener); window.removeEventListener('keydown', keyListener) }
  }, [site])
  useEffect(() => {
    if (!offerPreview) return
    let cancelled = false
    let attempts = 0
    const highlight = () => {
      if (cancelled) return
      attempts += 1
      document.querySelectorAll('[data-offer-highlight="true"]').forEach(el => {
        el.removeAttribute('data-offer-highlight')
        el.style.outline = ''
        el.style.outlineOffset = ''
      })
      const target = document.querySelector('[data-offer-id="' + CSS.escape(offerPreview.focusSlug) + '"]')
      if (target) {
        target.setAttribute('data-offer-highlight', 'true')
        target.style.outline = '3px solid #8b5cf6'
        target.style.outlineOffset = '4px'
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
      // The landing may render offers late (images/fonts/async sections).
      if (attempts < 15) setTimeout(highlight, 200)
    }
    highlight()
    return () => { cancelled = true }
  }, [offerPreview, showCart])
  const blockActions = event => {
    const anchor = event.target.closest('a')
    event.preventDefault(); event.stopPropagation()
    if (anchor?.getAttribute('href')?.startsWith('#')) {
      const id = anchor.getAttribute('href').slice(1)
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    }
  }
  if (!values) return <p dir="rtl" role="status">المعاينة بتفتح من زر «معاينة داخل الصفحة» في الداشبورد.</p>
  const landing = <Landing key={(showCart ? 'cart' : 'empty') + (offerPreview?.focusSlug || '')} showCart={showCart} focusSlug={offerPreview?.focusSlug} />
  return <div onClickCapture={blockActions} onKeyDownCapture={event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); event.stopPropagation() } }} onSubmitCapture={event => { event.preventDefault(); event.stopPropagation() }}>
    <OffersPreviewContext.Provider value={offerPreview}>
      {offerPreview ? <PageContentProvider site={site}>{landing}</PageContentProvider> : <PageContentPreview content={values}>{landing}</PageContentPreview>}
    </OffersPreviewContext.Provider>
  </div>
}
