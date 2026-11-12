import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSettings, Tile } from '../lib/settings'
import LowStock from './LowStock'
import InquiryBar, { useMoney } from './Progress'
import { fmtDate, isoDate } from '../lib/dates'
export default function Dashboard({ me }: { me?: any }) {
  const { tiles, stages } = useSettings(), money = useMoney()
  const canInv = useQuery({ queryKey: ['inventory', 'can'], enabled: !!me?.active, queryFn: async () => !!(await supabase.rpc('can_update_inventory')).data })
  const latest = useQuery({ queryKey: ['inquiries', 'latest'], queryFn: async () => {
    const { data, error } = await supabase.from('inquiries').select('id,inquiry_number,sales_stage,updated_at,dispatched_at,packing_no,customers(customer_name,phone_number)').is('archived_at', null).order('updated_at', { ascending: false }).limit(10); if (error) throw error; return data as any[] } })
  const inq = useQuery({ queryKey: ['inquiries', 'dash'], queryFn: async () => {
    const { data, error } = await supabase.from('inquiries').select('sales_stage,created_at,updated_at,lost_reason').is('archived_at', null); if (error) throw error; return data } })
  const fu = useQuery({ queryKey: ['followups', 'dash'], queryFn: async () => {
    const { data, error } = await supabase.from('followups').select('scheduled_at').eq('status', 'Pending'); if (error) throw error; return data } })
  // Confirmed orders that are not paid in full yet (admin only). Words only: no amounts.
  const isAdmin = me?.role === 'admin'
  const pend = useQuery({ queryKey: ['money', 'pending'], enabled: isAdmin, queryFn: async () => {
    const o = await supabase.from('inquiries').select('id,inquiry_number,customers(customer_name)').eq('sales_stage', 'Order Confirmed').is('archived_at', null); if (o.error) throw o.error
    const f = await supabase.from('order_finance').select('inquiry_id,pay_status,balance_due_on,pay_later'); if (f.error) throw f.error
    const fin: Record<string, any> = {}; for (const x of f.data as any[]) fin[x.inquiry_id] = x
    return (o.data as any[]).map((r) => ({ r, status: (fin[r.id]?.pay_status as string) ?? 'Not paid', due: fin[r.id]?.balance_due_on as string | null, later: fin[r.id]?.pay_later === true }))
      .filter((x) => x.status !== 'Paid in full').sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999')) } })
  if (inq.error || fu.error) return <p className="msg">{((inq.error || fu.error) as any).message}</p>
  if (!inq.data || !fu.data) return <p className="empty">Loading…</p>
  const now = Date.now(), t0 = new Date().setHours(0, 0, 0, 0), t1 = new Date().setHours(23, 59, 59, 999), m = new Date()
  const isMonth = (s: string) => { const d = new Date(s); return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear() }
  const I = inq.data, closed = ['Order Confirmed', 'Lost']
  const count = (t: Tile): number => {
    if (t.kind === 'total') return I.length
    if (t.kind === 'today') return I.filter((r) => +new Date(r.created_at) >= t0).length
    if (t.kind === 'active') return I.filter((r) => !closed.includes(r.sales_stage) && r.sales_stage !== 'On Hold').length
    if (t.kind === 'due_today') return fu.data.filter((f) => +new Date(f.scheduled_at) >= now && +new Date(f.scheduled_at) <= t1).length
    if (t.kind === 'overdue') return fu.data.filter((f) => +new Date(f.scheduled_at) < now).length
    return I.filter((r) => (t.stages ?? []).includes(r.sales_stage) && (!t.period || t.period === 'all' || (t.period === 'month' ? isMonth(r.updated_at) : +new Date(r.updated_at) >= t0))).length
  }
  const cards: [string, number][] = tiles.filter((t) => !t.hidden).map((t) => [t.label, count(t)])
  // Why inquiries are lost (all lost inquiries; older ones without a reason are grouped as "Not recorded")
  const lost = I.filter((r) => r.sales_stage === 'Lost'), counts: Record<string, number> = {}
  for (const r of lost) { const k = r.lost_reason || 'Not recorded'; counts[k] = (counts[k] ?? 0) + 1 }
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return <>
    <LowStock detail={isAdmin || !!canInv.data} />
    <div className="stats">{cards.map(([k, v]) => <div className="stat" key={k}><b>{v}</b><span className="muted">{k}</span></div>)}</div>
    {isAdmin && pend.data && pend.data.length > 0 && (() => { const today = isoDate()
      return <div className="card" style={{ borderLeftColor: '#8A6F52' }}><div className="row"><b>Payment pending</b><b>{pend.data.length}</b></div>
        <div className="muted">Confirmed orders that are not paid in full.</div>
        {pend.data.slice(0, 10).map(({ r, status, due, later }) => <div className="row" key={r.id}><div><div>{r.customers?.customer_name} <span className="muted">· {r.inquiry_number}</span></div>
          <div className="muted">{status}{later ? ' · payment later' : ''}{due ? ` · due ${fmtDate(due)}` : ''}</div>
          <InquiryBar r={{ id: r.id, sales_stage: 'Order Confirmed' }} stages={stages} money={money.data} /></div>
          <div style={{ textAlign: 'right' }}>{due && due < today && <span className="pill Urgent">Overdue</span>}</div></div>)}
        {pend.data.length > 10 && <div className="muted">…and {pend.data.length - 10} more.</div>}</div> })()}
    {latest.data && latest.data.length > 0 && <div className="card"><b>Latest inquiries</b>
      {latest.data.map((r) => <div key={r.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 6 }}><div className="row"><span>{r.customers?.customer_name} <span className="muted">· {r.inquiry_number}</span></span><span className="muted">{r.customers?.phone_number ?? ''}</span></div>
        <InquiryBar r={r} stages={stages} money={money.data} /></div>)}</div>}
    {rows.length > 0 && <div className="card"><div className="row"><b>Why inquiries are lost</b><span className="muted">{lost.length} total</span></div>
      {rows.map(([k, n]) => <div key={k} style={{ display: 'grid', gap: 3 }}><div className="row"><span>{k}</span><b>{n}</b></div>
        <div style={{ height: 8, borderRadius: 99, background: 'var(--line)' }}><div style={{ width: `${(n / lost.length) * 100}%`, height: 8, borderRadius: 99, background: 'var(--clay)' }} /></div></div>)}</div>}
  </>
}
