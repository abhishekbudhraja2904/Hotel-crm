import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDate, isoDate } from '../lib/dates'
import DateField from './DateField'
import JobUpdate, { UpdateList } from './JobUpdate'
import { CustomerPick, useEmps } from './Pickers'
import { HandOverButton } from './Reassign'
import { AgeTag, ageLook } from '../lib/age'
const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const pillOf = (s: string) => (s === 'Done' ? 'Done' : s === 'In progress' ? 'In progress' : 'To do')
// Repair boxes: a box arrives, is given to a service employee, who lists each piece, what was wrong, what was repaired and the spare parts used.
export default function Repairs({ me }: { me: any }) {
  const qc = useQueryClient(), [form, setForm] = useState(false), [pieces, setPieces] = useState<any>(null), [upd, setUpd] = useState<any>(null), [openId, setOpenId] = useState('')
  const refresh = () => { qc.invalidateQueries({ queryKey: ['aftersales'] }); qc.invalidateQueries({ queryKey: ['spares'] }); qc.invalidateQueries({ queryKey: ['service-team'] }) }
  const boxes = useQuery({ queryKey: ['aftersales', 'repairs'], queryFn: async () => { const { data, error } = await supabase.from('repair_boxes').select('id,box_no,customer_name,city,courier,notes,received_on,status,created_at,assigned_to,assigned:employees!assigned_to(employee_name),giver:employees!created_by(employee_name),repair_items(id,product,fault,repaired,status,work_date,repair_item_spares(spare_id,qty,spare_parts(name))),job_updates(id,done,note,proof_path,created_at,update_date)').order('created_at', { ascending: false }).limit(200); if (error) throw error; return data as any[] } })
  const mayWork = (b: any) => me.role === 'admin' || (me.role === 'service' && b.assigned_to === me.id)
  return <>
    <button className="primary bigbtn go" onClick={() => setForm(true)}>+ Add repair box</button>
    {boxes.data && !boxes.data.length && <p className="empty">No repair boxes yet.</p>}
    {boxes.error && <p className="msg">{(boxes.error as any).message}</p>}
    {boxes.data?.map((b) => { const done = b.status === 'Done', a = ageLook(b.created_at, done), its: any[] = b.repair_items ?? [], open = openId === b.id
      return <div className="card tap" key={b.id} style={a.style} onClick={() => setOpenId(open ? '' : b.id)}>
        <div className="row"><b>Repair box no. {b.box_no}</b><span className={`pill${done ? '' : ' Medium'}`}>{pillOf(b.status)}</span></div>
        <div><b>{b.customer_name}</b>{b.city ? ` · ${b.city}` : ''}</div>
        <AgeTag since={b.created_at} finished={done} />
        {b.notes && <div className="muted">{b.notes}</div>}
        <div className="muted">Received {fmtDate(b.received_on)}{b.courier ? ` · ${b.courier}` : ''} · {its.length} piece{its.length === 1 ? '' : 's'}{its.length ? `, ${its.filter((i) => i.status === 'Repaired').length} repaired` : ''}</div>
        <div className="muted">Given to {one(b.assigned)?.employee_name ?? 'nobody yet'}{one(b.giver)?.employee_name ? ` · by ${one(b.giver).employee_name}` : ''}</div>
        {!done && mayWork(b) && <div className="bar" onClick={(e) => e.stopPropagation()}>
          <button className="primary" onClick={() => setPieces(b)}>Pieces in the box</button>
          <button className="primary" onClick={() => setUpd({ box: b.id, title: `Repair box no. ${b.box_no} · ${b.customer_name}` })}>Update work (partly / fully done)</button></div>}
        {!done && <div className="bar" onClick={(e) => e.stopPropagation()}><HandOverButton me={me} kind="repair" id={b.id} currentId={b.assigned_to} title={`Repair box no. ${b.box_no} · ${b.customer_name}`} /></div>}
        {open && <div style={{ display: 'grid', gap: 6 }} onClick={(e) => e.stopPropagation()}>
          {its.map((i) => <div key={i.id} className="muted"><b>{i.product}</b> · {i.status}{i.fault ? ` · Fault: ${i.fault}` : ''}{i.repaired ? ` · Repaired: ${i.repaired}` : ''}{i.repair_item_spares?.length ? ` · Spares: ${i.repair_item_spares.map((s: any) => `${Number(s.qty)} × ${one(s.spare_parts)?.name ?? '?'}`).join(', ')}` : ''}</div>)}
          {!its.length && <div className="muted">No pieces listed yet.</div>}
          <UpdateList list={b.job_updates} />
        </div>}
      </div> })}
    {form && <BoxForm me={me} onClose={() => setForm(false)} onDone={refresh} />}
    {pieces && <Pieces box={boxes.data?.find((x) => x.id === pieces.id) ?? pieces} onClose={() => setPieces(null)} onChanged={refresh} />}
    {upd && <JobUpdate me={me} box={upd.box} title={upd.title} onClose={() => setUpd(null)} onDone={refresh} />}
  </>
}
function BoxForm({ me, onClose, onDone }: { me: any; onClose: () => void; onDone: () => void }) {
  const emps = useEmps(), [f, setF] = useState({ site: '', city: '', courier: '', notes: '', to: (me.role === 'service' ? me.id : '') as string, on: isoDate() }), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const { error } = await supabase.rpc('create_repair_box', { p_customer: null, p_name: f.site, p_city: f.city, p_courier: f.courier, p_notes: f.notes, p_to: f.to || null, p_received: f.on || null })
    setBusy(false); if (error) return setErr(error.message); onClose(); onDone()
  }
  return <div className="modal"><form className="card" onSubmit={save}><h3 style={{ margin: 0 }}>Add repair box</h3>
    <CustomerPick site={f.site} city={f.city} onChange={(site, city) => setF({ ...f, site, city })} />
    <label>Courier / how it came (optional)<input value={f.courier} onChange={(e) => setF({ ...f, courier: e.target.value })} placeholder="e.g. Blue Dart, docket no." /></label>
    <label>Note (optional)<input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="e.g. 5 locks, customer says they do not open" /></label>
    <label>Give to<select value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}><option value="">Not assigned yet</option>{emps.data?.map((x: any) => <option key={x.id} value={x.id}>{x.employee_name}</option>)}</select></label>
    <label>Received on<DateField value={f.on} onChange={(v) => setF({ ...f, on: v })} ariaLabel="Received on" /></label>
    {err && <p className="msg">{err}</p>}<button className="primary" disabled={busy || !f.site.trim()}>{busy ? 'Saving…' : 'Add box'}</button><button type="button" className="link" onClick={onClose}>Cancel</button></form></div>
}
// The list of pieces in a box, and the form to add or change one.
function Pieces({ box, onClose, onChanged }: { box: any; onClose: () => void; onChanged: () => void }) {
  const [edit, setEdit] = useState<any>(null), [err, setErr] = useState('')
  const its: any[] = box.repair_items ?? []
  async function del(i: any) {
    if (!confirm(`Remove "${i.product}" from this box? Spare parts used on it go back to stock.`)) return
    const { error } = await supabase.rpc('delete_repair_item', { p_item: i.id }); setErr(error ? error.message : ''); onChanged()
  }
  return <div className="modal"><div className="card">
    <h3 style={{ margin: 0 }}>Repair box no. {box.box_no}: pieces</h3><div className="muted">{box.customer_name}{box.city ? ` · ${box.city}` : ''}</div>
    {err && <p className="msg">{err}</p>}
    {its.map((i) => <div className="card" key={i.id} style={{ margin: 0 }}>
      <div className="row"><b>{i.product}</b><span className={`pill${i.status === 'Repaired' ? '' : ' Medium'}`}>{i.status === 'Pending' ? 'Not checked yet' : i.status}</span></div>
      {i.fault && <div className="muted">Fault: {i.fault}</div>}{i.repaired && <div className="muted">Repaired: {i.repaired}</div>}
      {i.repair_item_spares?.length > 0 && <div className="muted">Spares: {i.repair_item_spares.map((s: any) => `${Number(s.qty)} × ${one(s.spare_parts)?.name ?? '?'}`).join(', ')}</div>}
      <div className="bar"><button onClick={() => setEdit(i)}>Change</button><button className="link" onClick={() => del(i)}>Remove</button></div></div>)}
    {!its.length && <p className="empty">Nothing listed yet. Open the box, then add each piece.</p>}
    <button className="primary" onClick={() => setEdit({})}>+ Add a piece</button>
    <button className="link" onClick={onClose}>Close</button>
    {edit && <PieceForm box={box} item={edit} onClose={() => setEdit(null)} onDone={onChanged} />}
  </div></div>
}
function PieceForm({ box, item, onClose, onDone }: { box: any; item: any; onClose: () => void; onDone: () => void }) {
  const spares = useQuery({ queryKey: ['spares', 'active'], queryFn: async () => (await supabase.from('spare_parts').select('id,name,in_stock').eq('active', true).order('name')).data ?? [] })
  const [f, setF] = useState({ product: item.product ?? '', fault: item.fault ?? '', repaired: item.repaired ?? '', status: item.status ?? 'Pending', on: item.work_date ?? isoDate() })
  const [used, setUsed] = useState<{ spare_id: string; qty: string }[]>((item.repair_item_spares ?? []).map((s: any) => ({ spare_id: s.spare_id ?? '', qty: String(Number(s.qty)) })))
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const { error } = await supabase.rpc('save_repair_item', { p_box: box.id, p_item: item.id ?? null, p_product: f.product, p_fault: f.fault, p_repaired: f.repaired, p_status: f.status, p_spares: used.filter((u) => u.spare_id && Number(u.qty) > 0).map((u) => ({ spare_id: u.spare_id, qty: Number(u.qty) })), p_date: f.on || null })
    setBusy(false); if (error) return setErr(error.message); onDone(); onClose()
  }
  return <div className="modal"><form className="card" onSubmit={save}><h3 style={{ margin: 0 }}>{item.id ? 'Change piece' : 'Add a piece'}</h3>
    <label>Which piece (model)<input required value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} placeholder="e.g. RFID lock OF4800" /></label>
    <label>What is wrong (fault found)<textarea rows={2} value={f.fault} onChange={(e) => setF({ ...f, fault: e.target.value })} /></label>
    <label>What was repaired<textarea rows={2} value={f.repaired} onChange={(e) => setF({ ...f, repaired: e.target.value })} /></label>
    <label>Status<select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="Pending">Not checked / not finished</option><option value="Repaired">Repaired</option><option value="Not repairable">Cannot be repaired</option></select></label>
    <div className="muted">Spare parts used (taken off the stock when you save)</div>
    {used.map((u, x) => <div className="bar" key={x}>
      <select value={u.spare_id} onChange={(e) => setUsed(used.map((r, y) => (y === x ? { ...r, spare_id: e.target.value } : r)))} style={{ flex: 2 }}><option value="">Choose spare part…</option>{spares.data?.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({Number(s.in_stock)} in stock)</option>)}</select>
      <input type="number" min="0" step="any" value={u.qty} onChange={(e) => setUsed(used.map((r, y) => (y === x ? { ...r, qty: e.target.value } : r)))} style={{ flex: 1 }} aria-label="Quantity" />
      <button type="button" className="link" onClick={() => setUsed(used.filter((_, y) => y !== x))}>Remove</button></div>)}
    <button type="button" onClick={() => setUsed([...used, { spare_id: '', qty: '1' }])}>+ Add a spare part used</button>
    <label>Date of this work<DateField value={f.on} onChange={(v) => setF({ ...f, on: v })} ariaLabel="Date of work" /></label>
    {err && <p className="msg">{err}</p>}<button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save piece'}</button><button type="button" className="link" onClick={onClose}>Cancel</button></form></div>
}
