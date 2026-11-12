import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
// Fix a customer's name / phone (for example after an IndiaMART lead came in without a name).
export default function EditCustomer({ inquiry, onClose }: { inquiry: any; onClose: () => void }) {
  const qc = useQueryClient(), c = inquiry.customers ?? {}
  const [name, setName] = useState(c.customer_name ?? ''), [phone, setPhone] = useState(c.phone_number ?? ''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  async function save() {
    if (!name.trim()) return setMsg('Type the customer name.')
    setBusy(true); setMsg('')
    const { error } = await supabase.from('customers').update({ customer_name: name.trim(), phone_number: phone.trim() || null }).eq('id', inquiry.customer_id)
    setBusy(false); if (error) return setMsg(error.message)
    qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['customers'] }); onClose()
  }
  return <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}><div className="card">
    <div className="row"><h3 style={{ margin: 0 }}>Edit customer</h3><button className="link" onClick={onClose}>Close</button></div>
    <label>Name<input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
    <label>Phone<input value={phone} inputMode="tel" onChange={(e) => setPhone(e.target.value)} /></label>
    {msg && <p className="msg">{msg}</p>}
    <button className="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
  </div></div>
}
