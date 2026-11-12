import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSettings } from '../lib/settings'
import ScheduleFollowup from './ScheduleFollowup'
import LostReason from './LostReason'
import Payments from './Payments'
import ConfirmOrder from './ConfirmOrder'
import Quotes from './Quotes'
import QuoteForm from './QuoteForm'
import { moveStage } from '../lib/stage'
import WhoFor from './WhoFor'
import InquiryBar, { useMoney } from './Progress'
import ItemsEditor, { ItemRow, newRow, rowsFromItems, useCatalogue } from './ItemsEditor'
import Dispatch from './Dispatch'
import CustomerApp from './CustomerApp'
import EditCustomer from './EditCustomer'
import { fmtDate, fmtDateTime } from '../lib/dates'

export default function Inquiries({ me }: { me: any }) {
  const qc = useQueryClient()
  const { stages: STAGES } = useSettings()
  const [fuFor, setFuFor] = useState<any>(null), [lostFor, setLostFor] = useState<any>(null), [payFor, setPayFor] = useState<any>(null), [appFor, setAppFor] = useState<any>(null), [custFor, setCustFor] = useState<any>(null), [confirmFor, setConfirmFor] = useState<any>(null), [quoFor, setQuoFor] = useState<any>(null), [quoFormFor, setQuoFormFor] = useState<any>(null), [editFor, setEditFor] = useState<any>(null), [dispFor, setDispFor] = useState<any>(null)
  const isAdmin = me.role === 'admin'
  const { data: emps = [] } = useQuery({ queryKey: ['employees'], queryFn: async () => (await supabase.from('employees').select('id,employee_name').eq('active', true).in('role', ['admin', 'sales'])).data ?? [] })
  const [emp, setEmp] = useState('')
  const [q, setQ] = useState(''), [stage, setStage] = useState(''), [open, setOpen] = useState(false), [msg, setMsg] = useState('')
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['inquiries'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inquiries')
        .select('id,customer_id,inquiry_source,inquiry_number,assigned_to,inquiry_title,sales_stage,priority,inquiry_date,next_followup_at,updated_at,lost_reason,lost_note,packing_no,dispatched_at,customers(customer_name,phone_number),inquiry_items(product_name_snapshot,quantity),assigned:employees!assigned_to(employee_name)')
        .is('archived_at', null).order('created_at', { ascending: false }).limit(200)
      if (error) throw error
      return data
    }
  })
  const rows = data.filter((r: any) => (!stage || r.sales_stage === stage) && (!emp || r.assigned_to === emp) &&
    JSON.stringify(r).toLowerCase().includes(q.toLowerCase()))

  const money = useMoney()
  async function changeStage(r: any, next: string) {
    setMsg('')
    if (next === 'Lost' && r.sales_stage !== 'Lost') return setLostFor(r) // ask why first
    if (next === 'Order Confirmed' && r.sales_stage !== 'Order Confirmed') return setConfirmFor(r) // link products so stock can be locked
    if (next === 'Quotation Sent' && r.sales_stage !== 'Quotation Sent') return setQuoFormFor(r) // record what is being quoted
    // updated_at guard: if another user saved first, 0 rows match and we refuse to overwrite.
    const { data, error } = await supabase.from('inquiries').update({ sales_stage: next })
      .eq('id', r.id).eq('updated_at', r.updated_at).select('id')
    if (error) setMsg(error.message)
    else if (!data?.length) setMsg(`${r.inquiry_number} was changed by someone else. Latest data loaded — try again.`)
    else if (next === 'Order Confirmed' || next === 'Lost')
      await supabase.from('followups').update({ status: 'Cancelled' }).eq('inquiry_id', r.id).eq('status', 'Pending')
    qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['followups'] })
  }
  async function reassign(r: any, to: string) {
    const { data, error } = await supabase.from('inquiries').update({ assigned_to: to || null }).eq('id', r.id).eq('updated_at', r.updated_at).select('id')
    setMsg(error ? error.message : !data?.length ? `${r.inquiry_number} was changed by someone else. Try again.` : '')
    qc.invalidateQueries({ queryKey: ['inquiries'] })
  }
  async function del(r: any) {
    const t = prompt(`Delete ${r.inquiry_number} FOREVER, with its follow-ups, payments and history? This cannot be undone.\nType ${r.inquiry_number} to confirm:`)
    if (t === null) return
    const { error } = await supabase.rpc('delete_inquiry', { inq: r.id, confirm_number: t }); setMsg(error ? error.message : `${r.inquiry_number} deleted.`)
    qc.invalidateQueries({ queryKey: ['inquiries'] })
  }
  async function archive(r: any) {
    if (!confirm(`Archive ${r.inquiry_number}?`)) return
    const { error } = await supabase.from('inquiries').update({ archived_at: new Date().toISOString(), inquiry_status: 'Archived' }).eq('id', r.id)
    if (error) setMsg(error.message)
  }

  // Opens the IndiaMART email that created this inquiry, in the company's leads Gmail.
  async function openMail(r: any) {
    setMsg('')
    const [id, box] = await Promise.all([supabase.rpc('inquiry_source_mail', { p_inq: r.id }), supabase.from('org_settings').select('value').eq('key', 'indiamartMailbox').maybeSingle()])
    if (id.error) return setMsg(id.error.message)
    if (!id.data) return setMsg('No email is linked to this inquiry (it may have been added by hand).')
    const mailbox = (box.data?.value as string) || 'oforttleadsintake@gmail.com'
    window.open(`https://mail.google.com/mail/?authuser=${encodeURIComponent(mailbox)}#all/${id.data}`, '_blank')
  }

  return (
    <section>
      <div className="bar">
        <input placeholder="Search inquiries…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={stage} onChange={(e) => setStage(e.target.value)}><option value="">All stages</option>{STAGES.map((s) => <option key={s}>{s}</option>)}</select>
        {isAdmin && <select value={emp} onChange={(e) => setEmp(e.target.value)}><option value="">All staff</option>{emps.map((x: any) => <option key={x.id} value={x.id}>{x.employee_name}</option>)}</select>}
        <button className="primary" onClick={() => setOpen(true)}>+ Add inquiry</button>
      </div>
      {msg && <p className="msg">{msg}</p>}
      {isLoading && <p>Loading…</p>}
      {error && <p className="msg">{(error as any).message}</p>}
      {!isLoading && !rows.length && <p className="empty">No inquiries yet.</p>}
      {rows.map((r: any) => (
        <div className="card" key={r.id}>
          <div className="row"><b>{r.inquiry_number}</b><span className={`pill ${r.priority}`}>{r.priority}</span></div>
          <div>{r.customers?.customer_name} {(me.role === 'admin' || me.role === 'sales') && <button className="link" onClick={() => setCustFor(r)}>✎ Edit</button>} {r.customers?.phone_number && <a href={`tel:${r.customers.phone_number}`}>📞 {r.customers.phone_number}</a>}</div>
          <div className="muted">{r.inquiry_items?.map((i: any) => `${i.product_name_snapshot} × ${i.quantity ?? '?'}`).join(', ') || r.inquiry_title || 'No product yet'}</div>
          <div className="muted">Assigned: {r.assigned?.employee_name ?? 'Unassigned'} · Next follow-up: {r.next_followup_at ? fmtDateTime(r.next_followup_at) : '—'}</div>
          <InquiryBar r={r} stages={STAGES} money={money.data} />
          {r.sales_stage === 'Order Confirmed' && (() => { const m = money.data?.[r.id]; return <div className="row"><div className="muted">{r.packing_no ? <>Packing no. <b>{r.packing_no}</b></> : null}{m?.due && m.status !== 'Paid in full' ? ` · payment due ${fmtDate(m.due)}` : ''}</div><span style={{ display: 'flex', gap: 10 }}><button className="link" onClick={() => setPayFor(r)}>Payments</button>{me.role !== 'service' && <button className="link" onClick={() => setDispFor(r)}>Dispatch</button>}</span></div> })()}
          {r.sales_stage === 'Lost' && r.lost_reason && <div className="muted">Lost: {r.lost_reason}{r.lost_note ? ` · ${r.lost_note}` : ''}</div>}
          <div className="row">
            <select value={r.sales_stage} onChange={(e) => changeStage(r, e.target.value)}>{(STAGES.includes(r.sales_stage) ? STAGES : [...STAGES, r.sales_stage]).map((s: string) => <option key={s}>{s}</option>)}</select>
            <button className="link" onClick={() => setFuFor(r)}>+ Follow-up</button>{r.inquiry_source === 'IndiaMART' && (me.role === 'admin' || me.role === 'sales') && <button className="link" onClick={() => openMail(r)}>Original email</button>}{(me.role === 'admin' || me.role === 'sales') && <button className="link" onClick={() => setAppFor(r)}>Customer app</button>}{me.role !== 'service' && <button className="link" onClick={() => setQuoFor(r)}>Quotations</button>}{(isAdmin || (me.role === 'sales' && r.sales_stage !== 'Order Confirmed')) && <button className="link" onClick={() => setEditFor(r)}>Edit items</button>}
            {isAdmin && <><select value={r.assigned_to ?? ''} onChange={(e) => reassign(r, e.target.value)}><option value="">Unassigned</option>{emps.map((x: any) => <option key={x.id} value={x.id}>{x.employee_name}</option>)}</select><button className="link" onClick={() => archive(r)}>Archive</button><button className="link" onClick={() => del(r)}>Delete</button></>}
          </div>
        </div>
      ))}
      {confirmFor && <ConfirmOrder inquiry={confirmFor} onClose={() => setConfirmFor(null)} onConfirm={async () => { const e = await moveStage(confirmFor, 'Order Confirmed'); qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['followups'] }); qc.invalidateQueries({ queryKey: ['inventory'] }); return e }} />}
      {quoFormFor && <QuoteForm inquiry={quoFormFor} onClose={() => setQuoFormFor(null)} onSaved={async () => { const e = await moveStage(quoFormFor, 'Quotation Sent'); qc.invalidateQueries({ queryKey: ['inquiries'] }); return e }} onSkip={async () => { const e = await moveStage(quoFormFor, 'Quotation Sent'); qc.invalidateQueries({ queryKey: ['inquiries'] }); return e }} />}
      {quoFor && <Quotes me={me} inquiry={quoFor} onClose={() => setQuoFor(null)} />}
      {custFor && <EditCustomer inquiry={custFor} onClose={() => setCustFor(null)} />}
      {appFor && <CustomerApp customerId={appFor.customer_id} name={appFor.customers?.customer_name ?? ''} isAdmin={me.role === 'admin'} onClose={() => setAppFor(null)} />}
      {payFor && <Payments me={me} inquiry={payFor} onClose={() => setPayFor(null)} />}
      {lostFor && <LostReason inquiry={lostFor} onClose={() => setLostFor(null)} onSave={async (reason, note) => { const e = await moveStage(lostFor, 'Lost', { lost_reason: reason, lost_note: note || null }); qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['followups'] }); return e }} />}
      {fuFor && <ScheduleFollowup me={me} inquiryId={fuFor.id} assignedTo={fuFor.assigned_to} title="Add a follow-up" who={fuFor.customers} onClose={() => setFuFor(null)} />}
      {editFor && <EditItems inquiry={editFor} onClose={() => setEditFor(null)} />}
      {dispFor && <Dispatch me={me} inquiry={dispFor} onClose={() => setDispFor(null)} />}
      {open && <NewInquiry me={me} emps={isAdmin ? emps : []} onClose={() => setOpen(false)} />}
    </section>
  )
}

function NewInquiry({ me, emps, onClose }: { me: any; emps: any[]; onClose: () => void }) {
  const qc = useQueryClient()
  const { sources: SRC } = useSettings(), cat = useCatalogue()
  const [f, setF] = useState({ name: '', phone: '', title: '', priority: 'Medium', source: '', assign: me.id }), [rows, setRows] = useState<ItemRow[]>([newRow()])
  const source = f.source || SRC[0]
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const prods = cat.data ?? [], used = rows.filter((r) => r.pid || r.qty)
    for (const r of used) { const p = prods.find((x) => x.id === r.pid); if (!p) return setErr('Choose a category and a product on every item (or remove the empty item).'); if (!(Number(r.qty) > 0)) return setErr(`Enter the quantity for ${p.product_name}.`) }
    setBusy(true)
    try {
      const c = await supabase.from('customers').insert({ customer_name: f.name, phone_number: f.phone || null, created_by: me.id }).select('id').single()
      if (c.error) throw c.error
      const i = await supabase.from('inquiries').insert({ customer_id: c.data.id, inquiry_title: f.title || null, priority: f.priority, inquiry_source: source, assigned_to: f.assign || me.id }).select('id').single()
      if (i.error) throw i.error
      if (used.length) {
        const it = await supabase.from('inquiry_items').insert(used.map((r) => { const p = prods.find((x) => x.id === r.pid)!; return { inquiry_id: i.data.id, product_id: p.id, product_name_snapshot: p.product_name, unit: p.unit ?? null, quantity: Number(r.qty), mortis_spare_id: r.mortis || null } }))
        if (it.error) throw it.error
      }
      const fu = await supabase.from('followups').insert({ inquiry_id: i.data.id, assigned_to: f.assign || me.id, followup_type: 'Phone Call', scheduled_at: new Date(Date.now() + 36e5).toISOString(), source_rule: 'first_contact', notes: 'First contact', created_by: me.id })
      if (fu.error) throw fu.error
      qc.invalidateQueries(); onClose()
    } catch (x: any) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <div className="modal"><form className="card" style={{ maxWidth: 560 }} onSubmit={save}>
      <h2>New inquiry</h2>
      <label>Customer name *<input required value={f.name} onChange={set('name')} /></label>
      <label>Phone<input inputMode="tel" value={f.phone} onChange={set('phone')} /></label>
      <h4 style={{ margin: '6px 0 0' }}>Products wanted</h4>
      <ItemsEditor rows={rows} onChange={setRows} />
      <label>Title / notes<input value={f.title} onChange={set('title')} /></label>
      <label>Priority<select value={f.priority} onChange={set('priority')}>{['Low','Medium','High','Urgent'].map((p) => <option key={p}>{p}</option>)}</select></label>
      <label>Source<select value={source} onChange={set('source')}>{SRC.map((p) => <option key={p}>{p}</option>)}</select></label>
      {emps.length > 0 && <label>Assign to<select value={f.assign} onChange={set('assign')}>{emps.map((x: any) => <option key={x.id} value={x.id}>{x.employee_name}</option>)}</select></label>}
      {err && <p className="msg">{err}</p>}
      <div className="row"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
    </form></div>
  )
}

// Change the products on an existing inquiry (sales until the order is confirmed; the admin any time).
function EditItems({ inquiry, onClose }: { inquiry: any; onClose: () => void }) {
  const qc = useQueryClient(), cat = useCatalogue(), [rows, setRows] = useState<ItemRow[] | null>(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const items = useQuery({ queryKey: ['edit-items', inquiry.id], queryFn: async () => {
    const { data, error } = await supabase.from('inquiry_items').select('id,product_id,quantity,mortis_spare_id').eq('inquiry_id', inquiry.id).order('created_at'); if (error) throw error; return data as any[] } })
  if (cat.data && items.data && rows === null) { const r = rowsFromItems(items.data, cat.data); setRows(r.length ? r : [newRow()]) }
  async function save() {
    setErr(''); const prods = cat.data ?? [], used = (rows ?? []).filter((r) => r.pid || r.qty)
    for (const r of used) { const p = prods.find((x) => x.id === r.pid); if (!p) return setErr('Choose a category and a product on every item (or remove the empty item).'); if (!(Number(r.qty) > 0)) return setErr(`Enter the quantity for ${p.product_name}.`) }
    setBusy(true)
    const { error } = await supabase.rpc('save_inquiry_items', { p_inq: inquiry.id, p_items: used.map((r) => ({ product_id: r.pid, quantity: Number(r.qty), mortis_spare_id: r.mortis || null })) })
    setBusy(false); if (error) return setErr(error.message)
    qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['quote-items'] }); onClose()
  }
  return <div className="modal"><div className="card" style={{ maxWidth: 560 }}>
    <h3 style={{ margin: 0 }}>Edit items</h3><WhoFor inquiry={inquiry} />
    {!rows && <p className="empty">Loading…</p>}
    {rows && <ItemsEditor rows={rows} onChange={setRows} />}
    {err && <p className="msg">{err}</p>}
    <button className="primary" disabled={busy || !rows} onClick={save}>{busy ? 'Saving…' : 'Save items'}</button><button className="link" onClick={onClose}>Cancel</button>
  </div></div>
}
