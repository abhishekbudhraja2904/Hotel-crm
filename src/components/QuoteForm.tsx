import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import WhoFor from './WhoFor'
import { useSettings } from '../lib/settings'
import { inr } from '../lib/money'
import ItemsEditor, { ItemRow, newRow, rowsFromItems, useCatalogue } from './ItemsEditor'
// "Record the quotation": the inquiry's items come pre-filled; check the quantity, type the price. Opens when an inquiry is moved to Quotation Sent.
export default function QuoteForm({ inquiry, onClose, onSaved, onSkip }: { inquiry: any; onClose: () => void; onSaved?: () => Promise<string | null>; onSkip?: () => Promise<string | null> }) {
  const qc = useQueryClient(), [rows, setRows] = useState<ItemRow[] | null>(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [number, setNumber] = useState<string | null>(null), [inst, setInst] = useState(''), [freight, setFreight] = useState(''), [fgst, setFgst] = useState(true), [mode, setMode] = useState<'plus' | 'inclusive'>('plus'), [rateStr, setRateStr] = useState<string | null>(null), { gstRate } = useSettings()
  const cat = useCatalogue()
  const items = useQuery({ queryKey: ['quote-items', inquiry.id], queryFn: async () => {
    const { data, error } = await supabase.from('inquiry_items').select('id,product_id,product_name_snapshot,quantity,unit').eq('inquiry_id', inquiry.id).order('created_at'); if (error) throw error; return data as any[] } })
  const last = useQuery({ queryKey: ['quote-last', inquiry.id], queryFn: async () => {
    const { data } = await supabase.from('quotations').select('quotation_number').eq('inquiry_id', inquiry.id).order('created_at', { ascending: false }).limit(1); return (data?.[0]?.quotation_number as string) ?? '' } })
  const numVal = number ?? last.data ?? '' // a revised quote starts with the previous number; staff can type a different one
  const ready = cat.data && items.data && last.data !== undefined
  if (ready && rows === null) { const init = rowsFromItems(items.data!, cat.data!); setRows(init.length ? init : [newRow()]) }
  const R = rows ?? []
  const rate = rateStr === null ? gstRate : Number(rateStr) || 0
  const sub = R.reduce((a, l) => a + (Number(l.qty) > 0 && l.price ? Number(l.qty) * Number(l.price) : 0), 0) + (Number(inst) || 0), F = Number(freight) || 0
  const gst = mode === 'plus' ? Math.round(sub * rate) / 100 : Math.round((sub - sub / (1 + rate / 100)) * 100) / 100, FG = F > 0 && fgst ? (mode === 'plus' ? Math.round(F * rate) / 100 : Math.round((F - F / (1 + rate / 100)) * 100) / 100) : 0, payable = (mode === 'plus' ? sub + gst + FG : sub) + F
  const done = async () => { qc.invalidateQueries({ queryKey: ['quotes'] }); qc.invalidateQueries({ queryKey: ['quote-library'] }); qc.invalidateQueries({ queryKey: ['inquiries'] }) }
  async function save() {
    setErr('')
    if (!numVal.trim()) return setErr('Enter the quotation number.')
    const prods = cat.data ?? []
    const used = R.filter((l) => l.pid || l.qty || l.price)
    if (!used.length) return setErr('Add at least one item.')
    for (const l of used) {
      const p = prods.find((x) => x.id === l.pid)
      if (!p) return setErr('Choose a category and a product on every item (or remove the empty item).')
      if (!(Number(l.qty) > 0)) return setErr(`Enter the quantity for ${p.product_name}.`)
      if (!l.price || Number(l.price) < 0) return setErr(`Enter the price for ${p.product_name}.`)
    }
    setBusy(true)
    const { error } = await supabase.rpc('create_quotation', { p_inquiry: inquiry.id, p_number: numVal.trim(), p_installation: Number(inst) || 0, p_freight: Number(freight) || 0, p_freight_gst: fgst, p_gst_mode: mode, p_gst_rate: rate, p_lines: used.map((l) => { const p = prods.find((x) => x.id === l.pid)!; return { product_id: p.id, name: p.product_name, quantity: Number(l.qty), unit: p.unit || null, unit_price: Number(l.price) } }) })
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
      {ready && <div style={{ display: 'grid', gap: 6 }}>
        <div className="bar">
          <button type="button" className={mode === 'plus' ? 'primary' : ''} onClick={() => setMode('plus')}>+ GST ({rate}%)</button>
          <button type="button" className={mode === 'inclusive' ? 'primary' : ''} onClick={() => setMode('inclusive')}>Prices include GST</button></div>
        <label>GST rate (%)<input type="number" min="0" max="100" step="any" value={rateStr ?? String(gstRate)} onChange={(e) => setRateStr(e.target.value)} /></label></div>}
      {ready && <label>Freight / courier charges (₹, paid by the buyer, optional)<input type="number" min="0" step="any" value={freight} onChange={(e) => setFreight(e.target.value)} placeholder="Leave empty if not charged" />
        <span className="muted" style={{ textTransform: 'none', letterSpacing: 0, fontFamily: 'inherit', fontSize: 12 }}>Not part of the total above. It is picked up automatically when the order is confirmed.</span></label>}
      {ready && F > 0 && <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexDirection: 'row', color: 'inherit', fontSize: 14 }}><input type="checkbox" style={{ width: 18, height: 18, padding: 0 }} checked={fgst} onChange={(e) => setFgst(e.target.checked)} />Charge GST on freight too ({rate}%{mode === 'inclusive' ? ', already inside the freight amount' : ', added'})</label>}
      {ready && sub > 0 && <div className="warnbox" style={{ display: 'grid', gap: 3 }}>
        <div className="row"><span>Items{Number(inst) > 0 ? ' + installation' : ''}{mode === 'inclusive' ? ' (GST included)' : ''}</span><span>{inr(sub)}</span></div>
        <div className="row"><span>{mode === 'plus' ? `GST ${rate}% (added)` : `GST ${rate}% (already inside)`}</span><span>{mode === 'plus' ? '+ ' : ''}{inr(gst)}</span></div>
        {F > 0 && <div className="row"><span>Freight{mode === 'inclusive' && FG > 0 ? ' (GST included)' : ' (added)'}</span><span>+ {inr(F)}</span></div>}
        {FG > 0 && <div className="row"><span>{mode === 'plus' ? `GST ${rate}% on freight (added)` : `GST ${rate}% on freight (already inside)`}</span><span>{mode === 'plus' ? '+ ' : ''}{inr(FG)}</span></div>}
        <div className="row"><b>Total to receive</b><b>{inr(payable)}</b></div></div>}
      {err && <p className="msg">{err}</p>}
      <div className="bar"><button className="primary" disabled={busy || !ready} onClick={save}>{busy ? 'Saving…' : onSaved ? 'Save and mark Quotation Sent' : 'Save quotation'}</button>
        {onSkip && <button disabled={busy} onClick={skip}>Skip, just move the stage</button>}<button disabled={busy} onClick={onClose}>Cancel</button></div>
    </div></div>
  )
}
