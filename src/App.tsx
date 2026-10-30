import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from './lib/supabase'
import { APP_NAME } from './lib/brand'
import { useRealtime } from './hooks/useRealtime'
import Login from './components/Login'
import Inquiries from './components/Inquiries'
import Followups from './components/Followups'
import Dashboard from './components/Dashboard'
import Pipeline from './components/Pipeline'
import Team from './components/Team'
import Attendance from './components/Attendance'
import Inventory from './components/Inventory'

function Shell({ session }: { session: any }) {
  const [tab, setTab] = useState<'dash' | 'inq' | 'pipe' | 'fu' | 'team' | 'time' | 'inv'>('dash')
  const conn = useRealtime()
  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await supabase.from('employees').select('*').eq('auth_user_id', session.user.id).maybeSingle()).data
  })
  // Automatic attendance: clocked in when the app opens signed-in, kept alive by a heartbeat, clocked out on sign-out.
  useEffect(() => {
    if (!me?.active) return
    supabase.rpc('clock_in').then(() => {})
    const beat = () => { if (document.visibilityState === 'visible') supabase.rpc('heartbeat').then(() => {}) }
    const i = setInterval(beat, 120000), v = () => { if (document.visibilityState === 'visible') supabase.rpc('clock_in').then(() => {}) }
    document.addEventListener('visibilitychange', v)
    return () => { clearInterval(i); document.removeEventListener('visibilitychange', v) }
  }, [me?.id, me?.active])
  const signOut = async () => { try { await supabase.rpc('clock_out') } catch {} await supabase.auth.signOut() }
  if (isLoading) return <p className="pad">Loading…</p>
  if (!me || !me.active) return <div className="card login"><p>Your account isn't linked to an active employee profile. Ask the administrator.</p><button onClick={() => supabase.auth.signOut()}>Sign out</button></div>
  return (
    <>
      <header><img src="/logo.png" alt="" className="logo" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} /><b>{APP_NAME}</b>{/* live-sync status hidden: set to show again with <span className={`conn ${conn}`}>● {conn}</span> */}<span className="muted">{me.employee_name} ({me.role})</span>
        <button className="link" onClick={signOut}>Sign out</button></header>
      <main>{tab === 'dash' && <div className="hello"><h2>{new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}, {me.employee_name.split(' ')[0]}.</h2><p>Let’s move things forward.</p></div>}{tab === 'dash' ? <Dashboard /> : tab === 'inq' ? <Inquiries me={me} /> : tab === 'pipe' ? <Pipeline /> : tab === 'fu' ? <Followups me={me} /> : tab === 'time' ? <Attendance me={me} /> : tab === 'inv' ? <Inventory me={me} /> : <Team />}</main>
      <nav>{([['dash','Dashboard'],['inq','Inquiries'],['pipe','Pipeline'],['fu','Follow-ups'],['time','Clock'],...(['admin','service'].includes(me.role) ? [['inv','Inventory']] : []),...(me.role === 'admin' ? [['team','Team']] : [])] as string[][]).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k as any)}>{l}</button>)}</nav>
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
