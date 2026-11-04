import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDate, isoDate } from '../lib/dates'
import DateField from './DateField'
// View only: installation jobs and service tickets, who gave the work and who is doing it. No prices.
export default function ServiceTeam() {
  const [tab, setTab] = useState<'inst' | 'tix' | 'day'>('inst'), [tech, setTech] = useState(''), [exec, setExec] = useState(''), [st, setSt] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState('')
  const { data, isLoading, error } = useQuery({ queryKey: ['service-team'], queryFn: async () => { const { data, error } = await supabase.rpc('service_team_overview'); if (error) throw error; return data as any } })
  const rows: any[] = (tab === 'tix' ? data?.tickets : data?.installations) ?? []
  const date = (r: any) => (tab === 'tix' ? String(r.opened_at).slice(0, 10) : r.installed_on)
  const isNew = (r: any) => Date.now() - new Date(r.created_at ?? r.opened_at).getTime() < 48 * 3600 * 1000
  const uniq = (k: string, kn: string) => [...new Map(rows.filter((r) => r[k]).map((r) => [r[k], r[kn]])).entries()]
  const shown = rows.filter((r) => (!tech || r.technician_id === tech) && (!exec || r.sales_exec_id === exec) && (!st || r.status === st) && (!from || date(r) >= from) && (!to || date(r) <= to))
  const bar = <div className="bar"><button className={tab === 'inst' ? 'primary' : ''} onClick={() => { setTab('inst'); setSt('') }}>Installations</button><button className={tab === 'tix' ? 'primary' : ''} onClick={() => { setTab('tix'); setSt('') }}>Service tickets</button><button className={tab === 'day' ? 'primary' : ''} onClick={() => { setTab('day'); setSt('') }}>Daily report</button></div>
  const statuses = tab !== 'tix' ? ['Scheduled', 'Completed'] : ['Open', 'In progress', 'Fixed']
  if (tab === 'day') return <section>{bar}<DailyReport data={data} loading={isLoading} /></section>
  return <section>
    {bar}
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
      <div className="row"><b>{r.customer ?? r.site_name}{r.city ? ` · ${r.city}` : ''}</b><span>{isNew(r) && <span className="pill Urgent">New</span>} <span className="pill">{r.status}</span></span></div>
      {tab === 'tix' && <div>S-{String(r.seq).padStart(3, '0')} · {r.title}</div>}
      {r.items ? <div className="muted">{r.items}</div> : r.what ? <div className="muted">{r.what}</div> : null}
      <div className="muted">{r.site_name}{r.inquiry_number ? ` · ${r.inquiry_number}` : ''}{r.packing_no ? ` · packing no. ${r.packing_no}` : ''}</div>
      <div className="muted">Given by: {r.given_by ?? '—'}{r.sales_exec && r.sales_exec !== r.given_by ? ` · Sales: ${r.sales_exec}` : ''} · Technician: {r.technician ?? 'not assigned'} · {fmtDate(date(r))}</div>
    </div>)}
  </section>
}

const dayKey = (d: any) => String(d ?? '').slice(0, 10)
// One line per technician per day: installations done, tickets fixed, tickets opened/given. Counts only what has been recorded in the app.
function DailyReport({ data, loading }: { data: any; loading: boolean }) {
  const [from, setFrom] = useState(isoDate(new Date(Date.now() - 6 * 86400000))), [to, setTo] = useState(isoDate()), [tech, setTech] = useState('')
  const map = new Map<string, any>()
  const row = (day: string, id: string | null, name: string | null) => { const k = day + '|' + (id ?? ''); if (!map.has(k)) map.set(k, { day, id, name: name ?? 'Not assigned', inst: [] as string[], fixed: [] as string[], opened: [] as string[] }); return map.get(k) }
  for (const i of data?.installations ?? []) if (i.status === 'Completed' || (i.installed_on && i.installed_on <= isoDate())) row(dayKey(i.installed_on), i.technician_id, i.technician).inst.push(`${i.customer ?? i.site_name}${i.city ? ', ' + i.city : ''}`)
  for (const t of data?.tickets ?? []) {
    const lab = `S-${String(t.seq).padStart(3, '0')} ${t.customer ?? t.site_name}${t.city ? ', ' + t.city : ''}`
    row(dayKey(t.opened_at), t.technician_id, t.technician).opened.push(lab)
    if (t.status === 'Fixed' && t.closed_at) row(dayKey(t.closed_at), t.technician_id, t.technician).fixed.push(lab)
  }
  const techs = [...new Map([...map.values()].filter((r) => r.id).map((r) => [r.id, r.name])).entries()]
  const rows = [...map.values()].filter((r) => r.day >= from && r.day <= to && (!tech || r.id === tech)).sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : a.name.localeCompare(b.name)))
  return <>
    <div className="card" style={{ margin: 0 }}>
      <div className="bar"><label style={{ flex: 1 }}>From<DateField value={from} onChange={setFrom} ariaLabel="From date" /></label><label style={{ flex: 1 }}>To<DateField value={to} onChange={setTo} ariaLabel="To date" /></label></div>
      <select value={tech} onChange={(e) => setTech(e.target.value)}><option value="">All technicians</option>{techs.map(([id, n]) => <option key={id as string} value={id as string}>{n as string}</option>)}</select>
    </div>
    <p className="muted">Shows only work recorded in the app. If a technician did a job but did not record it, it will not appear here.</p>
    {loading && <p className="empty">Loading…</p>}
    {data && !rows.length && <p className="empty">No recorded work in these dates.</p>}
    {rows.map((r) => <div className="card" key={r.day + (r.id ?? '')}>
      <div className="row"><b>{r.name}</b><span className="muted">{fmtDate(r.day)}</span></div>
      <div>Installations done: <b>{r.inst.length}</b> · Tickets fixed: <b>{r.fixed.length}</b> · Tickets given: <b>{r.opened.length}</b></div>
      {r.inst.length > 0 && <div className="muted">Installed: {r.inst.join('; ')}</div>}
      {r.fixed.length > 0 && <div className="muted">Fixed: {r.fixed.join('; ')}</div>}
      {r.opened.length > 0 && <div className="muted">Given: {r.opened.join('; ')}</div>}
    </div>)}
  </>
}
