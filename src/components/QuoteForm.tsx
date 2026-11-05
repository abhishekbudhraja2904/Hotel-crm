import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import WhoFor from './WhoFor'
import ItemsEditor, { ItemRow, newRow, rowsFromItems, useCatalogue } from './ItemsEditor'
// "Record the quotation": the inquiry's items come pre-filled; check the quantity, type the price. Opens when an inquiry is moved to Quotation Sent.
export default function QuoteForm({ inquiry, onClose, onSaved, onSkip }: { inquiry: any; onClose: () => void; onSaved?: () => Promise<string | null>; onSkip?: () => Promise<string | null> }) {
  const qc = useQueryClient(), [rows, setRows] = useState<ItemRow[] | null>(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [number, setNumber] = useState<string | null>(null), [inst, setInst] = useState(''), [freight, setFreight] = useState('')
  const cat = useCatalogue()
  const items = useQuery({ queryKey: ['quote-items', inquiry.id], queryFn: async () => {
    const { data, error } = await supabase.from('inquiry_items').select('id,product_id,product_name_snapshot,quantity,unit').eq('inquiry_id', inquiry.id).order('created_at'); if (error) throw error; return data as any[] } })
  const last = useQuery({ queryKey: ['quote-last', inquiry.id], queryFn: async () => {
    const { data } = await supabase.from('quotations').select('quotation_number').eq('inquiry_id', inquiry.id).order('created_at', { ascending: false }).limit(1); return (data?.[0]?.quotation_number as string) ?? '' } })
  const numVal = number ?? last.data ?? '' // a revised quote starts with the previous number; staff can type a different one
  const ready = cat.data && items.data && last.data !== undefined
  if (ready && rows === null) { const init = rowsFromItems(items.data!, cat.data!); setRows(init.length ? init : [newRow()]) }
  const R = rows ?? []
  const done = async () => { qc.invalidateQueries({ queryKey: ['quotes'] }); qc.invalidateQueries({ queryKey: ['quote-library'] }); qc.invalidateQueries({ queryKey: ['inquiries'] }) }
  async function save() {
    setErr('')
    if (!numVal.trim()) return setErr('Enter the quotation number.')
    const prods = cat.data ?? []
    for (const l of R) {
      const p = prods.find((x) => x.id === l.pid)
      if (!p) return setErr('Choose a category and a product on every item (or remove the empty item).')
      if (!(Number(l.qty) > 0)) return setErr(`Enter the quantity for ${p.product_name}.`)
      if (!l.price || Number(l.price) < 0) return setErr(`Enter the price for ${p.product_name}.`)
    }
    setBusy(true)
    const { error } = await supabase.rpc('create_quotation', { p_inquiry: inquiry.id, p_number: numVal.trim(), p_installation: Number(inst) || 0, p_freight: Number(freight) || 0, p_lines: R.map((l) => { const p = prods.find((x) => x.id === l.pid)!; return { product_id: p.id, name: p.product_name, quantity: Number(l.qty), unit: p.unit || null, unit_price: Number(l.price) } }) })
    if (error) { setBusy(false); return setErr(error.message) }
    const e = onSaved ? await onSaved() : null
    setBusy(false); await done()
    if (e) setErr('The quotation is saved, but: ' + e); else onClose()
  }
  async function skip() { setBusy(true); const e = onSkip ? await onSkip() : null; setBusy(false); await done(); if (e) setErr(e); else onClose() }
  return (
    <div className="modal"><div className="card" style={{ maxWidth: 560 }}>
      <h3 style={{ margin: 0 }}>Record the quotation</h3>
      <WhoFor inquiry={inquiry} />
      {!ready && <p className="empty">Loading…</p>}
      {ready && <label>Quotation number<input required value={numVal} onChange={(e) => setNumber(e.target.value)} placeholder="the number on your Excel quotation" />
        <span className="muted" style={{ textTransform: 'none', letterSpacing: 0, fontFamily: 'inherit', fontSize: 12 }}>Type it yourself. Use the same number again to record a revised version.</span></label>}
      {ready && <ItemsEditor rows={R} onChange={setRows} showPrice keepOne />}
      {ready && <label>Installation charges (₹, optional)<input type="number" min="0" step="any" value={inst} onChange={(e) => setInst(e.target.value)} placeholder="Leave empty if not charged" /></label>}
      {ready && <label>Freight / courier charges (₹, paid by the buyer, optional)<input type="number" min="0" step="any" value={freight} onChange={(e) => setFreight(e.target.value)} placeholder="Leave empty if not charged" />
        <span className="muted" style={{ textTransform: 'none', letterSpacing: 0, fontFamily: 'inherit', fontSize: 12 }}>Not part of the total above, no GST on it. It is picked up automatically when the order is confirmed.</span></label>}
      {err && <p className="msg">{err}</p>}
      <div className="bar"><button className="primary" disabled={busy || !ready} onClick={save}>{busy ? 'Saving…' : onSaved ? 'Save and mark Quotation Sent' : 'Save quotation'}</button>
        {onSkip && <button disabled={busy} onClick={skip}>Skip, just move the stage</button>}<button disabled={busy} onClick={onClose}>Cancel</button></div>
    </div></div>
  )
}
