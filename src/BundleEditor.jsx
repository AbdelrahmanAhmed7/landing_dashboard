import { catalogGroups, groupLabels } from './flavorCatalog'

const totalUnits = selection => (selection?.items || []).reduce((sum, item) => sum + item.qty, 0)

export default function BundleEditor({ selection, onChange, onGroupChange }) {
  const items = selection?.items || []
  const patch = (key, changes) => onChange({
    version: 1,
    mode: 'components',
    items: items.map(item => item.key === key ? { ...item, ...changes } : item),
  })
  const setQty = (item, value) => {
    const qty = Math.max(1, Math.floor(Number(value) || 1))
    patch(item.key, { qty, choose: Math.min(item.choose, qty) })
  }
  const setChoose = (item, value) => {
    const choose = Math.min(item.qty, Math.max(0, Math.floor(Number(value) || 0)))
    patch(item.key, { choose, group: choose > 0 ? item.group : null })
  }
  const add = () => {
    const n = items.length + 1
    onChange({
      version: 1,
      mode: 'components',
      items: [...items, { key: crypto.randomUUID(), label: `المكوّن ${n}`, qty: 1, choose: 0, group: null }],
    })
  }
  return <div className="field bundle-editor">
    <h3 id="offer-bundle-heading" tabIndex={-1}>مكوّنات الباندل</h3>
    <small className="muted">كل مكوّن له كمية واختيار مستقل. لما «العميل يختار كام نكهة» تبقى صفر، المكوّن ثابت والعميل مش بيختار منه حاجة.</small>
    {items.length === 0 && <p className="inline-notice">ضيف مكوّن واحد على الأقل عشان الباندل يبقى متاح للطلب.</p>}
    {items.map((item, i) => {
      const known = catalogGroups.includes(item.group)
      return <div className="bundle-item" key={item.key}>
        <div className="bundle-item-head">
          <strong>مكوّن {i + 1}</strong>
          <button type="button" className="btn ghost small-btn" onClick={() => onChange({ version: 1, mode: 'components', items: items.filter(entry => entry.key !== item.key) })}>حذف</button>
        </div>
        <div className="grid3">
          <label className="field">
            <span>اسم المكوّن</span>
            <input value={item.label} onChange={e => patch(item.key, { label: e.target.value })} placeholder="سبريد / حلاوة / مربي" />
          </label>
          <label className="field">
            <span>عدد القطع</span>
            <input type="number" min="1" step="1" value={item.qty} onChange={e => setQty(item, e.target.value)} />
          </label>
          <label className="field">
            <span>العميل يختار كام نكهة؟</span>
            <input type="number" min="0" max={item.qty} step="1" value={item.choose} onChange={e => setChoose(item, e.target.value)} />
          </label>
        </div>
        {item.choose > 0 && <label className="field">
          <span>مجموعة النكهات</span>
          <select value={known ? item.group : item.group ? '__custom' : ''} onChange={e => onGroupChange(item.key, e.target.value === '__custom' ? item.key : e.target.value || null)}>
            <option value="">اختار المجموعة…</option>
            {catalogGroups.map(group => <option key={group} value={group}>{groupLabels[group]}</option>)}
            <option value="__custom">مخصصة — نكهات خاصة بالمكوّن</option>
          </select>
          <small className="muted">{item.group ? 'نكهات المكوّن بتتدار من قسم النكهات تحت.' : 'لازم تختار مجموعة عشان تقدر تضيف نكهات للمكوّن.'}</small>
        </label>}
        <small className="muted">{item.choose === 0 ? 'مكوّن ثابت من غير اختيار.' : `العميل هيختار ${item.choose} نكهة من نكهات المجموعة.`}</small>
      </div>
    })}
    <div className="bundle-summary">إجمالي القطع في الباندل: <strong>{totalUnits(selection)}</strong></div>
    <button type="button" className="btn ghost" onClick={add}>+ مكوّن جديد</button>
  </div>
}
