import { useState } from 'react'
import { useSettings } from '../lib/settings'
// Asks why an inquiry was lost, then hands the answer back to be saved together with the stage change.
export default function LostReason({ title, onSave, onClose }: { title: string; onSave: (reason: string, note: string) => Promise<string | null>; onClose: () => void }) {
  const { lostReasons: LOST_REASONS } = useSettings()
  const [picked, setReason] = useState(''), reason = picked || LOST_REASONS[0], [note, setNote] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function save() { setBusy(true); setErr(''); const e = await onSave(reason, note.trim()); setBusy(false); if (e) setErr(e); else onClose() }
  return (
    <div className="modal"><div className="card">
      <h3 style={{ margin: 0 }}>Why was this lost?</h3>
      <div className="muted">{title}</div>
      {LOST_REASONS.map((r) => <label key={r} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 15, color: 'inherit' }}>
        <input type="radio" name="lost" style={{ width: 18, height: 18, padding: 0 }} checked={reason === r} onChange={() => setReason(r)} />{r}</label>)}
      <label>Short note (optional)<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
      {err && <p className="msg">{err}</p>}
      <button className="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save as Lost'}</button>
      <button className="link" onClick={onClose}>Cancel (keep current stage)</button>
    </div></div>
  )
}
