import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
export default function Dashboard() {
  const inq = useQuery({ queryKey: ['inquiries', 'dash'], queryFn: async () => {
    const { data, error } = await supabase.from('inquiries').select('sales_stage,created_at,updated_at').is('archived_at', null); if (error) throw error; return data } })
  const fu = useQuery({ queryKey: ['followups', 'dash'], queryFn: async () => {
    const { data, error } = await supabase.from('followups').select('scheduled_at').eq('status', 'Pending'); if (error) throw error; return data } })
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
  return <div className="stats">{cards.map(([k, v]) => <div className="stat" key={k}><b>{v}</b><span className="muted">{k}</span></div>)}</div>
}
