import { flavorGroups, groupLabels } from './flavorCatalog'
import ImageUpload from './ImageUpload'

export default function FlavorEditor({ site, slug, flavors, onChange, onUpload, uploading }) {
  const groups = flavorGroups(site, slug)
  const patch = (id, changes) => onChange(flavors.map(f => f.id === id ? { ...f, ...changes } : f))
  const move = (id, direction) => {
    const index = flavors.findIndex(f => f.id === id)
    const members = flavors.map((f, i) => f.group === flavors[index].group ? i : -1).filter(i => i >= 0)
    const other = members[members.indexOf(index) + direction]
    if (other === undefined) return
    const next = [...flavors]
    ;[next[index], next[other]] = [next[other], next[index]]
    onChange(next)
  }
  return <div className="field flavor-editor">
    <h3 id="offer-flavors-heading" tabIndex={-1}>إدارة النكهات</h3>
    <small className="muted">التغيير يخص العرض ده فقط. لو كل نكهات مكوّن اتخفت، العرض هيبقى غير متاح للطلب. الصور الفاضية تستخدم الصورة المحلية لو موجودة.</small>
    {groups.map(group => {
      const members = flavors.filter(f => f.group === group)
      return <fieldset key={group} disabled={uploading !== ''} className="flavor-group">
        <legend>{groupLabels[group]} <span className="flavor-count">{members.filter(f => f.is_active).length} ظاهرة / {members.length}</span></legend>
        {members.length > 0 && members.every(f => !f.is_active) && <p className="inline-notice">كل نكهات المجموعة مخفية. أظهر نكهة واحدة على الأقل عشان العرض يبقى متاح للطلب.</p>}
        {members.length === 0 && <p className="muted small">مفيش نكهات مضافة للمجموعة دي. استخدم الزر تحت لإضافة أول نكهة.</p>}
        {members.map((fl, i) => <div key={fl.id} className={`flavor-edit-row${fl.is_active ? '' : ' flavor-hidden'}`}>
          <div className="flavor-item">
            <div className="thumb small">{fl.image ? <img src={fl.image} alt="" /> : <span>—</span>}</div>
            <input aria-label={`اسم النكهة ${i + 1} — ${groupLabels[group]}`} value={fl.name} onChange={e => patch(fl.id, { name: e.target.value })} placeholder="اسم النكهة" />
            <ImageUpload label="صورة" onSelect={file => onUpload(fl.id, file)} disabled={uploading !== ''} busy={uploading === fl.id} />
          </div>
          <div className="flavor-tools">
            <label><input type="checkbox" checked={fl.is_active} onChange={e => patch(fl.id, { is_active: e.target.checked })} /> ظاهرة</label>
            <button type="button" className="btn ghost small-btn" disabled={i === 0} onClick={() => move(fl.id, -1)} aria-label={`تقديم ${fl.name}`}>↑</button>
            <button type="button" className="btn ghost small-btn" disabled={i === members.length - 1} onClick={() => move(fl.id, 1)} aria-label={`تأخير ${fl.name}`}>↓</button>
            {fl.image && <button type="button" className="btn ghost small-btn" onClick={() => patch(fl.id, { image: undefined })}>شيل الصورة</button>}
            <button type="button" className="btn ghost small-btn" disabled={members.length === 1} title={members.length === 1 ? 'اخفي آخر نكهة بدل حذفها' : 'حذف النكهة'} onClick={() => onChange(flavors.filter(f => f.id !== fl.id))}>حذف</button>
          </div>
        </div>)}
        <button type="button" className="btn ghost" onClick={() => onChange([...flavors, { id: crypto.randomUUID(), group, name: '', is_active: true }])}>+ نكهة — {groupLabels[group]}</button>
      </fieldset>
    })}
  </div>
}
