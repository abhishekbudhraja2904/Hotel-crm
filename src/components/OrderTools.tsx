import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useWorkload } from '../lib/workload'
import ItemsEditor, { ItemRow, newRow, rowsFromItems, useCatalogue } from './ItemsEditor'
const isLockCat = (c?: string) => /^RFID Hotel Lock/i.test(c ?? '')
// On every order card in Inventory (admin / sales): edit the items, choose Left / Right for locks, and assign packing.
export default function OrderTools({ r, me }: { r: any; me: any }) {
  const qc = useQueryClient(), [modal, setModal] = useState<'' | 'items' | 'hand'>(''), [msg, setMsg] = useState('')
  const wl = useWorkload()
  const techs = useQuery({ queryKey: ['employees', 'service'], queryFn: async () => (await supabase.from('employees').select('id,employee_name').eq('active', true).eq('role', 'service').order('employee_name')).data ?? [] })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['dispatch'] }) }
  if (!['admin', 'sales'].includes(me.role)) return null
  async function assign(id: string) { const { error } = await supabase.rpc('assign_packer', { p_inq: r.inquiry_id, p_emp: id || null }); setMsg(error ? error.message : 'Packing assigned.'); refresh() }
  return <div style={{ display: 'grid', gap: 8 }} onClick={(e) => e.stopPropagation()}>
    <div className="bar"><button onClick={() => setModal('items')}>Edit items</button><button onClick={() => setModal('hand')}>Left / Right</button></div>
    <label>Packing assigned to<select value={r.packer_id ?? ''} onChange={(e) => assign(e.target.value)}><option value="">Not assigned</option>{techs.data?.map((t: any) => <option key={t.id} value={t.id}>{wl(t.id, t.employee_name)}</option>)}</select></label>
    {msg && <p className="msg" style={{ margin: 0 }}>{msg}</p>}
    {modal === 'items' && <EditItems id={r.inquiry_id} onClose={() => setModal('')} onDone={refresh} />}
    {modal === 'hand' && <Handles id={r.inquiry_id} onClose={() => setModal('')} onDone={refresh} />}
  </div>
}
function EditItems({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const cat = useCatalogue(), [rows, setRows] = useState<ItemRow[] | null>(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const items = useQuery({ queryKey: ['ot-items', id], queryFn: async () => {
    const { data, error } = await supabase.from('inquiry_items').select('id,product_id,quantity,mortis_spare_id,products(handle_of)').eq('inquiry_id', id).order('created_at'); if (error) throw error
    // a Left/Right version goes back to its main lock, lines of the same lock are joined
    const m = new Map<string, any>(); for (const i of (data ?? []) as any[]) { const p = Array.isArray(i.products) ? i.products[0] : i.products, pid = p?.handle_of ?? i.product_id, e = m.get(pid + '|' + (i.mortis_spare_id ?? '')); if (e) e.quantity = Number(e.quantity ?? 0) + Number(i.quantity ?? 0); else m.set(pid + '|' + (i.mortis_spare_id ?? ''), { product_id: pid, quantity: i.quantity, mortis_spare_id: i.mortis_spare_id }) }
    return Array.from(m.values()) } })
  if (cat.data && items.data && rows === null) { const x = rowsFromItems(items.data, cat.data); setRows(x.length ? x : [newRow()]) }
  async function save() {
    setErr(''); const prods = cat.data ?? [], used = (rows ?? []).filter((x) => x.pid || x.qty)
    for (const x of used) { const p = prods.find((y) => y.id === x.pid); if (!p) return setErr('Choose a category and a product on every item (or remove the empty item).'); if (!(Number(x.qty) > 0)) return setErr(`Enter the quantity for ${p.product_name}.`) }
    setBusy(true)
    const { error } = await supabase.rpc('save_inquiry_items', { p_inq: id, p_items: used.map((x) => ({ product_id: x.pid, quantity: Number(x.qty), mortis_spare_id: x.mortis || null })) })
    setBusy(false); if (error) return setErr(error.message); onDone(); onClose()
  }
  return <div className="modal"><div className="card" style={{ maxWidth: 560 }}>
    <h3 style={{ margin: 0 }}>Edit items</h3>
    <div className="muted">After saving, choose Left / Right again for any RFID lock.</div>
    {!rows && <p className="empty">Loading…</p>}
    {rows && <ItemsEditor rows={rows} onChange={setRows} />}
    {err && <p className="msg">{err}</p>}
    <button className="primary" disabled={busy || !rows} onClick={save}>{busy ? 'Saving…' : 'Save items'}</button><button className="link" onClick={onClose}>Cancel</button>
  </div></div>
}
function Handles({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState<Record<string, { l: string; r: string }>>({}), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const q = useQuery({ queryKey: ['ot-hand', id], queryFn: async () => {
    const { data, error } = await supabase.from('inquiry_items').select('id,quantity,product_name_snapshot,products(product_category,handle_of,handle)').eq('inquiry_id', id).order('created_at'); if (error) throw error
    return ((data ?? []) as any[]).map((i) => ({ ...i, p: Array.isArray(i.products) ? i.products[0] : i.products })).filter((i) => isLockCat(i.p?.product_category)) } })
  const todo = (q.data ?? []).filter((i) => !i.p?.handle_of), done = (q.data ?? []).filter((i) => i.p?.handle_of)
  const hv = (i: any) => v[i.id] ?? { l: '', r: '' }, ok = (i: any) => Number(i.quantity) > 0 && Number(hv(i).l || 0) + Number(hv(i).r || 0) === Number(i.quantity)
  async function save() {
    setBusy(true); setErr('')
    for (const i of todo) { const { error } = await supabase.rpc('set_line_handles', { p_item: i.id, p_left: Number(hv(i).l || 0), p_right: Number(hv(i).r || 0) }); if (error) { setBusy(false); return setErr(error.message) } }
    setBusy(false); onDone(); onClose()
  }
  async function reset() { setBusy(true); const { error } = await supabase.rpc('reset_line_handles', { p_inq: id }); setBusy(false); if (error) return setErr(error.message); setErr(''); q.refetch(); onDone() }
  return <div className="modal"><div className="card" style={{ maxWidth: 560 }}>
    <h3 style={{ margin: 0 }}>Left / Right handles</h3>
    {q.isLoading && <p className="empty">Loading…</p>}
    {q.data && !q.data.length && <p className="empty">This order has no RFID hotel locks.</p>}
    {done.length > 0 && <div className="okbox">{done.map((i) => <div key={i.id}>✓ {i.product_name_snapshot} × {Number(i.quantity)}</div>)}<button className="link" disabled={busy} onClick={reset}>Change this split</button></div>}
    {todo.map((i) => <div key={i.id} className="warnbox" style={{ display: 'grid', gap: 6 }}>
      <b>{i.product_name_snapshot} × {Number(i.quantity)}</b>
      <div className="bar"><label>Left<input type="number" min="0" value={hv(i).l} onChange={(e) => setV({ ...v, [i.id]: { ...hv(i), l: e.target.value } })} /></label><label>Right<input type="number" min="0" value={hv(i).r} onChange={(e) => setV({ ...v, [i.id]: { ...hv(i), r: e.target.value } })} /></label></div>
      {!ok(i) && <span className="muted">Left + Right must add up to {Number(i.quantity)}.</span>}
    </div>)}
    {err && <p className="msg">{err}</p>}
    {todo.length > 0 && <button className="primary" disabled={busy || todo.some((i) => !ok(i))} onClick={save}>{busy ? 'Saving…' : 'Save Left / Right'}</button>}
    <button className="link" onClick={onClose}>Close</button>
  </div></div>
}
