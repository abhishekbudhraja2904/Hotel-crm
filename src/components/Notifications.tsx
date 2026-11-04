import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDateTime } from '../lib/dates'
const KEY = ['notifications']
function useNotes() {
  return useQuery({ queryKey: KEY, refetchInterval: 30000, refetchOnWindowFocus: true, queryFn: async () => { const { data } = await supabase.from('notifications').select('id,kind,title,body,created_at,read_at').order('created_at', { ascending: false }).limit(60); return (data as any[]) ?? [] } })
}
function useRead() { const qc = useQueryClient(); return async (ids: string[] | null) => { await supabase.rpc('mark_notifications_read', { p_ids: ids }); qc.invalidateQueries({ queryKey: KEY }) } }
const tone = (k: string) => (k === 'paid' ? '#6B8F72' : k === 'collect' ? '#3f6b4a' : '#8A6F52')
// The bell in the top bar: every alert is kept here, newest first.
export function Bell() {
  const { data } = useNotes(), read = useRead(), [open, setOpen] = useState(false)
  const unread = (data ?? []).filter((n) => !n.read_at).length
  return <>
    <button aria-label="Notifications" onClick={() => setOpen(true)} style={{ position: 'relative', fontSize: 20, padding: '0 8px', background: 'none', border: 0, marginLeft: 'auto' }}>🔔{unread > 0 && <span style={{ position: 'absolute', top: -6, right: -2, background: '#9b3b30', color: '#fff', borderRadius: 10, fontSize: 11, padding: '1px 6px', fontWeight: 700 }}>{unread}</span>}</button>
    {open && <div className="modal" onClick={() => setOpen(false)}><div className="card" onClick={(e) => e.stopPropagation()}>
      <div className="row"><h3 style={{ margin: 0 }}>Notifications</h3>{unread > 0 && <button className="link" onClick={() => read(null)}>Mark all as read</button>}</div>
      {data && !data.length && <p className="empty">Nothing yet.</p>}
      {data?.map((n) => <div key={n.id} className="card" style={{ borderLeftColor: tone(n.kind), opacity: n.read_at ? 0.65 : 1 }} onClick={() => !n.read_at && read([n.id])}>
        <b>{n.title}</b>{n.body && <div className="muted">{n.body}</div>}<div className="muted">{fmtDateTime(n.created_at)}{n.read_at ? '' : ' · new'}</div></div>)}
      <button className="link" onClick={() => setOpen(false)}>Close</button></div></div>}
  </>
}
// A pop-up for the newest unread alert from the last day. After "OK" it is marked read and never pops up again, on any device.
export function NotifyPopup() {
  const { data } = useNotes(), read = useRead(), qc = useQueryClient()
  // Instant: the moment a notification is saved for me, refresh the bell and the packing cards (no waiting for the 30-second check).
  useEffect(() => {
    const ch = supabase.channel('my-notifications').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
      qc.invalidateQueries({ queryKey: KEY }); qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['aftersales'] })
    }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [qc])
  const fresh = (data ?? []).filter((n) => !n.read_at && Date.now() - new Date(n.created_at).getTime() < 24 * 3600 * 1000)
  const a = fresh[0]
  if (!a) return null
  return <div className="modal" style={{ zIndex: 30 }}><div className="card">
    <span className={`pill${a.kind === 'paid' || a.kind === 'collect' ? '' : ' Urgent'}`} style={{ justifySelf: 'start' }}>{a.kind === 'paid' ? 'Payment' : a.kind === 'collect' ? 'Collect' : 'New work'}</span>
    <h3 style={{ margin: 0 }}>{a.title}</h3>{a.body && <div>{a.body}</div>}
    {a.kind === 'packing' && <div className="warnbox">Pack the items and mark every carton with the packing number.</div>}
    {fresh.length > 1 && <div className="muted">{fresh.length - 1} more waiting in the bell</div>}
    <button className="primary" onClick={() => read([a.id])}>OK, seen</button></div></div>
}
