import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
const KEY = 'hermora-seen-alerts'
const load = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }
const save = (a: string[]) => { try { localStorage.setItem(KEY, JSON.stringify(a.slice(-300))) } catch { /* ignore */ } }
const words = (p: number | null) => (p == null ? '' : p >= 100 ? 'Fully paid' : p <= 0 ? 'No payment yet' : p >= 50 ? 'More than half paid' : 'Part paid')
// Pop-ups: new work given to me (no prices, payment in words only) and "payment received in full" for everyone involved in the order.
export default function Alerts({ me }: { me: any }) {
  const [seen, setSeen] = useState<string[]>(load())
  const mine = useQuery({ queryKey: ['alerts', 'mine'], refetchInterval: 60000, queryFn: async () => { const { data } = await supabase.rpc('my_assignments'); return (data as any[]) ?? [] } })
  const paid = useQuery({ queryKey: ['alerts', 'paid'], refetchInterval: 60000, queryFn: async () => { const { data } = await supabase.rpc('payment_alerts'); return (data as any[]) ?? [] } })
  const all = [...(paid.data ?? []).map((a) => ({ ...a, kind: 'paid' })), ...(mine.data ?? [])].filter((a) => !seen.includes(a.key))
  // first visit on a device: do not flood with old work, show only what is new from now on
  const first = (() => { try { return localStorage.getItem(KEY) === null } catch { return false } })()
  if (first && mine.data && paid.data) { save([...(mine.data ?? []).map((a: any) => a.key), ...(paid.data ?? []).map((a: any) => a.key)]); return null }
  const a = all[0]
  if (!a || !me) return null
  const done = () => { const n = [...seen, a.key]; setSeen(n); save(n) }
  const label = a.kind === 'paid' ? 'Payment received in full' : a.kind === 'collect' ? 'Packed and paid: collect' : a.kind === 'packing' ? 'New packing work' : a.kind === 'installation' ? 'New installation job' : 'New service ticket'
  return <div className="modal" style={{ zIndex: 30 }}><div className="card">
    <span className="pill Urgent" style={{ justifySelf: 'start' }}>{label}</span>
    {a.kind === 'paid' ? <>
      <h3 style={{ margin: 0 }}>{a.customer}</h3>
      <div>The full payment for this order has been received.</div>
      <div className="muted">{a.inquiry_number ?? ''}{a.packing_no ? ` · packing no. ${a.packing_no}` : ''}</div>
    </> : <>
      {a.packing_no && (a.kind === 'packing' || a.kind === 'collect') && <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>{a.packing_no}</div>}
      <h3 style={{ margin: 0 }}>{a.customer}{a.city ? `, ${a.city}` : ''}</h3>
      <div className="muted">{a.title}</div>
      {a.items && <div>{a.items}</div>}
      {a.paid_pct != null && <div className="muted">Payment: {words(a.paid_pct)}</div>}
      {a.assigned_by && <div className="muted">Assigned by {a.assigned_by}</div>}
      {a.kind === 'collect' && <div className="okbox">Fully paid. Collect this order.</div>}{a.kind === 'packing' && <div className="warnbox">Pack the items and mark every carton with the packing number.</div>}
    </>}
    {all.length > 1 && <div className="muted">{all.length - 1} more waiting</div>}
    <button className="primary" onClick={done}>OK, seen</button>
  </div></div>
}
