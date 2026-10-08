export default function ImageUpload({ label, onSelect, disabled, busy = false }) {
  return <label className={`btn ghost file-btn${disabled ? ' is-disabled' : ''}`}>
    <span>{busy ? 'جاري رفع الصورة…' : label}</span>
    <input
      className="visually-hidden"
      type="file"
      accept="image/*"
      aria-label={label}
      disabled={disabled}
      onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; onSelect(file) }}
    />
  </label>
}
