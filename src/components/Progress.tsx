import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { stageColour, barSteps } from '../lib/stageColour'
export type MoneyMap = Record<string, { status: string; due: string | null; later: boolean }>
// Payment state of every order the person can see (sales: own orders; admin: all). Words only, never amounts.
export function useMoney() {
  return useQuery({ queryKey: ['money', 'all'], queryFn: async () => {
    const f = await supabase.from('order_finance').select('inquiry_id,pay_status,balance_due_on,pay_later'); if (f.error) throw f.error
    const m: MoneyMap = {}
    for (const x of f.data as any[]) m[x.inquiry_id] = { status: String(x.pay_status ?? 'Not paid'), due: x.balance_due_on, later: x.pay_later === true }
    return m } })
}
// Before the order is confirmed: where the inquiry is in the pipeline. After: how much of the money has come in.
export default function InquiryBar({ r, stages, money }: { r: { id: string; sales_stage: string; dispatched_at?: string | null }; stages: string[]; money?: MoneyMap }) {
  if (r.sales_stage === 'Lost') return <div className="barwrap"><span className="ptag lost">Lost</span></div>
  if (r.sales_stage === 'On Hold') return <div className="barwrap"><span className="ptag hold">On hold</span></div>
  if (r.sales_stage === 'Order Confirmed') {
    const m = money?.[r.id], status = m?.status ?? 'Not paid', full = status === 'Paid in full'
    return <div className="barwrap">
      <div className={`paybar${full ? ' full' : ''}`}><i style={{ width: full ? '100%' : status === 'Part paid' ? '50%' : '0%' }} /></div>
      <div className="barnote">Payment: {status}{!full && m?.later ? ' · payment later' : ''}{r.dispatched_at && <> · <span className="tick">✓ Dispatched</span></>}</div></div>
  }
  const steps = barSteps(stages), at = Math.max(0, steps.indexOf(r.sales_stage)), col = stageColour(r.sales_stage, stages)
  return <div className="barwrap"><div className="stbar" aria-label={`Stage ${at + 1} of ${steps.length}`}>{steps.map((s, i) => <i key={s} style={i <= at ? { background: col } : undefined} />)}</div>
    <div className="barnote">{r.sales_stage} · step {at + 1} of {steps.length}</div></div>
}
