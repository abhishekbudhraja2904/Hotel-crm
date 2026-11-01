import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import ReceiveStock from './ReceiveStock'
import ProductForm from './ProductForm'
import Keeper from './Keeper'
import Correct from './Correct'
const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const n = (x: any) => Number(x ?? 0).toLocaleString('en-IN')
export default function Inventory({ me }: { me: any }) {
  const qc = useQueryClient(), isAdmin = me.role === 'admin', [msg, setMsg] = useState('')
  const [modal, setModal] = useState<'' | 'receive' | 'add' | 'keeper'>(''), [edit, setEdit] = useState<any>(null), [fix, setFix] = useState<any>(null)
  const [openId, setOpenId] = useState(''), [showMoves, setShowMoves] = useState(false), [showRemoved, setShowRemoved] = useState(false)
  const refresh = () => { qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['inquiries'] }) }
  const can = useQuery({ queryKey: ['inventory', 'can'], queryFn: async () => !!(await supabase.rpc('can_update_inventory')).data })
  const keeper = useQuery({ queryKey: ['inventory', 'keeper'], queryFn: async () => ((await supabase.rpc('inventory_keeper_info')).data ?? [])[0] ?? null })
  const stock = useQuery({ queryKey: ['inventory', 'overview'], queryFn: async () => { const { data, error } = await supabase.rpc('stock_overview'); if (error) throw error; return data as any[] } })
  const queue = useQuery({ queryKey: ['inventory', 'queue'], queryFn: async () => { const { data, error } = await supabase.rpc('dispatch_queue'); if (error) throw error; return data as any[] } })
  const packs = useQuery({ queryKey: ['inventory', 'packs'], queryFn: async () => { const { data, error } = await supabase.from('packs').select('id,packing_no,product_id,pieces_original,pieces_left').gt('pieces_left', 0).order('packing_no'); if (error) throw error; return data as any[] } })
  const moves = useQuery({ queryKey: ['inventory', 'moves'], enabled: showMoves, queryFn: async () => { const { data, error } = await supabase.from('stock_movements').select('id,qty_change,reason,note,created_at,products(product_name),employees:created_by(employee_name)').order('created_at', { ascending: false }).limit(25); if (error) throw error; return data } })
  const removed = useQuery({ queryKey: ['inventory', 'removed'], enabled: isAdmin && showRemoved, queryFn: async () => (await supabase.from('products').select('id,product_name').eq('active', false).order('product_name')).data ?? [] })
  const canEdit = !!can.data, k = keeper.data
  async function dispatch(r: any, override = false) {
    if (!confirm(override ? `Dispatch ${r.inquiry_number} WITHOUT full payment? This is recorded.` : `Dispatch ${r.inquiry_number}? The stock will be reduced.`)) return
    const { error } = await supabase.rpc('dispatch_inquiry', { inq: r.id, override }); setMsg(error ? error.message : ''); refresh()
  }
  async function setStart() {
    const v = prompt('Next packing number will be:', String(((await supabase.rpc('next_packing_no')).data as number) ?? 1)); if (!v) return
    const { error } = await supabase.rpc('set_next_packing_no', { p: Number(v) }); setMsg(error ? error.message : 'Saved.'); refresh()
  }
  async function takeBack() { if (!confirm('Take back stock updating from ' + k?.employee_name + '?')) return; const { error } = await supabase.rpc('clear_inventory_keeper'); setMsg(error ? error.message : ''); refresh() }
  const keeperLine = () => {
    if (!k) return isAdmin ? 'Nobody else is allowed to update stock right now.' : 'Only the admin can update stock right now.'
    const left = k.mode === 'once' ? (k.active ? 'for one update' : 'used up') : k.mode === 'until' ? (k.active ? `until ${new Date(k.expires_at).toLocaleDateString()}` : 'time is over') : 'until the admin takes it back'
    return `${k.employee_name} updates the stock (${left}).`
  }
  return (
    <section>
      {msg && <p className="msg">{msg}</p>}
      <div className={canEdit ? 'okbox' : 'card'} style={canEdit ? {} : { margin: 0 }}>
        <div className="row"><span>{canEdit && !isAdmin ? <b>You can update the stock.</b> : keeperLine()}</span>
          {isAdmin && <span style={{ display: 'flex', gap: 10 }}><button className="link" onClick={() => setModal('keeper')}>{k ? 'Change' : 'Hand over'}</button>{k && <button className="link" onClick={takeBack}>Take back</button>}</span>}</div>
        {canEdit && !isAdmin && <div className="muted">{keeperLine()}</div>}
      </div>
      {canEdit && <div className="bar" style={{ margin: '10px 0' }}><button className="primary bigbtn go" onClick={() => setModal('receive')}>+ Stock came in</button>{isAdmin && <button onClick={() => setModal('add')}>+ Add product</button>}{isAdmin && <button onClick={setStart}>Packing number start</button>}</div>}
      {!canEdit && isAdmin && null}

      <h3>Send out ({queue.data?.length ?? 0})</h3>
      {queue.data && !queue.data.length && <p className="empty">No confirmed orders waiting.</p>}
      {queue.data?.map((r: any) => { const byProd: Record<string, any[]> = {}; (r.plan ?? []).forEach((p: any) => { (byProd[p.product_id] = byProd[p.product_id] ?? []).push(p) })
        return (
        <div className="card" key={r.id} style={{ borderLeftColor: r.cleared ? '#3f6b4a' : '#8A6F52' }}>
          <div className="row"><b>{r.customer ?? r.title}</b><span className="muted">{r.inquiry_number}</span></div>
          {r.items?.map((i: any, x: number) => { const pl = i.product_id ? byProd[i.product_id] ?? [] : [], got = pl.reduce((s: number, p: any) => s + p.take, 0); return (
            <div key={x} style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 16 }}><b>{i.name}</b> × <b>{n(i.qty)}</b></div>
              {!i.product_id ? <div className="warnbox">Not linked to a stock product, so stock will not change.</div>
                : pl.length ? <><div className="muted">Take packing numbers</div><div className="chips">{pl.map((p: any) => <span key={p.packing_no} className="chip">{p.packing_no}</span>)}</div>
                  {got < Number(i.qty) && <div className="warnbox">Packing numbers cover only {n(got)} of {n(i.qty)} pieces. The rest is loose stock.</div>}</>
                : <div className="warnbox">No packing numbers in store for this product.</div>}
            </div>) })}
          {r.cleared ? <div className="okbox">✓ Full payment received</div> : <div className="warnbox">⏳ Waiting for full payment. Do not send yet.</div>}
          {canEdit && r.cleared && <button className="primary bigbtn go" onClick={() => dispatch(r)}>Dispatched ✓</button>}
          {canEdit && !r.cleared && isAdmin && <button className="link" onClick={() => dispatch(r, true)}>Dispatch anyway (admin)</button>}
          {!canEdit && r.cleared && <div className="muted">Waiting for {k?.employee_name ?? 'the admin'} to mark it dispatched.</div>}
        </div>) })}

      <h3>In store</h3>
      {stock.isLoading && <p className="empty">Loading…</p>}
      {stock.data && !stock.data.length && <p className="empty">No products yet.{isAdmin ? ' Press + Add product.' : ' Ask the admin to add products.'}</p>}
      {stock.data?.map((p: any) => { const low = Number(p.low_stock_level) > 0 && Number(p.free) <= Number(p.low_stock_level), open = openId === p.product_id, pk = (packs.data ?? []).filter((x) => x.product_id === p.product_id), loose = Number(p.in_store) - pk.reduce((s, x) => s + x.pieces_left, 0)
        return (
        <div className="card tap" key={p.product_id} style={{ borderLeftColor: low ? '#9b3b30' : '#6B8F72' }} onClick={() => setOpenId(open ? '' : p.product_id)}>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <div style={{ minWidth: 0 }}><b>{p.product_name}</b><div className="muted">{n(p.in_store)} in store · {n(p.locked)} locked{p.product_code ? ` · ${p.product_code}` : ''}</div>{low && <div style={{ color: '#9b3b30', fontWeight: 600, fontSize: 13 }}>LOW: reorder soon</div>}</div>
            <div className="bignum" style={low ? { color: '#9b3b30' } : {}}>{n(p.free)}<small>free</small></div></div>
          {open && <div style={{ display: 'grid', gap: 8 }} onClick={(e) => e.stopPropagation()}>
            <div className="muted">Packing numbers in store ({p.unit})</div>
            {pk.length ? <div style={{ display: 'grid', gap: 6 }}>{pk.map((x) => <div key={x.id} className="row" style={{ flexWrap: 'nowrap' }}><span><span className="chip sm">{x.packing_no}</span> &nbsp;{n(x.pieces_left)} of {n(x.pieces_original)} pieces</span>{canEdit && <button className="link" onClick={() => setFix({ pack: x })}>Fix</button>}</div>)}</div> : <div className="muted">No packs recorded.</div>}
            {loose > 0 && <div className="muted">{n(loose)} pieces are not in any pack (counted before packing numbers).</div>}
            {canEdit && <div className="bar"><button onClick={() => setFix({ product: p })}>Fix total count</button><button onClick={() => setEdit(p)}>Edit product</button></div>}
          </div>}
        </div>) })}

      {isAdmin && <><button className="link" onClick={() => setShowRemoved(!showRemoved)}>{showRemoved ? 'Hide removed products' : 'Show removed products'}</button>
        {showRemoved && (removed.data?.length ? removed.data.map((p: any) => <div className="card" key={p.id}><div className="row"><span>{p.product_name}</span><button onClick={async () => { const { error } = await supabase.rpc('set_product_active', { p_id: p.id, p_active: true }); setMsg(error ? error.message : ''); refresh() }}>Restore</button></div></div>) : <p className="empty">No removed products.</p>)}</>}
      <div><button className="link" onClick={() => setShowMoves(!showMoves)}>{showMoves ? 'Hide history' : 'Show stock history'}</button></div>
      {showMoves && moves.data?.map((m: any) => <div className="card" key={m.id}><div className="row"><b>{one(m.products)?.product_name}</b><span className={`pill${m.qty_change < 0 ? ' High' : ''}`}>{m.qty_change > 0 ? '+' : ''}{m.qty_change}</span></div>
        <div className="muted">{m.reason.replace('_', ' ')} · {one(m.employees)?.employee_name ?? 'System'} · {new Date(m.created_at).toLocaleString()}{m.note ? ` · ${m.note}` : ''}</div></div>)}

      {modal === 'receive' && <ReceiveStock products={stock.data ?? []} onClose={() => setModal('')} onDone={refresh} />}
      {modal === 'add' && <ProductForm isAdmin={isAdmin} onClose={() => setModal('')} onDone={refresh} />}
      {modal === 'keeper' && <Keeper me={me} onClose={() => setModal('')} onDone={refresh} />}
      {edit && <ProductForm product={edit} isAdmin={isAdmin} onClose={() => setEdit(null)} onDone={refresh} />}
      {fix && <Correct pack={fix.pack ? { ...fix.pack } : undefined} product={fix.product} onClose={() => setFix(null)} onDone={refresh} />}
    </section>
  )
}
