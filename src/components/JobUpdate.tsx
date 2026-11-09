import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { isoDate } from '../lib/dates'
import DateField from './DateField'
export function ProofLink({ path }: { path?: string | null }) {
  const [err, setErr] = useState('')
  if (!path) return null
  async function open() { const { data, error } = await supabase.storage.from('proofs').createSignedUrl(path!, 300); if (error || !data) return setErr('Could not open the photo'); window.open(data.signedUrl, '_blank') }
  return <><button className="link" onClick={(e) => { e.stopPropagation(); open() }}>View photo proof</button>{err && <span className="msg"> {err}</span>}</>
}
export function UpdateList({ list }: { list?: any[] }) {
  if (!list?.length) return null
  return <div style={{ display: 'grid', gap: 4 }}>{[...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).map((u) => <div key={u.id} className="muted"><b>{u.done === 'complete' ? 'Fully done' : 'Partly done'}</b> · {String(u.update_date).split('-').reverse().join('/')} · {u.note} <ProofLink path={u.proof_path} /></div>)}</div>
}
// The technician marks a job partly or fully done, .
export default function JobUpdate({ me, inst, ticket, box, title, onClose, onDone }: { me: any; inst?: string; ticket?: string; box?: string; title: string; onClose: () => void; onDone: () => void }) {
  const [done, setDone] = useState<'partial' | 'complete'>('complete'), [note, setNote] = useState(''), [day, setDay] = useState(isoDate()), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    setBusy(true)
    const { error } = await supabase.rpc('add_job_update', { p_inst: inst ?? null, p_ticket: ticket ?? null, p_box: box ?? null, p_done: done, p_note: note, p_proof: null, p_date: day || isoDate() })
    setBusy(false); if (error) return setErr(error.message); onDone(); onClose()
  }
  return <div className="modal"><form className="card" onSubmit={save}><h3 style={{ margin: 0 }}>Update work</h3><div className="muted">{title}</div>
    <div className="bar"><button type="button" className={done === 'partial' ? 'primary' : ''} onClick={() => setDone('partial')}>Partly done</button><button type="button" className={done === 'complete' ? 'primary' : ''} onClick={() => setDone('complete')}>Fully done</button></div>
    <label>Date of this work<DateField value={day} onChange={setDay} ariaLabel="Date of work" /></label>
    <label>What was done?<textarea required rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Example: 12 of 20 locks fitted, rooms 101 to 112" /></label>
    {err && <p className="msg">{err}</p>}<button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save update'}</button><button type="button" className="link" onClick={onClose}>Cancel</button></form></div>
}
