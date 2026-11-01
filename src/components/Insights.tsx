import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { inr } from '../lib/money'
const iso = (d: number) => new Date(Date.now() - d * 86400000).toISOString()
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : '')
const cnt = async (q: any) => { const { count, error } = await q; if (error) throw error; return count ?? 0 }
// Admin only: weekly summary, warranties ending, repeat customers, reorder suggestions. All figures are worked out from the live data.
export default function Insights() {
  const [quiet, setQuiet] = useState('180')
  const week = useQuery({ queryKey: ['insights', 'week'], queryFn: async () => {
    const s = iso(7), I = () => supabase.from('inquiries').select('id', { count: 'exact', head: true }).is('archived_at', null)
    const [fresh, won, lost, sent, inst, opened, fixed] = await Promise.all([
      cnt(I().gte('created_at', s)), cnt(I().eq('sales_stage', 'Order Confirmed').gte('updated_at', s)), cnt(I().eq('sales_stage', 'Lost').gte('updated_at', s)),
      cnt(supabase.from('inquiries').select('id', { count: 'exact', head: true }).gte('dispatched_at', s)),
      cnt(supabase.from('installations').select('id', { count: 'exact', head: true }).gte('created_at', s)),
      cnt(supabase.from('service_tickets').select('id', { count: 'exact', head: true }).gte('opened_at', s)),
      cnt(supabase.from('service_tickets').select('id', { count: 'exact', head: true }).gte('closed_at', s))])
    const p = await supabase.from('payments').select('amount').gte('created_at', s); if (p.error) throw p.error
    return { fresh, won, lost, sent, inst, opened, fixed, money: (p.data as any[]).reduce((a, x) => a + Number(x.amount), 0) } } })
  const warr = useQuery({ queryKey: ['insights', 'warranty'], queryFn: async () => {
    const t = new Date().toISOString().slice(0, 10), e = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)
    const { data, error } = await supabase.from('installations').select('id,site_name,what,warranty_until').gte('warranty_until', t).lte('warranty_until', e).order('warranty_until'); if (error) throw error; return data as any[] } })
  const repeat = useQuery({ queryKey: ['insights', 'repeat'], queryFn: async () => {
    const { data, error } = await supabase.from('inquiries').select('customer_id,updated_at,customers(customer_name,phone_number)').eq('sales_stage', 'Order Confirmed').is('archived_at', null).limit(1000); if (error) throw error
    const m: Record<string, any> = {}
    for (const r of data as any[]) { const c = Array.isArray(r.customers) ? r.customers[0] : r.customers; const x = (m[r.customer_id] = m[r.customer_id] ?? { name: c?.customer_name, phone: c?.phone_number, n: 0, last: '' }); x.n++; if (r.updated_at > x.last) x.last = r.updated_at }
    return Object.values(m) as any[] } })
  const reorder = useQuery({ queryKey: ['insights', 'reorder'], queryFn: async () => {
    const o = await supabase.rpc('stock_overview'); if (o.error) throw o.error
    const mv = await supabase.from('stock_movements').select('product_id,qty_change').eq('reason', 'dispatch').gte('created_at', iso(56)); if (mv.error) throw mv.error
    const out: Record<string, number> = {}; for (const x of mv.data as any[]) out[x.product_id] = (out[x.product_id] ?? 0) - Number(x.qty_change)
    return (o.data as any[]).map((p) => { const rate = (out[p.product_id] ?? 0) / 8; return { ...p, rate, weeks: rate > 0 ? Number(p.free) / rate : null } }).filter((p) => p.weeks !== null && p.weeks < 6).sort((a, b) => a.weeks - b.weeks) } })
  const w = week.data, cut = Date.now() - Number(quiet) * 86400000, rep = (repeat.data ?? []).filter((x) => new Date(x.last).getTime() < cut).sort((a, b) => a.last.localeCompare(b.last))
  const Stat = (v: any, l: string) => <div className="card" style={{ margin: 0, textAlign: 'center' }}><div className="bignum" style={{ textAlign: 'center' }}>{v}</div><div className="muted">{l}</div></div>
  return (
    <section>
      <h3>This week (last 7 days)</h3>
      {week.isLoading && <p className="empty">Loading…</p>}
      {w && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
        {Stat(w.fresh, 'New inquiries')}{Stat(w.won, 'Orders confirmed')}{Stat(w.lost, 'Lost')}{Stat(inr(w.money), 'Money received')}{Stat(w.sent, 'Dispatched')}{Stat(w.inst, 'Installations')}{Stat(w.opened, 'Tickets opened')}{Stat(w.fixed, 'Tickets fixed')}</div>}
      <p className="muted">"Confirmed" and "Lost" count inquiries that reached that stage in the week and haven't been edited since.</p>
      <h3>Warranty ending in 60 days</h3>
      {warr.data && !warr.data.length && <p className="empty">None.</p>}
      {warr.data?.map((i) => <div className="card" key={i.id}><div className="row"><b>{i.site_name}</b><span className="pill Medium">ends {fmt(i.warranty_until)}</span></div><div className="muted">{i.what} · a good time to offer a maintenance contract</div></div>)}
      <h3>Reorder suggestions</h3>
      {reorder.data && !reorder.data.length && <p className="empty">Nothing is running low against recent sales.</p>}
      {reorder.data?.map((p) => <div className="card" key={p.product_id} style={{ borderLeftColor: p.weeks < 3 ? '#9b3b30' : '#8A6F52' }}><div className="row"><b>{p.product_name}</b><span className={`pill${p.weeks < 3 ? ' Urgent' : ' Medium'}`}>about {p.weeks.toFixed(1)} weeks left</span></div>
        <div className="muted">Selling about {Math.round(p.rate)} a week (last 8 weeks). {Number(p.free).toLocaleString('en-IN')} free.</div></div>)}
      <h3>Customers to check in with</h3>
      <label>Last order was more than<select value={quiet} onChange={(e) => setQuiet(e.target.value)}><option value="90">3 months ago</option><option value="180">6 months ago</option><option value="365">1 year ago</option></select></label>
      {repeat.data && !rep.length && <p className="empty">Nobody yet.</p>}
      {rep.map((x, k) => <div className="card" key={k}><div className="row"><b>{x.name}</b><span className="muted">{x.n} order{x.n > 1 ? 's' : ''} · last {fmt(x.last)}</span></div>{x.phone && <a href={`tel:${x.phone}`}>{x.phone}</a>}</div>)}
    </section>
  )
}
