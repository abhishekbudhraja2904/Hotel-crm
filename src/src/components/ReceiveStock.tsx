import { useState } from 'react'
import { supabase } from '../lib/supabase'
// Stock has arrived: choose the product from the catalogue and say how many pieces came.
export default function ReceiveStock({ products, onClose, onDone }: { products: any[]; onClose: () => void; onDone: () => void }) {
  const [pid, setPid] = useState(''), [pieces, setPieces] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [added, setAdded] = useState<string | null>(null)
  const P = Number(pieces) || 0, prod = products.find((p) => p.product_id === pid)
  async function save() {
    if (!pid) return setErr('Choose the product.'); if (!(P > 0)) return setErr('Enter how many pieces came.')
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('receive_stock', { p_product: pid, p_pieces: P })
    setBusy(false); if (error) return setErr(error.message)
    setAdded(`${P} ${prod?.unit ?? 'pcs'} of ${prod?.product_name}`); onDone()
  }
  const adj = (d: number) => setPieces(String(Math.max(0, (Number(pieces) || 0) + d)))
  if (added) return <div className="modal"><div className="card"><div className="okbox"><b>✓ Stock added: {added}</b></div><button className="primary bigbtn" onClick={onClose}>Done</button></div></div>
  return (
    <div className="modal"><div className="card">
      <h3 style={{ margin: 0 }}>Stock came in</h3>
      <label>Which product?<select value={pid} onChange={(e) => setPid(e.target.value)}><option value="">Choose…</option>{products.map((p) => <option key={p.product_id} value={p.product_id}>{p.product_name}{p.product_code ? ` (${p.product_code})` : ''}</option>)}</select></label>
      <label>How many pieces came?<div className="stepper"><button type="button" onClick={() => adj(-1)}>−</button><input type="number" inputMode="numeric" min="0" value={pieces} onChange={(e) => setPieces(e.target.value)} /><button type="button" onClick={() => adj(1)}>+</button></div></label>
      {err && <p className="msg">{err}</p>}
      <button className="primary bigbtn go" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Add to stock'}</button>
      <button className="link" onClick={onClose}>Cancel</button>
    </div></div>
  )
}
