import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDate as fmt, isoDate } from '../lib/dates'
import DateField from './DateField'
const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const today = () => isoDate()
const inWarranty = (u?: string | null) => !!u && u >= today()
export default function AfterSales({ me }: { me: any }) {
  const qc = useQueryClient(), [tab, setTab] = useState<'inst' | 'tix' | 'find'>('inst'), [msg, setMsg] = useState('')
  const [form, setForm] = useState<'' | 'inst' | 'tix'>(''), [serialFor, setSerialFor] = useState<any>(null), [openId, setOpenId] = useState('')
  const canWrite = me.role === 'admin' || me.role === 'service' || me.role === 'sales' // may record installations and add serial numbers
  const canTix = me.role === 'admin' || me.role === 'service' // may change a ticket's status
  const refresh = () => qc.invalidateQueries({ queryKey: ['aftersales'] })
  const inst = useQuery({ queryKey: ['aftersales', 'inst'], queryFn: async () => { const { data, error } = await supabase.from('installations').select('id,site_name,what,installed_on,warranty_until,warranty_months,notes,inquiry_id,employees:technician_id(employee_name),serials(id,serial_no,room,packing_no)').order('installed_on', { ascending: false }).limit(200); if (error) throw error; return data as any[] } })
  const tix = useQuery({ queryKey: ['aftersales', 'tix'], queryFn: async () => { const { data, error } = await supabase.from('service_tickets').select('id,seq,site_name,title,details,priority,status,opened_at,closed_at,installations(warranty_until),assigned:employees!assigned_to(employee_name)').order('opened_at', { ascending: false }).limit(200); if (error) throw error; return data as any[] } })
  async function setStatus(t: any, status: string) { const { error } = await supabase.from('service_tickets').update({ status }).eq('id', t.id); setMsg(error ? error.message : ''); refresh() }
  const [q, setQ] = useState('')
  const found = useQuery({ queryKey: ['aftersales', 'find', q], enabled: q.trim().length >= 3, queryFn: async () => { const { data, error } = await supabase.from('serials').select('id,serial_no,room,packing_no,installations(site_name,installed_on,warranty_until,employees:technician_id(employee_name))').ilike('serial_no', `%${q.trim()}%`).limit(20); if (error) throw error; return data as any[] } })
  const Tab = (k: typeof tab, l: string) => <button className={tab === k ? 'primary' : ''} onClick={() => setTab(k)}>{l}</button>
  return (
    <section>
      <div className="bar">{Tab('inst', 'Installations')}{Tab('tix', 'Service tickets')}{Tab('find', 'Find a serial')}</div>
      {msg && <p className="msg">{msg}</p>}
      {tab === 'inst' && <>
        {canWrite && <button className="primary bigbtn go" onClick={() => setForm('inst')}>+ Record an installation</button>}
        {inst.data && !inst.data.length && <p className="empty">No installations recorded yet.</p>}
        {inst.data?.map((i) => <div className="card tap" key={i.id} style={{ borderLeftColor: inWarranty(i.warranty_until) ? '#6B8F72' : '#8b8f86' }} onClick={() => setOpenId(openId === i.id ? '' : i.id)}>
          <div className="row"><b>{i.site_name}</b><span className={`pill${inWarranty(i.warranty_until) ? '' : ' Medium'}`}>{inWarranty(i.warranty_until) ? 'In warranty' : 'Warranty over'}</span></div>
          {i.what && <div>{i.what}</div>}
          <div className="muted">Installed {fmt(i.installed_on)} by {one(i.employees)?.employee_name ?? 'n/a'} · warranty until {fmt(i.warranty_until)}</div>
          {openId === i.id && <div style={{ display: 'grid', gap: 6 }} onClick={(e) => e.stopPropagation()}>
            {i.notes && <div className="muted">{i.notes}</div>}
            {i.serials?.length ? i.serials.map((s: any) => <div key={s.id}><span className="chip sm">{s.serial_no}</span> {s.room ? `Room ${s.room}` : ''}{s.packing_no ? ` · packing no. ${s.packing_no}` : ''}</div>) : <div className="muted">No serial numbers saved.</div>}
            {canWrite && <button onClick={() => setSerialFor(i)}>+ Add serial numbers</button>}
            <button onClick={() => { setForm('tix') }}>Open a service ticket</button>
          </div>}
        </div>)}</>}
      {tab === 'tix' && <>
        <button className="primary bigbtn go" onClick={() => setForm('tix')}>+ New service ticket</button>
        {tix.data && !tix.data.length && <p className="empty">No tickets.</p>}
        {tix.data?.map((t) => { const w = one(t.installations)?.warranty_until; return <div className="card" key={t.id} style={{ borderLeftColor: t.priority === 'High' ? '#9b3b30' : '#8A6F52', opacity: t.status === 'Fixed' ? 0.7 : 1 }}>
          <div className="row"><b>Ticket S-{String(t.seq).padStart(3, '0')}</b><span className={`pill ${t.priority === 'High' ? 'Urgent' : t.priority}`}>{t.priority}</span></div>
          <div style={{ fontSize: 16 }}>{t.title}</div>
          <div className="muted">{t.site_name} · opened {fmt(t.opened_at)}{w ? (inWarranty(w) ? ' · in warranty' : ' · warranty over') : ''}{one(t.assigned)?.employee_name ? ` · ${one(t.assigned).employee_name}` : ''}</div>
          {t.details && <div className="muted">{t.details}</div>}
          {canTix ? <div className="bar">{['Open', 'In progress', 'Fixed'].map((s) => <button key={s} className={t.status === s ? 'primary' : ''} onClick={() => t.status !== s && setStatus(t, s)}>{s}</button>)}</div> : <span className="pill" style={{ justifySelf: 'start' }}>{t.status}</span>}
        </div> })}</>}
      {tab === 'find' && <>
        <input placeholder="Type at least 3 characters of the serial number" value={q} onChange={(e) => setQ(e.target.value)} />
        {found.data && !found.data.length && <p className="empty">Nothing found.</p>}
        {found.data?.map((s) => { const i = one(s.installations); return <div className="card" key={s.id}><b>{s.serial_no}</b><div><b>{i?.site_name}</b>{s.room ? `, Room ${s.room}` : ''}</div>
          <div className="muted">{s.packing_no ? `Packing no. ${s.packing_no} · ` : ''}installed {fmt(i?.installed_on)} by {one(i?.employees)?.employee_name ?? 'n/a'} · warranty until {fmt(i?.warranty_until)} ({inWarranty(i?.warranty_until) ? 'in warranty' : 'over'})</div></div> })}</>}
      {form === 'inst' && <InstForm me={me} onClose={() => setForm('')} onDone={(row) => { refresh(); setSerialFor(row) }} />}
      {form === 'tix' && <TicketForm me={me} sites={inst.data ?? []} onClose={() => setForm('')} onDone={refresh} />}
      {serialFor && <Serials inst={serialFor} onClose={() => setSerialFor(null)} onDone={refresh} />}
    </section>
  )
}
function useEmps() { return useQuery({ queryKey: ['employees', 'active'], queryFn: async () => (await supabase.from('employees').select('id,employee_name').eq('active', true).order('employee_name')).data ?? [] }) }
function InstForm({ me, onClose, onDone }: { me: any; onClose: () => void; onDone: (row: any) => void }) {
  const emps = useEmps(), orders = useQuery({ queryKey: ['aftersales', 'orders'], queryFn: async () => (await supabase.rpc('installable_orders')).data as any[] ?? [] })
  const [f, setF] = useState({ order: '', site: '', what: '', tech: me.id as string, on: today(), months: '12', notes: '' }), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const pick = (id: string) => { const o = orders.data?.find((x: any) => x.inquiry_id === id); setF({ ...f, order: id, site: o ? o.customer : f.site, what: o ? o.items ?? '' : f.what }) }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const { data, error } = await supabase.from('installations').insert({ inquiry_id: f.order || null, site_name: f.site.trim(), what: f.what.trim() || null, technician_id: f.tech || null, installed_on: f.on, warranty_months: Number(f.months) || 0, notes: f.notes.trim() || null, created_by: me.id }).select('id,site_name').single()
    setBusy(false); if (error) return setErr(error.message); onClose(); onDone(data)
  }
  return <div className="modal"><form className="card" onSubmit={save}><h3 style={{ margin: 0 }}>Record an installation</h3>
    <label>Dispatched order (optional)<select value={f.order} onChange={(e) => pick(e.target.value)}><option value="">Not from the list</option>{orders.data?.map((o: any) => <option key={o.inquiry_id} value={o.inquiry_id}>{o.customer} · {o.inquiry_number}</option>)}</select></label>
    <label>Site / hotel name<input required value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })} /></label>
    <label>What was installed<input value={f.what} onChange={(e) => setF({ ...f, what: e.target.value })} /></label>
    <label>Technician<select value={f.tech} onChange={(e) => setF({ ...f, tech: e.target.value })}>{emps.data?.map((x: any) => <option key={x.id} value={x.id}>{x.employee_name}</option>)}</select></label>
    <label>Installed on<DateField value={f.on} onChange={(v) => setF({ ...f, on: v })} ariaLabel="Installed on" /></label>
    <label>Warranty (months)<input type="number" min="0" value={f.months} onChange={(e) => setF({ ...f, months: e.target.value })} /></label>
    <label>Notes<input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
    {err && <p className="msg">{err}</p>}<button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="link" onClick={onClose}>Cancel</button></form></div>
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
  const emps = useEmps(), [f, setF] = useState({ inst: '', site: '', title: '', details: '', pr: 'Medium', to: '' }), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const s = sites.find((x) => x.id === f.inst), { error } = await supabase.from('service_tickets').insert({ installation_id: f.inst || null, site_name: (s?.site_name ?? f.site).trim(), title: f.title.trim(), details: f.details.trim() || null, priority: f.pr, assigned_to: f.to || null, opened_by: me.id })
    setBusy(false); if (error) return setErr(error.message); onDone(); onClose()
  }
  return <div className="modal"><form className="card" onSubmit={save}><h3 style={{ margin: 0 }}>New service ticket</h3>
    <label>Installation<select value={f.inst} onChange={(e) => setF({ ...f, inst: e.target.value })}><option value="">Not in the list</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.site_name} · {fmt(s.installed_on)}</option>)}</select></label>
    {!f.inst && <label>Site name<input required value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })} /></label>}
    <label>What is wrong?<input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
    <label>More details<input value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} /></label>
    <label>Priority<select value={f.pr} onChange={(e) => setF({ ...f, pr: e.target.value })}><option>Low</option><option>Medium</option><option>High</option></select></label>
    <label>Give to<select value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}><option value="">Not assigned</option>{emps.data?.map((x: any) => <option key={x.id} value={x.id}>{x.employee_name}</option>)}</select></label>
    {err && <p className="msg">{err}</p>}<button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Open ticket'}</button><button type="button" className="link" onClick={onClose}>Cancel</button></form></div>
}
