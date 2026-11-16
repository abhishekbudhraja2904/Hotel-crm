import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import ScheduleFollowup from './ScheduleFollowup'
import WhoFor from './WhoFor'
import { DateTimeField } from './DateField'
import { fmtDateTime, isoLocal } from '../lib/dates'
import { useSettings } from '../lib/settings'

// The pending follow-up of one inquiry, shown on the inquiry card itself (replaces the old Follow-ups screen).
export default function FollowupInline({ me, inquiry, f, last }: { me: any; inquiry: any; f: any; last?: any }) {
  const qc = useQueryClient(), { outcomes: OUTCOMES } = useSettings()
  const [outcome, setOutcome] = useState('Connected'), [msg, setMsg] = useState(''), [next, setNext] = useState(false), [res, setRes] = useState(false), [when, setWhen] = useState('')
  const refresh = () => { qc.invalidateQueries({ queryKey: ['followups'] }); qc.invalidateQueries({ queryKey: ['inquiries'] }) }
  const late = +new Date(f.scheduled_at) < Date.now(), today = !late && new Date(f.scheduled_at).toDateString() === new Date().toDateString()
  async function complete() {
    const { data, error } = await supabase.from('followups').update({ status: 'Completed', completed_at: new Date().toISOString(), outcome }).eq('id', f.id).eq('updated_at', f.updated_at).select('id')
    setMsg(error ? error.message : !data?.length ? 'This follow-up was already changed by someone else.' : '')
    refresh(); if (!error && data?.length) setNext(true)
  }
  function openRes() { const d = new Date(f.scheduled_at); d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0); setWhen(isoLocal(+d < Date.now() ? new Date(Date.now() + 36e5) : d)); setRes(true) }
  async function saveRes() {
    const d = new Date(when); if (isNaN(+d)) return setMsg('Invalid date.')
    const { error } = await supabase.from('followups').update({ scheduled_at: d.toISOString() }).eq('id', f.id)
    setMsg(error ? error.message : ''); setRes(false); refresh()
  }
  async function cancel() {
    if (!confirm('Cancel this follow-up?')) return
    const { error } = await supabase.from('followups').update({ status: 'Cancelled' }).eq('id', f.id)
    if (error) setMsg(error.message); refresh()
  }
  return (
    <div style={{ background: late ? '#fde2e2' : today ? '#fff4d6' : '#f1f4ee', borderRadius: 10, padding: 10, display: 'grid', gap: 6 }}>
      <div><b>{late ? '⚠ Follow-up overdue' : today ? 'Follow-up today' : 'Next follow-up'}</b> · {f.followup_type} · {fmtDateTime(f.scheduled_at)}</div>
      {f.notes && <div className="muted">{f.notes}</div>}
      {last && <div className="muted">Last follow-up: <b>{last.outcome ?? 'Done'}</b> · {fmtDateTime(last.completed_at)}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
        <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>{OUTCOMES.map((o: string) => <option key={o}>{o}</option>)}</select>
        <button className="primary" onClick={complete}>Done</button>
      </div>
      <div style={{ display: 'flex', gap: 14 }}><button className="link" onClick={openRes}>Reschedule</button><button className="link" onClick={cancel}>Cancel</button></div>
      {msg && <p className="msg">{msg}</p>}
      {next && <ScheduleFollowup me={me} inquiryId={f.inquiry_id} assignedTo={f.assigned_to} canSkip title="Done. When is the next follow-up?" who={inquiry.customers} onClose={() => setNext(false)} />}
      {res && <div className="modal"><div className="card"><h3 style={{ margin: 0 }}>Reschedule follow-up</h3><WhoFor c={inquiry.customers} />
        <label>New date and time<DateTimeField value={when} onChange={setWhen} /></label>
        <button className="primary" onClick={saveRes}>Save</button><button className="link" onClick={() => setRes(false)}>Cancel</button></div></div>}
    </div>
  )
}
