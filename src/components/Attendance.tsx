import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
const dur = (ms: number) => { const m = Math.max(0, Math.floor(ms / 60000)); return `${Math.floor(m / 60)}h ${m % 60}m` }
const t = (s: string) => new Date(s).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
export default function Attendance({ me }: { me: any }) {
  const qc = useQueryClient(), [msg, setMsg] = useState(''), [, tick] = useState(0)
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(i) }, [])
  const isAdmin = me.role === 'admin'
  const { data = [], isLoading } = useQuery({ queryKey: ['attendance'], refetchInterval: 30000, queryFn: async () => {
    const since = new Date(Date.now() - 7 * 864e5).toISOString()
    const { data, error } = await supabase.from('attendance').select('id,employee_id,clock_in,clock_out,last_seen,employees(employee_name,role)').gte('clock_in', since).order('clock_in', { ascending: false }).limit(300)
    if (error) throw error; return data } })
  const { data: staff = [] } = useQuery({ queryKey: ['staff-roster'], enabled: isAdmin, queryFn: async () => (await supabase.from('employees').select('id,employee_name,role').eq('active', true).order('employee_name')).data ?? [] })
  const mine: any = data.find((r: any) => r.employee_id === me.id && !r.clock_out)
  async function act(fn: string, args?: any) {
    setMsg(''); const { error } = await supabase.rpc(fn, args); if (error) setMsg(error.message)
    qc.invalidateQueries({ queryKey: ['attendance'] })
  }
  const active = data.filter((r: any) => !r.clock_out)
  const name = (r: any) => (Array.isArray(r.employees) ? r.employees[0] : r.employees)?.employee_name ?? 'Employee'
  return (
    <section>
      {msg && <p className="msg">{msg}</p>}
      <div className="card clockcard">
        <div className="muted">{mine ? `Clocked in since ${t(mine.clock_in)} (automatic at sign-in)` : 'You are clocked out'}</div>
        {mine && <b className="big">{dur(Date.now() - +new Date(mine.clock_in))}</b>}
        {mine ? <button className="primary" onClick={() => act('clock_out')}>Clock out</button> : <button className="primary" onClick={() => act('clock_in')}>Clock in</button>}
      </div>
      {isAdmin && <>
        <h3>Team status</h3>
        <p className="muted">Online = app open in the last 5 minutes. Idle = clocked in but not seen lately (app closed without signing out). Offline = clocked out.</p>
        {staff.map((e: any) => { const o: any = active.find((r: any) => r.employee_id === e.id)
          const online = o && Date.now() - +new Date(o.last_seen) < 5 * 60000
          return <div className="card" key={e.id}><div className="row"><b><span className={`dot ${o ? (online ? 'on' : 'idle') : ''}`} />{e.employee_name} <span className="muted">({e.role})</span></b>
            <span className="muted">{o ? `${online ? 'Online' : 'Idle'} · in since ${t(o.clock_in)} · ${dur(Date.now() - +new Date(o.clock_in))}` : 'Offline'}</span></div>
            {o && <button className="link" onClick={() => confirm(`Clock ${e.employee_name} out now?`) && act('admin_clock_out', { emp: e.id })}>Clock out for them</button>}</div> })}
      </>}
      <h3>{isAdmin ? 'Last 7 days' : 'My last 7 days'}</h3>
      {data.filter((r: any) => r.clock_out).map((r: any) => <div className="card" key={r.id}><div className="row"><b>{isAdmin ? name(r) : t(r.clock_in)}</b><span className="pill">{dur(+new Date(r.clock_out) - +new Date(r.clock_in))}</span></div>
        <div className="muted">{isAdmin && `${t(r.clock_in)} → `}{isAdmin ? t(r.clock_out) : `out ${t(r.clock_out)}`}</div></div>)}
    </section>
  )
}
