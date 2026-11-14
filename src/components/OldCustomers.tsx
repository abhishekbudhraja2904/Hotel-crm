import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDate } from '../lib/dates'
const BANDS: { key: string; label: string; hint: string; max: number }[] = [
  { key: 'recent', label: 'Recent buyers', hint: 'ordered in the last 3 months', max: 90 },
  { key: 'due', label: 'Due for a reorder', hint: 'last order 3 to 6 months ago', max: 180 },
  { key: 'lapsed', label: 'Gone quiet', hint: 'last order 6 to 12 months ago', max: 365 },
  { key: 'dormant', label: 'Dormant', hint: 'last order over a year ago', max: 1e9 }]
// Old customers grouped by how long ago they last ordered. Admin sees every client (and can pick a salesperson); sales see their own.
export default function OldCustomers({ me, onReorder }: { me: any; onReorder: (c: any) => void }) {
  const isAdmin = me.role === 'admin', [emp, setEmp] = useState(''), [q, setQ] = useState(''), [open, setOpen] = useState<string | null>('due')
  const emps = useQuery({ queryKey: ['employees'], enabled: isAdmin, queryFn: async () => (await supabase.from('employees').select('id,employee_name').eq('active', true).in('role', ['admin', 'sales'])).data ?? [] })
  const orders = useQuery({ queryKey: ['old-customers'], queryFn: async () => {
    const { data, error } = await supabase.from('inquiries').select('id,customer_id,assigned_to,dispatched_at,updated_at,customers(customer_name,phone_number,city),assigned:employees!assigned_to(employee_name),inquiry_items(product_name_snapshot,quantity)').eq('sales_stage', 'Order Confirmed').order('updated_at', { ascending: false }).limit(3000)
    if (error) throw error; return (data ?? []) as any[] } })
  const one = (x: any) => (Array.isArray(x) ? x[0] : x)
  const map = new Map<string, any>()
  for (const o of orders.data ?? []) {
    if (!o.customer_id || (emp && o.assigned_to !== emp)) continue
    const when = new Date(o.dispatched_at ?? o.updated_at), c = map.get(o.customer_id)
    if (!c) map.set(o.customer_id, { id: o.customer_id, cu: one(o.customers), last: when, lastInq: o.id, items: o.inquiry_items ?? [], by: one(o.assigned)?.employee_name, n: 1 })
    else { c.n++; if (when > c.last) Object.assign(c, { last: when, lastInq: o.id, items: o.inquiry_items ?? [], by: one(o.assigned)?.employee_name }) }
  }
  const s = q.trim().toLowerCase(), now = Date.now()
  const list = [...map.values()].map((c) => ({ ...c, days: Math.floor((now - +c.last) / 864e5) })).filter((c) => !s || `${c.cu?.customer_name} ${c.cu?.phone_number ?? ''} ${c.cu?.city ?? ''}`.toLowerCase().includes(s)).sort((a, b) => a.days - b.days)
  const band = (c: any) => BANDS.find((b) => c.days <= b.max)!.key
  return <div style={{ display: 'grid', gap: 10 }}>
    <div className="bar"><input placeholder="Search old customers…" value={q} onChange={(e) => setQ(e.target.value)} />
      {isAdmin && <select value={emp} onChange={(e) => setEmp(e.target.value)}><option value="">All staff</option>{(emps.data ?? []).map((x: any) => <option key={x.id} value={x.id}>{x.employee_name}</option>)}</select>}</div>
    <p className="muted" style={{ margin: 0 }}>{list.length} customers who have ordered before{isAdmin && !emp ? '' : isAdmin ? ' (this salesperson)' : ' (your clients)'}. Open a group to see them and start a repeat order.</p>
    {orders.isLoading && <p className="empty">Loading…</p>}
    {orders.error && <p className="msg">{(orders.error as any).message}</p>}
    {BANDS.map((b) => { const items = list.filter((c) => band(c) === b.key), on = open === b.key
      return <div className="card" key={b.key}>
        <button className="link" style={{ width: '100%', textAlign: 'left', fontWeight: 700, fontSize: 16 }} onClick={() => setOpen(on ? null : b.key)}>{on ? '▾' : '▸'} {b.label} <span className="muted" style={{ fontWeight: 400 }}>({items.length}) · {b.hint}</span></button>
        {on && !items.length && <p className="empty">Nobody in this group.</p>}
        {on && items.map((c) => <div key={c.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 8, display: 'grid', gap: 2 }}>
          <div className="row"><b>{c.cu?.customer_name ?? 'Customer'}{c.n > 1 && <span className="pill" style={{ marginLeft: 8 }}>{c.n} orders</span>}</b>{c.cu?.phone_number && <a href={`tel:${c.cu.phone_number}`}>📞 {c.cu.phone_number}</a>}</div>
          <div className="muted">{c.cu?.city ? `${c.cu.city} · ` : ''}Last order {fmtDate(c.last.toISOString().slice(0, 10))} ({c.days} days ago){isAdmin && c.by ? ` · ${c.by}` : ''}</div>
          <div className="muted">{c.items.map((i: any) => `${i.product_name_snapshot} × ${i.quantity ?? '?'}`).join(', ') || 'No items recorded'}</div>
          <div className="bar"><button className="primary" onClick={() => onReorder({ customerId: c.id, name: c.cu?.customer_name ?? '', inquiryId: c.lastInq })}>Repeat order</button></div>
        </div>)}
      </div> })}
  </div>
}
