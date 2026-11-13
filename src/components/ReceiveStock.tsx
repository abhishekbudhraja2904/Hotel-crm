import { useState } from 'react'
import { supabase } from '../lib/supabase'
// Stock has arrived: choose the product from the catalogue and say how many pieces came.
import { productOptions } from './ProductOptions'
export default function ReceiveStock({ products, onClose, onDone }: { products: any[]; onClose: () => void; onDone: () => void }) {
  const [L, setL] = useState(''), [R, setR] = useState('')
  const [pid, setPid] = useState(''), [pieces, setPieces] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [added, setAdded] = useState<string | null>(null)
  const nl = Number(L) || 0, nr = Number(R) || 0, P = Number(pieces) || 0, prod = products.find((p) => p.product_id === pid), isLock = /^RFID Hotel Lock/i.test(prod?.product_category ?? '')
  async function save() {
    if (!pid) return setErr('Choose the product.')
    const split = isLock && (L !== '' || R !== '')
    if (split ? !(nl + nr > 0) : !(P > 0)) return setErr(split ? 'Enter how many Left and how many Right came.' : 'Enter how many pieces came.')
    setBusy(true); setErr('')
    const { error } = split ? await supabase.rpc('receive_stock_handles', { p_product: pid, p_left: nl, p_right: nr }) : await supabase.rpc('receive_stock', { p_product: pid, p_pieces: P })
    setBusy(false); if (error) return setErr(error.message)
    setAdded(split ? `${prod?.product_name}: ${nl} Left + ${nr} Right` : `${P} ${prod?.unit ?? 'pcs'} of ${prod?.product_name}`); onDone()
  }
  const adj = (d: number) => setPieces(String(Math.max(0, (Number(pieces) || 0) + d)))
  if (added) return <div className="modal"><div className="card"><div className="okbox"><b>✓ Stock added: {added}</b></div><button className="primary bigbtn" onClick={onClose}>Done</button></div></div>
  return (
    <div className="modal"><div className="card">
      <h3 style={{ margin: 0 }}>Stock came in</h3>
      <label>Which product?<select value={pid} onChange={(e) => { setPid(e.target.value); setL(''); setR('') }}><option value="">Choose…</option>{productOptions(products, 'product_id')}</select></label>
      {isLock && <div className="warnbox" style={{ display: 'grid', gap: 8 }}><b>Left / Right split (optional)</b><div className="muted">Fill these if you know how many are Left and Right. Or leave both empty and just enter the total below.</div>
        <label>Left handle pieces<input type="number" inputMode="numeric" min="0" value={L} onChange={(e) => setL(e.target.value)} style={{ fontSize: 22, height: 48 }} /></label>
        <label>Right handle pieces<input type="number" inputMode="numeric" min="0" value={R} onChange={(e) => setR(e.target.value)} style={{ fontSize: 22, height: 48 }} /></label>
        <div className="muted">Total: {nl + nr}</div></div>}
      {!(isLock && (L !== '' || R !== '')) && <label>How many pieces came?<div className="stepper"><button type="button" onClick={() => adj(-1)}>−</button><input type="number" inputMode="numeric" min="0" value={pieces} onChange={(e) => setPieces(e.target.value)} /><button type="button" onClick={() => adj(1)}>+</button></div></label>}
      {err && <p className="msg">{err}</p>}
      <button className="primary bigbtn go" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Add to stock'}</button>
      <button className="link" onClick={onClose}>Cancel</button>
    </div></div>
  )
}
