import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDate, fmtDateTime } from '../lib/dates'
import ReceiveStock from './ReceiveStock'
import Keeper from './Keeper'
import Correct from './Correct'
import LowStock from './LowStock'
import Spares from './Spares'
import { AgeTag, ageLook } from '../lib/age'
import { HandOverButton } from './Reassign'
const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const n = (x: any) => Number(x ?? 0).toLocaleString('en-IN')
export default function Inventory({ me }: { me: any }) {
  const qc = useQueryClient(), isAdmin = me.role === 'admin', [msg, setMsg] = useState('')
  const [modal, setModal] = useState<'' | 'receive' | 'keeper'>(''), [fix, setFix] = useState<any>(null)
  const [openId, setOpenId] = useState(''), [showMoves, setShowMoves] = useState(false), [view, setView] = useState<'prod' | 'spare'>('prod')
  const refresh = () => { qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['lowstock'] }); qc.invalidateQueries({ queryKey: ['dispatch'] }) }
  // Left / Right handle versions: which locks already have them
  const handles = useQuery({ queryKey: ['inventory', 'handles'], queryFn: async () => ((await supabase.from('products').select('id,handle_of,handle').not('handle_of', 'is', null)).data ?? []) as any[] })
  async function addHandles(pid: string) { const { error } = await supabase.rpc('admin_add_handle_versions', { p_product: pid }); setMsg(error ? error.message : 'Left / Right enabled. Use "Fix total count" to type how many Left and how many Right.'); refresh() }
  async function removeHandles(pid: string) { if (!confirm('Remove the Left and Right versions of this lock? Only possible if they have no stock and no orders.')) return; const { error } = await supabase.rpc('admin_remove_handle_versions', { p_parent: pid }); setMsg(error ? error.message : 'Left / Right versions removed.'); refresh() }
  const can = useQuery({ queryKey: ['inventory', 'can'], queryFn: async () => !!(await supabase.rpc('can_update_inventory')).data })
  const keeper = useQuery({ queryKey: ['inventory', 'keeper'], queryFn: async () => ((await supabase.rpc('inventory_keeper_info')).data ?? [])[0] ?? null })
  const stock = useQuery({ queryKey: ['inventory', 'overview'], queryFn: async () => { const { data, error } = await supabase.rpc('stock_overview'); if (error) throw error; return data as any[] } })
  const queue = useQuery({ queryKey: ['inventory', 'queue'], refetchInterval: 30000, queryFn: async () => { const { data, error } = await supabase.rpc('pack_queue'); if (error) throw error; return data as any[] } })
  const moves = useQuery({ queryKey: ['inventory', 'moves'], enabled: showMoves, queryFn: async () => { const { data, error } = await supabase.from('stock_movements').select('id,qty_change,reason,note,created_at,products(product_name),employees:created_by(employee_name)').order('created_at', { ascending: false }).limit(25); if (error) throw error; return data } })
  const hset = new Set((handles.data ?? []).map((h: any) => h.id)), hmap = new Map((handles.data ?? []).map((h: any) => [h.id, h.handle_of])), hhand = new Map((handles.data ?? []).map((h: any) => [h.id, h.handle]))
  const canEdit = !!can.data, k = keeper.data
  async function packDone(r: any) { if (!confirm(`Packing no. ${r.packing_no} is fully packed?`)) return; const { error } = await supabase.rpc('mark_packing_done', { p_inq: r.inquiry_id }); setMsg(error ? error.message : ''); qc.invalidateQueries({ queryKey: ['inventory'] }) }
  async function takeBack() { if (!confirm('Take back stock updating from ' + k?.employee_name + '?')) return; const { error } = await supabase.rpc('clear_inventory_keeper'); setMsg(error ? error.message : ''); refresh() }
  const keeperLine = () => {
    if (!k) return isAdmin ? 'Nobody else is allowed to update stock right now.' : 'Only the admin can update stock right now.'
    const left = k.mode === 'once' ? (k.active ? 'for one update' : 'used up') : k.mode === 'until' ? (k.active ? `until ${fmtDate(k.expires_at)}` : 'time is over') : 'until the admin takes it back'
    return `${k.employee_name} updates the stock (${left}).`
  }
  const toggle = <div className="bar"><button className={view === 'prod' ? 'primary' : ''} onClick={() => setView('prod')}>Products</button><button className={view === 'spare' ? 'primary' : ''} onClick={() => setView('spare')}>Spare parts</button></div>
  if (view === 'spare') return <section>{toggle}<Spares me={me} /></section>
  return (
    <section>
      {toggle}
      {msg && <p className="msg">{msg}</p>}
      <LowStock detail />
      <div className={canEdit ? 'okbox' : 'card'} style={canEdit ? {} : { margin: 0 }}>
        <div className="row"><span>{canEdit && !isAdmin ? <b>You can update the stock.</b> : keeperLine()}</span>
          {isAdmin && <span style={{ display: 'flex', gap: 10 }}><button className="link" onClick={() => setModal('keeper')}>{k ? 'Change' : 'Hand over'}</button>{k && <button className="link" onClick={takeBack}>Take back</button>}</span>}</div>
        {canEdit && !isAdmin && <div className="muted">{keeperLine()}</div>}
        {me.role === 'service_admin' && !canEdit && <div className="muted">You can look at the stock but not change it.</div>}
      </div>
      {canEdit && <div className="bar" style={{ margin: '10px 0' }}><button className="primary bigbtn go" onClick={() => setModal('receive')}>+ Stock came in</button></div>}

      <h3>Orders to pack and collect ({queue.data?.length ?? 0})</h3>
      {queue.data && !queue.data.length && <p className="empty">Nothing is assigned to you right now.</p>}
      {queue.data?.map((r: any) => { const col = r.state === 'collect'; return (
        <div className="card" key={r.inquiry_id} style={{ borderLeftColor: col ? '#3f6b4a' : '#8A6F52', ...ageLook(r.since).style }}>
          <div className="row"><span className="muted">Packing number</span><span className={`pill${col ? '' : ' Medium'}`}>{col ? 'COLLECT' : 'PACK'}</span></div>
          <div className="pack-big">{r.packing_no ?? '—'}</div>
          {col ? <div className="okbox">Packed and fully paid. Collect this order, it is ready to go.</div>
            : <div className="warnbox">Pack the items below and mark every carton with packing number <b>{r.packing_no}</b>.</div>}
          {r.items?.map((i: any, x: number) => <div key={x} style={{ fontSize: 16 }}><b>{n(i.qty)}</b>{i.unit ? ` ${i.unit}` : ''} × <b>{i.name}</b>{i.mortis && <div className="muted" style={{ fontSize: 14 }}>Fit mortis: {i.mortis}</div>}</div>)}
          <div><b>{r.customer}</b>{r.city ? ` · ${r.city}` : ''}</div>
          <div className="barwrap"><div className={`paybar${Number(r.paid_pct) >= 100 ? ' full' : ''}`}><i style={{ width: `${Math.min(100, Number(r.paid_pct) || 0)}%` }} /></div>
            <div className="barnote">{Number(r.paid_pct) >= 100 ? 'Payment received in full' : 'Payment not complete yet'}</div></div>
          <AgeTag since={r.since} />
          <div className="muted">Assigned by {r.assigned_by ?? '—'}{r.packer ? ` · Packing: ${r.packer}` : ''}</div>
          {r.packed_at
            ? <div className="okbox">Packing done · {fmtDateTime(r.packed_at)}</div>
            : <div className="bar"><button className="primary bigbtn go" onClick={() => packDone(r)}>Packing done</button><span className="muted">Reminders every {n(r.remind_hours)} h until you tap this</span></div>}
          <div className="bar"><HandOverButton me={me} kind="packing" id={r.inquiry_id} currentId={r.packer_id} title={`Packing no. ${r.packing_no} · ${r.customer}`} /></div>
        </div>) })}

      <h3>In store</h3>
      {stock.isLoading && <p className="empty">Loading…</p>}
      {stock.data && !stock.data.length && <p className="empty">No products yet.{isAdmin ? ' Add them in Settings → Product catalogue.' : ' Ask the admin to add products.'}</p>}
      {(stock.data ?? []).filter((p: any) => !hset.has(p.product_id)).map((p0: any) => { const kids = (stock.data ?? []).filter((x: any) => hmap.get(x.product_id) === p0.product_id), has = kids.length > 0
        const sum = (f: string) => Number(p0[f] ?? 0) + kids.reduce((a: number, x: any) => a + Number(x[f] ?? 0), 0)
        const part = (h: string) => Number(kids.find((x: any) => hhand.get(x.product_id) === h)?.in_store ?? 0)
        const p = has ? { ...p0, in_store: sum('in_store'), locked: sum('locked'), free: sum('free') } : p0
        const see = isAdmin || canEdit /* only the admin and the stock keeper see the stock numbers */, low = see && Number(p.low_stock_level) > 0 && Number(p.in_store) <= Number(p.low_stock_level), open = openId === p.product_id
        return (
        <div className="card tap" key={p.product_id} style={{ borderLeftColor: low ? '#9b3b30' : '#6B8F72' }} onClick={() => setOpenId(open ? '' : p.product_id)}>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <div style={{ minWidth: 0 }}><b>{p.product_name}</b><div className="muted">{see ? `${n(p.in_store)} in store${has ? ` (${part('Left')} Left · ${part('Right')} Right)` : ''} · ` : ''}{n(p.locked)} blocked{p.product_code ? ` · ${p.product_code}` : ''}</div>{low && <div style={{ color: '#9b3b30', fontWeight: 600, fontSize: 13 }}>LOW: reorder soon</div>}</div>
            {see ? <div className="bignum" style={low ? { color: '#9b3b30' } : {}}>{n(p.free)}<small>free</small></div> : <div className="bignum">{n(p.locked)}<small>blocked</small></div>}</div>
          {open && (canEdit || isAdmin) && <div className="bar" onClick={(e) => e.stopPropagation()}>{canEdit && <button onClick={() => setFix({ product: p, parts: has || /^RFID Hotel Lock/i.test(p.product_category ?? '') ? { left: part('Left'), right: part('Right') } : null })}>Fix total count</button>}{isAdmin && /^RFID Hotel Lock/i.test(p.product_category ?? '') && !has && <button onClick={() => addHandles(p.product_id)}>Enable Left &amp; Right</button>}{isAdmin && has && <button className="link" onClick={() => removeHandles(p.product_id)}>Remove Left &amp; Right versions</button>}</div>}
        </div>) })}

      <div><button className="link" onClick={() => setShowMoves(!showMoves)}>{showMoves ? 'Hide history' : 'Show stock history'}</button></div>
      {showMoves && moves.data?.map((m: any) => <div className="card" key={m.id}><div className="row"><b>{one(m.products)?.product_name}</b><span className={`pill${m.qty_change < 0 ? ' High' : ''}`}>{m.qty_change > 0 ? '+' : ''}{m.qty_change}</span></div>
        <div className="muted">{m.reason.replace('_', ' ')} · {one(m.employees)?.employee_name ?? 'System'} · {fmtDateTime(m.created_at)}{m.note ? ` · ${m.note}` : ''}</div></div>)}

      {modal === 'receive' && <ReceiveStock products={(stock.data ?? []).filter((p: any) => !(handles.data ?? []).some((h: any) => h.id === p.product_id))} onClose={() => setModal('')} onDone={refresh} />}
      {modal === 'keeper' && <Keeper me={me} onClose={() => setModal('')} onDone={refresh} />}
      {fix && <Correct product={fix.product} parts={fix.parts} onClose={() => setFix(null)} onDone={refresh} />}
    </section>
  )
}
