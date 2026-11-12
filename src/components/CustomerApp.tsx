import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSettings } from '../lib/settings'
import { fmtDate } from '../lib/dates'
const wa = (p: string) => { const d = (p ?? '').replace(/\D/g, ''); return d.length === 10 ? '91' + d : d }
// Admin / sales: give a customer a login for the OFORTT customer app and send it on WhatsApp.
export default function CustomerApp({ me, inquiry, onClose }: { me: any; inquiry: any; onClose: () => void }) {
  const qc = useQueryClient(), s = useSettings(), cid = inquiry.customer_id
  const [contact, setContact] = useState<string | null>(null), [creds, setCreds] = useState<any>(null), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const acc = useQuery({ queryKey: ['appuser', cid], queryFn: async () => (await supabase.from('customer_app_users').select('login_id,contact_phone,active,password_set_at').eq('customer_id', cid).maybeSingle()).data })
  const phone = contact ?? acc.data?.contact_phone ?? me.phone ?? s.appBackupPhone
  async function issue(reset: boolean) {
    if (reset && !confirm('Issue a new password? The old one will stop working.')) return
    setMsg(''); setBusy(true)
    const { data, error } = await supabase.rpc('create_app_invite', { p_customer: cid, p_contact: phone || null, p_reset: reset }); setBusy(false)
    if (error) return setMsg(error.message)
    setCreds(data); qc.invalidateQueries({ queryKey: ['appuser', cid] })
  }
  async function saveContact() { const { error } = await supabase.rpc('set_app_contact', { p_customer: cid, p_contact: phone }); setMsg(error ? error.message : 'Contact number saved.'); qc.invalidateQueries({ queryKey: ['appuser', cid] }) }
  async function toggle() { const { error } = await supabase.rpc('set_app_active', { p_customer: cid, p_on: !acc.data?.active }); setMsg(error ? error.message : ''); qc.invalidateQueries({ queryKey: ['appuser', cid] }) }
  const name = inquiry.customers?.customer_name ?? '', custPhone = inquiry.customers?.phone_number ?? ''
  const text = creds ? `Hello ${name}, welcome to the ${s.appName || 'OFORTT'} customer app.\n${s.appUrl ? `Open: ${s.appUrl}\n` : ''}Login ID: ${creds.login_id}\nPassword: ${creds.password}\nFor any help, WhatsApp us on ${creds.contact_phone || phone}.` : ''
  return (
    <div className="modal"><div className="card" style={{ maxWidth: 480 }}>
      <div className="row"><h3 style={{ margin: 0 }}>Customer app</h3><button className="link" onClick={onClose}>Close</button></div>
      <div><b>{name}</b> {custPhone && <span className="muted">· {custPhone}</span>}</div>
      {acc.isLoading ? <p className="muted">Loading…</p> : <>
        {!creds && (acc.data
          ? <p className="muted" style={{ margin: 0 }}>Login ID <b>{acc.data.login_id}</b> · {acc.data.active ? 'Active' : 'Switched off'} · password set {fmtDate(acc.data.password_set_at)}. For safety the password is shown only once, when it is made.</p>
          : <p className="muted" style={{ margin: 0 }}>This customer has no app login yet. The customer will see the products they bought and can raise service requests.</p>)}
        <label>The customer's WhatsApp contact in the app (your number by default)<input value={phone ?? ''} inputMode="tel" onChange={(e) => setContact(e.target.value)} placeholder="10-digit WhatsApp number" /></label>
        {acc.data && !creds && (me.role === 'admin' || acc.data) && <div className="bar"><button onClick={saveContact}>Save contact number</button></div>}
        {creds && <div className="card" style={{ margin: 0 }}>
          <div className="muted">Login details (shown once, note them or send now)</div>
          <div>Login ID: <b>{creds.login_id}</b></div><div>Password: <b style={{ fontFamily: 'monospace', fontSize: 18 }}>{creds.password}</b></div>
          <div className="bar">
            {custPhone ? <a className="primary" style={{ padding: '8px 14px', borderRadius: 8, textDecoration: 'none' }} href={`https://wa.me/${wa(custPhone)}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">Send on WhatsApp</a> : <span className="muted">No phone number on this customer.</span>}
            <button onClick={() => navigator.clipboard?.writeText(text).then(() => setMsg('Copied.'))}>Copy message</button>
          </div>
          {!s.appUrl && <p className="muted" style={{ margin: 0 }}>The app link isn't set yet (Settings → Customer app), so the message has no link.</p>}
        </div>}
        <div className="bar">
          {!acc.data && <button className="primary" disabled={busy} onClick={() => issue(false)}>{busy ? 'Creating…' : 'Create login'}</button>}
          {acc.data && <button disabled={busy} onClick={() => issue(true)}>Issue a new password</button>}
          {acc.data && me.role === 'admin' && <button onClick={toggle}>{acc.data.active ? 'Switch app access off' : 'Switch app access on'}</button>}
        </div>
      </>}
      {msg && <p className="msg">{msg}</p>}
    </div></div>
  )
}
