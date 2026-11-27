import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useCatalogue } from './ItemsEditor'
import DateField from './DateField'
import { isoDate } from '../lib/dates'

type Row = { key: number; pid: string; name: string; qty: string }
let k = 1
const blank = (): Row => ({ key: k++, pid: '', name: '', qty: '' })
const OTHER = '__other'

// Adds a customer who bought before Hermora, with what they bought. These products show in the customer app's "My products".
export default function AddOldCustomer({ me, onClose, onAdded }: { me: any; onClose: () => void; onAdded: (c: { id: string; name: string }) => void }) {
  const qc = useQueryClient(), cat = useCatalogue(), isAdmin = me.role === 'admin'
  const [f, setF] = useState({ name: '', phone: '', city: '', assign: '' }), [when, setWhen] = useState(''), [rows, setRows] = useState<Row[]>([blank()]), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const emps = useQuery({ queryKey: ['employees'], enabled: isAdmin, queryFn: async () => (await supabase.from('employees').select('id,employee_name').eq('active', true).in('role', ['admin', 'sales'])).data ?? [] })
  const prods = cat.data ?? [], upd = (key: number, p: Partial<Row>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...p } : r)))
  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!f.name.trim()) return setErr('Type the customer name.')
    if (!when) return setErr('Choose the date they bought (an approximate date is fine).')
    if (when > isoDate()) return setErr('The purchase date cannot be in the future.')
    const used = rows.filter((r) => r.pid || r.name.trim() || r.qty)
    if (!used.length) return setErr('Add at least one product.')
    for (const r of used) {
      if (!r.pid) return setErr('Choose a product on every line (or remove the empty line).')
      if (r.pid === OTHER && !r.name.trim()) return setErr('Type the product name for the line marked "Other".')
      if (!(Number(r.qty) > 0)) return setErr('Enter the quantity on every line.')
    }
    setBusy(true)
    const { data, error } = await supabase.rpc('add_old_customer', { p_name: f.name, p_phone: f.phone, p_city: f.city, p_when: when, p_assign: isAdmin && f.assign ? f.assign : null,
      p_items: used.map((r) => (r.pid === OTHER ? { name: r.name.trim(), qty: Number(r.qty) } : { product_id: r.pid, qty: Number(r.qty) })) })
    setBusy(false)
    if (error) return setErr(error.message)
    qc.invalidateQueries({ queryKey: ['old-customers'] }); qc.invalidateQueries({ queryKey: ['customers'] })
    onAdded({ id: (data as any).customer_id, name: f.name.trim() })
  }
  return <div className="modal"><form className="card" style={{ maxWidth: 560, display: 'grid', gap: 8 }} onSubmit={save}>
    <h3 style={{ margin: 0 }}>Add old customer</h3>
    <div className="muted">For a customer who bought before Hermora. What you add here shows in their customer app under "My products".</div>
    <label>Customer name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
    <label>Phone number<input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
    <label>City<input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></label>
    {isAdmin && <label>Salesperson<select value={f.assign} onChange={(e) => setF({ ...f, assign: e.target.value })}><option value="">Me</option>{(emps.data ?? []).map((x: any) => <option key={x.id} value={x.id}>{x.employee_name}</option>)}</select></label>}
    <label>Date they bought<DateField value={when} onChange={setWhen} ariaLabel="Purchase date" /></label>
    <b>What they bought</b>
    {rows.map((r) => <div key={r.key} style={{ display: 'grid', gap: 6, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
      <select value={r.pid} onChange={(e) => upd(r.key, { pid: e.target.value })}><option value="">Choose product…</option>
        {prods.map((p) => <option key={p.id} value={p.id}>{p.product_name}</option>)}<option value={OTHER}>Other (older model, type the name)</option></select>
      {r.pid === OTHER && <input placeholder="Product name" value={r.name} onChange={(e) => upd(r.key, { name: e.target.value })} />}
      <div className="bar"><input inputMode="decimal" placeholder="Quantity" value={r.qty} onChange={(e) => upd(r.key, { qty: e.target.value.replace(/[^0-9.]/g, '') })} />
        {rows.length > 1 && <button type="button" className="link" onClick={() => setRows(rows.filter((x) => x.key !== r.key))}>Remove</button>}</div>
    </div>)}
    <button type="button" className="link" onClick={() => setRows([...rows, blank()])}>+ Add another product</button>
    {err && <p className="msg">{err}</p>}
    <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save old customer'}</button><button type="button" className="link" onClick={onClose}>Cancel</button>
  </form></div>
}
