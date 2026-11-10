import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDate as fmt, isoDate } from '../lib/dates'
import DateField from './DateField'
import JobUpdate, { UpdateList } from './JobUpdate'
import Repairs from './Repairs'
import { CustomerPick, useEmps, useCustomers } from './Pickers'
import { HandOverButton } from './Reassign'
import { AgeTag, ageLook } from '../lib/age'
import { CustomerTicketBar } from './CustomerApp'
const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const today = () => isoDate()
const inWarranty = (u?: string | null) => !!u && u >= today()
export default function AfterSales({ me }: { me: any }) {
  const qc = useQueryClient(), [tab, setTab] = useState<'inst' | 'tix' | 'rep' | 'mine' | 'find'>('inst'), [msg, setMsg] = useState('')
  const [upd, setUpd] = useState<any>(null), [form, setForm] = useState<'' | 'inst' | 'tix'>(''), [serialFor, setSerialFor] = useState<any>(null), [openId, setOpenId] = useState('')
  const canWrite = me.role === 'admin' || me.role === 'service' || me.role === 'sales' // may record installations and add serial numbers
  const canTix = me.role === 'admin' || me.role === 'service' // may change a ticket's status
  const refresh = () => qc.invalidateQueries({ queryKey: ['aftersales'] })
  const inst = useQuery({ queryKey: ['aftersales', 'inst'], queryFn: async () => { const { data, error } = await supabase.from('installations').select('id,status,technician_id,created_at,job_updates(id,done,note,proof_path,created_at,update_date),site_name,what,installed_on,warranty_until,warranty_months,notes,inquiry_id,employees:technician_id(employee_name),giver:employees!created_by(employee_name),inquiries(customers(customer_name,city)),serials(id,serial_no,room,packing_no)').order('installed_on', { ascending: false }).limit(200); if (error) throw error; return data as any[] } })
  const tix = useQuery({ queryKey: ['aftersales', 'tix'], queryFn: async () => { const { data, error } = await supabase.from('service_tickets').select('id,assigned_to,job_updates(id,done,note,proof_path,created_at,update_date),seq,site_name,title,details,priority,status,opened_at,closed_at,installations(warranty_until,inquiries(customers(customer_name,city))),assigned:employees!assigned_to(employee_name),giver:employees!opened_by(employee_name)').order('opened_at', { ascending: false }).limit(200); if (error) throw error; return data as any[] } })
  const appTix = useQuery({ queryKey: ['aftersales', 'app-tix'], queryFn: async () => { const { data, error } = await supabase.rpc('staff_customer_tickets'); if (error) throw error; return (data ?? {}) as Record<string, any> } })
  async function setStatus(t: any, status: string) { const { error } = await supabase.from('service_tickets').update({ status }).eq('id', t.id); setMsg(error ? error.message : ''); refresh() }
  const [q, setQ] = useState('')
  const found = useQuery({ queryKey: ['aftersales', 'find', q], enabled: q.trim().length >= 3, queryFn: async () => { const { data, error } = await supabase.from('serials').select('id,serial_no,room,packing_no,installations(site_name,installed_on,warranty_until,employees:technician_id(employee_name))').ilike('serial_no', `%${q.trim()}%`).limit(20); if (error) throw error; return data as any[] } })
  const Tab = (k: typeof tab, l: string) => <button className={tab === k ? 'primary' : ''} onClick={() => setTab(k)}>{l}</button>
  return (
    <section>
      <div className="bar">{Tab('inst', 'Installations')}{Tab('tix', 'Service tickets')}{Tab('rep', 'Repairs')}{me.role === 'service' && Tab('mine', 'My updates')}{Tab('find', 'Find a serial')}</div>
      {msg && <p className="msg">{msg}</p>}
      {tab === 'inst' && <>
        {canWrite && <button className="primary bigbtn go" onClick={() => setForm('inst')}>+ Give installation work</button>}
        {inst.data && !inst.data.length && <p className="empty">No installations recorded yet.</p>}
        {inst.data?.map((i) => <div className="card tap" key={i.id} style={{ borderLeftColor: inWarranty(i.warranty_until) ? '#6B8F72' : '#8b8f86', ...ageLook(i.created_at, i.status === 'Completed').style }} onClick={() => setOpenId(openId === i.id ? '' : i.id)}>
          <div className="row"><b>{one(one(i.inquiries)?.customers)?.customer_name ?? i.site_name}</b><span className={`pill${i.status === 'Completed' ? '' : ' Medium'}`}>{i.status === 'Completed' ? (inWarranty(i.warranty_until) ? 'Completed · in warranty' : 'Completed · warranty over') : i.job_updates?.length ? 'Partly done' : 'To do'}</span></div>
          <AgeTag since={i.created_at} finished={i.status === 'Completed'} />
          {i.what && <div>{i.what}</div>}
          <div className="muted">{[i.site_name, one(one(i.inquiries)?.customers)?.city].filter(Boolean).join(' · ')}{one(i.giver)?.employee_name ? ` · Given by ${one(i.giver).employee_name}` : ''}</div>
          <div className="muted">{i.status === 'Completed' ? `Completed ${fmt(i.installed_on)} by ${one(i.employees)?.employee_name ?? 'n/a'} · warranty until ${fmt(i.warranty_until)}` : `Given to ${one(i.employees)?.employee_name ?? 'nobody yet'} · planned ${fmt(i.installed_on)}`}</div>
          {i.status !== 'Completed' && (me.role === 'admin' || (me.role === 'service' && i.technician_id === me.id)) && <button className="primary" onClick={(e) => { e.stopPropagation(); setUpd({ inst: i.id, title: `${i.site_name}${i.what ? ' · ' + i.what : ''}` }) }}>Update work (partly / fully done)</button>}
          {i.status !== 'Completed' && <div className="bar" onClick={(e) => e.stopPropagation()}><HandOverButton me={me} kind="installation" id={i.id} currentId={i.technician_id} title={`${i.site_name}${i.what ? ' · ' + i.what : ''}`} /></div>}
          {openId === i.id && <div style={{ display: 'grid', gap: 6 }} onClick={(e) => e.stopPropagation()}>
            {i.notes && <div className="muted">{i.notes}</div>}
            <UpdateList list={i.job_updates} />
            {i.serials?.length ? i.serials.map((s: any) => <div key={s.id}><span className="chip sm">{s.serial_no}</span> {s.room ? `Room ${s.room}` : ''}{s.packing_no ? ` · packing no. ${s.packing_no}` : ''}</div>) : <div className="muted">No serial numbers saved.</div>}
            {canWrite && <button onClick={() => setSerialFor(i)}>+ Add serial numbers</button>}
            <button onClick={() => { setForm('tix') }}>Open a service ticket</button>
          </div>}
        </div>)}</>}
      {tab === 'tix' && <>
        <button className="primary bigbtn go" onClick={() => setForm('tix')}>+ New service ticket</button>
        {tix.data && !tix.data.length && <p className="empty">No tickets.</p>}
        {tix.data?.map((t) => { const w = one(t.installations)?.warranty_until; return <div className="card" key={t.id} style={{ borderLeftColor: t.priority === 'High' ? '#9b3b30' : '#8A6F52', opacity: t.status === 'Fixed' ? 0.7 : 1, ...ageLook(t.opened_at, t.status === 'Fixed').style }}>
          <div className="row"><b>Ticket S-{String(t.seq).padStart(3, '0')}</b><span className={`pill ${t.priority === 'High' ? 'Urgent' : t.priority}`}>{t.priority}</span></div>
          <div style={{ fontSize: 16 }}>{t.title}</div>
          <AgeTag since={t.opened_at} finished={t.status === 'Fixed'} />
          <div className="muted">{[t.site_name, one(one(one(t.installations)?.inquiries)?.customers)?.city].filter(Boolean).join(' · ')}{one(t.giver)?.employee_name ? ` · Given by ${one(t.giver).employee_name}` : ''}</div>
          <div className="muted">Opened {fmt(t.opened_at)}{w ? (inWarranty(w) ? ' · in warranty' : ' · warranty over') : ''}{one(t.assigned)?.employee_name ? ` · ${one(t.assigned).employee_name}` : ''}</div>
          {t.details && <div className="muted" style={{ whiteSpace: 'pre-line' }}>{t.details}</div>}
          {appTix.data?.[t.id] && <CustomerTicketBar info={appTix.data[t.id]} seq={t.seq} />}
          <UpdateList list={t.job_updates} />
          {t.status !== 'Fixed' && (me.role === 'admin' || (me.role === 'service' && t.assigned_to === me.id)) && <button className="primary" onClick={() => setUpd({ ticket: t.id, title: `S-${String(t.seq).padStart(3, '0')} · ${t.title}` })}>Update work (partly / fully done)</button>}
          {t.status !== 'Fixed' && <div className="bar"><HandOverButton me={me} kind="ticket" id={t.id} currentId={t.assigned_to} title={`S-${String(t.seq).padStart(3, '0')} · ${t.title}`} /></div>}
          {canTix ? <div className="bar">{['Open', 'In progress', 'Fixed'].map((s) => <button key={s} className={t.status === s ? 'primary' : ''} onClick={() => t.status !== s && setStatus(t, s)}>{s}</button>)}</div> : <span className="pill" style={{ justifySelf: 'start' }}>{t.status}</span>}
        </div> })}</>}
      {tab === 'rep' && <Repairs me={me} />}
      {tab === 'mine' && <MyUpdates />}
      {tab === 'find' && <>
        <input placeholder="Type at least 3 characters of the serial number" value={q} onChange={(e) => setQ(e.target.value)} />
        {found.data && !found.data.length && <p className="empty">Nothing found.</p>}
        {found.data?.map((s) => { const i = one(s.installations); return <div className="card" key={s.id}><b>{s.serial_no}</b><div><b>{i?.site_name}</b>{s.room ? `, Room ${s.room}` : ''}</div>
          <div className="muted">{s.packing_no ? `Packing no. ${s.packing_no} · ` : ''}installed {fmt(i?.installed_on)} by {one(i?.employees)?.employee_name ?? 'n/a'} · warranty until {fmt(i?.warranty_until)} ({inWarranty(i?.warranty_until) ? 'in warranty' : 'over'})</div></div> })}</>}
      {form === 'inst' && <InstForm me={me} onClose={() => setForm('')} onDone={() => refresh()} />}
      {upd && <JobUpdate me={me} inst={upd.inst} ticket={upd.ticket} title={upd.title} onClose={() => setUpd(null)} onDone={refresh} />}
      {form === 'tix' && <TicketForm me={me} sites={inst.data ?? []} onClose={() => setForm('')} onDone={refresh} />}
      {serialFor && <Serials inst={serialFor} onClose={() => setSerialFor(null)} onDone={refresh} />}
    </section>
  )
}
function InstForm({ me, onClose, onDone }: { me: any; onClose: () => void; onDone: () => void }) {
  const emps = useEmps(), custs = useCustomers(), orders = useQuery({ queryKey: ['aftersales', 'orders'], queryFn: async () => (await supabase.rpc('installable_orders')).data as any[] ?? [] })
  const [f, setF] = useState({ order: '', site: '', city: '', what: '', tech: (me.role === 'service' ? me.id : '') as string, on: today(), months: '12', notes: '' }), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const pick = (id: string) => { const o = orders.data?.find((x: any) => x.inquiry_id === id); setF({ ...f, order: id, site: o ? o.customer : f.site, city: custs.data?.find((c: any) => o && c.name === o.customer)?.city ?? f.city, what: o ? o.items ?? '' : f.what }) }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const { data, error } = await supabase.from('installations').insert({ inquiry_id: f.order || null, site_name: f.site.trim(), city: f.city.trim() || null, what: f.what.trim() || null, technician_id: f.tech || null, installed_on: f.on, status: 'Scheduled', warranty_months: Number(f.months) || 0, notes: f.notes.trim() || null, created_by: me.id }).select('id,site_name').single()
    setBusy(false); if (error) return setErr(error.message); onClose(); onDone()
  }
  return <div className="modal"><form className="card" onSubmit={save}><h3 style={{ margin: 0 }}>Give installation work</h3>
    <label>Dispatched order (optional)<select value={f.order} onChange={(e) => pick(e.target.value)}><option value="">Not from the list</option>{orders.data?.map((o: any) => <option key={o.inquiry_id} value={o.inquiry_id}>{o.customer} · {o.inquiry_number}</option>)}</select></label>
    <CustomerPick site={f.site} city={f.city} onChange={(site, city) => setF({ ...f, site, city })} />
    <label>What is to be installed<input value={f.what} onChange={(e) => setF({ ...f, what: e.target.value })} /></label>
    <label>Give to<select value={f.tech} onChange={(e) => setF({ ...f, tech: e.target.value })}><option value="">Choose…</option>{emps.data?.map((x: any) => <option key={x.id} value={x.id}>{x.employee_name}</option>)}</select></label>
    <label>Planned date<DateField value={f.on} onChange={(v) => setF({ ...f, on: v })} ariaLabel="Installed on" /></label>
    <label>Warranty (months, starts when work is completed)<input type="number" min="0" value={f.months} onChange={(e) => setF({ ...f, months: e.target.value })} /></label>
    <label>Notes<input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
    {err && <p className="msg">{err}</p>}<button className="primary" disabled={busy || !f.site.trim()}>{busy ? 'Saving…' : 'Give work'}</button><button type="button" className="link" onClick={onClose}>Cancel</button></form></div>
}
function Serials({ inst, onClose, onDone }: { inst: any; onClose: () => void; onDone: () => void }) {
  const [txt, setTxt] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function save() {
    const rows = txt.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [s, r, p] = l.split(',').map((x) => x.trim()); return { installation_id: inst.id, serial_no: s, room: r || null, packing_no: p ? Number(p) || null : null } })
    if (!rows.length) return onClose()
    setBusy(true); setErr(''); const { error } = await supabase.from('serials').insert(rows); setBusy(false)
    if (error) return setErr(/duplicate/i.test(error.message) ? 'One of these serial numbers is already saved.' : error.message); onDone(); onClose()
  }
  return <div className="modal"><div className="card"><h3 style={{ margin: 0 }}>Serial numbers: {inst.site_name}</h3>
    <p className="muted" style={{ margin: 0 }}>One per line: serial number, room, packing number (room and packing number are optional). Example: <b>OF4800-000412, 204, 14</b></p>
    <textarea rows={8} value={txt} onChange={(e) => setTxt(e.target.value)} />
    {err && <p className="msg">{err}</p>}<button className="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button><button className="link" onClick={onClose}>Skip for now</button></div></div>
}
function TicketForm({ me, sites, onClose, onDone }: { me: any; sites: any[]; onClose: () => void; onDone: () => void }) {
  const emps = useEmps(), [f, setF] = useState({ inst: '', site: '', city: '', title: '', details: '', pr: 'Medium', to: me.role === 'service' ? me.id : '' }), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const s = sites.find((x) => x.id === f.inst), { error } = await supabase.from('service_tickets').insert({ installation_id: f.inst || null, site_name: (s?.site_name ?? f.site).trim(), city: (s?.city ?? f.city).trim() || null, title: f.title.trim(), details: f.details.trim() || null, priority: f.pr, assigned_to: f.to || null, opened_by: me.id })
    setBusy(false); if (error) return setErr(error.message); onDone(); onClose()
  }
  return <div className="modal"><form className="card" onSubmit={save}><h3 style={{ margin: 0 }}>New service ticket</h3>
    <label>Installation<select value={f.inst} onChange={(e) => setF({ ...f, inst: e.target.value })}><option value="">Not in the list</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.site_name} · {fmt(s.installed_on)}</option>)}</select></label>
    {!f.inst && <CustomerPick site={f.site} city={f.city} onChange={(site, city) => setF({ ...f, site, city })} />}
    <label>What is wrong?<input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
    <label>More details<input value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} /></label>
    <label>Priority<select value={f.pr} onChange={(e) => setF({ ...f, pr: e.target.value })}><option>Low</option><option>Medium</option><option>High</option></select></label>
    <label>Give to<select value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}><option value="">Not assigned</option>{emps.data?.map((x: any) => <option key={x.id} value={x.id}>{x.employee_name}</option>)}</select></label>
    {err && <p className="msg">{err}</p>}<button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Open ticket'}</button><button type="button" className="link" onClick={onClose}>Cancel</button></form></div>
}

// The notes this person has written, newest first, with the date of the work.
function MyUpdates() {
  const q = useQuery({ queryKey: ['aftersales', 'mine'], queryFn: async () => { const { data, error } = await supabase.rpc('my_job_updates'); if (error) throw error; return data as any[] } })
  return <>
    {q.isLoading && <p className="empty">Loading…</p>}
    {q.data && !q.data.length && <p className="empty">You have not saved any updates yet.</p>}
    {q.data?.map((u) => <div className="card" key={u.id}>
      <div className="row"><b>{u.job}{u.city ? ` · ${u.city}` : ''}</b><span className={`pill${u.done === 'complete' ? '' : ' Medium'}`}>{u.done === 'complete' ? 'Fully done' : 'Partly done'}</span></div>
      <div className="muted">Work date {fmt(u.day)} · saved {fmt(u.saved_at)}</div><div>{u.note}</div></div>)}
  </>
}
