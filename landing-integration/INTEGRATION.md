# ربط الـ landing page بالداشبورد

اللي هنعمله في كل landing page (مثال: صفحة الآيس كريم `site = 'ice-cream'`):

## 1) تثبيت وإعداد
```bash
npm i @supabase/supabase-js
```
في `.env` بتاع الـ landing (نفس القيم بتاعة الداشبورد، الـ anon key بس):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
وانسخ `useOffers.js` جوه `src/`.

## 2) تعديلات `App.jsx` (صفحة الآيس كريم)

**أ) خلّي الـ bundles المحلية fallback وضيف لكل واحد `flavorImages`:**
```js
const LOCAL_BUNDLES = [ /* نفس مصفوفة bundles الحالية */ ]
// جوه كل عنصر ضيف:
//   icecream → flavorImages: ICECREAM_IMAGES
//   ketobar  → flavorImages: KETOBAR_IMAGES
//   halawa   → flavorImages: {}
```
(لازم `ICECREAM_IMAGES` و`KETOBAR_IMAGES` يتعرفوا قبل `LOCAL_BUNDLES`.)

**ب) في `App()`:**
```js
import { useOffers } from './useOffers'
const { bundles } = useOffers('ice-cream', LOCAL_BUNDLES)
```
وبدل ما `Landing` و`StepConfirm` يقروا `bundles` من الـ module، مرّرها props:
`<Landing bundles={bundles} ... />` و`<StepConfirm bundles={bundles} ... />`.
وفي `restoreCart` استخدم `bundles` اللي من الـ hook.

**ج) استبدالات:**
| القديم | الجديد |
|---|---|
| `bundleUnits(item.bundle.id)` | `item.bundle.units` |
| `images={bundleImages(item.bundle.id)}` | `images={item.bundle.flavorImages}` |
| `bundles` جوه `Landing` | `props.bundles` |

## 3) تنبيهات
- الـ `slug` في الداشبورد = `bundle.id` في الكود. العروض الحالية اتعمللها seed بنفس الـ ids (`icecream`, `ketobar`, `halawa`) فمفيش حاجة هتتكسر، وكلاسات الـ CSS زي `.bundle-row-icecream` هتفضل شغالة.
- العرض الجديد من الداشبورد هياخد `.bundle-row-<slug>`؛ لو محتاج ستايل خاص ليه ضيفه في الـ CSS.
- النصوص المكتوبة بإيدك (الـ FAQ، والـ hero، وعبارة "8 نكهات") مش بتتحدث لوحدها من الداشبورد.
- لو خبّيت كل عروض الصفحة، الصفحة هتعرض قايمة فاضية (مش المحلية).
