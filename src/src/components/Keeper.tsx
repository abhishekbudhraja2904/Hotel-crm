import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
// Admin only: hand the job of updating stock to ONE person.
export default function Keeper({ me, onClose, onDone }: { me: any; onClose: () => void; onDone: () => void }) {
  const [emp, setEmp] = useState(''), [mode, setMode] = useState<'once' | 'until' | 'standing'>('standing'), [days, setDays] = useState('3'), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const emps = useQuery({ queryKey: ['employees', 'all'], queryFn: async () => (await supabase.from('employees').select('id,employee_name,role').eq('active', true).order('employee_name')).data ?? [] })
  async function save() {
    if (!emp) return setErr('Choose a person.')
    const d = Number(days); if (mode === 'until' && !(d >= 1)) return setErr('Enter the number of days.')
    setBusy(true); setErr('')
    const until = mode === 'until' ? new Date(Date.now() + d * 86400000).toISOString() : null
    const { error } = await supabase.rpc('set_inventory_keeper', { emp, p_mode: mode, p_uses: 1, p_until: until })
    setBusy(false); if (error) setErr(error.message); else { onDone(); onClose() }
  }
  const opt = (m: typeof mode, t: string, s: string) => <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: 'inherit', fontSize: 15 }}>
    <input type="radio" name="km" style={{ width: 18, height: 18, padding: 0, marginTop: 3 }} checked={mode === m} onChange={() => setMode(m)} /><span><b>{t}</b><br /><span className="muted">{s}</span></span></label>
  return (
    <div className="modal"><div className="card">
      <h3 style={{ margin: 0 }}>Hand over stock updating</h3>
      <p className="muted" style={{ margin: 0 }}>Only this one person (and you) can add stock, correct counts and dispatch. Everyone else can only look. Handing over to someone new replaces the earlier person.</p>
      <label>Who?<select value={emp} onChange={(e) => setEmp(e.target.value)}><option value="">Choose…</option>{emps.data?.filter((x: any) => x.id !== me.id).map((x: any) => <option key={x.id} value={x.id}>{x.employee_name}</option>)}</select></label>
      {opt('once', 'Just one update', 'Works for ONE action (one stock receipt, or one dispatch), then stops.')}
      {opt('until', 'For a few days', 'Works until the number of days below is over.')}
      {mode === 'until' && <label>Number of days<input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} /></label>}
      {opt('standing', 'Until I take it back', 'Works every time until you remove it.')}
      {err && <p className="msg">{err}</p>}
      <button className="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Hand over'}</button>
      <button className="link" onClick={onClose}>Cancel</button>
    </div></div>
  )
}
