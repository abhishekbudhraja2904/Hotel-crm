import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
export default function Team() {
  const [del, setDel] = useState<any>(null), [pw, setPw] = useState(''), [dbusy, setDbusy] = useState(false), [derr, setDerr] = useState('')
  const qc = useQueryClient(), [f, setF] = useState({ name: '', email: '', password: '', role: 'sales' }), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const { data = [] } = useQuery({ queryKey: ['employees'], queryFn: async () => (await supabase.from('employees').select('*').order('created_at')).data ?? [] })
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  async function add(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('')
    const { data: res, error } = await supabase.functions.invoke(import.meta.env.VITE_EMPLOYEE_FUNCTION || 'create-employee', { body: f })
    setBusy(false)
    if (error || res?.error) return setMsg(res?.error || error!.message)
    setF({ name: '', email: '', password: '', role: 'sales' }); qc.invalidateQueries({ queryKey: ['employees'] }); setMsg('Employee added. Share their email and password with them.')
  }
  async function toggle(r: any) {
    if (!r.active || confirm(`Reactivate ${r.employee_name}?`)) {
      if (r.active && !confirm(`Deactivate ${r.employee_name}? They will lose access.`)) return
      const { error } = await supabase.from('employees').update({ active: !r.active }).eq('id', r.id)
      if (error) setMsg(error.message); else qc.invalidateQueries({ queryKey: ['employees'] })
    }
  }
  // WhatsApp number shown to the customers this person invites in the OFORTT customer app
  async function setPhone(r: any) {
    const v = prompt(`WhatsApp number for ${r.employee_name} (customers they invite will message this number):`, r.phone ?? '')
    if (v === null) return
    const n = v.replace(/\D/g, '')
    if (v.trim() && n.length < 10) return setMsg('Type a full mobile number, e.g. 9312435438')
    const { error } = await supabase.from('employees').update({ phone: v.trim() || null }).eq('id', r.id)
    if (error) setMsg(error.message); else { setMsg(''); qc.invalidateQueries({ queryKey: ['employees'] }) }
  }
  async function remove(e: React.FormEvent) {
    e.preventDefault(); setDbusy(true); setDerr('')
    const { data: res, error } = await supabase.functions.invoke('delete-employee', { body: { employee_id: del.id, password: pw } })
    setDbusy(false)
    if (error || res?.error) { let m = res?.error || error!.message; try { const b = await (error as any)?.context?.json?.(); if (b?.error) m = b.error } catch { /* ignore */ } return setDerr(m) }
    setDel(null); setPw(''); setMsg(res.message); qc.invalidateQueries({ queryKey: ['employees'] })
  }
  return (
    <section>
      {data.map((r: any) => <div className="card" key={r.id}><div className="row"><b>{r.employee_name}</b><span className="pill">{r.role}</span></div>
        <div className="muted">{r.email} · {r.active ? 'Active' : 'Deactivated'}</div><div className="muted">WhatsApp: {r.phone || 'not set'}</div><div className="bar"><button className="link" onClick={() => setPhone(r)}>{r.phone ? 'Change WhatsApp' : 'Add WhatsApp'}</button><button className="link" onClick={() => toggle(r)}>{r.active ? 'Deactivate' : 'Reactivate'}</button><button className="link" style={{ color: '#9b3b30' }} onClick={() => { setDel(r); setPw(''); setDerr('') }}>Delete</button></div></div>)}
      {del && <div className="modal"><form className="card" onSubmit={remove}><h3 style={{ margin: 0 }}>Delete {del.employee_name}?</h3>
        <p className="muted" style={{ margin: 0 }}>Their login is removed and they can never sign in again. If they have work history, they are deactivated instead and their records are kept. To confirm, type YOUR OWN password.</p>
        <label>Your password<input type="password" required autoFocus value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        {derr && <p className="msg">{derr}</p>}
        <button className="primary" disabled={dbusy}>{dbusy ? 'Deleting…' : 'Delete'}</button><button type="button" className="link" onClick={() => setDel(null)}>Cancel</button></form></div>}
      {msg && <p className="msg">{msg}</p>}
      <form className="card" onSubmit={add}><h3>Add employee</h3>
        <label>Name<input required value={f.name} onChange={set('name')} /></label>
        <label>Email<input type="email" required value={f.email} onChange={set('email')} /></label>
        <label>Temporary password (8+ characters)<input type="text" minLength={8} required value={f.password} onChange={set('password')} /></label>
        <label>Role<select value={f.role} onChange={set('role')}><option value="sales">Sales executive</option><option value="service">Installation / service</option><option value="service_admin">Service admin (view only)</option><option value="admin">Administrator</option></select></label>
        <button className="primary" disabled={busy}>{busy ? 'Adding…' : 'Add employee'}</button>
      </form>
    </section>
  )
}
