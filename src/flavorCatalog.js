// Shared contract: retain hidden entries and stable IDs in offers.flavors.
const catalog = {
  cola: [['cola', 'كولا'], ['pineapple', 'أناناس'], ['lemon', 'ليمون نعناع'], ['orange', 'برتقال'], ['greenApple', 'تفاح أخضر'], ['mixBerries', 'توت مشكل']],
  spread: [['kids', 'أطفال'], ['original', 'أوجينال'], ['protein', 'بروتين'], ['vegan', 'فيجن'], ['prestige', 'بريستيج'], ['coconut', 'جوز هند', false], ['peanut', 'زبدة فول سوداني', false], ['highProtein', 'زبدة فول سوداني عالي البروتين', false], ['chocolatePeanut', 'زبدة فول سوداني شيكولاتة', false]],
  chocoBar: [['darkHazel', 'دارك بالبندق'], ['darkAlmond', 'دارك باللوز'], ['darkPlain', 'دارك سادة'], ['milkHazel', 'ميلك بالبندق'], ['milkAlmond', 'ميلك باللوز'], ['milkPlain', 'ميلك سادة']],
  icecream: ['فانيليا', 'شوكولاتة', 'فراولة', 'مانجو', 'بلوبيري', 'فسدق', 'بندق', 'كنتالوب'].map((name, i) => [`ice-${i}`, name]),
  ketobar: ['بندق', 'زبدة فول سوداني', 'دبل شوكولاتة', 'جوز هند', 'لوز'].map((name, i) => [`keto-${i}`, name]),
}

export const groupLabels = { cola: 'نكهات الكولا', spread: 'نكهات السبريد', chocoBar: 'نكهات الشيكولاتة بار', icecream: 'نكهات الآيس كريم', ketobar: 'نكهات الكيتو بار', default: 'النكهات' }

export const catalogGroups = Object.keys(catalog)

// Bundle selection: [components] where each component has its own quantity and
// how many flavors the customer should pick for it. Stored in offers.selection.
export function normalizeSelection(raw) {
  if (!raw || raw.mode !== 'components' || !Array.isArray(raw.items)) return null
  const seen = new Set()
  const items = raw.items.filter(item => item && typeof item === 'object').map((item, i) => {
    const qty = Math.max(1, Math.floor(Number(item.qty) || 1))
    const choose = Math.min(qty, Math.max(0, Math.floor(Number(item.choose) || 0)))
    const base = String(item.key || item.group || `item-${i + 1}`).trim() || `item-${i + 1}`
    let key = base
    for (let n = 2; seen.has(key); n += 1) key = `${base}-${n}`
    seen.add(key)
    const group = choose > 0 ? String(item.group || key).trim() || key : null
    return { key, label: String(item.label || base).trim() || base, qty, choose, group }
  })
  return items.length ? { version: 1, mode: 'components', items } : null
}

export function selectionGroups(selection) {
  return [...new Set((normalizeSelection(selection)?.items || []).filter(item => item.choose > 0).map(item => item.group))]
}

const explicitGroups = (raw) => Array.isArray(raw)
  ? [...new Set(raw.filter(x => x && typeof x === 'object' && typeof x.group === 'string' && x.group.trim()).map(x => x.group.trim()))]
  : []

export function flavorGroups(site, slug, selection, raw, shared = false) {
  if (normalizeSelection(selection)) return selectionGroups(selection)
  if (shared) {
    const groups = explicitGroups(raw)
    if (groups.length) return groups
  }
  if (site === 'cola') return ['cola']
  if (site === 'spread') return slug === 'spread-choco-bar' ? ['spread', 'chocoBar'] : [slug === 'choco-bar' ? 'chocoBar' : 'spread']
  return [slug === 'icecream' || slug === 'ketobar' ? slug : 'default']
}

export function defaultFlavorsForGroup(group) {
  return (catalog[group] || []).map(([id, name, active]) => ({ id, name, group, is_active: active !== false }))
}

export function defaultFlavors(site, slug, selection, raw, shared = false) {
  return flavorGroups(site, slug, selection, raw, shared).flatMap(defaultFlavorsForGroup)
}

export function groupLabel(group, selection) {
  const item = (normalizeSelection(selection)?.items || []).find(entry => entry.group === group)
  return item?.label || groupLabels[group] || group
}

export function normalizeFlavors(raw, site, slug, selection, shared = false) {
  const sel = normalizeSelection(selection)
  const groups = flavorGroups(site, slug, sel, raw, shared)
  const defaults = defaultFlavors(site, slug, sel, raw, shared)
  // Empty legacy cola/spread arrays used to mean the local product catalog.
  // Bundles start with no flavors; the editor seeds the groups it needs.
  const source = Array.isArray(raw) && raw.length ? raw : sel ? [] : site === 'ice-cream' ? [] : defaults
  return source.filter(x => x && (typeof x === 'string' || typeof x.name === 'string')).map((entry, i) => {
    const fl = typeof entry === 'string' ? { name: entry } : entry
    const match = defaults.find(d => (fl.group == null || fl.group === d.group) && (fl.id ? fl.id === d.id : fl.name === d.name))
    return { ...fl, id: fl.id || match?.id || `legacy-${i}-${fl.name}`, group: fl.group || match?.group || groups[0], is_active: fl.is_active !== false, name: fl.name.trim() }
  })
}

export function flavorData(raw, site, slug, local, selection, shared = false) {
  const sel = normalizeSelection(selection)
  const all = normalizeFlavors(raw, site, slug, sel, shared)
  const groups = flavorGroups(site, slug, sel, raw, shared)
  const defaults = defaultFlavors(site, slug, sel, raw, shared)
  const options = all.filter(f => f.is_active && f.name && groups.includes(f.group)).map(f => {
    const original = defaults.find(d => d.id === f.id && d.group === f.group)
    return { ...f, image: f.image || local?.flavorImages?.[original?.name] || local?.flavorImages?.[f.name] }
  })
  const components = sel ? sel.items.map(item => {
    const itemOptions = item.choose > 0 ? options.filter(f => f.group === item.group) : []
    return {
      ...item,
      flavorOptions: itemOptions,
      flavors: itemOptions.map(f => f.name),
      available: item.choose === 0 || itemOptions.length >= item.choose,
    }
  }) : null
  const required = groups.filter(group => group !== 'default' || all.some(f => f.group === group))
  return {
    flavorOptions: options,
    flavors: options.map(f => f.name),
    flavorImages: Object.fromEntries(options.filter(f => f.image).map(f => [f.name, f.image])),
    flavorsAvailable: components ? components.every(c => c.available) : required.every(group => options.some(f => f.group === group)),
    components,
    selection: sel,
  }
}
