import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { inr } from '../lib/money'
import { stageColour, barSteps } from '../lib/stageColour'
export type MoneyMap = Record<string, { value: number | null; paid: number; due: string | null; settled?: number }>
// Order value and money received for every order the person can see (sales: own orders; admin: all).
export function useMoney() {
  return useQuery({ queryKey: ['money', 'all'], queryFn: async () => {
    const f = await supabase.from('order_finance').select('inquiry_id,order_value,balance_due_on,settled_amount'); if (f.error) throw f.error
    const p = await supabase.from('payments').select('inquiry_id,amount'); if (p.error) throw p.error
    const m: MoneyMap = {}
    for (const x of f.data as any[]) m[x.inquiry_id] = { value: Number(x.order_value), paid: 0, due: x.balance_due_on, settled: Number(x.settled_amount ?? 0) }
    for (const x of p.data as any[]) { m[x.inquiry_id] = m[x.inquiry_id] ?? { value: null, paid: 0, due: null }; m[x.inquiry_id].paid += Number(x.amount) }
    return m } })
}
// Before the order is confirmed: where the inquiry is in the pipeline. After: how much of the money has come in.
export default function InquiryBar({ r, stages, money }: { r: { id: string; sales_stage: string; dispatched_at?: string | null }; stages: string[]; money?: MoneyMap }) {
  if (r.sales_stage === 'Lost') return <div className="barwrap"><span className="ptag lost">Lost</span></div>
  if (r.sales_stage === 'On Hold') return <div className="barwrap"><span className="ptag hold">On hold</span></div>
  if (r.sales_stage === 'Order Confirmed') {
    const m = money?.[r.id], value = m?.value ?? 0, paid = (m?.paid ?? 0) + (m?.settled ?? 0), full = value > 0 && paid >= value - 0.999, pct = full ? 100 : value > 0 ? Math.min(100, (paid / value) * 100) : 0
    return <div className="barwrap">
      <div className={`paybar${full ? ' full' : ''}`}><i style={{ width: `${pct}%` }} /></div>
      <div className="barnote">{value > 0 ? `${inr(Math.round(full ? value : paid))} of ${inr(Math.round(value))} received${full ? ' · paid in full' : ''}` : 'Order value not entered yet'}{r.dispatched_at && <> · <span className="tick">✓ Dispatched</span></>}</div></div>
  }
  const steps = barSteps(stages), at = Math.max(0, steps.indexOf(r.sales_stage)), col = stageColour(r.sales_stage, stages)
  return <div className="barwrap"><div className="stbar" aria-label={`Stage ${at + 1} of ${steps.length}`}>{steps.map((s, i) => <i key={s} style={i <= at ? { background: col } : undefined} />)}</div>
    <div className="barnote">{r.sales_stage} · step {at + 1} of {steps.length}</div></div>
}
