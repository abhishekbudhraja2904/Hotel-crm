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
import { tempOf, TEMP_LOOK } from '../lib/temperature'
import DateField from './DateField'
import Reorder from './Reorder'
import OldCustomers from './OldCustomers'
import WhoFor from './WhoFor'
import InquiryBar, { useMoney } from './Progress'
import ItemsEditor, { ItemRow, newRow, rowsFromItems, useCatalogue } from './ItemsEditor'
import Dispatch from './Dispatch'
import Notes from './Notes'
import InquiryBoard from './InquiryBoard'
import FollowupInline from './FollowupInline'
import CustomerApp from './CustomerApp'
import EditCustomer from './EditCustomer'
import { fmtDate, fmtDateTime } from '../lib/dates'

export default function Inquiries({ me, startFu = false, startFilter = '' }: { me: any; startFu?: boolean; startFilter?: string }) {
  const qc = useQueryClient()
  const { stages: STAGES } = useSettings()
  const [fuFor, setFuFor] = useState<any>(null), [lostFor, setLostFor] = useState<any>(null), [payFor, setPayFor] = useState<any>(null), [appFor, setAppFor] = useState<any>(null), [custFor, setCustFor] = useState<any>(null), [confirmFor, setConfirmFor] = useState<any>(null), [quoFor, setQuoFor] = useState<any>(null), [quoFormFor, setQuoFormFor] = useState<any>(null), [editFor, setEditFor] = useState<any>(null), [dispFor, setDispFor] = useState<any>(null)
  const isAdmin = me.role === 'admin'
  const { data: emps = [] } = useQuery({ queryKey: ['employees'], queryFn: async () => (await supabase.from('employees').select('id,employee_name').eq('active', true).in('role', ['admin', 'sales'])).data ?? [] })
  const [view, setView] = useState<'list' | 'old'>(startFilter === 'old' ? 'old' : 'list'), [reorderFor, setReorderFor] = useState<any>(null)
  const [emp, setEmp] = useState(startFilter.startsWith('emp:') ? startFilter.slice(4) : ''), [tf, setTf] = useState(startFilter.startsWith('temp:') ? startFilter.slice(5) : ''), [att, setAtt] = useState(startFilter === 'notatt' ? '1' : ''), [fuF, setFuF] = useState(['late', 'due', 'today', 'later', 'none'].includes(startFilter) ? startFilter : startFu ? 'due' : ''), [notesFor, setNotesFor] = useState<any>(null), [openId, setOpenId] = useState(''), cfg = useSettings()
  async function setNeeded(r: any, v: string) { const { error } = await supabase.from('inquiries').update({ needed_by: v || null }).eq('id', r.id); if (error) setMsg(error.message); qc.invalidateQueries({ queryKey: ['inquiries'] }) }
  const pendFu = useQuery({ queryKey: ['followups', 'pending'], queryFn: async () => { const m = new Map<string, any>(); for (const d of ((await supabase.from('followups').select('id,inquiry_id,assigned_to,followup_type,scheduled_at,notes,updated_at').eq('status', 'Pending').order('scheduled_at').limit(1000)).data ?? []) as any[]) if (!m.has(d.inquiry_id)) m.set(d.inquiry_id, d); return m } })
  const fuState = (id: string) => { const f = pendFu.data?.get(id); if (!f) return 'none'; const t = +new Date(f.scheduled_at); return t < Date.now() ? 'late' : t <= new Date().setHours(23, 59, 59, 999) ? 'today' : 'later' }
  const lastFu = useQuery({ queryKey: ['followups', 'last'], queryFn: async () => { const m = new Map<string, any>(); for (const d of ((await supabase.from('followups').select('inquiry_id,outcome,completed_at').eq('status', 'Completed').order('completed_at', { ascending: false }).limit(500)).data ?? []) as any[]) if (!m.has(d.inquiry_id)) m.set(d.inquiry_id, d); return m } })
  const [q, setQ] = useState(startFilter.startsWith('q:') ? startFilter.slice(2) : ''), [stage, setStage] = useState(startFilter.startsWith('stage:') ? startFilter.slice(6) : ''), [open, setOpen] = useState(false), [msg, setMsg] = useState('')
  const { data = [], isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['inquiries'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inquiries')
        .select('id,attended_at,created_at,needed_by,customer_id,inquiry_source,inquiry_number,assigned_to,inquiry_title,sales_stage,priority,inquiry_date,next_followup_at,updated_at,lost_reason,lost_note,packing_no,dispatched_at,customers(customer_name,phone_number,city),inquiry_items(product_name_snapshot,quantity),assigned:employees!assigned_to(employee_name)')
        .is('archived_at', null).order('created_at', { ascending: false }).limit(200)
      if (error) throw error
      return data
    }
  })
  // Latest note on each inquiry (shown on the board card)
  const latestNote = useQuery({ queryKey: ['inquiries', 'notes-latest'], queryFn: async () => { const m = new Map<string, any>(); for (const n of ((await supabase.from('inquiry_notes').select('inquiry_id,body,created_at,author:employees!created_by(employee_name)').order('created_at', { ascending: false }).limit(1500)).data ?? []) as any[]) if (!m.has(n.inquiry_id)) m.set(n.inquiry_id, n); return m } })
  const ATT_HOURS = 4
  const notAtt = (r: any) => !r.attended_at && !['Order Confirmed', 'Lost'].includes(r.sales_stage) && Date.now() - new Date(r.created_at).getTime() > ATT_HOURS * 3600000
  const rows = data.filter((r: any) => !r.dispatched_at && (!att || notAtt(r)) && (!fuF || (fuF === 'due' ? ['late', 'today'].includes(fuState(r.id)) : fuState(r.id) === fuF)) && (!stage || r.sales_stage === stage) && (!emp || r.assigned_to === emp) && (!tf || tempOf(r.needed_by, cfg.tempHotDays, cfg.tempWarmDays) === tf) &&
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

  // Opens the IndiaMART email that created this inquiry in the company's leads Gmail.
  // The admin is signed in to that Gmail; sales open it through Gmail's "delegated access" to it.
  async function openMail(r: any) {
    setMsg('')
    const [id, box] = await Promise.all([supabase.rpc('inquiry_source_mail', { p_inq: r.id }), supabase.from('org_settings').select('value').eq('key', 'indiamartMailbox').maybeSingle()])
    if (id.error) return setMsg(id.error.message)
    if (!id.data) return setMsg('No email is linked to this inquiry (it may have been added by hand).')
    const mailbox = (box.data?.value as string) || 'oforttleadsintake@gmail.com'
    window.open(me.role === 'admin' ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(mailbox)}#all/${id.data}` : `https://mail.google.com/mail/b/${encodeURIComponent(mailbox)}/u/0/#all/${id.data}`, '_blank')
  }

  // The full card (everything the old list showed). On the board it opens in a pop-up when a card is tapped.
  const renderCard = (r: any) => (
        <div className="card">
          <div className="row"><b>{r.inquiry_number}</b><span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{isAdmin && notAtt(r) && <span className="pill" style={{ background: '#fde2e2', color: '#b42318' }}>Not attended yet</span>}{!['Order Confirmed', 'Lost'].includes(r.sales_stage) && (() => { const t = tempOf(r.needed_by, cfg.tempHotDays, cfg.tempWarmDays), L = TEMP_LOOK[t]; return L ? <span className="pill" style={{ background: L.bg, color: L.fg }}>{L.icon} {t}</span> : null })()}<span className={`pill ${r.priority}`}>{r.priority}</span></span></div>
          <div>
            <div className="row" style={{ flexWrap: 'nowrap' }}><b style={{ fontSize: 17 }}>{r.customers?.customer_name}</b>{(me.role === 'admin' || me.role === 'sales') && <button className="link" onClick={() => setCustFor(r)}>✎ Edit</button>}</div>
            {r.customers?.phone_number && <a href={`tel:${r.customers.phone_number}`} style={{ fontSize: 14 }}>📞 {r.customers.phone_number}</a>}
            <div className="muted" style={{ marginTop: 2 }}>{r.inquiry_items?.map((i: any) => `${i.product_name_snapshot} × ${i.quantity ?? '?'}`).join(', ') || r.inquiry_title || 'No product yet'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: !['Order Confirmed', 'Lost'].includes(r.sales_stage) ? '1fr 1fr' : '1fr', gap: 10, borderTop: '1px solid #e6e3d8', paddingTop: 8 }} onClick={(e) => e.stopPropagation()}>
            <div><div className="muted" style={{ fontSize: 12 }}>Assigned to</div><b>{r.assigned?.employee_name ?? 'Unassigned'}</b></div>
            {!['Order Confirmed', 'Lost'].includes(r.sales_stage) && <div><div className="muted" style={{ fontSize: 12 }}>Customer needs it by</div><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><DateField value={r.needed_by ?? ''} onChange={(v) => setNeeded(r, v)} ariaLabel="Date the customer needs the order" />{r.needed_by && <button className="link" onClick={() => setNeeded(r, '')}>clear</button>}</div></div>}
          </div>
          {pendFu.data?.get(r.id)
            ? <FollowupInline me={me} inquiry={r} f={pendFu.data.get(r.id)} last={lastFu.data?.get(r.id)} />
            : !['Order Confirmed', 'Lost'].includes(r.sales_stage) && <div style={{ border: '1px dashed #c9c5b5', borderRadius: 10, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div><b>No follow-up scheduled</b>{lastFu.data?.get(r.id) && <div className="muted">Last: <b>{lastFu.data.get(r.id).outcome ?? 'Done'}</b> · {fmtDateTime(lastFu.data.get(r.id).completed_at)}</div>}</div>
                <button className="primary" onClick={() => setFuFor(r)}>+ Schedule</button></div>}
          <InquiryBar r={r} stages={STAGES} money={money.data} />
          {r.sales_stage === 'Order Confirmed' && (() => { const m = money.data?.[r.id]; return <div className="row"><div className="muted">{r.packing_no ? <>Packing no. <b>{r.packing_no}</b></> : null}{m?.due && m.status !== 'Paid in full' ? ` · payment due ${fmtDate(m.due)}` : ''}</div><span style={{ display: 'flex', gap: 8 }}><button onClick={() => setPayFor(r)}>Payments</button>{me.role !== 'service' && <button onClick={() => setDispFor(r)}>Dispatch</button>}</span></div> })()}
          {r.sales_stage === 'Lost' && r.lost_reason && <div className="muted">Lost: {r.lost_reason}{r.lost_note ? ` · ${r.lost_note}` : ''}</div>}
          <div style={{ display: 'grid', gap: 8 }}>
            <select value={r.sales_stage} onChange={(e) => changeStage(r, e.target.value)}>{(STAGES.includes(r.sales_stage) ? STAGES : [...STAGES, r.sales_stage]).map((s: string) => <option key={s}>{s}</option>)}</select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => setFuFor(r)}>+ Follow-up</button>
              <button onClick={() => setNotesFor(r)}>📝 Notes</button>
            </div>
            <details onClick={(e) => { if ((e.target as HTMLElement).tagName === 'BUTTON') (e.currentTarget as HTMLDetailsElement).open = false }}>
              <summary style={{ cursor: 'pointer', padding: '6px 0', fontWeight: 600 }}>More ▾</summary>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                {r.dispatched_at && (me.role === 'admin' || me.role === 'sales') && <button onClick={() => setReorderFor({ customerId: r.customer_id, name: r.customers?.customer_name ?? '', inquiryId: r.id })}>Repeat order</button>}
                {r.inquiry_source === 'IndiaMART' && (me.role === 'admin' || me.role === 'sales') && <button onClick={() => openMail(r)}>Original email</button>}
                {(me.role === 'admin' || me.role === 'sales') && <button onClick={() => setAppFor(r)}>Customer app</button>}
                {me.role !== 'service' && <button onClick={() => setQuoFor(r)}>Quotations</button>}
                {(isAdmin || (me.role === 'sales' && r.sales_stage !== 'Order Confirmed')) && <button onClick={() => setEditFor(r)}>Edit items</button>}
                {isAdmin && <button onClick={() => archive(r)}>Archive</button>}
                {(isAdmin || (me.role === 'sales' && r.sales_stage !== 'Order Confirmed' && !r.packing_no && !r.dispatched_at)) && <button onClick={() => del(r)} style={{ color: '#9b3b30' }}>Delete</button>}
                {isAdmin && <label style={{ gridColumn: '1 / -1' }}>Assigned to<select value={r.assigned_to ?? ''} onChange={(e) => reassign(r, e.target.value)}><option value="">Unassigned</option>{emps.map((x: any) => <option key={x.id} value={x.id}>{x.employee_name}</option>)}</select></label>}
              </div>
            </details>
          </div>
        </div>
  )
  const openRow = data.find((r: any) => r.id === openId)

  return (
    <section>
      {(me.role === 'admin' || me.role === 'sales') && <div className="bar"><button className={view === 'list' ? 'primary' : ''} onClick={() => setView('list')}>Inquiries</button><button className={view === 'old' ? 'primary' : ''} onClick={() => setView('old')}>Old customers</button></div>}
      {view === 'list' ? <>
      <div className="bar">
        <input placeholder="Search inquiries…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={stage} onChange={(e) => setStage(e.target.value)}><option value="">All stages</option>{STAGES.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={fuF} onChange={(e) => setFuF(e.target.value)}><option value="">All follow-ups</option><option value="due">Due today + overdue</option><option value="late">Overdue</option><option value="today">Due today</option><option value="later">Upcoming</option><option value="none">No follow-up set</option></select>
        <select value={tf} onChange={(e) => setTf(e.target.value)}><option value="">Hot / Warm / Cold</option><option value="Hot">🔥 Hot</option><option value="Warm">🌤 Warm</option><option value="Cold">❄️ Cold</option><option value="None">No date set</option></select>
        {isAdmin && <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14, color: 'inherit' }}><input type="checkbox" style={{ width: 18, height: 18, padding: 0 }} checked={!!att} onChange={(e) => setAtt(e.target.checked ? '1' : '')} />Not attended</label>}
        {isAdmin && <select value={emp} onChange={(e) => setEmp(e.target.value)}><option value="">All staff</option>{emps.map((x: any) => <option key={x.id} value={x.id}>{x.employee_name}</option>)}</select>}
        <button className="primary" onClick={() => setOpen(true)}>+ Add inquiry</button>
      </div>
      {msg && <p className="msg">{msg}</p>}
      {isLoading && <p>Loading…</p>}
      {error && <p className="msg">{(error as any).message}</p>}
      <InquiryBoard rows={rows} columns={stage ? [stage] : [...STAGES, ...[...new Set(data.map((r: any) => r.sales_stage))].filter((x: any) => !STAGES.includes(x))] as string[]} allStages={STAGES} me={me} notes={latestNote.data} version={dataUpdatedAt}
        onMove={(r, to) => changeStage(r, to)} onOpen={(r) => setOpenId(r.id)} />
      </> : <OldCustomers me={me} onReorder={(c) => setReorderFor(c)} />}
      {openRow && <div className="modal" onClick={() => setOpenId('')}><div style={{ maxWidth: 440, margin: 'auto' }} onClick={(e) => e.stopPropagation()}>
        {renderCard(openRow)}
        <button className="primary" style={{ width: '100%' }} onClick={() => setOpenId('')}>Close</button></div></div>}
      {confirmFor && <ConfirmOrder inquiry={confirmFor} onClose={() => setConfirmFor(null)} onConfirm={async () => { const e = await moveStage(confirmFor, 'Order Confirmed'); qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['followups'] }); qc.invalidateQueries({ queryKey: ['inventory'] }); return e }} />}
      {quoFormFor && <QuoteForm inquiry={quoFormFor} onClose={() => setQuoFormFor(null)} onSaved={async () => { const e = await moveStage(quoFormFor, 'Quotation Sent'); qc.invalidateQueries({ queryKey: ['inquiries'] }); return e }} onSkip={async () => { const e = await moveStage(quoFormFor, 'Quotation Sent'); qc.invalidateQueries({ queryKey: ['inquiries'] }); return e }} />}
      {quoFor && <Quotes me={me} inquiry={quoFor} onClose={() => setQuoFor(null)} />}
      {custFor && <EditCustomer inquiry={custFor} onClose={() => setCustFor(null)} />}
      {appFor && <CustomerApp customerId={appFor.customer_id} name={appFor.customers?.customer_name ?? ''} isAdmin={me.role === 'admin'} onClose={() => setAppFor(null)} />}
      {payFor && <Payments me={me} inquiry={payFor} onClose={() => setPayFor(null)} />}
      {lostFor && <LostReason inquiry={lostFor} onClose={() => setLostFor(null)} onSave={async (reason, note) => { const e = await moveStage(lostFor, 'Lost', { lost_reason: reason, lost_note: note || null }); qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['followups'] }); return e }} />}
      {fuFor && <ScheduleFollowup me={me} inquiryId={fuFor.id} assignedTo={fuFor.assigned_to} title="Add a follow-up" who={fuFor.customers} onClose={() => setFuFor(null)} />}
      {notesFor && <Notes kind="inquiry" id={notesFor.id} title={`${notesFor.inquiry_number} · ${notesFor.customers?.customer_name ?? ''}`} me={me} onClose={() => setNotesFor(null)} />}
      {editFor && <EditItems inquiry={editFor} onClose={() => setEditFor(null)} />}
      {dispFor && <Dispatch me={me} inquiry={dispFor} onClose={() => setDispFor(null)} />}
      {reorderFor && <Reorder me={me} customerId={reorderFor.customerId} name={reorderFor.name} fromInquiryId={reorderFor.inquiryId} onClose={() => setReorderFor(null)} onCreated={(row) => { setReorderFor(null); qc.invalidateQueries({ queryKey: ['inquiries'] }); setConfirmFor(row) }} />}
      {open && <NewInquiry me={me} emps={isAdmin ? emps : []} onClose={() => setOpen(false)} />}
    </section>
  )
}

function NewInquiry({ me, emps, onClose }: { me: any; emps: any[]; onClose: () => void }) {
  const qc = useQueryClient()
  const { sources: SRC } = useSettings(), cat = useCatalogue()
  const [f, setF] = useState({ name: '', phone: '', title: '', priority: 'Medium', source: '', assign: me.id }), [rows, setRows] = useState<ItemRow[]>([newRow()])
  const [needed, setNeeded] = useState('')
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
      const i = await supabase.from('inquiries').insert({ customer_id: c.data.id, inquiry_title: f.title || null, priority: f.priority, inquiry_source: source, needed_by: needed || null, assigned_to: f.assign || me.id }).select('id').single()
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
      <label>Date the customer needs the order (optional)<DateField value={needed} onChange={setNeeded} ariaLabel="Needed by" /></label>
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
  // Lines that must survive an edit untouched: Left/Right handle lines (kept per row while quantity and product are unchanged) and items whose product is no longer in the catalogue.
  const [keep, setKeep] = useState<Record<number, { base: string; total: number; lines: any[] }>>({}), [frozen, setFrozen] = useState<any[]>([]), [orphans, setOrphans] = useState<any[]>([])
  const items = useQuery({ queryKey: ['edit-items', inquiry.id], queryFn: async () => {
    const { data, error } = await supabase.from('inquiry_items').select('id,product_id,quantity,mortis_spare_id,product_name_snapshot').eq('inquiry_id', inquiry.id).order('created_at'); if (error) throw error
    const ids = [...new Set((data ?? []).map((i: any) => i.product_id).filter(Boolean))]
    const info = ids.length ? ((await supabase.from('products').select('id,handle_of').in('id', ids)).data ?? []) : []
    return { items: data as any[], handle: new Map<string, string | null>(info.map((p: any) => [p.id, p.handle_of] as [string, string | null])) } } })
  if (cat.data && items.data && rows === null) {
    const out: ItemRow[] = [], kp: Record<number, { base: string; total: number; lines: any[] }> = {}, fz: any[] = [], orph: any[] = [], byBase = new Map<string, ItemRow>()
    for (const i of items.data.items) {
      const base = (i.product_id && items.data.handle.get(i.product_id)) || i.product_id, p = base ? cat.data.find((x: any) => x.id === base) : null
      if (!i.product_id) { orph.push(i); out.push({ ...newRow(), qty: i.quantity != null ? String(Number(i.quantity)) : '' }); continue }
      if (!p) { fz.push(i); continue }
      const isVar = !!items.data.handle.get(i.product_id), ex = byBase.get(base)
      if (isVar && ex) { ex.qty = String(Number(ex.qty) + Number(i.quantity ?? 0)); kp[ex.key].total += Number(i.quantity ?? 0); kp[ex.key].lines.push(i); continue }
      const row: ItemRow = { ...newRow(), cat: p.product_category, pid: base, qty: i.quantity != null ? String(Number(i.quantity)) : '', mortis: i.mortis_spare_id ?? '' }
      out.push(row); if (isVar) { byBase.set(base, row); kp[row.key] = { base, total: Number(i.quantity ?? 0), lines: [i] } }
    }
    setKeep(kp); setFrozen(fz); setOrphans(orph); setRows(out.length || fz.length ? out : [newRow()])
  }
  async function save() {
    setErr(''); const prods = cat.data ?? [], used = (rows ?? []).filter((r) => r.pid || r.qty)
    for (const r of used) { const p = prods.find((x) => x.id === r.pid); if (!p) return setErr('Choose a category and a product on every item (or remove the empty item).'); if (!(Number(r.qty) > 0)) return setErr(`Enter the quantity for ${p.product_name}.`) }
    const payload: any[] = frozen.map((i) => ({ product_id: i.product_id, quantity: i.quantity != null ? Number(i.quantity) : null, mortis_spare_id: i.mortis_spare_id || null }))
    for (const r of used) {
      const k = keep[r.key]
      if (k && k.base === r.pid && Number(r.qty) === k.total) for (const l of k.lines) payload.push({ product_id: l.product_id, quantity: Number(l.quantity), mortis_spare_id: l.mortis_spare_id || null })
      else payload.push({ product_id: r.pid, quantity: Number(r.qty), mortis_spare_id: r.mortis || null })
    }
    setBusy(true)
    const { error } = await supabase.rpc('save_inquiry_items', { p_inq: inquiry.id, p_items: payload })
    setBusy(false); if (error) return setErr(error.message)
    qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['quote-items'] }); qc.invalidateQueries({ queryKey: ['dispatch'] }); onClose()
  }
  return <div className="modal"><div className="card" style={{ maxWidth: 560 }}>
    <h3 style={{ margin: 0 }}>Edit items</h3><WhoFor inquiry={inquiry} />
    {!rows && <p className="empty">Loading…</p>}
    {orphans.length > 0 && <div className="warnbox">These old items are not linked to a catalogue product. Choose the product for each blank row below (quantity is already filled): {orphans.map((o) => `${o.product_name_snapshot} × ${o.quantity ?? '?'}`).join(', ')}</div>}
    {frozen.length > 0 && <div className="muted">Also kept as they are: {frozen.map((o) => `${o.product_name_snapshot} × ${o.quantity ?? '?'}`).join(', ')}</div>}
    {rows && <ItemsEditor rows={rows} onChange={setRows} />}
    {err && <p className="msg">{err}</p>}
    <button className="primary" disabled={busy || !rows} onClick={save}>{busy ? 'Saving…' : 'Save items'}</button><button className="link" onClick={onClose}>Cancel</button>
  </div></div>
}
