import { useState } from 'react'
import { supabase } from '../lib/supabase'
// Fix a count: either one pack (by packing number) or a product's loose stock.
export default function Correct({ pack, product, onClose, onDone }: { pack?: any; product?: any; onClose: () => void; onDone: () => void }) {
  const [val, setVal] = useState(pack ? String(pack.pieces_left) : '0'), [reason, setReason] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true); setErr('')
    const { error } = pack ? await supabase.rpc('correct_pack', { p_pack: pack.id, p_left: Number(val), p_reason: reason })
      : await supabase.rpc('correct_stock', { p_product: product.product_id, p_change: Number(val), p_reason: reason })
    setBusy(false); if (error) setErr(error.message); else { onDone(); onClose() }
  }
  return (
    <div className="modal"><div className="card">
      <h3 style={{ margin: 0 }}>{pack ? `Fix packing number ${pack.packing_no}` : `Fix count: ${product.product_name}`}</h3>
      <label>{pack ? 'Pieces really in this pack now' : 'Add (+) or remove (−) this many pieces'}<input type="number" value={val} onChange={(e) => setVal(e.target.value)} style={{ fontSize: 24, height: 52 }} /></label>
      <label>Why? (for example damaged, counted wrong)<input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      {err && <p className="msg">{err}</p>}
      <button className="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      <button className="link" onClick={onClose}>Cancel</button>
    </div></div>
  )
}
