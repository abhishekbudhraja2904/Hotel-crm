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
import { Bell, NotifyPopup } from './components/Notifications'
import Settings from './components/Settings'
import AfterSales from './components/AfterSales'
import Insights from './components/Insights'
import QuoteLibrary from './components/QuoteLibrary'
import Icon from './components/Icon'
import ServiceTeam from './components/ServiceTeam'
import { ClockGate, LockBar } from './components/ClockGate'
import { maybeAutoDownload } from './lib/excel'

function Shell({ session }: { session: any }) {
  const [tab, setTab] = useState<'dash' | 'inq' | 'pipe' | 'fu' | 'team' | 'time' | 'inv' | 'set' | 'after' | 'ins' | 'quo' | 'svc'>('dash')
  const [menu, setMenu] = useState(false), [unlocked, setUnlocked] = useState(false)
  const conn = useRealtime()
  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await supabase.from('employees').select('*').eq('auth_user_id', session.user.id).maybeSingle()).data
  })
  // Clock status: people the admin marked "must clock in on office network" clock in by hand; everyone else is clocked in automatically.
  const cs = useQuery({ queryKey: ['clock'], enabled: !!me?.active, refetchInterval: 60000, queryFn: async () => { const { data, error } = await supabase.rpc('clock_status'); if (error) throw error; return (data ?? {}) as any } })
  const manual = !!cs.data?.office_only
  useEffect(() => { if (cs.data?.clocked_in) setUnlocked(true) }, [cs.data?.clocked_in])
  // Automatic attendance: clocked in when the app opens signed-in, kept alive by a heartbeat, clocked out on sign-out.
  useEffect(() => {
    if (!me?.active || !cs.data) return
    const beat = () => { if (document.visibilityState === 'visible') supabase.rpc('heartbeat').then(() => {}) }
    const i = setInterval(beat, 120000)
    if (manual) return () => clearInterval(i)
    supabase.rpc('clock_in').then(() => {})
    const v = () => { if (document.visibilityState === 'visible') supabase.rpc('clock_in').then(() => {}) }
    document.addEventListener('visibilitychange', v)
    return () => { clearInterval(i); document.removeEventListener('visibilitychange', v) }
  }, [me?.id, me?.active, !!cs.data, manual])
  useEffect(() => { if (me?.active) { const t = setTimeout(() => maybeAutoDownload(me), 4000); return () => clearTimeout(t) } }, [me?.id])
  const signOut = async () => { try { await supabase.rpc('clock_out') } catch {} await supabase.auth.signOut() }
  const canInv = useQuery({ queryKey: ['inventory', 'can'], enabled: !!me?.active, queryFn: async () => !!(await supabase.rpc('can_update_inventory')).data })
  if (isLoading) return <p className="pad">Loading…</p>
  if (me?.active && cs.isLoading) return <p className="pad">Loading…</p>
  if (!me || !me.active) return <div className="card login"><p>Your account isn't linked to an active employee profile. Ask the administrator.</p><button onClick={() => supabase.auth.signOut()}>Sign out</button></div>
  // Who sees which menu items: technicians (role 'service') get only Inventory, Clock and Settings; sales get no Inventory or Team; admin gets everything.
  const items: string[][] = me.role === 'service'
    ? [['after', 'Jobs'], ['inv', 'Inventory'], ['time', 'Clock'], ['set', 'Settings']]
    : me.role === 'service_admin'
    ? [['svc', 'Service team'], ['after', 'Give work'], ['inv', 'Inventory'], ['time', 'Clock'], ['set', 'Settings']]
    : [['dash', 'Dashboard'], ['inq', 'Inquiries'], ['quo', 'Quotations'], ['pipe', 'Pipeline'], ['fu', 'Follow-ups'], ['after', 'After-sales'], ...(me.role === 'admin' ? [['svc', 'Service team']] : []), ['time', 'Clock'], ...(me.role === 'admin' ? [['inv', 'Inventory'], ['ins', 'Insights'], ['team', 'Team']] : canInv.data ? [['inv', 'Inventory']] : []), ['set', 'Settings']]
  const cur = items.some(([k]) => k === tab) ? tab : items[0][0] // a technician opens straight on Jobs
  if (manual && cs.data && !cs.data.clocked_in && !unlocked) return <ClockGate me={me} status={cs.data} />
  const locked = manual && cs.data && !cs.data.clocked_in
  return (
    <>
      <header><button className="burger" aria-label="Menu" onClick={() => setMenu(!menu)}>☰</button><img src="/logo.png" alt="" className="logo" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} /><b>{APP_NAME}</b>{/* live-sync status hidden: set to show again with <span className={`conn ${conn}`}>● {conn}</span> */}<Bell /><span className="muted">{me.employee_name} ({me.role})</span>
        <button className="link" onClick={signOut}>Sign out</button></header>
      {!locked && <NotifyPopup />}
      {locked && <LockBar status={cs.data} />}
      <main className={locked ? 'locked' : ''}>{cur === 'dash' && <div className="hello"><h2>{new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}, {me.employee_name.split(' ')[0]}.</h2><p>Let’s move things forward.</p></div>}{cur === 'dash' ? <Dashboard me={me} /> : cur === 'inq' ? <Inquiries me={me} /> : cur === 'pipe' ? <Pipeline /> : cur === 'fu' ? <Followups me={me} /> : cur === 'time' ? <Attendance me={me} /> : cur === 'inv' ? <Inventory me={me} /> : cur === 'set' ? <Settings me={me} /> : cur === 'after' ? <AfterSales me={me} /> : cur === 'ins' ? <Insights /> : cur === 'quo' ? <QuoteLibrary /> : cur === 'svc' ? <ServiceTeam /> : <Team />}</main>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}<nav className={menu ? 'open' : ''}>{items.map(([k, l]) => <button key={k} className={`a-${k}${cur === k ? ' on' : ''}`} onClick={() => { setTab(k as any); setMenu(false) }}><span className="ico"><Icon name={k} /></span>{l}</button>)}</nav>
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
