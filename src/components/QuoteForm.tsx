import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import WhoFor from './WhoFor'
import ItemsEditor, { ItemRow, newRow, rowsFromItems, useCatalogue, useMortisOptions } from './ItemsEditor'
// "Record the quotation": the inquiry's items come pre-filled; check the quantities and type the quotation number. No amounts are recorded. Opens when an inquiry is moved to Quotation Sent.
export default function QuoteForm({ inquiry, onClose, onSaved, onSkip, reviseFrom }: { inquiry: any; reviseFrom?: any; onClose: () => void; onSaved?: () => Promise<string | null>; onSkip?: () => Promise<string | null> }) {
  const qc = useQueryClient(), [rows, setRows] = useState<ItemRow[] | null>(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [number, setNumber] = useState<string | null>(null), mortisOpts = useMortisOptions().data ?? []
  const cat = useCatalogue()
  const items = useQuery({ queryKey: ['quote-items', inquiry.id], queryFn: async () => {
    const { data, error } = await supabase.from('inquiry_items').select('id,product_id,product_name_snapshot,quantity,unit,mortis_spare_id').eq('inquiry_id', inquiry.id).order('created_at'); if (error) throw error; return data as any[] } })
  const last = useQuery({ queryKey: ['quote-last', inquiry.id], queryFn: async () => {
    const { data } = await supabase.from('quotations').select('quotation_number').eq('inquiry_id', inquiry.id).order('created_at', { ascending: false }).limit(1); return (data?.[0]?.quotation_number as string) ?? '' } })
  const numVal = number ?? last.data ?? '' // a revised quote starts with the previous number; staff can type a different one
  const ready = cat.data && items.data && last.data !== undefined
  if (ready && rows === null) {
    // Revising a quotation: start from that quotation's items and quantities (change what is needed), otherwise from the inquiry's items.
    const src = reviseFrom ? (reviseFrom.quotation_lines ?? []).map((l: any) => ({ product_id: l.product_id, quantity: l.quantity })) : items.data!
    const init = rowsFromItems(src, cat.data!); setRows(init.length ? init : [newRow()])
  }
  if (reviseFrom && number === null && ready) setNumber(reviseFrom.quotation_number)
  const R = rows ?? []
  const done = async () => { qc.invalidateQueries({ queryKey: ['quotes'] }); qc.invalidateQueries({ queryKey: ['quote-library'] }); qc.invalidateQueries({ queryKey: ['inquiries'] }) }
  async function save() {
    setErr('')
    if (!numVal.trim()) return setErr('Enter the quotation number.')
    const prods = cat.data ?? []
    const used = R.filter((l) => l.pid || l.qty)
    if (!used.length) return setErr('Add at least one item.')
    for (const l of used) {
      const p = prods.find((x) => x.id === l.pid)
      if (!p) return setErr('Choose a category and a product on every item (or remove the empty item).')
      if (!(Number(l.qty) > 0)) return setErr(`Enter the quantity for ${p.product_name}.`)
    }
    setBusy(true)
    // No amounts are recorded: every price goes in as 0.
    const { error } = await supabase.rpc('create_quotation', { p_inquiry: inquiry.id, p_number: numVal.trim(), p_installation: 0, p_freight: 0, p_freight_gst: false, p_gst_mode: 'plus', p_gst_rate: 0, p_lines: used.map((l) => { const p = prods.find((x) => x.id === l.pid)!; return { product_id: p.id, name: p.product_name + (l.mortis ? ` (with ${mortisOpts.find((m) => m.id === l.mortis)?.name ?? 'special mortis'})` : ''), quantity: Number(l.qty), unit: p.unit || null, unit_price: 0 } }) })
    if (error) { setBusy(false); return setErr(error.message) }
    const e = onSaved ? await onSaved() : null
    setBusy(false); await done()
    if (e) setErr('The quotation is saved, but: ' + e); else onClose()
  }
  async function skip() { setBusy(true); const e = onSkip ? await onSkip() : null; setBusy(false); await done(); if (e) setErr(e); else onClose() }
  return (
    <div className="modal"><div className="card" style={{ maxWidth: 560 }}>
      <h3 style={{ margin: 0 }}>{reviseFrom ? `Revise ${reviseFrom.quotation_number}` : 'Record the quotation'}</h3>
      <WhoFor inquiry={inquiry} />
      {!ready && <p className="empty">Loading…</p>}
      {ready && <label>Quotation number<input required value={numVal} onChange={(e) => setNumber(e.target.value)} placeholder="the number on your Excel quotation" />
        <span className="muted" style={{ textTransform: 'none', letterSpacing: 0, fontFamily: 'inherit', fontSize: 12 }}>Type it yourself. Use the same number again to record a revised version.</span></label>}
      {ready && <ItemsEditor rows={R} onChange={setRows} keepOne />}
      {err && <p className="msg">{err}</p>}
      <div className="bar"><button className="primary" disabled={busy || !ready} onClick={save}>{busy ? 'Saving…' : onSaved ? 'Save and mark Quotation Sent' : 'Save quotation'}</button>
        {onSkip && <button disabled={busy} onClick={skip}>Skip, just move the stage</button>}<button disabled={busy} onClick={onClose}>Cancel</button></div>
    </div></div>
  )
}
