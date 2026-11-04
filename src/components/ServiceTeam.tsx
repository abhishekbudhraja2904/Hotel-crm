import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDate, isoDate } from '../lib/dates'
import DateField from './DateField'
import { ProofLink } from './JobUpdate'
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
      <div className="row"><b>{r.customer ?? r.site_name}{r.city ? ` · ${r.city}` : ''}</b><span>{isNew(r) && <span className="pill Urgent">New</span>} <span className="pill">{r.status === 'Scheduled' ? 'To do' : r.status}</span></span></div>
      {tab === 'tix' && <div>S-{String(r.seq).padStart(3, '0')} · {r.title}</div>}
      {r.items ? <div className="muted">{r.items}</div> : r.what ? <div className="muted">{r.what}</div> : null}
      <div className="muted">{r.site_name}{r.inquiry_number ? ` · ${r.inquiry_number}` : ''}{r.packing_no ? ` · packing no. ${r.packing_no}` : ''}</div>
      <div className="muted">Given by: {r.given_by ?? '—'}{r.sales_exec && r.sales_exec !== r.given_by ? ` · Sales: ${r.sales_exec}` : ''} · Technician: {r.technician ?? 'not assigned'} · {fmtDate(date(r))}</div>
    </div>)}
  </section>
}

// Day-wise report built from the updates technicians save (partly / fully done, with note and photo proof).
function DailyReport({ data, loading }: { data: any; loading: boolean }) {
  const [from, setFrom] = useState(isoDate(new Date(Date.now() - 6 * 86400000))), [to, setTo] = useState(isoDate()), [tech, setTech] = useState('')
  const rep = useQuery({ queryKey: ['service-team', 'daily'], refetchInterval: 60000, queryFn: async () => { const { data, error } = await supabase.rpc('daily_work_report'); if (error) throw error; return data as any[] } })
  const all: any[] = rep.data ?? []
  const techs = [...new Map([...all, ...(data?.installations ?? []), ...(data?.tickets ?? [])].filter((r) => r.technician_id).map((r) => [r.technician_id, r.technician])).entries()]
  const shown = all.filter((r) => r.day >= from && r.day <= to && (!tech || r.technician_id === tech))
  const groups = new Map<string, any[]>()
  for (const r of shown) { const k = r.day + '|' + r.technician_id; groups.set(k, [...(groups.get(k) ?? []), r]) }
  // open work per technician and when they last sent an update
  const open = techs.map(([id, name]) => {
    const jobs = [...(data?.installations ?? []).filter((i: any) => i.status !== 'Completed'), ...(data?.tickets ?? []).filter((t: any) => t.status !== 'Fixed')].filter((j: any) => j.technician_id === id)
    const last = all.filter((r) => r.technician_id === id).map((r) => r.day).sort().pop()
    return { id, name, n: jobs.length, last }
  }).filter((o) => o.n > 0 && (!tech || o.id === tech))
  return <>
    <div className="card" style={{ margin: 0 }}>
      <div className="bar"><label style={{ flex: 1 }}>From<DateField value={from} onChange={setFrom} ariaLabel="From date" /></label><label style={{ flex: 1 }}>To<DateField value={to} onChange={setTo} ariaLabel="To date" /></label></div>
      <select value={tech} onChange={(e) => setTech(e.target.value)}><option value="">All technicians</option>{techs.map(([id, n]) => <option key={id as string} value={id as string}>{n as string}</option>)}</select>
    </div>
    {open.length > 0 && <div className="card" style={{ margin: 0 }}><b>Work still open</b>{open.map((o) => <div key={o.id as string} className="muted">{o.name as string}: {o.n} job{o.n > 1 ? 's' : ''} open · last update {o.last ? fmtDate(o.last) : 'never'}</div>)}</div>}
    {(loading || rep.isLoading) && <p className="empty">Loading…</p>}
    {rep.error && <p className="msg">{(rep.error as any).message}</p>}
    {rep.data && !groups.size && <p className="empty">No updates were sent in these dates.</p>}
    {[...groups.entries()].map(([k, list]) => <div className="card" key={k}>
      <div className="row"><b>{list[0].technician ?? 'Unknown'}</b><span className="muted">{fmtDate(list[0].day)}</span></div>
      <div>Fully done: <b>{list.filter((u) => u.done === 'complete').length}</b> · Partly done: <b>{list.filter((u) => u.done === 'partial').length}</b></div>
      {list.map((u) => <div key={u.id} className="muted"><b>{u.done === 'complete' ? 'Fully done' : 'Partly done'}</b> · {u.job}{u.city ? `, ${u.city}` : ''} · {u.note} <ProofLink path={u.proof_path} /></div>)}
    </div>)}
  </>
}
