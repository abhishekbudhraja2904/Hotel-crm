import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSettings, saveSetting } from '../lib/settings'
// Admin-only settings cards: GST and payment rule, auto clock-out, office network, and per-person rules.
export function PaymentRules({ me }: { me: any }) {
  const qc = useQueryClient(), s = useSettings(), [req, setReq] = useState(s.requireFullPayment), [msg, setMsg] = useState('')
  useEffect(() => { setReq(s.requireFullPayment) }, [s.requireFullPayment])
  async function save() { const e = await saveSetting('requireFullPayment', req, me.id); setMsg(e ?? 'Saved.'); qc.invalidateQueries({ queryKey: ['settings'] }) }
  return <div className="card"><h3 style={{ margin: 0 }}>Payment rule</h3>
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexDirection: 'row', color: 'inherit', fontSize: 14 }}>
      <input type="checkbox" style={{ width: 18, height: 18, padding: 0 }} checked={req} onChange={(e) => setReq(e.target.checked)} />Allow dispatch only after the payment is marked "Paid in full"</label>
    <p className="muted" style={{ margin: 0 }}>{req ? 'Orders cannot be marked ready or dispatched until paid in full (or marked "payment later").' : 'For now an order can be dispatched before or after payment.'}</p>
    {msg && <p className="msg">{msg}</p>}<button className="primary" onClick={save}>Save</button></div>
}
const pad = (n: number) => String(n).padStart(2, '0')
export function ClockRules({ me }: { me: any }) {
  const qc = useQueryClient(), s = useSettings(), [t, setT] = useState(s.autoClockOut.time), [idle, setIdle] = useState(String(s.autoClockOut.idleMinutes)), [msg, setMsg] = useState('')
  useEffect(() => { setT(s.autoClockOut.time); setIdle(String(s.autoClockOut.idleMinutes)) }, [s.autoClockOut.time, s.autoClockOut.idleMinutes])
  const [hh, mm] = t.split(':').map(Number), h12 = hh % 12 || 12, pm = hh >= 12
  const set = (h: number, m: number, isPm: boolean) => setT(`${pad((h % 12) + (isPm ? 12 : 0))}:${pad(m)}`)
  async function save() {
    const i = Number(idle); if (!(i >= 5)) return setMsg('Inactivity time must be 5 minutes or more.')
    const e = await saveSetting('autoClockOut', { time: t, idleMinutes: i }, me.id); setMsg(e ?? 'Saved.'); qc.invalidateQueries({ queryKey: ['settings'] })
  }
  return <div className="card"><h3 style={{ margin: 0 }}>Automatic clock-out</h3>
    <p className="muted" style={{ margin: 0 }}>For people marked "must clock in on office network" below. They are clocked out at this time every day, and after a long time with no activity.</p>
    <label>Clock everyone out at<span className="timef">
      <select value={h12} onChange={(e) => set(+e.target.value, mm, pm)}>{Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select>
      <select value={mm} onChange={(e) => set(h12, +e.target.value, pm)}>{Array.from({ length: 12 }, (_, i) => i * 5).map((n) => <option key={n} value={n}>{pad(n)}</option>)}</select>
      <select value={pm ? 'pm' : 'am'} onChange={(e) => set(h12, mm, e.target.value === 'pm')}><option value="am">am</option><option value="pm">pm</option></select></span></label>
    <label>Clock out after this many minutes of no activity<input type="number" min="5" value={idle} onChange={(e) => setIdle(e.target.value)} /></label>
    {msg && <p className="msg">{msg}</p>}<button className="primary" onClick={save}>Save</button></div>
}
export function OfficeNetwork() {
  const qc = useQueryClient(), [msg, setMsg] = useState(''), [label, setLabel] = useState('')
  const info = useQuery({ queryKey: ['office-network'], queryFn: async () => { const { data, error } = await supabase.rpc('office_network_admin'); if (error) throw error; return data as any } })
  const d = info.data
  async function add(replace: boolean) {
    if (replace && d?.ips?.length && !confirm('Replace the saved office network with this one?')) return
    const { error } = await supabase.rpc('add_office_ip', { p_label: label || d?.label || null, p_replace: replace }); setMsg(error ? error.message : 'Saved.'); qc.invalidateQueries({ queryKey: ['office-network'] })
  }
  async function remove(ip: string) { const { error } = await supabase.rpc('remove_office_ip', { p_ip: ip }); setMsg(error ? error.message : ''); qc.invalidateQueries({ queryKey: ['office-network'] }) }
  return <div className="card"><h3 style={{ margin: 0 }}>Office network</h3>
    <p className="muted" style={{ margin: 0 }}>A web app cannot read the Wi-Fi name. Instead it uses the office's internet address. Open Settings while you are on the office Wi-Fi and press the button.</p>
    {info.isLoading && <p className="empty">Loading…</p>}
    {d && <>
      <div className="muted">This device's address as seen by the server: <b>{d.my_ip ?? 'could not be read'}</b>{d.matches ? ' · matches the office network' : ''}</div>
      <label>Name for this network (optional)<input value={label || d.label || ''} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Office Wi-Fi" /></label>
      <button className="primary" onClick={() => add(true)}>Use this network as the office network</button>
      <button onClick={() => add(false)}>Also allow this address (second line or IPv6)</button>
      {(d.ips ?? []).length ? <><div className="muted">Saved office addresses{d.label ? ` (${d.label})` : ''}:</div>{d.ips.map((ip: string) => <div className="row" key={ip}><span>{ip}</span><button className="link" onClick={() => remove(ip)}>Remove</button></div>)}</> : <p className="warnbox">No office network saved yet. Staff marked below cannot clock in until you save one.</p>}
      <p className="muted" style={{ margin: 0 }}>If the office internet provider changes the address, press the button again. If some phones fail to clock in on the office Wi-Fi, open Settings on one of them and use "Also allow this address".</p>
    </>}
    {msg && <p className="msg">{msg}</p>}</div>
}
export function StaffRules({ me }: { me: any }) {
  const qc = useQueryClient(), [msg, setMsg] = useState('')
  const list = useQuery({ queryKey: ['staff-rules'], queryFn: async () => { const { data, error } = await supabase.from('employees').select('id,employee_name,role,office_only').eq('active', true).neq('role', 'admin').order('employee_name'); if (error) throw error; return data as any[] } })
  const done = () => { qc.invalidateQueries({ queryKey: ['staff-rules'] }); qc.invalidateQueries({ queryKey: ['employees'] }) }
  async function role(e: any, r: string) { const { error } = await supabase.rpc('set_employee_role', { emp: e.id, p_role: r }); setMsg(error ? error.message : ''); done() }
  async function office(e: any, on: boolean) { const { error } = await supabase.rpc('set_employee_office_only', { emp: e.id, p_on: on }); setMsg(error ? error.message : ''); done() }
  return <div className="card"><h3 style={{ margin: 0 }}>People: role and clock-in rule</h3>
    <p className="muted" style={{ margin: 0 }}>"Service admin" can only view installations, service tickets and stock. "Must clock in on office network": that person must clock in by hand from the office Wi-Fi, and the app is view-only while they are clocked out. Use it for office and store staff, not for people who work at customer sites.</p>
    {list.data && !list.data.length && <p className="empty">No other staff yet.</p>}
    {list.data?.map((e) => <div key={e.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 8, display: 'grid', gap: 6 }}>
      <b>{e.employee_name}</b>
      <select value={e.role} onChange={(x) => role(e, x.target.value)}><option value="sales">Sales executive</option><option value="service">Installation / service</option><option value="service_admin">Service admin (view only)</option></select>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexDirection: 'row', color: 'inherit', fontSize: 14 }}><input type="checkbox" style={{ width: 18, height: 18, padding: 0 }} checked={!!e.office_only} onChange={(x) => office(e, x.target.checked)} />Must clock in on office network</label></div>)}
    {msg && <p className="msg">{msg}</p>}</div>
}

// Which categories make up the "Hotel lock kit": picking the kit on an inquiry or quotation adds one row for each of these.
export function KitContents({ me }: { me: any }) {
  const qc = useQueryClient(), s = useSettings(), [sel, setSel] = useState<string[]>(s.kitCategories), [msg, setMsg] = useState('')
  useEffect(() => { setSel(s.kitCategories) }, [JSON.stringify(s.kitCategories)]) // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (c: string) => setSel((a) => (a.includes(c) ? a.filter((x) => x !== c) : [...a, c]))
  async function save() { const e = await saveSetting('kitCategories', s.categories.filter((c) => sel.includes(c)), me.id); setMsg(e ?? 'Saved.'); qc.invalidateQueries({ queryKey: ['settings'] }) }
  return <div className="card"><h3 style={{ margin: 0 }}>Hotel lock kit contents</h3>
    <p className="muted" style={{ margin: 0 }}>Tick the categories that belong in the kit. When someone picks "Hotel lock kit" on an inquiry or quotation, one row is added for each tick, and they only choose the model.</p>
    {s.categories.map((c) => <label key={c} style={{ display: 'flex', gap: 8, alignItems: 'center', flexDirection: 'row', color: 'inherit', fontSize: 14 }}>
      <input type="checkbox" style={{ width: 18, height: 18, padding: 0 }} checked={sel.includes(c)} onChange={() => toggle(c)} />{c}</label>)}
    {msg && <p className="msg">{msg}</p>}<button className="primary" onClick={save}>Save kit</button></div>
}

// Which product groups are always sold together, e.g. Kettle with Tray.
export function SoldTogether({ me }: { me: any }) {
  const qc = useQueryClient(), s = useSettings(), [a, setA] = useState(''), [b, setB] = useState(''), [msg, setMsg] = useState('')
  const fams = useQuery({ queryKey: ['catalogue-admin', 'families'], queryFn: async () => { const { data } = await supabase.from('products').select('family').not('family', 'is', null); return [...new Set((data ?? []).map((r: any) => String(r.family)))].sort() } })
  async function put(pairs: string[][]) { const e = await saveSetting('soldTogether', pairs, me.id); setMsg(e ?? 'Saved.'); qc.invalidateQueries({ queryKey: ['settings'] }) }
  const add = () => { if (!a || !b || a === b) return setMsg('Choose two different groups.'); if (s.soldTogether.some((p) => p.includes(a) && p.includes(b))) return setMsg('Already added.'); put([...s.soldTogether, [a, b]]) }
  return <div className="card"><h3 style={{ margin: 0 }}>Products sold together</h3>
    <p className="muted" style={{ margin: 0 }}>Give products a group in the catalogue (for example Kettle, Tray). When someone picks a product from one group on an inquiry or quotation, a row for the paired group is added and they only choose the model.</p>
    {s.soldTogether.map((p, i) => <div className="row" key={i}><span>{p[0]} ↔ {p[1]}</span><button className="link" onClick={() => put(s.soldTogether.filter((_, x) => x !== i))}>Remove</button></div>)}
    {!s.soldTogether.length && <p className="empty">Nothing paired yet.</p>}
    <div className="bar"><select value={a} onChange={(e) => setA(e.target.value)}><option value="">Group…</option>{fams.data?.map((f) => <option key={f}>{f}</option>)}</select><select value={b} onChange={(e) => setB(e.target.value)}><option value="">Sold with…</option>{fams.data?.map((f) => <option key={f}>{f}</option>)}</select><button onClick={add}>Add</button></div>
    {msg && <p className="msg">{msg}</p>}</div>
}

// Lock mortis: which products are locks, which spare part is the standard mortis, and which mortis can be chosen instead.
export function LockMortis({ me }: { me: any }) {
  const qc = useQueryClient(), s = useSettings(), [msg, setMsg] = useState('')
  const spares = useQuery({ queryKey: ['spares', 'names'], queryFn: async () => { const { data } = await supabase.from('spare_parts').select('id,name').eq('active', true).order('name'); return (data ?? []) as any[] } })
  async function put(key: string, v: any) { const e = await saveSetting(key, v, me.id); setMsg(e ?? 'Saved.'); qc.invalidateQueries({ queryKey: ['settings'] }); qc.invalidateQueries({ queryKey: ['mortis-options'] }) }
  const m = s.mortis
  return <div className="card"><h3 style={{ margin: 0 }}>Lock mortis</h3>
    <p className="muted" style={{ margin: 0 }}>Every lock normally has the standard mortis. When a sales person picks another mortis on a lock, that mortis is taken from the spare parts when the order is dispatched, and the standard mortis goes back into the spare parts.</p>
    <label>Products in this category are locks<select value={m.category} onChange={(e) => put('mortisCategory', e.target.value)}><option value="">None (feature off)</option>{s.categories.map((c) => <option key={c}>{c}</option>)}</select></label>
    <label>The standard mortis is the spare part<select value={m.standardId} onChange={(e) => put('standardMortisId', e.target.value)}><option value="">Choose…</option>{spares.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <div><b>Mortis that can be chosen instead</b></div>
    {spares.data?.filter((p) => p.id !== m.standardId).map((p) => <label key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexDirection: 'row', color: 'inherit', fontSize: 14 }}><input type="checkbox" style={{ width: 18, height: 18, padding: 0 }} checked={m.optionIds.includes(p.id)} onChange={(e) => put('mortisOptionIds', e.target.checked ? [...m.optionIds, p.id] : m.optionIds.filter((x) => x !== p.id))} />{p.name}</label>)}
    {msg && <p className="msg">{msg}</p>}</div>
}

export function CustomerAppSettings({ me }: { me: any }) {
  const qc = useQueryClient(), s = useSettings(), [url, setUrl] = useState(s.appUrl), [ph, setPh] = useState(s.appBackupPhone), [msg, setMsg] = useState('')
  useEffect(() => { setUrl(s.appUrl); setPh(s.appBackupPhone) }, [s.appUrl, s.appBackupPhone])
  async function save() { const e1 = await saveSetting('customerAppUrl', url.trim(), me.id); const e2 = e1 ?? await saveSetting('appBackupPhone', ph.trim(), me.id); setMsg(e2 ?? 'Saved.'); qc.invalidateQueries({ queryKey: ['settings'] }) }
  return <div className="card"><h3 style={{ margin: 0 }}>Customer app</h3>
    <label>App web address (put in the invite message)<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></label>
    <label>Office backup WhatsApp number (used when a staff member has no number)<input value={ph} inputMode="tel" onChange={(e) => setPh(e.target.value)} /></label>
    {msg && <p className="msg">{msg}</p>}<button className="primary" onClick={save}>Save</button></div>
}
