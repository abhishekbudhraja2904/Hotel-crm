import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSettings } from '../lib/settings'
// Admin only: the product catalogue. Everyone else picks from this list.
export default function Catalogue() {
  const qc = useQueryClient(), { categories } = useSettings(), [edit, setEdit] = useState<any>(null), [msg, setMsg] = useState(''), [showHidden, setShowHidden] = useState(false)
  const list = useQuery({ queryKey: ['catalogue-admin'], queryFn: async () => { const { data, error } = await supabase.rpc('catalogue_admin'); if (error) throw error; return data as any[] } })
  const refresh = () => { for (const k of ['catalogue-admin', 'catalogue', 'inventory', 'lowstock', 'products', 'quote-products']) qc.invalidateQueries({ queryKey: [k] }) }
  async function setActive(p: any, on: boolean) { const { error } = await supabase.rpc('set_product_active', { p_id: p.id, p_active: on }); setMsg(error ? error.message : ''); refresh() }
  const vis = (list.data ?? []).filter((p) => p.active), hid = (list.data ?? []).filter((p) => !p.active)
  return <div className="card"><h3 style={{ margin: 0 }}>Product catalogue</h3>
    <p className="muted" style={{ margin: 0 }}>Staff choose products only from this list: in inquiries, quotations and stock. Hiding a product keeps its history.</p>
    {msg && <p className="msg">{msg}</p>}
    <button className="primary" onClick={() => setEdit({})}>+ Add product</button>
    {list.isLoading && <p className="empty">Loading…</p>}
    {list.data && !vis.length && <p className="empty">No products yet.</p>}
    {vis.map((p) => <div key={p.id} className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 6 }}>
      <div><b>{p.product_name}</b><div className="muted">{p.product_category}{p.product_code ? ` · ${p.product_code}` : ''} · {p.unit}{Number(p.low_stock_level) > 0 ? ` · alert at ${Number(p.low_stock_level)}` : ''}</div></div>
      <span style={{ display: 'flex', gap: 10 }}><button className="link" onClick={() => setEdit(p)}>Edit</button><button className="link" onClick={() => confirm(`Hide ${p.product_name}?`) && setActive(p, false)}>Hide</button></span></div>)}
    {hid.length > 0 && <button className="link" onClick={() => setShowHidden(!showHidden)}>{showHidden ? 'Hide' : 'Show'} hidden products ({hid.length})</button>}
    {showHidden && hid.map((p) => <div key={p.id} className="row"><span className="muted">{p.product_name}</span><button className="link" onClick={() => setActive(p, true)}>Show again</button></div>)}
    {edit && <ProductEditor product={edit.id ? edit : null} categories={categories} onClose={() => setEdit(null)} onDone={refresh} />}
  </div>
}
function ProductEditor({ product, categories, onClose, onDone }: { product: any; categories: string[]; onClose: () => void; onDone: () => void }) {
  const cats = product && !categories.includes(product.product_category) ? [product.product_category, ...categories] : categories
  const [f, setF] = useState({ name: product?.product_name ?? '', cat: product?.product_category ?? categories[0], code: product?.product_code ?? '', unit: product?.unit ?? 'pcs', desc: product?.description ?? '', low: String(Number(product?.low_stock_level ?? 0) || '') })
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [confirmDel, setConfirmDel] = useState('')
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const { error } = await supabase.rpc('admin_save_product', { p_id: product?.id ?? null, p_name: f.name, p_cat: f.cat, p_code: f.code, p_unit: f.unit, p_desc: f.desc, p_low: Number(f.low) || 0 })
    setBusy(false); if (error) setErr(error.message); else { onDone(); onClose() }
  }
  async function del() { const { error } = await supabase.rpc('delete_product', { p_id: product.id }); if (error) setErr(error.message); else { onDone(); onClose() } }
  return <div className="modal"><form className="card" onSubmit={save}>
    <h3 style={{ margin: 0 }}>{product ? 'Edit product' : 'Add product'}</h3>
    <label>Name<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
    <label>Category<select value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}>{cats.map((c) => <option key={c}>{c}</option>)}</select></label>
    <label>Product code (optional)<input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></label>
    <label>Counted in (for example pcs, sets, cards)<input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></label>
    <label>Description (optional)<input value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} /></label>
    <label>Low-stock alert when the store has this many or fewer (0 = no alert)<input type="number" min="0" value={f.low} onChange={(e) => setF({ ...f, low: e.target.value })} /></label>
    {err && <p className="msg">{err}</p>}
    <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="link" onClick={onClose}>Cancel</button>
    {product && <><hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
      <div className="muted">Permanent delete works only for a product that was never used. Type its name to confirm:</div>
      <input value={confirmDel} onChange={(e) => setConfirmDel(e.target.value)} placeholder={product.product_name} />
      <button type="button" disabled={confirmDel.trim() !== product.product_name} onClick={del}>Delete forever</button></>}
  </form></div>
}
