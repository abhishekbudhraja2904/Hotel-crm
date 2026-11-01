import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
const TYPES = ['Phone Call', 'WhatsApp', 'Email', 'Meeting', 'Site Visit', 'Internal Task', 'Other']
const at10 = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(10, 0, 0, 0); return d }
const local = (d: Date) => { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }
// Pop-up used to put the next follow-up on an inquiry: after a follow-up is Done, and from the "+ Follow-up" button on an inquiry.
export default function ScheduleFollowup({ me, inquiryId, assignedTo, title, subtitle, canSkip, onClose }:
  { me: any; inquiryId: string; assignedTo: string | null; title: string; subtitle?: string; canSkip?: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [when, setWhen] = useState(local(at10(3))), [type, setType] = useState('Phone Call'), [notes, setNotes] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function save() {
    const d = new Date(when); if (!when || isNaN(+d)) return setErr('Pick a date and time.')
    if (+d < Date.now() - 60000) return setErr('That time is in the past.')
    setBusy(true); setErr('')
    const { error } = await supabase.from('followups').insert({ inquiry_id: inquiryId, assigned_to: assignedTo || me.id, followup_type: type, scheduled_at: d.toISOString(), notes: notes || null, created_by: me.id })
    setBusy(false); if (error) return setErr(error.message)
    qc.invalidateQueries({ queryKey: ['followups'] }); qc.invalidateQueries({ queryKey: ['inquiries'] }); onClose()
  }
  const quick: [string, number][] = [['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7]]
  return (
    <div className="modal"><div className="card">
      <h3 style={{ margin: 0 }}>{title}</h3>
      {subtitle && <div className="muted">{subtitle}</div>}
      <div className="bar">{quick.map(([l, n]) => <button type="button" key={l} className={when === local(at10(n)) ? 'primary' : ''} onClick={() => setWhen(local(at10(n)))}>{l}</button>)}</div>
      <label>Date and time<input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
      <label>How<select value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label>Note (optional)<input value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      {err && <p className="msg">{err}</p>}
      <button className="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Schedule follow-up'}</button>
      <button className="link" onClick={onClose}>{canSkip ? 'No more follow-ups needed' : 'Cancel'}</button>
    </div></div>
  )
}
