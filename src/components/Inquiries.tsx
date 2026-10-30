import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSettings } from '../lib/settings'

export default function Inquiries({ me }: { me: any }) {
  const qc = useQueryClient()
  const { stages: STAGES } = useSettings()
  const isAdmin = me.role === 'admin'
  const { data: emps = [] } = useQuery({ queryKey: ['employees'], queryFn: async () => (await supabase.from('employees').select('id,employee_name').eq('active', true)).data ?? [] })
  const [emp, setEmp] = useState('')
  const [q, setQ] = useState(''), [stage, setStage] = useState(''), [open, setOpen] = useState(false), [msg, setMsg] = useState('')
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['inquiries'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inquiries')
        .select('id,inquiry_number,assigned_to,inquiry_title,sales_stage,priority,inquiry_date,next_followup_at,updated_at,customers(customer_name,phone_number),inquiry_items(product_name_snapshot,quantity),assigned:employees!assigned_to(employee_name)')
        .is('archived_at', null).order('created_at', { ascending: false }).limit(200)
      if (error) throw error
      return data
    }
  })
  const rows = data.filter((r: any) => (!stage || r.sales_stage === stage) && (!emp || r.assigned_to === emp) &&
    JSON.stringify(r).toLowerCase().includes(q.toLowerCase()))

  async function changeStage(r: any, next: string) {
    setMsg('')
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
  async function archive(r: any) {
    if (!confirm(`Archive ${r.inquiry_number}?`)) return
    const { error } = await supabase.from('inquiries').update({ archived_at: new Date().toISOString(), inquiry_status: 'Archived' }).eq('id', r.id)
    if (error) setMsg(error.message)
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
          <div>{r.customers?.customer_name} {r.customers?.phone_number && <a href={`tel:${r.customers.phone_number}`}>📞 {r.customers.phone_number}</a>}</div>
          <div className="muted">{r.inquiry_items?.map((i: any) => `${i.product_name_snapshot} × ${i.quantity ?? '?'}`).join(', ') || r.inquiry_title || 'No product yet'}</div>
          <div className="muted">Assigned: {r.assigned?.employee_name ?? 'Unassigned'} · Next follow-up: {r.next_followup_at ? new Date(r.next_followup_at).toLocaleString() : '—'}</div>
          <div className="row">
            <select value={r.sales_stage} onChange={(e) => changeStage(r, e.target.value)}>{(STAGES.includes(r.sales_stage) ? STAGES : [...STAGES, r.sales_stage]).map((s: string) => <option key={s}>{s}</option>)}</select>
            {isAdmin && <><select value={r.assigned_to ?? ''} onChange={(e) => reassign(r, e.target.value)}><option value="">Unassigned</option>{emps.map((x: any) => <option key={x.id} value={x.id}>{x.employee_name}</option>)}</select><button className="link" onClick={() => archive(r)}>Archive</button></>}
          </div>
        </div>
      ))}
      {open && <NewInquiry me={me} emps={isAdmin ? emps : []} onClose={() => setOpen(false)} />}
    </section>
  )
}

function NewInquiry({ me, emps, onClose }: { me: any; emps: any[]; onClose: () => void }) {
  const qc = useQueryClient()
  const { categories: CATS, sources: SRC } = useSettings()
  const [f, setF] = useState({ name: '', phone: '', title: '', cat: '', prod: '', qty: '', priority: 'Medium', source: '', assign: me.id })
  const cat = f.cat || CATS[0], source = f.source || SRC[0]
  const { data: prods = [] } = useQuery({ queryKey: ['products'], queryFn: async () => (await supabase.from('products').select('id,product_name,unit').eq('active', true).order('product_name')).data ?? [] })
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      const c = await supabase.from('customers').insert({ customer_name: f.name, phone_number: f.phone || null, created_by: me.id }).select('id').single()
      if (c.error) throw c.error
      const i = await supabase.from('inquiries').insert({ customer_id: c.data.id, inquiry_title: f.title || null, priority: f.priority, inquiry_source: source, assigned_to: f.assign || me.id }).select('id').single()
      if (i.error) throw i.error
      const it = await supabase.from('inquiry_items').insert({ inquiry_id: i.data.id, product_id: prods.find((x: any) => x.id === f.prod)?.id ?? null, product_name_snapshot: prods.find((x: any) => x.id === f.prod)?.product_name ?? cat, unit: prods.find((x: any) => x.id === f.prod)?.unit ?? null, quantity: f.qty ? Number(f.qty) : null })
      if (it.error) throw it.error
      const fu = await supabase.from('followups').insert({ inquiry_id: i.data.id, assigned_to: f.assign || me.id, followup_type: 'Phone Call', scheduled_at: new Date(Date.now() + 36e5).toISOString(), source_rule: 'first_contact', notes: 'First contact', created_by: me.id })
      if (fu.error) throw fu.error
      qc.invalidateQueries(); onClose()
    } catch (x: any) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <div className="modal"><form className="card" onSubmit={save}>
      <h2>New inquiry</h2>
      <label>Customer name *<input required value={f.name} onChange={set('name')} /></label>
      <label>Phone<input inputMode="tel" value={f.phone} onChange={set('phone')} /></label>
      <label>Product category<select value={cat} onChange={set('cat')}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
      {prods.length > 0 && <label>Catalogue product (updates stock when dispatched)<select value={f.prod} onChange={set('prod')}><option value="">— not in catalogue —</option>{prods.map((x: any) => <option key={x.id} value={x.id}>{x.product_name}</option>)}</select></label>}
      <label>Quantity<input type="number" min="0" value={f.qty} onChange={set('qty')} /></label>
      <label>Title / notes<input value={f.title} onChange={set('title')} /></label>
      <label>Priority<select value={f.priority} onChange={set('priority')}>{['Low','Medium','High','Urgent'].map((p) => <option key={p}>{p}</option>)}</select></label>
      <label>Source<select value={source} onChange={set('source')}>{SRC.map((p) => <option key={p}>{p}</option>)}</select></label>
      {emps.length > 0 && <label>Assign to<select value={f.assign} onChange={set('assign')}>{emps.map((x: any) => <option key={x.id} value={x.id}>{x.employee_name}</option>)}</select></label>}
      {err && <p className="msg">{err}</p>}
      <div className="row"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
    </form></div>
  )
}
