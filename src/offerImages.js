import colaSummer from './assets/offers/cola-summer.jpeg'
import colaCombo from './assets/offers/cola-combo.jpeg'
import colaMonth from './assets/offers/cola-month.jpeg'
import icecream from './assets/offers/icecream.webp'
import ketobar from './assets/offers/ketobar.webp'
import halawa from './assets/offers/halawa.jpeg'
import spreadTwo from './assets/offers/spread-two.webp'
import spreadThree from './assets/offers/spread-three.webp'
import spreadFour from './assets/offers/spread-four.webp'
import chocoBar from './assets/offers/choco-bar.jpeg'
import spreadChocoBar from './assets/offers/spread-choco-bar.jpeg'

// Mirror the existing landing assets by site and slug. These preview URLs must
// stay out of image_url: saving null preserves each landing's local fallback.
const images = new Map([
  ['cola:summer', colaSummer], ['cola:combo', colaCombo], ['cola:month', colaMonth],
  ['ice-cream:icecream', icecream], ['ice-cream:ketobar', ketobar], ['ice-cream:halawa', halawa],
  ['spread:two-jars', spreadTwo], ['spread:three-jars', spreadThree], ['spread:four-jars', spreadFour],
  ['spread:choco-bar', chocoBar], ['spread:spread-choco-bar', spreadChocoBar],
])

export const defaultOfferImage = (site, slug) => images.get(`${site}:${slug}`) || null
