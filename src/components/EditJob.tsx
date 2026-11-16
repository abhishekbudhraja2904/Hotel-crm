import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

// Edit the details of an installation, a service ticket or a repair box.
export default function EditJob({ kind, row, onClose }: { kind: 'installation' | 'ticket' | 'repair'; row: any; onClose: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState<any>(kind === 'ticket'
    ? { title: row.title ?? '', details: row.details ?? '', priority: row.priority ?? 'Medium', site: row.site_name ?? '' }
    : kind === 'installation'
      ? { site: row.site_name ?? '', what: row.what ?? '', notes: row.notes ?? '' }
      : { name: row.customer_name ?? '', city: row.city ?? '', courier: row.courier ?? '', notes: row.notes ?? '' })
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    let error: any = null
    if (kind === 'ticket') {
      if (!f.title.trim() || !f.site.trim()) { setBusy(false); return setErr('Title and site are needed.') }
      ;({ error } = await supabase.from('service_tickets').update({ title: f.title.trim(), details: f.details.trim() || null, priority: f.priority, site_name: f.site.trim() }).eq('id', row.id))
    } else if (kind === 'installation') {
      if (!f.site.trim()) { setBusy(false); return setErr('Site name is needed.') }
      ;({ error } = await supabase.from('installations').update({ site_name: f.site.trim(), what: f.what.trim() || null, notes: f.notes.trim() || null }).eq('id', row.id))
    } else {
      ;({ error } = await supabase.rpc('edit_repair_box', { p_id: row.id, p_name: f.name, p_city: f.city, p_courier: f.courier, p_notes: f.notes }))
    }
    setBusy(false)
    if (error) return setErr(error.message)
    qc.invalidateQueries({ queryKey: ['aftersales'] }); onClose()
  }
  return (
    <div className="modal"><form className="card" onSubmit={save}>
      <h3 style={{ margin: 0 }}>{kind === 'ticket' ? 'Edit service ticket' : kind === 'installation' ? 'Edit installation' : 'Edit repair box'}</h3>
      {kind === 'ticket' && <>
        <label>Title<input value={f.title} onChange={set('title')} /></label>
        <label>Site<input value={f.site} onChange={set('site')} /></label>
        <label>Details<textarea rows={3} value={f.details} onChange={set('details')} /></label>
        <label>Priority<select value={f.priority} onChange={set('priority')}><option>Low</option><option>Medium</option><option>High</option></select></label>
      </>}
      {kind === 'installation' && <>
        <label>Site<input value={f.site} onChange={set('site')} /></label>
        <label>What is to be done<input value={f.what} onChange={set('what')} /></label>
        <label>Notes<textarea rows={3} value={f.notes} onChange={set('notes')} /></label>
      </>}
      {kind === 'repair' && <>
        <label>Customer<input value={f.name} onChange={set('name')} /></label>
        <label>City<input value={f.city} onChange={set('city')} /></label>
        <label>Courier / docket<input value={f.courier} onChange={set('courier')} /></label>
        <label>Notes<textarea rows={3} value={f.notes} onChange={set('notes')} /></label>
      </>}
      {err && <p className="msg">{err}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      <button type="button" className="link" onClick={onClose}>Cancel</button>
    </form></div>
  )
}
