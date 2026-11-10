import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDateTime } from '../lib/dates'

// "Customer app" box: the customer's app ID, WhatsApp invite, PIN reset, phones,
// and who the customer sees as their OFORTT contact. Admin + Sales (checked again in the database).
export default function CustomerApp({ customerId, name, isAdmin, onClose }: { customerId: string; name: string; isAdmin?: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [sent, setSent] = useState<any>(null)
  const st = useQuery({
    queryKey: ['customer-app', customerId],
    queryFn: async () => { const { data, error } = await supabase.rpc('customer_app_status', { p_customer: customerId }); if (error) throw error; return data as any }
  })
  const staff = useQuery({
    queryKey: ['employees', 'contacts'], enabled: !!isAdmin,
    queryFn: async () => (await supabase.from('employees').select('id,employee_name,phone').eq('active', true).order('employee_name')).data ?? []
  })
  const s = st.data

  async function invite() {
    if (s?.invited && !confirm(`Send ${name} a NEW PIN? Their old PIN will stop working, and you become their contact in the app.`)) return
    setBusy(true); setMsg(''); setSent(null)
    const { data, error } = await supabase.functions.invoke('invite-customer', { body: { customer_id: customerId } })
    setBusy(false)
    if (error || data?.error) {
      let m = data?.error || error!.message
      try { const b = await (error as any)?.context?.json?.(); if (b?.error) m = b.error } catch { /* ignore */ }
      return setMsg(m)
    }
    setSent(data); st.refetch()
    if (!data.sender_has_phone) setMsg('Your WhatsApp number is not saved in Team, so this customer will see the office backup number. Ask the admin to add it.')
    window.open(waLink(data.phone, data.message), '_blank')
  }

  async function removeDevice(d: any) {
    if (!confirm(`Remove "${d.label || 'this phone'}"? It will be signed out of the app.`)) return
    const { error } = await supabase.rpc('staff_remove_customer_device', { p_device: d.id })
    setMsg(error ? error.message : 'Phone removed. They can now sign in on another phone.'); st.refetch()
  }

  async function changeContact(empId: string) {
    const { error } = await supabase.rpc('staff_set_customer_contact', { p_customer: customerId, p_employee: empId || null })
    setMsg(error ? error.message : 'Contact changed. The customer sees it next time they open the app.'); st.refetch()
  }

  return (
    <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card">
        <div className="row"><h3 style={{ margin: 0 }}>Customer app</h3><button className="link" onClick={onClose}>Close</button></div>
        <div className="muted">{name}</div>
        {st.isLoading && <p>Loading…</p>}
        {st.error && <p className="msg">{(st.error as any).message}</p>}
        {s && !s.ok && <p className="msg">Only admin or the sales person handling this customer can manage their app.</p>}
        {s?.ok && <>
          <div className="row" style={{ alignItems: 'center' }}>
            <div><div className="muted">Customer ID</div><b style={{ fontSize: 24, letterSpacing: 1 }}>{s.code ?? 'Given on first invite'}</b></div>
            <span className="pill">{!s.invited ? 'Not invited' : s.pin_set ? 'Using the app' : 'Invited'}</span>
          </div>
          {s.invited_at && <div className="muted">Last invite: {fmtDateTime(s.invited_at)}</div>}

          {s.contact && <div className="muted" style={{ marginTop: 6 }}>
            Their WhatsApp contact in the app: <b>{s.contact.name}</b>{s.contact.backup ? ' (office backup number)' : ''} · +{s.contact.wa}
          </div>}
          {isAdmin && s.code && <label style={{ marginTop: 6 }}>Change contact
            <select value={s.contact_id ?? ''} onChange={(e) => changeContact(e.target.value)}>
              <option value="">Office backup number</option>
              {(staff.data ?? []).map((x: any) => <option key={x.id} value={x.id}>{x.employee_name}{x.phone ? '' : ' (no WhatsApp saved)'}</option>)}
            </select></label>}

          <button className="primary" disabled={busy} onClick={invite} style={{ width: '100%', marginTop: 12 }}>
            {busy ? 'Preparing…' : s.invited ? 'Reset PIN & send on WhatsApp' : 'Send app invite on WhatsApp'}
          </button>
          {sent && <div className="card" style={{ marginTop: 10, whiteSpace: 'pre-line' }}>
            {sent.message}
            <div className="bar">
              <button className="link" onClick={() => window.open(waLink(sent.phone, sent.message), '_blank')}>Open WhatsApp</button>
              <button className="link" onClick={() => navigator.clipboard?.writeText(sent.message).then(() => setMsg('Message copied.'))}>Copy message</button>
            </div>
            {!sent.phone && <div className="muted">No phone number saved for this customer — pick the chat in WhatsApp yourself.</div>}
          </div>}

          <h4 style={{ marginBottom: 4 }}>Phones · {s.devices.length} of 2</h4>
          {!s.devices.length && <div className="muted">Not signed in on any phone yet.</div>}
          {s.devices.map((d: any) => <div className="row" key={d.id}>
            <div><b>{d.label || 'Phone'}</b><div className="muted">Last used {fmtDateTime(d.last_seen)}</div></div>
            <button className="link" style={{ color: '#9b3b30' }} onClick={() => removeDevice(d)}>Remove</button>
          </div>)}
        </>}
        {msg && <p className="msg">{msg}</p>}
      </div>
    </div>
  )
}

// Settings card (admin): the office backup number customers see when their contact has no number or has left.
export function CustomerAppContacts() {
  const q = useQuery({ queryKey: ['customer-app-settings'], queryFn: async () => { const { data, error } = await supabase.rpc('customer_app_get_settings'); if (error) throw error; return data as any } })
  const [v, setV] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { if (q.data?.backup_phone) setV(q.data.backup_phone) }, [q.data?.backup_phone])
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true)
    const { error } = await supabase.rpc('customer_app_set_backup', { p_phone: v })
    setBusy(false); setMsg(error ? error.message : 'Saved. Customers see it next time they open the app.'); q.refetch()
  }
  return (
    <form className="card" onSubmit={save}>
      <h3 style={{ margin: 0 }}>Customer app · WhatsApp contacts</h3>
      <p className="muted" style={{ margin: 0 }}>Each customer's buttons (Reorder, Message, Call, video call) go to the staff member who sent their invite. Set staff numbers in <b>Team</b>. When that person has no number or has left, this office number is used instead.</p>
      <label>Office backup number<input inputMode="tel" value={v} onChange={(e) => setV(e.target.value)} placeholder="9312435438" /></label>
      <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      {msg && <p className="msg">{msg}</p>}
    </form>
  )
}

// WhatsApp needs the number with country code and no + or spaces. 10-digit Indian numbers get 91 added.
function waLink(phone: string | null, text: string) {
  let n = (phone ?? '').replace(/\D/g, '')
  if (n.length === 11 && n.startsWith('0')) n = n.slice(1)
  if (n.length === 10) n = '91' + n
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`
}

// On a Service ticket that came from the customer app: their ID, video(s), and a WhatsApp button.
export function CustomerTicketBar({ info, seq }: { info: any; seq: number }) {
  const [err, setErr] = useState('')
  async function open(path: string) {
    const w = window.open('', '_blank') // opened right away so the phone doesn't block it
    const { data, error } = await supabase.storage.from('customer-media').createSignedUrl(path, 3600)
    if (error || !data) { w?.close(); return setErr(error?.message ?? 'Could not open the file') }
    if (w) w.location.href = data.signedUrl; else window.location.href = data.signedUrl
  }
  const no = 'S-' + String(seq).padStart(3, '0')
  const text = `Hello from OFORTT about your ticket ${no}${info.fault ? ` (${info.fault})` : ''}. Can we do a video call now?`
  return (
    <div className="bar" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
      <span className="chip sm">From customer app · {info.code}</span>
      {(info.media ?? []).map((p: string, i: number) => <button key={p} onClick={() => open(p)}>{/\.(jpe?g|png|webp|heic)$/i.test(p) ? 'View photo' : 'Watch video'}{info.media.length > 1 ? ` ${i + 1}` : ''}</button>)}
      {info.phone && <button className="primary" onClick={() => window.open(waLink(info.phone, text), '_blank')}>WhatsApp customer</button>}
      {err && <span className="msg">{err}</span>}
    </div>
  )
}

// Settings card (admin): the fault list customers pick from, per product category.
export function CustomerAppProblems() {
  const q = useQuery({ queryKey: ['customer-app-settings'], queryFn: async () => { const { data, error } = await supabase.rpc('customer_app_get_settings'); if (error) throw error; return data as any } })
  const [rows, setRows] = useState<{ key: string; text: string; rooms: boolean }[]>([])
  const [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!q.data) return
    const opts = q.data.problem_options ?? {}
    const keys = Array.from(new Set([...(q.data.categories ?? []), ...Object.keys(opts).filter((k) => k !== '_other')])).sort()
    setRows([...keys, '_other'].map((k) => ({ key: k, text: (opts[k]?.faults ?? []).join('\n'), rooms: !!opts[k]?.rooms })))
  }, [q.data])
  const set = (i: number, patch: Partial<{ text: string; rooms: boolean }>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true)
    const out: Record<string, any> = {}
    for (const r of rows) {
      const faults = r.text.split('\n').map((s) => s.trim()).filter(Boolean)
      if (faults.length) out[r.key] = { rooms: r.rooms, faults }
    }
    if (!out._other) out._other = { rooms: false, faults: ['Not working', 'Something else'] }
    const { error } = await supabase.rpc('customer_app_set_problem_options', { p_options: out })
    setBusy(false); setMsg(error ? error.message : 'Saved. Customers see the new list right away.'); q.refetch()
  }
  return (
    <form className="card" onSubmit={save}>
      <h3 style={{ margin: 0 }}>Customer app · problems customers can pick</h3>
      <p className="muted" style={{ margin: 0 }}>When a customer reports a problem, they pick one of their products, then one of these lines. One problem per line, in the words customers use. Keep "Something else" last. Tick "Ask room numbers" for things fitted in rooms (locks, switches).</p>
      {q.isLoading && <p>Loading…</p>}
      {rows.map((r, i) => <div key={r.key} style={{ display: 'grid', gap: 4 }}>
        <b>{r.key === '_other' ? 'Any other product' : r.key}</b>
        <textarea rows={Math.max(3, r.text.split('\n').length + 1)} value={r.text} onChange={(e) => set(i, { text: e.target.value })} placeholder={'Not working\nSomething else'} />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}><input type="checkbox" checked={r.rooms} onChange={(e) => set(i, { rooms: e.target.checked })} style={{ width: 'auto' }} />Ask room numbers</label>
      </div>)}
      <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save problem lists'}</button>
      {msg && <p className="msg">{msg}</p>}
    </form>
  )
}
