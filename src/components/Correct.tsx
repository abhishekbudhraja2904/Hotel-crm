import { useState } from 'react'
import { supabase } from '../lib/supabase'
// Fix a product's count (damage, miscount). A reason is required. Locks with handles: type the true Left and Right counts.
export default function Correct({ product, parts, onClose, onDone }: { product: any; parts?: { left: number; right: number } | null; onClose: () => void; onDone: () => void }) {
  const [val, setVal] = useState('0'), [reason, setReason] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const [L, setL] = useState(String(parts?.left ?? 0)), [R, setR] = useState(String(parts?.right ?? 0))
  const isLock = !!parts, [split, setSplit] = useState(false)
  async function save() {
    setBusy(true); setErr('')
    const { error } = isLock && split
      ? await supabase.rpc('set_handle_stock', { p_product: product.product_id, p_left: Number(L), p_right: Number(R), p_reason: reason })
      : await supabase.rpc('correct_stock', { p_product: product.product_id, p_change: Number(val), p_reason: reason })
    setBusy(false); if (error) setErr(error.message); else { onDone(); onClose() }
  }
  return (
    <div className="modal"><div className="card">
      <h3 style={{ margin: 0 }}>Fix count: {product.product_name}</h3>
      {isLock && split ? <>
        <div className="muted">Type how many Left and how many Right are really in the store now.</div>
        <label>Left handle pieces<input type="number" min="0" value={L} onChange={(e) => setL(e.target.value)} style={{ fontSize: 24, height: 52 }} /></label>
        <label>Right handle pieces<input type="number" min="0" value={R} onChange={(e) => setR(e.target.value)} style={{ fontSize: 24, height: 52 }} /></label>
        <div className="muted">Total: {(Number(L) || 0) + (Number(R) || 0)}</div>
      </> : <>
        <div className="muted">{Number(product.in_store)} in store now</div>
        <label>Add (+) or remove (−) this many pieces<input type="number" value={val} onChange={(e) => setVal(e.target.value)} style={{ fontSize: 24, height: 52 }} /></label>
      </>}
      {isLock && <button type="button" className="link" onClick={() => setSplit(!split)}>{split ? 'Just change the total instead' : 'Enter door handle counts, Left / Right (optional)'}</button>}
      <label>Why? (for example damaged, counted wrong)<input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      {err && <p className="msg">{err}</p>}
      <button className="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      <button className="link" onClick={onClose}>Cancel</button>
    </div></div>
  )
}
