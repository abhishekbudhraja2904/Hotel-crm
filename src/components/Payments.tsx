import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDate, isoDate } from '../lib/dates'
import DateField from './DateField'
import WhoFor from './WhoFor'
export const PAY_STATES = ['Not paid', 'Part paid', 'Paid in full'] as const
// Payment for one order: only a state (Not paid / Part paid / Paid in full), an optional promised date, and "payment later". No amounts are recorded.
export default function Payments({ me: _me, inquiry, onClose }: { me: any; inquiry: any; onClose: () => void }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['money', inquiry.id], queryFn: async () => {
    const { data, error } = await supabase.from('order_finance').select('pay_status,balance_due_on,pay_later').eq('inquiry_id', inquiry.id).maybeSingle(); if (error) throw error
    return (data ?? { pay_status: 'Not paid', balance_due_on: null, pay_later: false }) as { pay_status: string; balance_due_on: string | null; pay_later: boolean } } })
  const [due, setDue] = useState<string | null>(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const refresh = () => { qc.invalidateQueries({ queryKey: ['money'] }); qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['inquiries'] }) }
  const status = data?.pay_status ?? 'Not paid', dueStr = due ?? data?.balance_due_on ?? ''
  async function setStatus(s: string) {
    setErr(''); setBusy(true)
    const { error } = await supabase.rpc('set_payment_status', { p_inq: inquiry.id, p_status: s, p_due: s === 'Paid in full' ? null : dueStr || null })
    setBusy(false); if (error) return setErr(error.message); setDue(null); refresh()
  }
  async function payLater(on: boolean) {
    setErr(''); setBusy(true)
    const { error } = await supabase.rpc('set_pay_later', { p_inq: inquiry.id, p_on: on, p_due: on && dueStr ? dueStr : null })
    setBusy(false); if (error) setErr(error.message); else setDue(null); refresh()
  }
  const overdue = status !== 'Paid in full' && !!data?.balance_due_on && data.balance_due_on < isoDate()
  return (
    <div className="modal"><div className="card">
      <div className="row"><h3 style={{ margin: 0 }}>Payment</h3><button className="link" onClick={onClose}>Close</button></div>
      <WhoFor inquiry={inquiry} />
      {isLoading && <p className="muted">Loading…</p>}
      {data && <>
        <div className="row"><span className="muted">Payment</span><span className="pill" style={status === 'Paid in full' ? undefined : { background: '#f0e3c8' }}>{status}</span></div>
        <div className={`paybar${status === 'Paid in full' ? ' full' : ''}`}><i style={{ width: status === 'Paid in full' ? '100%' : status === 'Part paid' ? '50%' : '0%' }} /></div>
        {overdue && <span className="pill Urgent" style={{ justifySelf: 'start' }}>Payment overdue</span>}
        <h4 style={{ margin: '6px 0 0' }}>Mark payment as</h4>
        <div className="bar">{PAY_STATES.map((s) => <button key={s} type="button" disabled={busy} className={status === s ? 'primary' : ''} onClick={() => setStatus(s)}>{s}</button>)}</div>
        {status !== 'Paid in full' && <label>Payment promised by (optional)<DateField value={dueStr} onChange={setDue} ariaLabel="Payment promised by" /></label>}
        {status !== 'Paid in full' && (data.pay_later
          ? <div className="warnbox" style={{ display: 'grid', gap: 6 }}><b>Payment later</b><span className="muted">This order can go through packing and dispatch before the payment comes in{data.balance_due_on ? ` (promised by ${fmtDate(data.balance_due_on)})` : ''}.</span><button type="button" disabled={busy} onClick={() => payLater(false)}>Cancel "payment later"</button></div>
          : <div className="card" style={{ display: 'grid', gap: 6 }}><b>Payment later</b><span className="muted">Let this order go to packing and dispatch without waiting for the payment.</span>
              <button type="button" disabled={busy} onClick={() => payLater(true)}>Allow packing and dispatch, payment later</button></div>)}
        {err && <p className="msg">{err}</p>}
      </>}
    </div></div>
  )
}
