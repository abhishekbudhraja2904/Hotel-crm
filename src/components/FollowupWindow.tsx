import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDateTime } from '../lib/dates'
import { useSettings } from '../lib/settings'
import { tempOf, TEMP_LOOK } from '../lib/temperature'
// A window on top of the dashboard (not a tab): follow-ups that are due and follow-ups already done,
// with the customer's key details. Sales see their own; the admin sees everyone's and can pick a person.
const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const INQ = 'inquiries(inquiry_number,inquiry_title,sales_stage,needed_by,inquiry_source,customers(customer_name,phone_number,city))'
export default function FollowupWindow({ me, start, onClose }: { me: any; start: 'late' | 'today'; onClose: () => void }) {
  const cfg = useSettings(), isAdmin = me?.role === 'admin'
  const [tab, setTab] = useState<'due' | 'done'>('due'), [emp, setEmp] = useState(''), [only, setOnly] = useState<'' | 'late' | 'today'>(start)
  const { data: emps = [] } = useQuery({ queryKey: ['employees', 'fu-window'], enabled: isAdmin, queryFn: async () => (await supabase.from('employees').select('id,employee_name').eq('active', true).in('role', ['admin', 'sales']).order('employee_name')).data ?? [] })
  const due = useQuery({ queryKey: ['followups', 'window-due'], queryFn: async () => {
    const { data, error } = await supabase.from('followups').select(`id,inquiry_id,assigned_to,followup_type,scheduled_at,notes,assigned:employees!assigned_to(employee_name),${INQ}`).eq('status', 'Pending').order('scheduled_at'); if (error) throw error; return data as any[] } })
  const done = useQuery({ queryKey: ['followups', 'window-done'], queryFn: async () => {
    const { data, error } = await supabase.from('followups').select(`id,inquiry_id,assigned_to,followup_type,outcome,completed_at,scheduled_at,notes,assigned:employees!assigned_to(employee_name),${INQ}`).eq('status', 'Completed').order('completed_at', { ascending: false }).limit(150); if (error) throw error; return data as any[] } })
  const now = Date.now(), end = new Date().setHours(23, 59, 59, 999)
  const mine = (r: any) => !emp || r.assigned_to === emp
  const lastOutcome = new Map<string, any>(); for (const d of done.data ?? []) if (!lastOutcome.has(d.inquiry_id)) lastOutcome.set(d.inquiry_id, d)
  // "Due" = overdue + today (upcoming ones are not due yet)
  const late = (due.data ?? []).filter((r) => mine(r) && +new Date(r.scheduled_at) < now)
  const today = (due.data ?? []).filter((r) => mine(r) && +new Date(r.scheduled_at) >= now && +new Date(r.scheduled_at) <= end)
  const doneRows = (done.data ?? []).filter(mine)
  const Who = ({ r }: { r: any }) => { const q = one(r.inquiries), c = one(q?.customers), t = q?.needed_by ? tempOf(q.needed_by, cfg.tempHotDays, cfg.tempWarmDays) : 'None', look = TEMP_LOOK[t]
    return <>
      <div className="row"><b>{c?.customer_name ?? 'Customer'}</b><span className="muted">{q?.inquiry_number}</span></div>
      <div className="whofor" style={{ padding: '4px 10px' }}>{c?.phone_number && <a href={`tel:${c.phone_number}`}>📞 {c.phone_number}</a>}{c?.city && <span>📍 {c.city}</span>}
        {look && <span className="pill" style={{ background: look.bg, color: look.fg }}>{look.icon} {t}</span>}</div>
      <div className="muted">{[q?.inquiry_title, q?.sales_stage, q?.needed_by ? `needed by ${new Date(q.needed_by + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : '', q?.inquiry_source].filter(Boolean).join(' · ')}</div>
      {isAdmin && <div className="muted">Assigned: {one(r.assigned)?.employee_name ?? 'Unassigned'}</div>}
    </> }
  const dueCard = (r: any, isLate: boolean) => { const last = lastOutcome.get(r.inquiry_id)
    return <div className="card" key={r.id} style={{ margin: 0, borderLeftColor: isLate ? '#b3261e' : undefined }}>
      <Who r={r} />
      <div className="muted">{r.followup_type} · <b style={isLate ? { color: '#b3261e' } : {}}>{isLate ? 'Overdue · ' : ''}{fmtDateTime(r.scheduled_at)}</b>{r.notes ? ` · ${r.notes}` : ''}</div>
      {last && <div className="muted">Last follow-up: <b>{last.outcome ?? 'Done'}</b> · {fmtDateTime(last.completed_at)}</div>}
    </div> }
  const loading = due.isLoading || done.isLoading, err = (due.error || done.error) as any
  return <div className="modal" onClick={onClose}><div className="card" style={{ maxWidth: 560, display: 'grid', gap: 10 }} onClick={(e) => e.stopPropagation()}>
    <div className="row"><h3 style={{ margin: 0 }}>Follow-ups</h3><button className="link" onClick={onClose}>Close ✕</button></div>
    {isAdmin && <select value={emp} onChange={(e) => setEmp(e.target.value)}><option value="">All staff</option>{emps.map((x: any) => <option key={x.id} value={x.id}>{x.employee_name}</option>)}</select>}
    <div className="bar"><button className={tab === 'due' ? 'primary' : ''} onClick={() => setTab('due')}>Due ({late.length + today.length})</button><button className={tab === 'done' ? 'primary' : ''} onClick={() => setTab('done')}>Done ({doneRows.length})</button></div>
    {loading && <p className="empty">Loading…</p>}{err && <p className="msg">{err.message}</p>}
    {tab === 'due' && !loading && <>
      <div className="bar"><button className={only === '' ? 'primary' : ''} onClick={() => setOnly('')}>All due</button><button className={only === 'late' ? 'primary' : ''} onClick={() => setOnly('late')}>Overdue ({late.length})</button><button className={only === 'today' ? 'primary' : ''} onClick={() => setOnly('today')}>Today ({today.length})</button></div>
      {only !== 'today' && late.map((r) => dueCard(r, true))}
      {only !== 'late' && today.map((r) => dueCard(r, false))}
      {!(only === 'late' ? late : only === 'today' ? today : [...late, ...today]).length && <p className="empty">Nothing due. 🎉</p>}
    </>}
    {tab === 'done' && !loading && <>
      {doneRows.map((d) => <div className="card" key={d.id} style={{ margin: 0 }}><Who r={d} />
        <div className="muted">{d.followup_type} · Result: <b>{d.outcome ?? 'Done'}</b> · {fmtDateTime(d.completed_at)}{d.notes ? ` · ${d.notes}` : ''}</div></div>)}
      {!doneRows.length && <p className="empty">No follow-ups done yet.</p>}
      {(done.data ?? []).length >= 150 && <div className="muted">Showing the latest 150.</div>}
    </>}
  </div></div>
}
