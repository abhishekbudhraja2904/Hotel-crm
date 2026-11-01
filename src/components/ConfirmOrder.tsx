import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
// Shown when an inquiry is moved to Order Confirmed: ties each line to a catalogue product so the stock can be LOCKED for this customer.
export default function ConfirmOrder({ inquiry, onConfirm, onClose }: { inquiry: any; onConfirm: () => Promise<string | null>; onClose: () => void }) {
  const [pick, setPick] = useState<Record<string, string>>({}), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const items = useQuery({ queryKey: ['confirm-items', inquiry.id], queryFn: async () => {
    const { data, error } = await supabase.from('inquiry_items').select('id,product_id,product_name_snapshot,quantity,unit').eq('inquiry_id', inquiry.id).order('created_at'); if (error) throw error; return data as any[] } })
  const prods = useQuery({ queryKey: ['confirm-products'], queryFn: async () => {
    const { data, error } = await supabase.from('products').select('id,product_name,product_code').eq('active', true).order('product_name'); if (error) throw error; return data as any[] } })
  const stock = useQuery({ queryKey: ['inventory', 'overview'], queryFn: async () => { const { data } = await supabase.rpc('stock_overview'); return (data ?? []) as any[] } })
  const val = (i: any) => pick[i.id] ?? i.product_id ?? ''
  const free = (pid: string) => Number(stock.data?.find((s: any) => s.product_id === pid)?.free ?? 0)
  async function go() {
    setBusy(true); setErr('')
    for (const i of items.data ?? []) {
      const v = pick[i.id]; if (v === undefined || v === (i.product_id ?? '')) continue
      const { error } = await supabase.from('inquiry_items').update({ product_id: v || null }).eq('id', i.id)
      if (error) { setBusy(false); return setErr(error.message) }
    }
    const e = await onConfirm(); setBusy(false); if (e) setErr(e); else onClose()
  }
  return (
    <div className="modal"><div className="card">
      <h3 style={{ margin: 0 }}>Confirm this order</h3>
      <div className="muted">{inquiry.customers?.customer_name ?? ''} · {inquiry.inquiry_number}</div>
      <p style={{ margin: 0 }}>Which products are being sold? These pieces will be <b>locked</b> for this customer so nobody else sells them.</p>
      {items.isLoading && <p className="empty">Loading…</p>}
      {items.data && !items.data.length && <p className="muted">This inquiry has no product lines, so no stock will be locked.</p>}
      {items.data?.map((i) => { const v = val(i), q = Number(i.quantity ?? 0); return (
        <div key={i.id} style={{ display: 'grid', gap: 4 }}>
          <b>{i.product_name_snapshot} × {i.quantity ?? '?'}</b>
          <select value={v} onChange={(e) => setPick({ ...pick, [i.id]: e.target.value })}>
            <option value="">Not a stock item (no stock locked)</option>
            {prods.data?.map((p) => <option key={p.id} value={p.id}>{p.product_name}{p.product_code ? ` (${p.product_code})` : ''}</option>)}
          </select>
          {v && q > free(v) && <div className="warnbox">Only {free(v)} free in store for this product. You can still confirm; the stock team will see the shortage.</div>}
        </div>) })}
      {err && <p className="msg">{err}</p>}
      <button className="primary" disabled={busy || items.isLoading} onClick={go}>{busy ? 'Saving…' : 'Confirm order'}</button>
      <button className="link" onClick={onClose}>Cancel (keep current stage)</button>
    </div></div>
  )
}
