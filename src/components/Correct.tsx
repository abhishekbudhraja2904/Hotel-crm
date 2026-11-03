import { useState } from 'react'
import { supabase } from '../lib/supabase'
// Fix a product's count (damage, miscount). A reason is required.
export default function Correct({ product, onClose, onDone }: { product: any; onClose: () => void; onDone: () => void }) {
  const [val, setVal] = useState('0'), [reason, setReason] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('correct_stock', { p_product: product.product_id, p_change: Number(val), p_reason: reason })
    setBusy(false); if (error) setErr(error.message); else { onDone(); onClose() }
  }
  return (
    <div className="modal"><div className="card">
      <h3 style={{ margin: 0 }}>Fix count: {product.product_name}</h3>
      <div className="muted">{Number(product.in_store)} in store now</div>
      <label>Add (+) or remove (−) this many pieces<input type="number" value={val} onChange={(e) => setVal(e.target.value)} style={{ fontSize: 24, height: 52 }} /></label>
      <label>Why? (for example damaged, counted wrong)<input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      {err && <p className="msg">{err}</p>}
      <button className="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      <button className="link" onClick={onClose}>Cancel</button>
    </div></div>
  )
}
