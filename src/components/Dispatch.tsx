import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useWorkload } from '../lib/workload'
import { fmtDate, fmtDateTime } from '../lib/dates'
import WhoFor from './WhoFor'
import { useSettings } from '../lib/settings'
const n = (x: any) => Number(x ?? 0).toLocaleString('en-IN')
// Sales / admin: mark the order (or part of it) ready to dispatch, and later note the docket number and courier.
export default function Dispatch({ me, inquiry, onClose }: { me: any; inquiry: any; onClose: () => void }) {
  const qc = useQueryClient(), canAct = me.role === 'admin' || me.role === 'sales'
  const [msg, setMsg] = useState(''), [qty, setQty] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false), [dk, setDk] = useState<Record<string, { no: string; courier: string }>>({})
  const bal = useQuery({ queryKey: ['dispatch', 'bal', inquiry.id], queryFn: async () => { const { data, error } = await supabase.rpc('order_balance', { p_inq: inquiry.id }); if (error) throw error; return data as any[] } })
  const parts = useQuery({ queryKey: ['dispatch', 'parts', inquiry.id], queryFn: async () => {
    const { data, error } = await supabase.from('dispatch_parts').select('id,part_no,status,ready_at,sent_at,docket_no,courier_name,docket_at,dispatch_part_items(id,product_name,quantity,unit)').eq('inquiry_id', inquiry.id).order('part_no'); if (error) throw error; return data as any[] } })
  const pk = useQuery({ queryKey: ['dispatch', 'pk', inquiry.id], queryFn: async () => (await supabase.from('inquiries').select('packing_no,packing_year,packer_id,packed_at,pack_remind_hours').eq('id', inquiry.id).maybeSingle()).data })
  const wl = useWorkload()
  const techs = useQuery({ queryKey: ['employees', 'service'], queryFn: async () => (await supabase.from('employees').select('id,employee_name').eq('active', true).eq('role', 'service').order('employee_name')).data ?? [] })
  const settings = useSettings(), [rem2, setRem2] = useState<string | null>(null)
  async function saveRemind() { const h = Number(rem2 ?? pk.data?.pack_remind_hours ?? settings.packReminderHours); const { error } = await supabase.rpc('set_pack_reminder', { p_inq: inquiry.id, p_hours: h }); setMsg(error ? error.message : 'Reminder gap saved.'); qc.invalidateQueries({ queryKey: ['dispatch'] }) }
  async function cancelPacking() {
    if (!confirm('Cancel packing for this order? Anything marked ready (not yet dispatched) is taken back, the packer is told to stop, and reminders end.')) return
    const why = prompt('What was the mistake? (optional, the packer will see it)', '')
    if (why === null) return
    const { error } = await supabase.rpc('cancel_packing', { p_inq: inquiry.id, p_reason: why }); setMsg(error ? error.message : 'Packing cancelled. You can assign it again when ready.'); refresh()
  }
  async function setPacker(id: string) { const { error } = await supabase.rpc('assign_packer', { p_inq: inquiry.id, p_emp: id || null }); setMsg(error ? error.message : ''); qc.invalidateQueries({ queryKey: ['dispatch'] }) }
  const refresh = () => { qc.invalidateQueries({ queryKey: ['dispatch'] }); qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['inventory'] }) }
  const rem = (bal.data ?? []).filter((b) => Number(b.remaining) > 0)
  const val = (b: any) => qty[b.product_id] ?? String(Number(b.remaining))
  async function ready() {
    setMsg(''); setBusy(true)
    const items = rem.map((b) => ({ product_id: b.product_id, quantity: Number(val(b)) || 0 })).filter((i) => i.quantity > 0)
    const { error } = await supabase.rpc('mark_ready', { p_inq: inquiry.id, p_items: items }); setBusy(false)
    if (error) return setMsg(error.message); setQty({}); refresh()
  }
  async function cancel(id: string) { if (!confirm('Take this part back (it is not dispatched yet)?')) return; const { error } = await supabase.rpc('cancel_ready', { p_part: id }); setMsg(error ? error.message : ''); refresh() }
  async function dispatchNow(id: string) {
    const v = dk[id] ?? { no: '', courier: '' }
    if (!v.courier.trim() || !v.no.trim()) return setMsg('Enter the courier name and the docket number to dispatch.')
    if (!confirm('Dispatch this part? Stock will be reduced and the docket saved.')) return
    const { error } = await supabase.rpc('dispatch_part', { p_part: id, p_docket: v.no, p_courier: v.courier }); setMsg(error ? error.message : 'Dispatched.'); refresh()
  }
  async function docket(id: string, p: any) {
    const v = dk[id] ?? { no: p.docket_no ?? '', courier: p.courier_name ?? '' }
    const { error } = await supabase.rpc('set_docket', { p_part: id, p_docket: v.no, p_courier: v.courier }); setMsg(error ? error.message : 'Saved.'); refresh()
  }
  const total = parts.data?.length ?? 0
  return (
    <div className="modal"><div className="card" style={{ maxWidth: 560 }}>
      <div className="row"><h3 style={{ margin: 0 }}>Dispatch</h3><button className="link" onClick={onClose}>Close</button></div>
      <WhoFor inquiry={inquiry} />
      {pk.data?.packing_no ? <div><div className="muted">Packing number for this whole order</div><div className="pack-big">{pk.data.packing_no}</div></div> : <p className="muted">No packing number yet.</p>}
      {canAct && <label>Packing assigned to<select value={pk.data?.packer_id ?? ''} onChange={(e) => setPacker(e.target.value)}><option value="">Not assigned</option>{techs.data?.map((t: any) => <option key={t.id} value={t.id}>{wl(t.id, t.employee_name)}</option>)}</select></label>}
      {canAct && pk.data?.packer_id && (pk.data.packed_at
        ? <div className="okbox">Packing done · {fmtDateTime(pk.data.packed_at)}</div>
        : <div className="bar"><label style={{ flex: 1 }}>Remind every (hours, until packing is done)<input type="number" min="0.5" max="72" step="0.5" value={rem2 ?? String(pk.data.pack_remind_hours ?? settings.packReminderHours)} onChange={(e) => setRem2(e.target.value)} /></label><button onClick={saveRemind}>Save</button></div>)}
      {canAct && (pk.data?.packer_id || (parts.data ?? []).some((p: any) => p.status === 'ready')) && <div><button className="link" style={{ color: '#9b3b30' }} onClick={cancelPacking}>Cancel packing (made a mistake)</button></div>}
      {msg && <p className="msg">{msg}</p>}
      {bal.isLoading && <p className="empty">Loading…</p>}
      {bal.data && !bal.data.length && <p className="warnbox">This order has no catalogue products, so nothing can be dispatched from here. Use "Edit items" (admin) to add them.</p>}
      {bal.data && bal.data.length > 0 && <>
        <h4 style={{ margin: '4px 0 0' }}>Ordered</h4>
        {bal.data.map((b) => <div className="row" key={b.product_id}><span>{b.product_name}</span><span className="muted">{n(b.ordered)} ordered · {n(b.sent)} sent{Number(b.ready) > 0 ? ` · ${n(b.ready)} ready` : ''}</span></div>)}
      </>}
      {canAct && rem.length > 0 && <>
        <h4 style={{ margin: '8px 0 0' }}>{total ? 'Send the next part' : 'Ready to dispatch'}</h4>
        <p className="muted" style={{ margin: 0 }}>Change the numbers to send only part of the order now. The store team will see this packing number and these items and collect them. You dispatch it yourself by entering the courier and docket.</p>
        {rem.map((b) => <label key={b.product_id}>{b.product_name} (up to {n(b.remaining)}{b.unit ? ' ' + b.unit : ''})<input type="number" min="0" max={Number(b.remaining)} step="any" value={val(b)} onChange={(e) => setQty({ ...qty, [b.product_id]: e.target.value })} /></label>)}
        <button className="primary" disabled={busy} onClick={ready}>{busy ? 'Saving…' : 'Mark ready to dispatch'}</button>
      </>}
      {bal.data && bal.data.length > 0 && !rem.length && <div className="okbox">Everything on this order has been sent or is ready to go.</div>}
      {total > 0 && <h4 style={{ margin: '8px 0 0' }}>Parts</h4>}
      {parts.data?.map((p) => { const v = dk[p.id] ?? { no: p.docket_no ?? '', courier: p.courier_name ?? '' }; return (
        <div className="card" key={p.id} style={{ margin: 0 }}>
          <div className="row"><b>Part {p.part_no}</b><span className={`pill${p.status === 'dispatched' ? '' : ' Medium'}`}>{p.status === 'dispatched' ? `Dispatched ${fmtDate(p.sent_at)}` : 'Ready, store is collecting'}</span></div>
          <div className="muted">Marked ready {fmtDateTime(p.ready_at)}</div>
          {(p.dispatch_part_items ?? []).map((i: any) => <div key={i.id}>{n(i.quantity)}{i.unit ? ` ${i.unit}` : ''} × {i.product_name}</div>)}
          {p.status === 'ready' && canAct && <div style={{ display: 'grid', gap: 6 }}>
            <label>Courier / shipping service *<input value={v.courier} onChange={(e) => setDk({ ...dk, [p.id]: { ...v, courier: e.target.value } })} /></label>
            <label>Docket no. *<input value={v.no} onChange={(e) => setDk({ ...dk, [p.id]: { ...v, no: e.target.value } })} /></label>
            <button className="primary" onClick={() => dispatchNow(p.id)}>Dispatch</button>
            <button className="link" onClick={() => cancel(p.id)}>Take this part back</button></div>}
          {p.status === 'dispatched' && (canAct ? <div style={{ display: 'grid', gap: 6 }}>
            <label>Docket no.<input value={v.no} onChange={(e) => setDk({ ...dk, [p.id]: { ...v, no: e.target.value } })} /></label>
            <label>Courier name<input value={v.courier} onChange={(e) => setDk({ ...dk, [p.id]: { ...v, courier: e.target.value } })} /></label>
            <button onClick={() => docket(p.id, p)}>Correct docket or courier</button>
            {p.docket_at && <div className="muted">Entered {fmtDate(p.docket_at)}</div>}</div> : (p.docket_no || p.courier_name) && <div className="muted">Docket {p.docket_no ?? '—'} · {p.courier_name ?? '—'}</div>)}
        </div>) })}
    </div></div>
  )
}
