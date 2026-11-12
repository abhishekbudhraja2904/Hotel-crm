import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDateTime } from '../lib/dates'
import { playHermora, startAlarm, unlockSound, soundOn, setSoundOn } from '../lib/sound'
const URGENT = ['packing', 'packing_reminder', 'packing_wait', 'collect', 'packing_cancelled']
const KEY = ['notifications']
const VAPID = 'BFBqiPeaizvU3ynOF2vBlZInVfmXqslg-Q-ppN2KDHM09BdRDu4KEAzGrnh7mkBuI7pX4FGSLsl2JUdeJ19qReM'
const b64 = (s: string) => { const p = '='.repeat((4 - (s.length % 4)) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))) }
function useNotes() {
  return useQuery({ queryKey: KEY, refetchInterval: 30000, refetchOnWindowFocus: true, queryFn: async () => { const { data } = await supabase.from('notifications').select('id,kind,title,body,created_at,read_at').order('created_at', { ascending: false }).limit(60); return (data as any[]) ?? [] } })
}
function useRead() { const qc = useQueryClient(); return async (ids: string[] | null) => { await supabase.rpc('mark_notifications_read', { p_ids: ids }); qc.invalidateQueries({ queryKey: KEY }) } }
// Turn phone notifications on or off for this phone / browser.
function PhoneToggle() {
  const ok = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  const [on, setOn] = useState(false), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { if (!ok) return; navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => setOn(!!s)).catch(() => {}) }, [ok])
  if (!ok) return <p className="muted">Phone notifications are not available in this browser. On iPhone, add the app to the Home Screen first (Share, then Add to Home Screen) and open it from there.</p>
  async function turnOn() {
    setBusy(true); setMsg('')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') throw new Error('Notifications are blocked. Allow them for this site in the browser settings.')
      const reg = await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID) }))
      const j: any = sub.toJSON()
      const { error } = await supabase.rpc('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth })
      if (error) throw error
      setOn(true); setMsg('Done. This phone will now get notifications.')
    } catch (e: any) { setMsg(e.message ?? 'Could not turn on') }
    setBusy(false)
  }
  async function turnOff() {
    setBusy(true); const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription()
    if (sub) { await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint }); await sub.unsubscribe() }
    setOn(false); setBusy(false); setMsg('Turned off on this phone.')
  }
  return <div className="okbox" style={{ display: 'grid', gap: 6 }}>
    <b>Phone notifications: {on ? 'ON' : 'OFF'}</b>
    {on ? <button disabled={busy} onClick={turnOff}>Turn off on this phone</button> : <button className="primary" disabled={busy} onClick={turnOn}>Turn on notifications</button>}
    {msg && <span className="muted">{msg}</span>}
  </div>
}
// Sound on/off and a test button, in the bell panel.
function SoundToggle() {
  const [on, setOn] = useState(soundOn())
  return <div className="okbox" style={{ display: 'grid', gap: 6 }}>
    <b>Alert sound: {on ? 'ON' : 'OFF'}</b>
    <div className="bar"><button onClick={() => { const v = !on; setSoundOn(v); setOn(v); if (v) { unlockSound(); playHermora(true) } }}>{on ? 'Turn sound off' : 'Turn sound on'}</button><button onClick={() => { unlockSound(); playHermora(true) }}>Test sound</button></div>
    <span className="muted">Plays while Hermora is open. Phone alerts when the app is closed use the phone's own notification sound.</span>
  </div>
}
const tone = (k: string) => (k === 'paid' ? '#6B8F72' : k === 'collect' ? '#3f6b4a' : '#8A6F52')
// The bell in the top bar: every alert is kept here, newest first.
export function Bell() {
  const { data } = useNotes(), read = useRead(), [open, setOpen] = useState(false)
  const unread = (data ?? []).filter((n) => !n.read_at).length
  return <>
    <button aria-label="Notifications" onClick={() => setOpen(true)} style={{ position: 'relative', fontSize: 20, padding: '0 8px', background: 'none', color: 'inherit', border: 0, marginLeft: 8 }}>🔔{unread > 0 && <span style={{ position: 'absolute', top: -6, right: -2, background: '#9b3b30', color: '#fff', borderRadius: 10, fontSize: 11, padding: '1px 6px', fontWeight: 700 }}>{unread}</span>}</button>
    {open && <div className="modal" onClick={() => setOpen(false)}><div className="card" onClick={(e) => e.stopPropagation()}>
      <div className="row"><h3 style={{ margin: 0 }}>Notifications</h3>{unread > 0 && <button className="link" onClick={() => read(null)}>Mark all as read</button>}</div>
      <PhoneToggle />
      <SoundToggle />
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
      playHermora()
    }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [qc])
  const fresh = (data ?? []).filter((n) => !n.read_at && Date.now() - new Date(n.created_at).getTime() < 24 * 3600 * 1000)
  const a = fresh[0]
  // Allow sound after the first tap anywhere; urgent alerts keep ringing every few seconds until OK is pressed.
  useEffect(() => { const u = () => unlockSound(); window.addEventListener('pointerdown', u, { once: true }); return () => window.removeEventListener('pointerdown', u) }, [])
  useEffect(() => {
    if (!a || document.visibilityState === 'hidden') return
    if (URGENT.includes(a.kind)) return startAlarm()
    playHermora()
  }, [a?.id])
  if (!a) return null
  return <div className="modal" style={{ zIndex: 30 }}><div className="card">
    <span className={`pill${a.kind === 'paid' || a.kind === 'collect' || a.kind === 'packing_done' ? '' : ' Urgent'}`} style={{ justifySelf: 'start' }}>{a.kind === 'paid' ? 'Payment' : a.kind === 'collect' ? 'Collect' : a.kind === 'packing_reminder' ? 'Reminder' : a.kind === 'packing_wait' ? 'Packing pending' : a.kind === 'packing_done' ? 'Packing done' : a.kind === 'packing_cancelled' ? 'Packing cancelled' : 'New work'}</span>
    <h3 style={{ margin: 0 }}>{a.title}</h3>{a.body && <div>{a.body}</div>}
    {a.kind === 'packing' && <div className="warnbox">Pack the items and mark every carton with the packing number.</div>}
    {a.kind === 'packing_reminder' && <div className="warnbox">Packing is still not marked done. When you finish, open Inventory and tap "Packing done". These reminders repeat until you do.</div>}
    {a.kind === 'packing_cancelled' && <div className="warnbox">Stop. Do not pack or dispatch this order. Sales will assign it again if needed.</div>}
    {a.kind === 'packing_wait' && <div className="warnbox">The packing you assigned is not done yet. You will be reminded again until it is marked done.</div>}
    {fresh.length > 1 && <div className="muted">{fresh.length - 1} more waiting in the bell</div>}
    <button className="primary" onClick={() => read([a.id])}>OK, seen</button></div></div>
}
