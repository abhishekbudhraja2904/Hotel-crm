import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDate } from '../lib/dates'
import DateField from './DateField'
// View only: installation jobs and service tickets, who gave the work and who is doing it. No prices.
export default function ServiceTeam() {
  const [tab, setTab] = useState<'inst' | 'tix'>('inst'), [tech, setTech] = useState(''), [exec, setExec] = useState(''), [st, setSt] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState('')
  const { data, isLoading, error } = useQuery({ queryKey: ['service-team'], queryFn: async () => { const { data, error } = await supabase.rpc('service_team_overview'); if (error) throw error; return data as any } })
  const rows: any[] = (tab === 'inst' ? data?.installations : data?.tickets) ?? []
  const date = (r: any) => (tab === 'inst' ? r.installed_on : String(r.opened_at).slice(0, 10))
  const uniq = (k: string, kn: string) => [...new Map(rows.filter((r) => r[k]).map((r) => [r[k], r[kn]])).entries()]
  const shown = rows.filter((r) => (!tech || r.technician_id === tech) && (!exec || r.sales_exec_id === exec) && (!st || r.status === st) && (!from || date(r) >= from) && (!to || date(r) <= to))
  const statuses = tab === 'inst' ? ['Scheduled', 'Completed'] : ['Open', 'In progress', 'Fixed']
  return <section>
    <div className="bar"><button className={tab === 'inst' ? 'primary' : ''} onClick={() => { setTab('inst'); setSt('') }}>Installations</button><button className={tab === 'tix' ? 'primary' : ''} onClick={() => { setTab('tix'); setSt('') }}>Service tickets</button></div>
    <div className="card" style={{ margin: 0 }}>
      <div className="bar">
        <select value={tech} onChange={(e) => setTech(e.target.value)}><option value="">All technicians</option>{uniq('technician_id', 'technician').map(([id, n]) => <option key={id as string} value={id as string}>{n as string}</option>)}</select>
        <select value={exec} onChange={(e) => setExec(e.target.value)}><option value="">All sales executives</option>{uniq('sales_exec_id', 'sales_exec').map(([id, n]) => <option key={id as string} value={id as string}>{n as string}</option>)}</select>
        <select value={st} onChange={(e) => setSt(e.target.value)}><option value="">All statuses</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select></div>
      <div className="bar"><label style={{ flex: 1 }}>From<DateField value={from} onChange={setFrom} ariaLabel="From date" /></label><label style={{ flex: 1 }}>To<DateField value={to} onChange={setTo} ariaLabel="To date" /></label></div>
    </div>
    {isLoading && <p className="empty">Loading…</p>}
    {error && <p className="msg">{(error as any).message}</p>}
    {data && !shown.length && <p className="empty">Nothing matches.</p>}
    {shown.map((r) => <div className="card" key={r.id}>
      <div className="row"><b>{r.customer ?? r.site_name}</b><span className="pill">{r.status}</span></div>
      {tab === 'tix' && <div>S-{String(r.seq).padStart(3, '0')} · {r.title}</div>}
      {r.items ? <div className="muted">{r.items}</div> : r.what ? <div className="muted">{r.what}</div> : null}
      <div className="muted">{r.site_name}{r.inquiry_number ? ` · ${r.inquiry_number}` : ''}{r.packing_no ? ` · packing no. ${r.packing_no}` : ''}</div>
      <div className="muted">Given by: {r.given_by ?? '—'}{r.sales_exec && r.sales_exec !== r.given_by ? ` · Sales: ${r.sales_exec}` : ''} · Technician: {r.technician ?? 'not assigned'} · {fmtDate(date(r))}</div>
    </div>)}
  </section>
}
