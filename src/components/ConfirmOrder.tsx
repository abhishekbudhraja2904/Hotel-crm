import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import WhoFor from './WhoFor'
// Shown when an inquiry is moved to Order Confirmed: ties each line to a catalogue product so the stock can be LOCKED for this customer.
export default function ConfirmOrder({ inquiry, onConfirm, onClose }: { inquiry: any; onConfirm: () => Promise<string | null>; onClose: () => void }) {
  const [pick, setPick] = useState<Record<string, string>>({}), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [packNo, setPackNo] = useState<number | null>(null), [packer, setPacker] = useState(''), [packerSaved, setPackerSaved] = useState('')
  const items = useQuery({ queryKey: ['confirm-items', inquiry.id], queryFn: async () => {
    const { data, error } = await supabase.from('inquiry_items').select('id,product_id,product_name_snapshot,quantity,unit').eq('inquiry_id', inquiry.id).order('created_at'); if (error) throw error; return data as any[] } })
  const prods = useQuery({ queryKey: ['confirm-products'], queryFn: async () => {
    const { data, error } = await supabase.from('products').select('id,product_name,product_code,product_category').eq('active', true).is('handle_of', null).order('sort_order').order('product_name'); if (error) throw error; return data as any[] } })
  // Left / Right handle versions of locks that already exist (they are created automatically the first time a lock is split)
  const [hand, setHand] = useState<Record<string, { l: string; r: string }>>({})
  const vers = useQuery({ queryKey: ['confirm-handles'], queryFn: async () => ((await supabase.from('products').select('id,handle_of').not('handle_of', 'is', null)).data ?? []) as any[] })
  const stock = useQuery({ queryKey: ['inventory', 'overview'], queryFn: async () => { const { data } = await supabase.rpc('stock_overview'); return (data ?? []) as any[] } })
  const techs = useQuery({ queryKey: ['employees', 'service'], queryFn: async () => (await supabase.from('employees').select('id,employee_name').eq('active', true).eq('role', 'service').order('employee_name')).data ?? [] })
  async function assign() {
    if (!packer) return setErr('Choose who will collect and pack this order.')
    const { error } = await supabase.rpc('assign_packer', { p_inq: inquiry.id, p_emp: packer })
    if (error) return setErr(error.message); setErr(''); setPackerSaved(techs.data?.find((t: any) => t.id === packer)?.employee_name ?? 'selected')
  }
  const val = (i: any) => pick[i.id] ?? i.product_id ?? ''
  // An RFID hotel lock line must say how many are Left-handle and how many Right-handle (so the right lock is packed).
  const isLock = (pid: string) => /^RFID Hotel Lock/i.test(prods.data?.find((p: any) => p.id === pid)?.product_category ?? '')
  const needHand = (i: any) => { const v = val(i); return !!v && isLock(v) && !(vers.data ?? []).some((x: any) => x.id === v) }
  const hv = (i: any) => hand[i.id] ?? { l: '', r: '' }
  const handOk = (i: any) => { const h = hv(i), q = Number(i.quantity ?? 0); return q > 0 && Number(h.l || 0) >= 0 && Number(h.r || 0) >= 0 && Number(h.l || 0) + Number(h.r || 0) === q }
  const blocked = (items.data ?? []).some((i) => needHand(i) && !handOk(i))
  const hasStock = !!stock.data?.length // only people allowed to see stock get these numbers
  const free = (pid: string) => Number(stock.data?.find((s: any) => s.product_id === pid)?.free ?? 0)
  async function go() {
    setBusy(true); setErr('')
    for (const i of items.data ?? []) {
      const v = pick[i.id]; if (v === undefined || v === (i.product_id ?? '')) continue
      const { error } = await supabase.from('inquiry_items').update({ product_id: v || null }).eq('id', i.id)
      if (error) { setBusy(false); return setErr(error.message) }
    }
    for (const i of items.data ?? []) {
      if (!needHand(i)) continue
      const h = hv(i); const { error } = await supabase.rpc('set_line_handles', { p_item: i.id, p_left: Number(h.l || 0), p_right: Number(h.r || 0) })
      if (error) { setBusy(false); return setErr(error.message) }
    }
    const e = await onConfirm()
    if (e) { setBusy(false); return setErr(e) }
    const n = await supabase.from('inquiries').select('packing_no').eq('id', inquiry.id).maybeSingle()
    setBusy(false); setPackNo(n.data?.packing_no ?? 0)
  }
  if (packNo !== null) return (
    <div className="modal"><div className="card">
      <div className="okbox"><b>✓ Order confirmed</b></div>
      <WhoFor inquiry={inquiry} />
      {packNo ? <><div className="muted">Packing number for this order</div><div className="pack-big">{packNo}</div><p className="muted" style={{ margin: 0 }}>Write this number on every carton of this order.</p></> : <p className="muted">The packing number will show on the inquiry.</p>}
      <label>Who will collect and pack this order?<select value={packer} onChange={(e) => setPacker(e.target.value)}><option value="">Choose a service employee…</option>{techs.data?.map((t: any) => <option key={t.id} value={t.id}>{t.employee_name}</option>)}</select></label>
      {packerSaved ? <div className="okbox">✓ Assigned to {packerSaved}. It shows on their screen when you mark the order ready.</div> : <button onClick={assign}>Assign packing</button>}
      {err && <p className="msg">{err}</p>}
      <button className="primary bigbtn" onClick={onClose}>Done</button>
    </div></div>)
  return (
    <div className="modal"><div className="card">
      <h3 style={{ margin: 0 }}>Confirm this order</h3>
      <WhoFor inquiry={inquiry} />
      <p style={{ margin: 0 }}>Which products are being sold? These pieces will be <b>blocked</b> for this customer so nobody else sells them.</p>
      {items.isLoading && <p className="empty">Loading…</p>}
      {items.data && !items.data.length && <p className="muted">This inquiry has no product lines, so no stock will be blocked.</p>}
      {items.data?.map((i) => { const v = val(i), q = Number(i.quantity ?? 0); return (
        <div key={i.id} style={{ display: 'grid', gap: 4 }}>
          <b>{i.product_name_snapshot} × {i.quantity ?? '?'}</b>
          <select value={v} onChange={(e) => setPick({ ...pick, [i.id]: e.target.value })}>
            <option value="">Not a stock item (no stock blocked)</option>
            {prods.data?.map((p) => <option key={p.id} value={p.id}>{p.product_name}{p.product_code ? ` (${p.product_code})` : ''}</option>)}
          </select>
          {needHand(i) && <div className="warnbox" style={{ display: 'grid', gap: 6 }}>
            <b>Which handle? (required)</b>
            <span>How many of the {q || '?'} locks are Left-handle and how many Right-handle? This decides which lock is packed.</span>
            <div className="bar">
              <label style={{ flex: 1 }}>Left<input type="number" min="0" inputMode="numeric" value={hv(i).l} onChange={(e) => setHand({ ...hand, [i.id]: { ...hv(i), l: e.target.value } })} /></label>
              <label style={{ flex: 1 }}>Right<input type="number" min="0" inputMode="numeric" value={hv(i).r} onChange={(e) => setHand({ ...hand, [i.id]: { ...hv(i), r: e.target.value } })} /></label>
            </div>
            <div className="bar"><button onClick={() => setHand({ ...hand, [i.id]: { l: String(q), r: '0' } })}>All Left</button><button onClick={() => setHand({ ...hand, [i.id]: { l: '0', r: String(q) } })}>All Right</button></div>
            {!handOk(i) && <span className="muted">Left + Right must add up to {q || 'the quantity (set it in Edit items first)'}.</span>}
          </div>}
          {v && hasStock && q > free(v) && <div className="warnbox">Only {free(v)} free in store for this product. You can still confirm; the stock team will see the shortage.</div>}
        </div>) })}
      {err && <p className="msg">{err}</p>}
      <button className="primary" disabled={busy || items.isLoading || blocked} onClick={go}>{busy ? 'Saving…' : blocked ? 'Choose Left / Right to confirm' : 'Confirm order'}</button>
      <button className="link" onClick={onClose}>Cancel (keep current stage)</button>
    </div></div>
  )
}
