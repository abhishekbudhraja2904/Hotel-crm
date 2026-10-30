import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSettings } from '../lib/settings'
const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const nice = (m: string) => (/check constraint|inventory/i.test(m) ? 'Not enough stock for that change.' : m)
export default function Inventory({ me }: { me: any }) {
  const { categories: CATS } = useSettings()
  const qc = useQueryClient(), isAdmin = me.role === 'admin', [msg, setMsg] = useState(''), [amt, setAmt] = useState<Record<string, string>>({})
  const [np, setNp] = useState({ name: '', cat: '', code: '', unit: 'pcs', open: '', low: '' }), [busy, setBusy] = useState(false)
  const prods = useQuery({ queryKey: ['inventory', 'products'], queryFn: async () => {
    const { data, error } = await supabase.from('products').select('id,product_name,product_code,product_category,unit,inventory(qty_on_hand,low_stock_level)').eq('active', true).order('product_name'); if (error) throw error; return data } })
  const moves = useQuery({ queryKey: ['inventory', 'moves'], queryFn: async () => {
    const { data, error } = await supabase.from('stock_movements').select('id,qty_change,reason,note,created_at,products(product_name),employees:created_by(employee_name)').order('created_at', { ascending: false }).limit(15); if (error) throw error; return data } })
  const ready = useQuery({ queryKey: ['inquiries', 'dispatch'], queryFn: async () => {
    const { data, error } = await supabase.from('inquiries').select('id,inquiry_number,inquiry_title,inquiry_items(product_id,product_name_snapshot,quantity,unit)').eq('sales_stage', 'Order Confirmed').is('dispatched_at', null).is('archived_at', null); if (error) throw error; return data } })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['inquiries'] }) }
  const stock = (id: string) => Number(one(prods.data?.find((p: any) => p.id === id)?.inventory)?.qty_on_hand ?? 0)
  async function move(p: any, sign: 1 | -1) {
    const n = Number(amt[p.id]); if (!n || n <= 0) return setMsg('Enter a quantity above zero.')
    const { error } = await supabase.from('stock_movements').insert({ product_id: p.id, qty_change: sign * n, reason: sign > 0 ? 'stock_in' : 'adjustment', created_by: me.id })
    setMsg(error ? nice(error.message) : ''); setAmt({ ...amt, [p.id]: '' }); refresh()
  }
  async function addProduct(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('')
    const { data, error } = await supabase.from('products').insert({ product_name: np.name, product_category: np.cat || CATS[0], product_code: np.code || null, unit: np.unit || 'pcs' }).select('id').single()
    if (error) { setBusy(false); return setMsg(error.message) }
    if (np.low) await supabase.from('inventory').update({ low_stock_level: Number(np.low) }).eq('product_id', data.id)
    if (Number(np.open) > 0) await supabase.from('stock_movements').insert({ product_id: data.id, qty_change: Number(np.open), reason: 'stock_in', note: 'Opening stock', created_by: me.id })
    setNp({ name: '', cat: '', code: '', unit: 'pcs', open: '', low: '' }); setBusy(false); refresh()
  }
  async function dispatch(r: any) {
    if (!confirm(`Dispatch ${r.inquiry_number}? Stock will be subtracted.`)) return
    const { error } = await supabase.rpc('dispatch_inquiry', { inq: r.id }); setMsg(error ? error.message : ''); refresh()
  }
  return (
    <section>
      {msg && <p className="msg">{msg}</p>}
      <h3>Ready to dispatch ({ready.data?.length ?? 0})</h3>
      {ready.data && !ready.data.length && <p className="empty">No confirmed orders waiting.</p>}
      {ready.data?.map((r: any) => <div className="card" key={r.id}><div className="row"><b>{r.inquiry_number}</b><span className="muted">{r.inquiry_title}</span></div>
        {r.inquiry_items?.map((i: any, k: number) => <div className="muted" key={k}>{i.product_name_snapshot} × {i.quantity ?? '?'}{' '}
          {i.product_id ? (stock(i.product_id) < Number(i.quantity ?? 0) ? <span className="pill Urgent">only {stock(i.product_id)} in stock</span> : <span className="pill">in stock: {stock(i.product_id)}</span>) : <span className="pill Medium">not in catalogue – stock won’t change</span>}</div>)}
        <button className="primary" onClick={() => dispatch(r)}>Dispatch & update stock</button></div>)}
      <h3>Stock</h3>
      {prods.isLoading && <p className="empty">Loading…</p>}
      {prods.data && !prods.data.length && <p className="empty">No products yet.{isAdmin ? ' Add the first one below.' : ' Ask the admin to add products.'}</p>}
      {prods.data?.map((p: any) => { const inv = one(p.inventory), q = Number(inv?.qty_on_hand ?? 0), low = Number(inv?.low_stock_level ?? 0); return (
        <div className="card" key={p.id}><div className="row"><b>{p.product_name}</b>
          <span className={`pill${low > 0 && q <= low ? ' Urgent' : ''}`}>{q} {p.unit}{low > 0 && q <= low ? ' · LOW' : ''}</span></div>
          <div className="muted">{p.product_category}{p.product_code ? ` · ${p.product_code}` : ''}{low > 0 ? ` · alert at ${low}` : ''}</div>
          <div className="row"><input type="number" min="0" placeholder="Qty" value={amt[p.id] ?? ''} onChange={(e) => setAmt({ ...amt, [p.id]: e.target.value })} style={{ width: 90 }} />
            <button className="primary" onClick={() => move(p, 1)}>+ Stock in</button><button onClick={() => move(p, -1)}>− Remove</button></div></div>) })}
      {isAdmin && <form className="card" onSubmit={addProduct}><h3 style={{ margin: 0 }}>Add product</h3>
        <label>Name<input required value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} /></label>
        <label>Category<select value={np.cat || CATS[0]} onChange={(e) => setNp({ ...np, cat: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Product code (optional)<input value={np.code} onChange={(e) => setNp({ ...np, code: e.target.value })} /></label>
        <label>Unit<input value={np.unit} onChange={(e) => setNp({ ...np, unit: e.target.value })} /></label>
        <label>Opening stock<input type="number" min="0" value={np.open} onChange={(e) => setNp({ ...np, open: e.target.value })} /></label>
        <label>Low-stock alert at<input type="number" min="0" value={np.low} onChange={(e) => setNp({ ...np, low: e.target.value })} /></label>
        <button className="primary" disabled={busy}>{busy ? 'Adding…' : 'Add product'}</button></form>}
      <h3>Recent stock movements</h3>
      {moves.data?.map((m: any) => <div className="card" key={m.id}><div className="row"><b>{one(m.products)?.product_name}</b><span className={`pill${m.qty_change < 0 ? ' High' : ''}`}>{m.qty_change > 0 ? '+' : ''}{m.qty_change}</span></div>
        <div className="muted">{m.reason.replace('_', ' ')} · {one(m.employees)?.employee_name ?? 'System'} · {new Date(m.created_at).toLocaleString()}{m.note ? ` · ${m.note}` : ''}</div></div>)}
    </section>
  )
}
