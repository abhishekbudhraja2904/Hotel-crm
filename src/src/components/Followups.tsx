import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import ScheduleFollowup from './ScheduleFollowup'
import WhoFor from './WhoFor'
import { DateTimeField } from './DateField'
import { fmtDateTime, isoLocal } from '../lib/dates'
const OUTCOMES = ['Connected','No Response','Interested','Not Interested','Requested More Information','Quotation Requested','Approval Pending','Other']
export default function Followups({ me }: { me: any }) {
  const qc = useQueryClient()
  const [msg, setMsg] = useState(''), [next, setNext] = useState<any>(null), [resFor, setResFor] = useState<any>(null), [resWhen, setResWhen] = useState(''), [outcome, setOutcome] = useState<Record<string, string>>({})
  const { data = [], isLoading } = useQuery({
    queryKey: ['followups'],
    queryFn: async () => {
      const { data, error } = await supabase.from('followups')
        .select('id,inquiry_id,assigned_to,followup_type,scheduled_at,status,notes,updated_at,inquiries(inquiry_number,customers(customer_name,phone_number))')
        .eq('status', 'Pending').order('scheduled_at')
      if (error) throw error
      return data
    }
  })
  async function complete(r: any) {
    const { data, error } = await supabase.from('followups')
      .update({ status: 'Completed', completed_at: new Date().toISOString(), outcome: outcome[r.id] || 'Connected' })
      .eq('id', r.id).eq('updated_at', r.updated_at).select('id')
    setMsg(error ? error.message : !data?.length ? 'This follow-up was already changed by someone else.' : '')
    qc.invalidateQueries({ queryKey: ['followups'] })
    if (!error && data?.length) setNext(r)
  }
  function reschedule(r: any) { const d = new Date(r.scheduled_at); d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0); setResWhen(isoLocal(+d < Date.now() ? new Date(Date.now() + 36e5) : d)); setResFor(r) }
  async function saveReschedule() {
    const d = new Date(resWhen); if (isNaN(+d)) return setMsg('Invalid date.')
    const { error } = await supabase.from('followups').update({ scheduled_at: d.toISOString() }).eq('id', resFor.id)
    setMsg(error ? error.message : ''); setResFor(null); qc.invalidateQueries({ queryKey: ['followups'] })
  }
  async function cancel(r: any) {
    if (!confirm('Cancel this follow-up?')) return
    const { error } = await supabase.from('followups').update({ status: 'Cancelled' }).eq('id', r.id)
    if (error) setMsg(error.message)
  }
  const now = Date.now(), end = new Date().setHours(23, 59, 59, 999)
  const group = (name: string, rows: any[]) => rows.length > 0 && (
    <div><h3>{name} ({rows.length})</h3>{rows.map((r) => (
      <div className="card" key={r.id}>
        <div className="row"><b>{r.inquiries?.customers?.customer_name}</b><span className="muted">{r.inquiries?.inquiry_number}</span></div>
        <div className="muted">{r.followup_type} · {fmtDateTime(r.scheduled_at)} {r.notes && `· ${r.notes}`}</div>
        <div className="row">
          <select value={outcome[r.id] || 'Connected'} onChange={(e) => setOutcome({ ...outcome, [r.id]: e.target.value })}>{OUTCOMES.map((o) => <option key={o}>{o}</option>)}</select>
          <button className="primary" onClick={() => complete(r)}>Done</button>
        </div>
        <div className="row"><button className="link" onClick={() => reschedule(r)}>Reschedule</button><button className="link" onClick={() => cancel(r)}>Cancel</button></div>
      </div>))}</div>)
  return (
    <section>
      {msg && <p className="msg">{msg}</p>}
      {next && <ScheduleFollowup me={me} inquiryId={next.inquiry_id} assignedTo={next.assigned_to} canSkip title="Done. When is the next follow-up?" who={next.inquiries?.customers} onClose={() => setNext(null)} />}
      {resFor && <div className="modal"><div className="card"><h3 style={{ margin: 0 }}>Reschedule follow-up</h3><WhoFor c={resFor.inquiries?.customers} />
        <label>New date and time<DateTimeField value={resWhen} onChange={setResWhen} /></label>
        <button className="primary" onClick={saveReschedule}>Save</button><button className="link" onClick={() => setResFor(null)}>Cancel</button></div></div>}
      {isLoading && <p>Loading…</p>}
      {!isLoading && !data.length && <p className="empty">No pending follow-ups. 🎉</p>}
      {group('Overdue', data.filter((r: any) => +new Date(r.scheduled_at) < now))}
      {group('Today', data.filter((r: any) => +new Date(r.scheduled_at) >= now && +new Date(r.scheduled_at) <= end))}
      {group('Upcoming', data.filter((r: any) => +new Date(r.scheduled_at) > end))}
    </section>
  )
}
