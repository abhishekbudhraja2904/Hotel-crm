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
import Settings from './components/Settings'

function Shell({ session }: { session: any }) {
  const [tab, setTab] = useState<'dash' | 'inq' | 'pipe' | 'fu' | 'team' | 'time' | 'inv' | 'set'>('dash')
  const [menu, setMenu] = useState(false)
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
  const canInv = useQuery({ queryKey: ['inventory', 'can'], enabled: !!me?.active, queryFn: async () => !!(await supabase.rpc('can_update_inventory')).data })
  if (isLoading) return <p className="pad">Loading…</p>
  if (!me || !me.active) return <div className="card login"><p>Your account isn't linked to an active employee profile. Ask the administrator.</p><button onClick={() => supabase.auth.signOut()}>Sign out</button></div>
  // Who sees which menu items: technicians (role 'service') get only Inventory, Clock and Settings; sales get no Inventory or Team; admin gets everything.
  const items: string[][] = me.role === 'service'
    ? [['inv', 'Inventory'], ['time', 'Clock'], ['set', 'Settings']]
    : [['dash', 'Dashboard'], ['inq', 'Inquiries'], ['pipe', 'Pipeline'], ['fu', 'Follow-ups'], ['time', 'Clock'], ...(me.role === 'admin' ? [['inv', 'Inventory'], ['team', 'Team']] : canInv.data ? [['inv', 'Inventory']] : []), ['set', 'Settings']]
  const cur = items.some(([k]) => k === tab) ? tab : items[0][0] // a technician opens straight on Inventory
  return (
    <>
      <header><button className="burger" aria-label="Menu" onClick={() => setMenu(!menu)}>☰</button><img src="/logo.png" alt="" className="logo" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} /><b>{APP_NAME}</b>{/* live-sync status hidden: set to show again with <span className={`conn ${conn}`}>● {conn}</span> */}<span className="muted">{me.employee_name} ({me.role})</span>
        <button className="link" onClick={signOut}>Sign out</button></header>
      <main>{cur === 'dash' && <div className="hello"><h2>{new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}, {me.employee_name.split(' ')[0]}.</h2><p>Let’s move things forward.</p></div>}{cur === 'dash' ? <Dashboard me={me} /> : cur === 'inq' ? <Inquiries me={me} /> : cur === 'pipe' ? <Pipeline /> : cur === 'fu' ? <Followups me={me} /> : cur === 'time' ? <Attendance me={me} /> : cur === 'inv' ? <Inventory me={me} /> : cur === 'set' ? <Settings me={me} /> : <Team />}</main>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}<nav className={menu ? 'open' : ''}>{items.map(([k, l]) => <button key={k} className={cur === k ? 'on' : ''} onClick={() => { setTab(k as any); setMenu(false) }}>{l}</button>)}</nav>
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
