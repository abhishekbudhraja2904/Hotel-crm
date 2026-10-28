import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from './lib/supabase'
import { useRealtime } from './hooks/useRealtime'
import Login from './components/Login'
import Inquiries from './components/Inquiries'
import Followups from './components/Followups'
import Dashboard from './components/Dashboard'
import Pipeline from './components/Pipeline'
import Team from './components/Team'

function Shell({ session }: { session: any }) {
  const [tab, setTab] = useState<'dash' | 'inq' | 'pipe' | 'fu' | 'team'>('dash')
  const conn = useRealtime()
  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await supabase.from('employees').select('*').eq('auth_user_id', session.user.id).maybeSingle()).data
  })
  if (isLoading) return <p className="pad">Loading…</p>
  if (!me || !me.active) return <div className="card login"><p>Your account isn't linked to an active employee profile. Ask the administrator.</p><button onClick={() => supabase.auth.signOut()}>Sign out</button></div>
  return (
    <>
      <header><b>Access CRM</b><span className={`conn ${conn}`}>● {conn}</span><span className="muted">{me.employee_name} ({me.role})</span>
        <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button></header>
      <main>{tab === 'dash' ? <Dashboard /> : tab === 'inq' ? <Inquiries me={me} /> : tab === 'pipe' ? <Pipeline /> : tab === 'fu' ? <Followups me={me} /> : <Team />}</main>
      <nav>{([['dash','Dashboard'],['inq','Inquiries'],['pipe','Pipeline'],['fu','Follow-ups'],...(me.role === 'admin' ? [['team','Team']] : [])] as string[][]).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k as any)}>{l}</button>)}</nav>
    </>
  )
}
export default function App() {
  const [session, setSession] = useState<any>(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  if (session === undefined) return <p className="pad">Loading…</p>
  return session ? <Shell session={session} /> : <Login />
}
