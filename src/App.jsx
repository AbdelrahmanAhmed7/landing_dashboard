import { useEffect, useState } from 'react'
import { supabase, isConfigured } from './supabase'
import Login from './Login.jsx'
import Dashboard from './Dashboard.jsx'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = لسه بيتحمّل

  useEffect(() => {
    if (!isConfigured) {
      setSession(null)
      return
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!isConfigured) {
    return (
      <div className="center-screen">
        <div className="card narrow">
          <h1>الإعدادات ناقصة</h1>
          <p>
            اعمل ملف <code>.env</code> وحط فيه <code>VITE_SUPABASE_URL</code> و
            <code>VITE_SUPABASE_ANON_KEY</code> (راجع <code>.env.example</code>) وبعدين شغّل الـ dev server تاني.
          </p>
        </div>
      </div>
    )
  }

  if (session === undefined) return <div className="center-screen">جاري التحميل…</div>
  if (!session) return <Login />
  return <Dashboard session={session} />
}
