import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
// Inventory: for whom is this product blocked? Confirmed orders not yet fully dispatched, with how many each still needs.
const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const n = (v: any) => String(Math.round(Number(v ?? 0) * 100) / 100)
export default function BlockedFor({ ids, hand }: { ids: string[]; hand: Map<string, string> }) {
  const q = useQuery({ queryKey: ['inventory', 'blocked-for', ids.join(',')], queryFn: async () => {
    const [it, sent] = await Promise.all([
      supabase.from('inquiry_items').select('inquiry_id,product_id,quantity,inquiries!inner(id,inquiry_number,packing_no,sales_stage,dispatched_at,archived_at,customers(customer_name,city),assigned:employees!assigned_to(employee_name))')
        .in('product_id', ids).eq('inquiries.sales_stage', 'Order Confirmed').is('inquiries.dispatched_at', null).is('inquiries.archived_at', null),
      supabase.from('dispatch_part_items').select('product_id,quantity,dispatch_parts!inner(inquiry_id,status)').in('product_id', ids).eq('dispatch_parts.status', 'dispatched'),
    ])
    if (it.error) throw it.error
    const gone = new Map<string, number>()
    for (const s of (sent.data ?? []) as any[]) { const k = one(s.dispatch_parts).inquiry_id + '|' + s.product_id; gone.set(k, (gone.get(k) ?? 0) + Number(s.quantity)) }
    const byOrder = new Map<string, any>()
    for (const r of it.data as any[]) {
      const left = Number(r.quantity) - (gone.get(r.inquiry_id + '|' + r.product_id) ?? 0); if (left <= 0) continue
      gone.set(r.inquiry_id + '|' + r.product_id, Math.max(0, (gone.get(r.inquiry_id + '|' + r.product_id) ?? 0) - Number(r.quantity)))
      const o = byOrder.get(r.inquiry_id) ?? { inq: one(r.inquiries), total: 0, parts: new Map<string, number>() }
      o.total += left; const h = hand.get(r.product_id) ?? ''; o.parts.set(h, (o.parts.get(h) ?? 0) + left); byOrder.set(r.inquiry_id, o)
    }
    return [...byOrder.values()].sort((a, b) => b.total - a.total)
  } })
  return <div onClick={(e) => e.stopPropagation()} style={{ borderTop: '1px solid var(--line)', marginTop: 8, paddingTop: 8, display: 'grid', gap: 6 }}>
    <b>Blocked for</b>
    {q.isLoading && <div className="muted">Loading…</div>}
    {q.error && <div className="msg">{(q.error as any).message}</div>}
    {q.data && !q.data.length && <div className="muted">No open orders found.</div>}
    {q.data?.map((o: any) => { const c = one(o.inq.customers), lr = [...o.parts.entries()].filter(([h]: any) => h)
      return <div key={o.inq.id} className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}><b>{c?.customer_name ?? 'Customer'}</b>{c?.city ? ` · ${c.city}` : ''}
          <div className="muted">{o.inq.inquiry_number}{o.inq.packing_no ? ` · packing no. ${o.inq.packing_no}` : ''}{one(o.inq.assigned)?.employee_name ? ` · Sales: ${one(o.inq.assigned).employee_name}` : ''}</div></div>
        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><b>{n(o.total)}</b>{lr.length > 0 && <div className="muted">{lr.map(([h, v]: any) => `${n(v)} ${h}`).join(' · ')}</div>}</div>
      </div> })}
  </div>
}
