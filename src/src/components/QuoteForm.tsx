import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { inr } from '../lib/money'
type Line = { key: number; pid: string; name: string; qty: string; unit: string; price: string }
let k = 1
// "Record the quotation": pick the products, type the quantity and the price. Opens when an inquiry is moved to Quotation Sent.
export default function QuoteForm({ inquiry, onClose, onSaved, onSkip }: { inquiry: any; onClose: () => void; onSaved?: () => Promise<string | null>; onSkip?: () => Promise<string | null> }) {
  const qc = useQueryClient(), [lines, setLines] = useState<Line[] | null>(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const prods = useQuery({ queryKey: ['quote-products'], queryFn: async () => {
    const { data, error } = await supabase.from('products').select('id,product_name,unit').eq('active', true).order('product_name'); if (error) throw error; return data as any[] } })
  const items = useQuery({ queryKey: ['quote-items', inquiry.id], queryFn: async () => {
    const { data, error } = await supabase.from('inquiry_items').select('id,product_id,product_name_snapshot,quantity,unit').eq('inquiry_id', inquiry.id).order('created_at'); if (error) throw error; return data as any[] } })
  const ready = prods.data && items.data
  if (ready && lines === null) {
    const init: Line[] = items.data!.map((i) => ({ key: k++, pid: i.product_id ?? '__other', name: i.product_name_snapshot ?? '', qty: i.quantity != null ? String(Number(i.quantity)) : '', unit: i.unit ?? '', price: '' }))
    setLines(init.length ? init : [{ key: k++, pid: '', name: '', qty: '', unit: '', price: '' }])
  }
  const L = lines ?? []
  const set = (key: number, p: Partial<Line>) => setLines(L.map((l) => (l.key === key ? { ...l, ...p } : l)))
  const pick = (key: number, pid: string) => {
    if (pid === '__other' || pid === '') return set(key, { pid, name: pid === '' ? '' : L.find((l) => l.key === key)?.name ?? '' })
    const p = prods.data!.find((x) => x.id === pid); set(key, { pid, name: p?.product_name ?? '', unit: p?.unit ?? '' })
  }
  const lineTotal = (l: Line) => (Number(l.qty) > 0 && l.price !== '' ? Number(l.qty) * Number(l.price) : 0)
  const total = L.reduce((s, l) => s + lineTotal(l), 0)
  const done = async () => { qc.invalidateQueries({ queryKey: ['quotes'] }); qc.invalidateQueries({ queryKey: ['quote-library'] }); qc.invalidateQueries({ queryKey: ['inquiries'] }) }
  async function save() {
    setErr('')
    for (const l of L) {
      if (!l.name.trim()) return setErr('Choose a product (or type its name) on every line.')
      if (!(Number(l.qty) > 0)) return setErr(`Enter the quantity for ${l.name}.`)
      if (l.price === '' || Number(l.price) < 0) return setErr(`Enter the price for ${l.name}.`)
    }
    setBusy(true)
    const { error } = await supabase.rpc('create_quotation', { p_inquiry: inquiry.id, p_lines: L.map((l) => ({ product_id: l.pid && l.pid !== '__other' ? l.pid : null, name: l.name.trim(), quantity: Number(l.qty), unit: l.unit || null, unit_price: Number(l.price) })) })
    if (error) { setBusy(false); return setErr(error.message) }
    const e = onSaved ? await onSaved() : null
    setBusy(false); await done()
    if (e) setErr('The quotation is saved, but: ' + e); else onClose()
  }
  async function skip() { setBusy(true); const e = onSkip ? await onSkip() : null; setBusy(false); await done(); if (e) setErr(e); else onClose() }
  return (
    <div className="modal"><div className="card" style={{ maxWidth: 560 }}>
      <h3 style={{ margin: 0 }}>Record the quotation</h3>
      <div className="muted">{inquiry.customers?.customer_name ?? ''} · {inquiry.inquiry_number}</div>
      {!ready && <p className="empty">Loading…</p>}
      {L.map((l, i) => (
        <div className="card" key={l.key} style={{ margin: 0 }}>
          <div className="row"><b>Item {i + 1}</b>{L.length > 1 && <button type="button" className="link" onClick={() => setLines(L.filter((x) => x.key !== l.key))}>Remove</button>}</div>
          <label>Product<select value={l.pid} onChange={(e) => pick(l.key, e.target.value)}><option value="">Choose…</option>{prods.data?.map((p) => <option key={p.id} value={p.id}>{p.product_name}</option>)}<option value="__other">Other (type the name)</option></select></label>
          {l.pid === '__other' && <label>Name<input value={l.name} onChange={(e) => set(l.key, { name: e.target.value })} /></label>}
          <div className="bar">
            <label style={{ flex: 1 }}>Quantity{l.unit ? ` (${l.unit})` : ''}<input type="number" inputMode="decimal" min="0" step="any" value={l.qty} onChange={(e) => set(l.key, { qty: e.target.value })} /></label>
            <label style={{ flex: 1 }}>Price per piece (₹)<input type="number" inputMode="decimal" min="0" step="any" value={l.price} onChange={(e) => set(l.key, { price: e.target.value })} /></label>
          </div>
          {lineTotal(l) > 0 && <div className="muted">Line total: <b>{inr(lineTotal(l))}</b></div>}
        </div>
      ))}
      {ready && <button type="button" onClick={() => setLines([...L, { key: k++, pid: '', name: '', qty: '', unit: '', price: '' }])}>+ Add another item</button>}
      <div className="row"><b>Total quoted</b><b className="bignum" style={{ fontSize: 24 }}>{inr(total)}</b></div>
      {err && <p className="msg">{err}</p>}
      <div className="bar"><button className="primary" disabled={busy || !ready} onClick={save}>{busy ? 'Saving…' : onSaved ? 'Save and mark Quotation Sent' : 'Save quotation'}</button>
        {onSkip && <button disabled={busy} onClick={skip}>Skip, just move the stage</button>}<button disabled={busy} onClick={onClose}>Cancel</button></div>
    </div></div>
  )
}
