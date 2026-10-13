// Public production URLs supplied by the site owner.
export const LANDING_URLS = {
  cola: 'https://cola.healthyandtasty.net/',
  'ice-cream': 'https://ice-cream.healthyandtasty.net/',
  spread: 'https://spread.healthyandtasty.net/',
}

export function landingPreviewUrl(site) {
  if (import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return `http://127.0.0.1:${{ cola: 4175, 'ice-cream': 4176, spread: 4177 }[site]}/preview.html`
  }
  return LANDING_URLS[site] ? new URL('/preview.html', LANDING_URLS[site]).href : null
}
