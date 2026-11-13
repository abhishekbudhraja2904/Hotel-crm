import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDateTime } from '../lib/dates'
const n = (x: any) => Number(x ?? 0).toLocaleString('en-IN')
const one = (x: any) => (Array.isArray(x) ? x[0] : x)
// Spare parts stock. Repairs take parts off this stock automatically.
export default function Spares({ me }: { me: any }) {
  const qc = useQueryClient(), canEdit = me.role === 'admin' || me.role === 'service', [msg, setMsg] = useState('')
  const [modal, setModal] = useState<null | { kind: 'new' } | { kind: 'in' | 'fix' | 'edit' | 'print'; p: any }>(null), [showMoves, setShowMoves] = useState(false)
  const list = useQuery({ queryKey: ['spares'], queryFn: async () => { const { data, error } = await supabase.rpc('spare_overview'); if (error) throw error; const all = (data ?? []) as any[], base = all.filter((x) => !x.printed_of).sort((a, b) => String(a.name).localeCompare(String(b.name))); return base.flatMap((b) => [b, ...all.filter((x) => x.printed_of === b.id)]) } })
  const moves = useQuery({ queryKey: ['spares', 'moves'], enabled: showMoves, queryFn: async () => { const { data, error } = await supabase.from('spare_movements').select('id,qty_change,reason,note,created_at,spare_parts(name),employees:created_by(employee_name)').order('created_at', { ascending: false }).limit(30); if (error) throw error; return data as any[] } })
  const refresh = () => qc.invalidateQueries({ queryKey: ['spares'] })
  const low = (p: any) => Number(p.low_level) > 0 && Number(p.in_stock) <= Number(p.low_level)
  return <section>
    {msg && <p className="msg">{msg}</p>}
    {canEdit && <button className="primary bigbtn go" onClick={() => setModal({ kind: 'new' })}>+ New spare part</button>}
    {me.role === 'service_admin' && <p className="muted" style={{ margin: 0 }}>You can look at the spare parts but not change them.</p>}
    {list.data && !list.data.length && <p className="empty">No spare parts yet.{canEdit ? ' Add the first one above.' : ''}</p>}
    {list.data?.map((p) => <div className="card" key={p.id} style={{ borderLeftColor: low(p) ? '#9b3b30' : '#6B8F72', opacity: p.active ? 1 : 0.55, marginLeft: p.printed_of ? 18 : 0 }}>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <div style={{ minWidth: 0 }}><b>{p.printed_of ? '↳ ' : ''}{p.name}</b>{!p.active && <span className="muted"> (not in use)</span>}<div className="muted">{p.code ?? ''}{Number(p.low_level) > 0 ? `${p.code ? ' · ' : ''}warn at ${n(p.low_level)}` : ''}</div>{Number(p.locked) > 0 && <div className="muted" style={{ color: '#a8641c', fontWeight: 600 }}>{n(p.locked)} reserved for confirmed orders · {n(p.free)} free</div>}{low(p) && <div style={{ color: '#9b3b30', fontWeight: 600, fontSize: 13 }}>LOW: order more soon</div>}</div>
        <div className="bignum" style={low(p) ? { color: '#9b3b30' } : {}}>{n(p.in_stock)}<small>in stock</small></div></div>
      {canEdit && <div className="bar"><button onClick={() => setModal({ kind: 'in', p })}>Stock came in</button><button onClick={() => setModal({ kind: 'fix', p })}>Fix count</button>{!p.printed_of && <button onClick={() => setModal({ kind: 'print', p })}>Printed some</button>}<button onClick={() => setModal({ kind: 'edit', p })}>Edit</button></div>}
    </div>)}
    <div><button className="link" onClick={() => setShowMoves(!showMoves)}>{showMoves ? 'Hide history' : 'Show spare parts history'}</button></div>
    {showMoves && moves.data?.map((m) => <div className="card" key={m.id}><div className="row"><b>{one(m.spare_parts)?.name}</b><span className={`pill${m.qty_change < 0 ? ' High' : ''}`}>{m.qty_change > 0 ? '+' : ''}{Number(m.qty_change)}</span></div>
      <div className="muted">{String(m.reason).replace(/_/g, ' ')} · {one(m.employees)?.employee_name ?? 'System'} · {fmtDateTime(m.created_at)}{m.note ? ` · ${m.note}` : ''}</div></div>)}
    {modal && <SpareModal modal={modal} onClose={() => setModal(null)} onDone={(m) => { setMsg(m); refresh() }} />}
  </section>
}
function SpareModal({ modal, onClose, onDone }: { modal: any; onClose: () => void; onDone: (m: string) => void }) {
  const p = modal.p, k = modal.kind as 'new' | 'in' | 'fix' | 'edit' | 'print'
  const [name, setName] = useState(p?.name ?? ''), [code, setCode] = useState(p?.code ?? ''), [qty, setQty] = useState(k === 'fix' ? String(Number(p.in_stock)) : ''), [low, setLow] = useState(String(Number(p?.low_level ?? 0))), [note, setNote] = useState(''), [active, setActive] = useState(p?.active ?? true), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const r = k === 'new' ? await supabase.rpc('add_spare_part', { p_name: name, p_code: code, p_qty: Number(qty || 0), p_low: Number(low || 0) })
      : k === 'in' ? await supabase.rpc('receive_spare', { p_spare: p.id, p_qty: Number(qty), p_note: note })
      : k === 'print' ? await supabase.rpc('print_parts', { p_spare: p.id, p_qty: Number(qty) })
      : k === 'fix' ? await supabase.rpc('correct_spare', { p_spare: p.id, p_total: Number(qty), p_note: note })
      : await supabase.rpc('edit_spare_part', { p_id: p.id, p_name: name, p_code: code, p_low: Number(low || 0), p_active: active })
    setBusy(false); if (r.error) return setErr(r.error.message)
    onDone('Saved.'); onClose()
  }
  return <div className="modal"><form className="card" onSubmit={save}>
    <h3 style={{ margin: 0 }}>{k === 'new' ? 'New spare part' : k === 'print' ? `Laser printing done: ${p.name}` : k === 'in' ? `Stock came in: ${p.name}` : k === 'fix' ? `Fix the count: ${p.name}` : `Edit ${p.name}`}</h3>
    {(k === 'new' || k === 'edit') && <><label>Name<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lock motor" /></label>
      <label>Code (optional)<input value={code} onChange={(e) => setCode(e.target.value)} /></label>
      <label>Warn me when stock falls to (0 = no warning)<input type="number" min="0" step="any" value={low} onChange={(e) => setLow(e.target.value)} /></label></>}
    {k === 'new' && <label>Stock now in hand<input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} /></label>}
    {k === 'print' && <><div className="muted">{Number(p.in_stock)} plain pieces now. Pieces you enter move from plain to the printed count.</div><label>How many came back printed?<input required type="number" min="1" step="any" value={qty} onChange={(e) => setQty(e.target.value)} /></label></>}
    {k === 'in' && <label>How many came in<input required type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} /></label>}
    {k === 'fix' && <label>Correct total in hand<input required type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} /></label>}
    {(k === 'in' || k === 'fix') && <label>Note (optional)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder={k === 'in' ? 'e.g. bought from supplier' : 'e.g. counted on shelf'} /></label>}
    {k === 'edit' && <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexDirection: 'row', color: 'inherit', fontSize: 14 }}><input type="checkbox" style={{ width: 18, height: 18, padding: 0 }} checked={active} onChange={(e) => setActive(e.target.checked)} />In use (untick to stop offering it in repairs)</label>}
    {err && <p className="msg">{err}</p>}<button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="link" onClick={onClose}>Cancel</button></form></div>
}
