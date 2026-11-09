import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useEmps } from './Pickers'
// A service employee who cannot do a job hands it to another service employee. Admin and service admin can do it too.
export function HandOverButton({ me, kind, id, currentId, title }: { me: any; kind: 'installation' | 'ticket' | 'repair' | 'packing'; id: string; currentId?: string | null; title: string }) {
  const [open, setOpen] = useState(false)
  const may = me.role === 'admin' || me.role === 'service_admin' || (me.role === 'service' && currentId === me.id)
  if (!may) return null
  return <>
    <button onClick={(e) => { e.stopPropagation(); setOpen(true) }}>Give to another employee</button>
    {open && <HandOver kind={kind} id={id} currentId={currentId} title={title} onClose={() => setOpen(false)} />}
  </>
}
function HandOver({ kind, id, currentId, title, onClose }: { kind: string; id: string; currentId?: string | null; title: string; onClose: () => void }) {
  const qc = useQueryClient(), emps = useEmps(), [to, setTo] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const { error } = await supabase.rpc('reassign_work', { p_kind: kind, p_id: id, p_to: to })
    setBusy(false); if (error) return setErr(error.message)
    for (const k of ['aftersales', 'inventory', 'service-team', 'notifications']) qc.invalidateQueries({ queryKey: [k] })
    onClose()
  }
  return <div className="modal" onClick={(e) => e.stopPropagation()}><form className="card" onSubmit={go}><h3 style={{ margin: 0 }}>Give this work to someone else</h3><div className="muted">{title}</div>
    <p className="muted" style={{ margin: 0 }}>Use this when you are not available. The other person is told at once, and the work leaves your list.</p>
    <label>Give to<select required value={to} onChange={(e) => setTo(e.target.value)}><option value="">Choose…</option>{emps.data?.filter((x: any) => x.id !== currentId).map((x: any) => <option key={x.id} value={x.id}>{x.employee_name}</option>)}</select></label>
    {err && <p className="msg">{err}</p>}<button className="primary" disabled={busy || !to}>{busy ? 'Saving…' : 'Give the work'}</button><button type="button" className="link" onClick={onClose}>Cancel</button></form></div>
}
