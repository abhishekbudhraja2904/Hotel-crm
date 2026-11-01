import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { inr } from '../lib/money'
export default function Dashboard({ me }: { me?: any }) {
  const inq = useQuery({ queryKey: ['inquiries', 'dash'], queryFn: async () => {
    const { data, error } = await supabase.from('inquiries').select('sales_stage,created_at,updated_at,lost_reason').is('archived_at', null); if (error) throw error; return data } })
  const fu = useQuery({ queryKey: ['followups', 'dash'], queryFn: async () => {
    const { data, error } = await supabase.from('followups').select('scheduled_at').eq('status', 'Pending'); if (error) throw error; return data } })
  // Money still to collect on confirmed orders (admin only)
  const isAdmin = me?.role === 'admin'
  const pend = useQuery({ queryKey: ['money', 'pending'], enabled: isAdmin, queryFn: async () => {
    const o = await supabase.from('inquiries').select('id,inquiry_number,customers(customer_name)').eq('sales_stage', 'Order Confirmed').is('archived_at', null); if (o.error) throw o.error
    const f = await supabase.from('order_finance').select('inquiry_id,order_value,balance_due_on'); if (f.error) throw f.error
    const p = await supabase.from('payments').select('inquiry_id,amount'); if (p.error) throw p.error
    const paid: Record<string, number> = {}; for (const x of p.data as any[]) paid[x.inquiry_id] = (paid[x.inquiry_id] ?? 0) + Number(x.amount)
    const fin: Record<string, any> = {}; for (const x of f.data as any[]) fin[x.inquiry_id] = x
    return (o.data as any[]).map((r) => ({ r, value: fin[r.id] ? Number(fin[r.id].order_value) : null, due: fin[r.id]?.balance_due_on as string | null, paid: paid[r.id] ?? 0 }))
      .filter((x) => x.value === null || x.value - x.paid > 0.001).sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999')) } })
  if (inq.error || fu.error) return <p className="msg">{((inq.error || fu.error) as any).message}</p>
  if (!inq.data || !fu.data) return <p className="empty">Loading…</p>
  const now = Date.now(), t0 = new Date().setHours(0, 0, 0, 0), t1 = new Date().setHours(23, 59, 59, 999), m = new Date()
  const isMonth = (s: string) => { const d = new Date(s); return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear() }
  const I = inq.data, closed = ['Order Confirmed', 'Lost']
  const cards: [string, number][] = [
    ['Total inquiries', I.length], ['New today', I.filter((r) => +new Date(r.created_at) >= t0).length],
    ['Active', I.filter((r) => !closed.includes(r.sales_stage) && r.sales_stage !== 'On Hold').length],
    ['Follow-ups due today', fu.data.filter((f) => +new Date(f.scheduled_at) >= now && +new Date(f.scheduled_at) <= t1).length],
    ['Overdue follow-ups', fu.data.filter((f) => +new Date(f.scheduled_at) < now).length],
    ['Quotations pending', I.filter((r) => r.sales_stage === 'Quotation Sent').length],
    ['Orders confirmed', I.filter((r) => r.sales_stage === 'Order Confirmed').length],
    ['Won this month', I.filter((r) => r.sales_stage === 'Order Confirmed' && isMonth(r.updated_at)).length],
    ['Lost this month', I.filter((r) => r.sales_stage === 'Lost' && isMonth(r.updated_at)).length]]
  // Why inquiries are lost (all lost inquiries; older ones without a reason are grouped as "Not recorded")
  const lost = I.filter((r) => r.sales_stage === 'Lost'), counts: Record<string, number> = {}
  for (const r of lost) { const k = r.lost_reason || 'Not recorded'; counts[k] = (counts[k] ?? 0) + 1 }
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return <>
    <div className="stats">{cards.map(([k, v]) => <div className="stat" key={k}><b>{v}</b><span className="muted">{k}</span></div>)}</div>
    {isAdmin && pend.data && pend.data.length > 0 && (() => { const today = new Date().toLocaleDateString('en-CA'), total = pend.data.reduce((n, x) => n + (x.value != null ? x.value - x.paid : 0), 0)
      return <div className="card" style={{ borderLeftColor: '#8A6F52' }}><div className="row"><b>Money to collect</b><b>{inr(total)}</b></div>
        <div className="muted">Confirmed orders that are not fully paid.</div>
        {pend.data.slice(0, 10).map(({ r, value, due, paid }) => <div className="row" key={r.id}><div><div>{r.customers?.customer_name} <span className="muted">· {r.inquiry_number}</span></div>
          <div className="muted">{value == null ? 'Order value not entered' : `Received ${inr(paid)} of ${inr(value)}`}{due ? ` · due ${new Date(due + 'T00:00:00').toLocaleDateString()}` : ''}</div></div>
          <div style={{ textAlign: 'right' }}>{value != null && <b>{inr(value - paid)}</b>}{due && due < today && <div><span className="pill Urgent">Overdue</span></div>}</div></div>)}
        {pend.data.length > 10 && <div className="muted">…and {pend.data.length - 10} more.</div>}</div> })()}
    {rows.length > 0 && <div className="card"><div className="row"><b>Why inquiries are lost</b><span className="muted">{lost.length} total</span></div>
      {rows.map(([k, n]) => <div key={k} style={{ display: 'grid', gap: 3 }}><div className="row"><span>{k}</span><b>{n}</b></div>
        <div style={{ height: 8, borderRadius: 99, background: 'var(--line)' }}><div style={{ width: `${(n / lost.length) * 100}%`, height: 8, borderRadius: 99, background: 'var(--clay)' }} /></div></div>)}</div>}
  </>
}
