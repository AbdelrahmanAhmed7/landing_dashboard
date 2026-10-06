import { useState } from 'react'
import { supabase } from './supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (err) setError('الإيميل أو الباسورد غلط')
    setBusy(false)
  }

  return (
    <div className="center-screen">
      <form className="card narrow" onSubmit={submit}>
        <h1>Healthy &amp; Tasty</h1>
        <p className="muted">إدارة العروض — تسجيل الدخول</p>
        <label className="field">
          <span>الإيميل</span>
          <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label className="field">
          <span>الباسورد</span>
          <input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'جاري الدخول…' : 'دخول'}</button>
      </form>
    </div>
  )
}
