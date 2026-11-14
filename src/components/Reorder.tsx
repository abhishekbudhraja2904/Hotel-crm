import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import ItemsEditor, { ItemRow, newRow, rowsFromItems, useCatalogue } from './ItemsEditor'
import DateField from './DateField'
export const INQ_SELECT = 'id,needed_by,customer_id,inquiry_source,inquiry_number,assigned_to,inquiry_title,sales_stage,priority,inquiry_date,next_followup_at,updated_at,lost_reason,lost_note,packing_no,dispatched_at,customers(customer_name,phone_number),inquiry_items(product_name_snapshot,quantity),assigned:employees!assigned_to(employee_name)'
// Repeat order for an old customer: the items of an earlier order are copied (edit them freely), a new inquiry is made and goes straight to "Confirm order".
export default function Reorder({ me, customerId, name, fromInquiryId, onClose, onCreated }: { me: any; customerId: string; name: string; fromInquiryId: string; onClose: () => void; onCreated: (row: any) => void }) {
  const cat = useCatalogue(), [rows, setRows] = useState<ItemRow[] | null>(null), [needed, setNeeded] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const src = useQuery({ queryKey: ['reorder-src', fromInquiryId], queryFn: async () => {
    const { data, error } = await supabase.from('inquiry_items').select('product_id,quantity,mortis_spare_id,products(handle_of)').eq('inquiry_id', fromInquiryId).order('created_at'); if (error) throw error
    const m = new Map<string, any>() // Left/Right versions go back to the main lock, same lines are joined
    for (const i of (data ?? []) as any[]) { const p = Array.isArray(i.products) ? i.products[0] : i.products, pid = p?.handle_of ?? i.product_id, key = pid + '|' + (i.mortis_spare_id ?? ''), e = m.get(key); if (e) e.quantity = Number(e.quantity ?? 0) + Number(i.quantity ?? 0); else m.set(key, { product_id: pid, quantity: i.quantity, mortis_spare_id: i.mortis_spare_id }) }
    return Array.from(m.values()) } })
  const orig = useQuery({ queryKey: ['reorder-orig', fromInquiryId], queryFn: async () => (await supabase.from('inquiries').select('assigned_to').eq('id', fromInquiryId).maybeSingle()).data })
  if (cat.data && src.data && rows === null) { const x = rowsFromItems(src.data, cat.data); setRows(x.length ? x : [newRow()]) }
  async function create() {
    setErr(''); const prods = cat.data ?? [], used = (rows ?? []).filter((x) => x.pid || x.qty)
    if (!used.length) return setErr('Add at least one product.')
    for (const x of used) { const p = prods.find((y) => y.id === x.pid); if (!p) return setErr('Choose a category and a product on every item (or remove the empty item).'); if (!(Number(x.qty) > 0)) return setErr(`Enter the quantity for ${p.product_name}.`) }
    setBusy(true)
    try {
      const owner = me.role === 'admin' ? (orig.data?.assigned_to ?? me.id) : me.id
      const i = await supabase.from('inquiries').insert({ customer_id: customerId, inquiry_title: 'Repeat order', priority: 'Medium', inquiry_source: 'Repeat order', needed_by: needed || null, assigned_to: owner }).select('id').single(); if (i.error) throw i.error
      const it = await supabase.from('inquiry_items').insert(used.map((x) => { const p = prods.find((y) => y.id === x.pid)!; return { inquiry_id: i.data.id, product_id: p.id, product_name_snapshot: p.product_name, unit: p.unit ?? null, quantity: Number(x.qty), mortis_spare_id: x.mortis || null } })); if (it.error) throw it.error
      const row = await supabase.from('inquiries').select(INQ_SELECT).eq('id', i.data.id).single(); if (row.error) throw row.error
      onCreated(row.data)
    } catch (x: any) { setErr(x.message) } finally { setBusy(false) }
  }
  return <div className="modal"><div className="card" style={{ maxWidth: 560 }}>
    <h3 style={{ margin: 0 }}>Repeat order: {name}</h3>
    <div className="muted">The items of the earlier order are copied below. Change anything you need, then continue to confirm the order.</div>
    {!rows && <p className="empty">Loading…</p>}
    {rows && <ItemsEditor rows={rows} onChange={setRows} />}
    <label>Date the customer needs it (optional)<DateField value={needed} onChange={setNeeded} ariaLabel="Needed by" /></label>
    {err && <p className="msg">{err}</p>}
    <button className="primary" disabled={busy || !rows} onClick={create}>{busy ? 'Creating…' : 'Continue to confirm order'}</button><button className="link" onClick={onClose}>Cancel</button>
  </div></div>
}
