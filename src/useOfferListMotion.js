import { useLayoutEffect, useRef } from 'react'

// Measure positions relative to the list so scrolling never counts as a move.
export function useOfferListMotion(offers, query, visibility) {
  const listRef = useRef(null)
  const previous = useRef(new Map())

  useLayoutEffect(() => {
    const cards = [...(listRef.current?.children || [])]
    const next = new Map(cards.map(card => [card.dataset.offerId, card.offsetTop]))
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    for (const card of cards) {
      const oldTop = previous.current.get(card.dataset.offerId)
      const newTop = next.get(card.dataset.offerId)
      if (reducedMotion || typeof card.animate !== 'function') continue
      if (oldTop !== undefined && oldTop !== newTop) {
        card.getAnimations().forEach(animation => animation.cancel())
        card.animate([
          { transform: `translateY(${oldTop - newTop}px)` },
          { transform: 'translateY(0)' },
        ], { duration: 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
      } else if (oldTop === undefined) {
        card.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180, easing: 'ease-out' })
      }
    }
    previous.current = next
  }, [offers, query, visibility])

  useLayoutEffect(() => () => {
    previous.current.clear()
  }, [])

  return listRef
}
