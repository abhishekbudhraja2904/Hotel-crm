import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDateTime } from '../lib/dates'
// Acknowledgement of work given to a service employee. The employee taps "Acknowledge"; admin, the giver and the service desk see whether it was seen.
export function useAcks() { return useQuery({ queryKey: ['acks'], refetchInterval: 60000, queryFn: async () => ((await supabase.rpc('work_ack_status')).data ?? {}) as Record<string, any> }) }
const ago = (t: string) => { const h = (Date.now() - +new Date(t)) / 36e5; return h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days` }
export default function AckBar({ kind, id }: { kind: 'packing' | 'repair' | 'installation' | 'ticket'; id: string }) {
  const qc = useQueryClient(), q = useAcks(), [err, setErr] = useState(''), [busy, setBusy] = useState(false), a = q.data?.[`${kind}:${id}`]
  if (!a) return null
  async function ack(e: React.MouseEvent) {
    e.stopPropagation(); setBusy(true); setErr('')
    const { error } = await supabase.rpc('acknowledge_work', { p_kind: kind, p_id: id }); setBusy(false)
    if (error) return setErr(error.message); qc.invalidateQueries({ queryKey: ['acks'] }); qc.invalidateQueries({ queryKey: ['notifications'] })
  }
  if (a.ack_at) return <div className="muted" style={{ color: '#3d6b46' }}>✓ Acknowledged{a.mine ? '' : ` by ${a.emp_name}`} · {fmtDateTime(a.ack_at)}</div>
  if (a.mine) return <div className="warnbox" style={{ display: 'grid', gap: 6 }} onClick={(e) => e.stopPropagation()}>
    <b>This work was given to you{a.by_name ? ` by ${a.by_name}` : ''} {ago(a.assigned_at)} ago.</b>
    <button className="primary bigbtn" disabled={busy} onClick={ack}>{busy ? 'Saving…' : '✅ Acknowledge: I have seen this'}</button>
    {err && <span className="msg">{err}</span>}</div>
  return <div style={{ color: '#9b3b30', fontWeight: 600, fontSize: 13 }}>⏳ Not acknowledged yet by {a.emp_name} · given {ago(a.assigned_at)} ago</div>
}
