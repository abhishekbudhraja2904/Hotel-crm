import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
// Admin: which parts make one lock of this model. Parts come from the Spare parts list and can be shared by many models.
export default function LockParts({ product, current, onClose, onDone }: { product: any; current: any[]; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<{ spare_id: string; qty: string }[]>(current.length ? current.map((c) => ({ spare_id: c.spare_id, qty: String(c.qty) })) : [{ spare_id: '', qty: '1' }])
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const spares = useQuery({ queryKey: ['spares', 'pick'], queryFn: async () => ((await supabase.rpc('spare_overview')).data ?? []) as any[] })
  const set = (i: number, k: 'spare_id' | 'qty', v: string) => setRows(rows.map((r, x) => (x === i ? { ...r, [k]: v } : r)))
  async function save() {
    const items = rows.filter((r) => r.spare_id).map((r) => ({ spare_id: r.spare_id, qty: Number(r.qty) }))
    if (items.some((i) => !(i.qty > 0))) return setErr('Every part needs a quantity above zero.')
    if (new Set(items.map((i) => i.spare_id)).size !== items.length) return setErr('A part is listed twice.')
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('set_lock_recipe', { p_product: product.product_id, p_items: items })
    setBusy(false); if (error) setErr(error.message); else { onDone(); onClose() }
  }
  return (
    <div className="modal"><div className="card">
      <h3 style={{ margin: 0 }}>Parts of {product.product_name}</h3>
      <div className="muted">Choose every part that goes into ONE lock. When an order is dispatched and there are not enough finished locks, these parts are used up automatically. Add new parts under Spare parts.</div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 36px', gap: 6 }}>
          <select value={r.spare_id} onChange={(e) => set(i, 'spare_id', e.target.value)}><option value="">Choose part…</option>{(spares.data ?? []).filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input type="number" min="1" step="any" value={r.qty} onChange={(e) => set(i, 'qty', e.target.value)} />
          <button type="button" onClick={() => setRows(rows.filter((_, x) => x !== i))}>✕</button>
        </div>))}
      <button type="button" onClick={() => setRows([...rows, { spare_id: '', qty: '1' }])}>+ Add another part</button>
      {err && <p className="msg">{err}</p>}
      <button className="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save parts'}</button>
      <button className="link" onClick={onClose}>Cancel</button>
    </div></div>
  )
}
