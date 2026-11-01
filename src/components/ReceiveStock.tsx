import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
// Stock has arrived: say what and how many; the app gives each pack its PACKING NUMBER to write on the box.
export default function ReceiveStock({ products, onClose, onDone }: { products: any[]; onClose: () => void; onDone: () => void }) {
  const [pid, setPid] = useState(''), [pieces, setPieces] = useState(''), [per, setPer] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [nums, setNums] = useState<number[] | null>(null)
  const next = useQuery({ queryKey: ['inventory', 'nextno'], queryFn: async () => Number((await supabase.rpc('next_packing_no')).data ?? 1) })
  const P = Number(pieces) || 0, K = Number(per) || 0, packs = P > 0 && K > 0 ? Math.ceil(P / K) : 0, n0 = next.data ?? 1
  const prod = products.find((p) => p.product_id === pid)
  async function save() {
    if (!pid) return setErr('Choose the product.'); if (!(P > 0 && K > 0)) return setErr('Enter the pieces received and the pieces in each pack.')
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('receive_stock', { p_product: pid, p_pieces: P, p_per_pack: K })
    setBusy(false); if (error) return setErr(error.message)
    setNums(data as number[]); onDone()
  }
  const adj = (v: string, d: number, set: (s: string) => void) => set(String(Math.max(0, (Number(v) || 0) + d)))
  if (nums) return (
    <div className="modal"><div className="card">
      <div className="okbox"><b>✓ Stock added: {P} {prod?.unit ?? 'pcs'} of {prod?.product_name}</b></div>
      <h3 style={{ margin: 0 }}>Write these packing numbers on the boxes</h3>
      <div className="chips">{nums.map((n) => <span key={n} className="chip">{n}</span>)}</div>
      <p className="muted" style={{ margin: 0 }}>{nums.length} pack{nums.length > 1 ? 's' : ''}, {K} pieces in each{P % K ? ` (the last one has ${P % K})` : ''}.</p>
      <button className="primary bigbtn" onClick={onClose}>Done</button>
    </div></div>)
  return (
    <div className="modal"><div className="card">
      <h3 style={{ margin: 0 }}>Receive stock</h3>
      <label>Which product?<select value={pid} onChange={(e) => setPid(e.target.value)}><option value="">Choose…</option>{products.map((p) => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}</select></label>
      <label>How many pieces came?<div className="stepper"><button type="button" onClick={() => adj(pieces, -1, setPieces)}>−</button><input type="number" inputMode="numeric" min="0" value={pieces} onChange={(e) => setPieces(e.target.value)} /><button type="button" onClick={() => adj(pieces, 1, setPieces)}>+</button></div></label>
      <label>How many pieces in each pack?<div className="stepper"><button type="button" onClick={() => adj(per, -1, setPer)}>−</button><input type="number" inputMode="numeric" min="0" value={per} onChange={(e) => setPer(e.target.value)} /><button type="button" onClick={() => adj(per, 1, setPer)}>+</button></div></label>
      {packs > 0 && <div className="warnbox">This makes <b>{packs}</b> pack{packs > 1 ? 's' : ''}: packing number{packs > 1 ? 's' : ''} <b>{n0}{packs > 1 ? ` to ${n0 + packs - 1}` : ''}</b>{P % K ? `. The last pack has ${P % K} pieces.` : '.'}</div>}
      {err && <p className="msg">{err}</p>}
      <button className="primary bigbtn go" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Add to stock'}</button>
      <button className="link" onClick={onClose}>Cancel</button>
    </div></div>
  )
}
