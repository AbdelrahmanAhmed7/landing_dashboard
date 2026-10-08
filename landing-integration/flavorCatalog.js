// Shared contract: retain hidden entries and stable IDs in offers.flavors.
const catalog = {
  cola: [['cola', 'كولا'], ['lemon', 'ليمون نعناع']],
  spread: [['kids', 'أطفال'], ['original', 'أوجينال'], ['protein', 'بروتين'], ['vegan', 'فيجن'], ['prestige', 'بريستيج'], ['coconut', 'جوز هند', false], ['peanut', 'زبدة فول سوداني', false], ['highProtein', 'زبدة فول سوداني عالي البروتين', false], ['chocolatePeanut', 'زبدة فول سوداني شيكولاتة', false]],
  chocoBar: [['darkHazel', 'دارك بالبندق'], ['darkAlmond', 'دارك باللوز'], ['darkPlain', 'دارك سادة'], ['milkHazel', 'ميلك بالبندق'], ['milkAlmond', 'ميلك باللوز'], ['milkPlain', 'ميلك سادة']],
  icecream: ['فانيليا', 'شوكولاتة', 'فراولة', 'مانجو', 'بلوبيري', 'فسدق', 'بندق', 'كنتالوب'].map((name, i) => [`ice-${i}`, name]),
  ketobar: ['بندق', 'زبدة فول سوداني', 'دبل شوكولاتة', 'جوز هند', 'لوز'].map((name, i) => [`keto-${i}`, name]),
}

export const groupLabels = { cola: 'نكهات الكولا', spread: 'نكهات السبريد', chocoBar: 'نكهات الشيكولاتة بار', icecream: 'نكهات الآيس كريم', ketobar: 'نكهات الكيتو بار', default: 'النكهات' }

export function flavorGroups(site, slug) {
  if (site === 'cola') return ['cola']
  if (site === 'spread') return slug === 'spread-choco-bar' ? ['spread', 'chocoBar'] : [slug === 'choco-bar' ? 'chocoBar' : 'spread']
  return [slug === 'icecream' || slug === 'ketobar' ? slug : 'default']
}

export function defaultFlavors(site, slug) {
  return flavorGroups(site, slug).flatMap(group => (catalog[group] || []).map(([id, name, active]) => ({ id, name, group, is_active: active !== false })))
}

export function normalizeFlavors(raw, site, slug) {
  const groups = flavorGroups(site, slug)
  const defaults = defaultFlavors(site, slug)
  // Empty legacy cola/spread arrays used to mean the local product catalog.
  const source = Array.isArray(raw) && raw.length ? raw : site === 'ice-cream' ? [] : defaults
  return source.filter(x => x && (typeof x === 'string' || typeof x.name === 'string')).map((entry, i) => {
    const fl = typeof entry === 'string' ? { name: entry } : entry
    const match = defaults.find(d => (fl.group == null || fl.group === d.group) && (fl.id ? fl.id === d.id : fl.name === d.name))
    return { ...fl, id: fl.id || match?.id || `legacy-${i}-${fl.name}`, group: fl.group || match?.group || groups[0], is_active: fl.is_active !== false, name: fl.name.trim() }
  })
}

export function flavorData(raw, site, slug, local) {
  const all = normalizeFlavors(raw, site, slug)
  const groups = flavorGroups(site, slug)
  const defaults = defaultFlavors(site, slug)
  const options = all.filter(f => f.is_active && f.name && groups.includes(f.group)).map(f => {
    const original = defaults.find(d => d.id === f.id && d.group === f.group)
    return { ...f, image: f.image || local?.flavorImages?.[original?.name] || local?.flavorImages?.[f.name] }
  })
  const required = groups.filter(group => group !== 'default' || all.some(f => f.group === group))
  return {
    flavorOptions: options,
    flavors: options.map(f => f.name),
    flavorImages: Object.fromEntries(options.filter(f => f.image).map(f => [f.name, f.image])),
    flavorsAvailable: required.every(group => options.some(f => f.group === group)),
  }
}
