import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSettings } from '../lib/settings'
// Add or edit a product. Admin also sees Remove / Delete.
export default function ProductForm({ product, isAdmin, onClose, onDone }: { product?: any; isAdmin: boolean; onClose: () => void; onDone: () => void }) {
  const { categories } = useSettings()
  const cats = product && !categories.includes(product.product_category) ? [product.product_category, ...categories] : categories
  const [f, setF] = useState({ name: product?.product_name ?? '', cat: product?.product_category ?? categories[0], code: product?.product_code ?? '', unit: product?.unit ?? 'pcs', low: String(Number(product?.low_stock_level ?? 0) || '') })
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [confirmDel, setConfirmDel] = useState('')
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const { error } = await supabase.rpc('save_product', { p_id: product?.product_id ?? null, p_name: f.name, p_cat: f.cat, p_code: f.code, p_unit: f.unit, p_low: Number(f.low) || 0 })
    setBusy(false); if (error) setErr(error.message); else { onDone(); onClose() }
  }
  async function remove() {
    if (!confirm(`Remove ${product.product_name} from the list? It is only hidden; you can restore it later.`)) return
    const { error } = await supabase.rpc('set_product_active', { p_id: product.product_id, p_active: false }); if (error) setErr(error.message); else { onDone(); onClose() }
  }
  async function del() {
    const { error } = await supabase.rpc('delete_product', { p_id: product.product_id }); if (error) setErr(error.message); else { onDone(); onClose() }
  }
  return (
    <div className="modal"><form className="card" onSubmit={save}>
      <h3 style={{ margin: 0 }}>{product ? 'Edit product' : 'Add product'}</h3>
      <label>Name<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label>Category<select value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}>{cats.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label>Product code (optional)<input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></label>
      <label>Counted in (for example pcs, sets, cards)<input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></label>
      <label>Warn me when free stock goes down to<input type="number" min="0" value={f.low} onChange={(e) => setF({ ...f, low: e.target.value })} /></label>
      {err && <p className="msg">{err}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      <button type="button" className="link" onClick={onClose}>Cancel</button>
      {product && isAdmin && <>
        <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
        <button type="button" onClick={remove}>Remove from list (can restore)</button>
        <div className="muted">Permanent delete works only for a product that was never used. Type its name to confirm:</div>
        <input value={confirmDel} onChange={(e) => setConfirmDel(e.target.value)} placeholder={product.product_name} />
        <button type="button" disabled={confirmDel.trim() !== product.product_name} onClick={del}>Delete forever</button></>}
    </form></div>
  )
}
