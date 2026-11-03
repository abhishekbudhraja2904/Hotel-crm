import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDate, fmtDateTime } from '../lib/dates'
import ReceiveStock from './ReceiveStock'
import Keeper from './Keeper'
import Correct from './Correct'
import LowStock from './LowStock'
const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const n = (x: any) => Number(x ?? 0).toLocaleString('en-IN')
export default function Inventory({ me }: { me: any }) {
  const qc = useQueryClient(), isAdmin = me.role === 'admin', [msg, setMsg] = useState('')
  const [modal, setModal] = useState<'' | 'receive' | 'keeper'>(''), [fix, setFix] = useState<any>(null)
  const [openId, setOpenId] = useState(''), [showMoves, setShowMoves] = useState(false)
  const refresh = () => { qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['lowstock'] }); qc.invalidateQueries({ queryKey: ['dispatch'] }) }
  const can = useQuery({ queryKey: ['inventory', 'can'], queryFn: async () => !!(await supabase.rpc('can_update_inventory')).data })
  const keeper = useQuery({ queryKey: ['inventory', 'keeper'], queryFn: async () => ((await supabase.rpc('inventory_keeper_info')).data ?? [])[0] ?? null })
  const stock = useQuery({ queryKey: ['inventory', 'overview'], queryFn: async () => { const { data, error } = await supabase.rpc('stock_overview'); if (error) throw error; return data as any[] } })
  const queue = useQuery({ queryKey: ['inventory', 'queue'], queryFn: async () => { const { data, error } = await supabase.rpc('dispatch_queue'); if (error) throw error; return data as any[] } })
  const moves = useQuery({ queryKey: ['inventory', 'moves'], enabled: showMoves, queryFn: async () => { const { data, error } = await supabase.from('stock_movements').select('id,qty_change,reason,note,created_at,products(product_name),employees:created_by(employee_name)').order('created_at', { ascending: false }).limit(25); if (error) throw error; return data } })
  const canEdit = !!can.data, k = keeper.data
  const canSend = isAdmin || me.role === 'service' || canEdit // service admin only watches
  async function dispatched(r: any) {
    if (!confirm(`Packing no. ${r.packing_no}, part ${r.part_no}: have all these boxes been sent? The stock will be reduced.`)) return
    const { error } = await supabase.rpc('confirm_dispatch', { p_part: r.part_id }); setMsg(error ? error.message : ''); refresh()
  }
  async function takeBack() { if (!confirm('Take back stock updating from ' + k?.employee_name + '?')) return; const { error } = await supabase.rpc('clear_inventory_keeper'); setMsg(error ? error.message : ''); refresh() }
  const keeperLine = () => {
    if (!k) return isAdmin ? 'Nobody else is allowed to update stock right now.' : 'Only the admin can update stock right now.'
    const left = k.mode === 'once' ? (k.active ? 'for one update' : 'used up') : k.mode === 'until' ? (k.active ? `until ${fmtDate(k.expires_at)}` : 'time is over') : 'until the admin takes it back'
    return `${k.employee_name} updates the stock (${left}).`
  }
  return (
    <section>
      {msg && <p className="msg">{msg}</p>}
      <LowStock detail />
      <div className={canEdit ? 'okbox' : 'card'} style={canEdit ? {} : { margin: 0 }}>
        <div className="row"><span>{canEdit && !isAdmin ? <b>You can update the stock.</b> : keeperLine()}</span>
          {isAdmin && <span style={{ display: 'flex', gap: 10 }}><button className="link" onClick={() => setModal('keeper')}>{k ? 'Change' : 'Hand over'}</button>{k && <button className="link" onClick={takeBack}>Take back</button>}</span>}</div>
        {canEdit && !isAdmin && <div className="muted">{keeperLine()}</div>}
        {me.role === 'service_admin' && !canEdit && <div className="muted">You can look at the stock but not change it.</div>}
      </div>
      {canEdit && <div className="bar" style={{ margin: '10px 0' }}><button className="primary bigbtn go" onClick={() => setModal('receive')}>+ Stock came in</button></div>}

      <h3>To dispatch ({queue.data?.length ?? 0})</h3>
      {queue.data && !queue.data.length && <p className="empty">Nothing is waiting to be sent.</p>}
      {queue.data?.map((r: any) => { const short = (r.items ?? []).filter((i: any) => Number(i.in_store) < Number(i.qty)), blocked = r.needs_payment && !r.cleared
        return (
        <div className="card" key={r.part_id} style={{ borderLeftColor: blocked ? '#8A6F52' : '#3f6b4a' }}>
          <div className="muted">Packing number</div>
          <div className="pack-big">{r.packing_no ?? '—'}</div>
          <div className="row"><b>{r.customer}</b><span className="muted">Part {r.part_no} · {r.inquiry_number}</span></div>
          <div className="muted">Collect every carton marked {r.packing_no}</div>
          {r.items?.map((i: any, x: number) => <div key={x} style={{ fontSize: 16 }}><b>{n(i.qty)}</b>{i.unit ? ` ${i.unit}` : ''} × <b>{i.name}</b></div>)}
          {short.length > 0 && <div className="warnbox">Not enough in store: {short.map((i: any) => `${i.name} (${n(i.in_store)} in store)`).join(', ')}.</div>}
          {blocked && <div className="warnbox">⏳ Waiting for full payment. Do not send yet.</div>}
          {canSend && !blocked && <button className="primary bigbtn go" onClick={() => dispatched(r)}>Dispatched ✓</button>}
          {!canSend && <div className="muted">Waiting for the store team to mark it dispatched.</div>}
        </div>) })}

      <h3>In store</h3>
      {stock.isLoading && <p className="empty">Loading…</p>}
      {stock.data && !stock.data.length && <p className="empty">No products yet.{isAdmin ? ' Add them in Settings → Product catalogue.' : ' Ask the admin to add products.'}</p>}
      {stock.data?.map((p: any) => { const low = Number(p.low_stock_level) > 0 && Number(p.in_store) <= Number(p.low_stock_level), open = openId === p.product_id
        return (
        <div className="card tap" key={p.product_id} style={{ borderLeftColor: low ? '#9b3b30' : '#6B8F72' }} onClick={() => setOpenId(open ? '' : p.product_id)}>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <div style={{ minWidth: 0 }}><b>{p.product_name}</b><div className="muted">{n(p.in_store)} in store · {n(p.locked)} locked{p.product_code ? ` · ${p.product_code}` : ''}</div>{low && <div style={{ color: '#9b3b30', fontWeight: 600, fontSize: 13 }}>LOW: reorder soon</div>}</div>
            <div className="bignum" style={low ? { color: '#9b3b30' } : {}}>{n(p.free)}<small>free</small></div></div>
          {open && canEdit && <div className="bar" onClick={(e) => e.stopPropagation()}><button onClick={() => setFix({ product: p })}>Fix total count</button></div>}
        </div>) })}

      <div><button className="link" onClick={() => setShowMoves(!showMoves)}>{showMoves ? 'Hide history' : 'Show stock history'}</button></div>
      {showMoves && moves.data?.map((m: any) => <div className="card" key={m.id}><div className="row"><b>{one(m.products)?.product_name}</b><span className={`pill${m.qty_change < 0 ? ' High' : ''}`}>{m.qty_change > 0 ? '+' : ''}{m.qty_change}</span></div>
        <div className="muted">{m.reason.replace('_', ' ')} · {one(m.employees)?.employee_name ?? 'System'} · {fmtDateTime(m.created_at)}{m.note ? ` · ${m.note}` : ''}</div></div>)}

      {modal === 'receive' && <ReceiveStock products={stock.data ?? []} onClose={() => setModal('')} onDone={refresh} />}
      {modal === 'keeper' && <Keeper me={me} onClose={() => setModal('')} onDone={refresh} />}
      {fix && <Correct product={fix.product} onClose={() => setFix(null)} onDone={refresh} />}
    </section>
  )
}
