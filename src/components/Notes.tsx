import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDateTime } from '../lib/dates'

// Notes on an inquiry (table inquiry_notes) or on a service ticket (table ticket_notes).
export default function Notes({ kind, id, title, me, canAdd = true, onClose }: { kind: 'inquiry' | 'ticket'; id: string; title: string; me: any; canAdd?: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const table = kind === 'inquiry' ? 'inquiry_notes' : 'ticket_notes', col = kind === 'inquiry' ? 'inquiry_id' : 'ticket_id'
  const [text, setText] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const { data = [], isLoading } = useQuery({ queryKey: ['notes', kind, id], queryFn: async () => (await supabase.from(table).select('id,body,created_at,author:employees!created_by(employee_name)').eq(col, id).order('created_at', { ascending: false })).data ?? [] })
  async function add() {
    if (!text.trim()) return
    setBusy(true); setErr('')
    const { error } = await supabase.from(table).insert({ [col]: id, body: text.trim(), created_by: me.id })
    setBusy(false)
    if (error) return setErr(error.message)
    setText(''); qc.invalidateQueries({ queryKey: ['notes', kind, id] }); qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['notes-count'] })
  }
  return (
    <div className="modal"><div className="card">
      <h3 style={{ margin: 0 }}>Notes</h3>
      <div className="muted">{title}</div>
      {canAdd && <>
        <textarea rows={3} placeholder="Write a note…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="primary" disabled={busy || !text.trim()} onClick={add}>{busy ? 'Saving…' : 'Add note'}</button>
      </>}
      {err && <p className="msg">{err}</p>}
      {isLoading && <p>Loading…</p>}
      {!isLoading && !data.length && <p className="empty">No notes yet.</p>}
      {data.map((n: any) => <div key={n.id} className="card" style={{ margin: 0 }}>
        <div style={{ whiteSpace: 'pre-wrap' }}>{n.body}</div>
        <div className="muted">{n.author?.employee_name ?? '—'} · {fmtDateTime(n.created_at)}</div>
      </div>)}
      <button className="link" onClick={onClose}>Close</button>
    </div></div>
  )
}
