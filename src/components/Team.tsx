import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
export default function Team() {
  const qc = useQueryClient(), [f, setF] = useState({ name: '', email: '', password: '', role: 'sales' }), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const { data = [] } = useQuery({ queryKey: ['employees'], queryFn: async () => (await supabase.from('employees').select('*').order('created_at')).data ?? [] })
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  async function add(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('')
    const { data: res, error } = await supabase.functions.invoke('create-employee', { body: f })
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
  return (
    <section>
      <form className="card" onSubmit={add}><h3>Add employee</h3>
        <label>Name<input required value={f.name} onChange={set('name')} /></label>
        <label>Email<input type="email" required value={f.email} onChange={set('email')} /></label>
        <label>Temporary password (8+ characters)<input type="text" minLength={8} required value={f.password} onChange={set('password')} /></label>
        <label>Role<select value={f.role} onChange={set('role')}><option value="sales">Sales executive</option><option value="service">Installation / service</option><option value="admin">Administrator</option></select></label>
        <button className="primary" disabled={busy}>{busy ? 'Adding…' : 'Add employee'}</button>
      </form>
      {msg && <p className="msg">{msg}</p>}
      {data.map((r: any) => <div className="card" key={r.id}><div className="row"><b>{r.employee_name}</b><span className="pill">{r.role}</span></div>
        <div className="muted">{r.email} · {r.active ? 'Active' : 'Deactivated'}</div><button className="link" onClick={() => toggle(r)}>{r.active ? 'Deactivate' : 'Reactivate'}</button></div>)}
    </section>
  )
}
