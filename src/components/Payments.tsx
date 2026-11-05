import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { inr } from '../lib/money'
import { useSettings } from '../lib/settings'
import { fmtDate, isoDate } from '../lib/dates'
import DateField from './DateField'
import WhoFor from './WhoFor'
const r2 = (n: number) => Math.round(n * 100) / 100
// Order value (filled from the latest quotation), GST, courier, and the payments received for one order.
export default function Payments({ me, inquiry, onClose }: { me: any; inquiry: any; onClose: () => void }) {
  const qc = useQueryClient(), isAdmin = me.role === 'admin', { gstRate } = useSettings()
  const key = ['money', inquiry.id]
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: async () => {
    const f = await supabase.from('order_finance').select('order_value,balance_due_on,base_value,gst_mode,gst_rate,gst_amount,courier_charges').eq('inquiry_id', inquiry.id).maybeSingle(); if (f.error) throw f.error
    const p = await supabase.from('payments').select('id,amount,paid_on,note,created_at,employees:created_by(employee_name)').eq('inquiry_id', inquiry.id).order('paid_on', { ascending: false }).order('created_at', { ascending: false }); if (p.error) throw p.error
    const q = await supabase.from('quotations').select('quotation_number,version,total_amount,freight_charges').eq('inquiry_id', inquiry.id).order('created_at', { ascending: false }).limit(1); if (q.error) throw q.error
    return { fin: f.data, pays: p.data as any[], quote: (q.data?.[0] ?? null) as any } } })
  const [base, setBase] = useState<string | null>(null), [mode, setMode] = useState<'plus' | 'inclusive' | null>(null), [courier, setCourier] = useState<string | null>(null), [due, setDue] = useState<string | null>(null)
  const [amt, setAmt] = useState(''), [on, setOn] = useState(isoDate()), [note, setNote] = useState('')
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const refresh = () => { qc.invalidateQueries({ queryKey: ['money'] }); qc.invalidateQueries({ queryKey: ['inventory'] }) }
  const fin = data?.fin
  const legacy = !!fin && fin.base_value == null // entered before GST existed: treat as the final total
  const baseStr = base ?? (fin ? String(Number(fin.base_value ?? fin.order_value)) : data?.quote ? String(Number(data.quote.total_amount)) : '')
  const m = mode ?? (fin ? ((fin.gst_mode as any) ?? 'inclusive') : 'plus')
  const courierStr = courier ?? (fin ? String(Number(fin.courier_charges ?? 0) || '') : data?.quote ? String(Number(data.quote.freight_charges ?? 0) || '') : '')
  const rate = fin?.gst_rate != null && base === null && mode === null ? Number(fin.gst_rate) : gstRate
  const B = Number(baseStr) || 0, C = Number(courierStr) || 0
  const gst = legacy && base === null && mode === null ? 0 : m === 'plus' ? r2((B * rate) / 100) : r2(B - B / (1 + rate / 100))
  const total = m === 'plus' ? r2(B + gst + C) : r2(B + C)
  const value = Number(fin?.order_value ?? 0), paid = (data?.pays ?? []).reduce((n, p) => n + Number(p.amount), 0), balance = Math.max(0, value - paid)
  const pct = value > 0 ? Math.min(100, Math.round((paid / value) * 100)) : 0, full = value > 0 && balance < 0.005
  async function saveValue() {
    if (!(B > 0)) return setErr('Enter the order value.')
    setErr(''); setBusy(true)
    const { error } = await supabase.from('order_finance').upsert({ inquiry_id: inquiry.id, order_value: total, base_value: B, gst_mode: m, gst_rate: rate, gst_amount: gst, courier_charges: C, balance_due_on: (due ?? fin?.balance_due_on) || null, updated_by: me.id }, { onConflict: 'inquiry_id' })
    setBusy(false); if (error) return setErr(error.message); setBase(null); setMode(null); setCourier(null); setDue(null); refresh()
  }
  async function addPayment() {
    const a = Number(amt); if (!(a > 0)) return setErr('Enter the amount received.')
    if (!fin) return setErr('Save the order value first.')
    if (a > balance + 0.001) return setErr(`That is more than the balance (${inr(balance)}). Check the amount.`)
    if (!on) return setErr('Enter the date received.')
    setErr(''); setBusy(true)
    const { error } = await supabase.from('payments').insert({ inquiry_id: inquiry.id, amount: a, paid_on: on, note: note || null, created_by: me.id })
    setBusy(false); if (error) return setErr(error.message); setAmt(''); setNote(''); refresh()
  }
  async function del(id: string) { if (!confirm('Delete this payment entry?')) return; const { error } = await supabase.from('payments').delete().eq('id', id); if (error) setErr(error.message); refresh() }
  return (
    <div className="modal"><div className="card">
      <div className="row"><h3 style={{ margin: 0 }}>Payments</h3><button className="link" onClick={onClose}>Close</button></div>
      <WhoFor inquiry={inquiry} />
      {isLoading && <p className="muted">Loading…</p>}
      {data && <>
        <div style={{ display: 'grid', gap: 6 }}>
          <div className="row"><span className="muted">Total to receive</span><b>{fin ? inr(value) : 'Not entered'}</b></div>
          <div className="row"><span className="muted">Received</span><b>{inr(paid)}</b></div>
          <div className={`paybar${full ? ' full' : ''}`}><i style={{ width: `${pct}%` }} /></div>
          <div className="row"><span className="muted">Balance{fin?.balance_due_on ? ` · due ${fmtDate(fin.balance_due_on)}` : ''}</span><b>{inr(balance)}</b></div>
          {full && <span className="pill" style={{ justifySelf: 'start' }}>Paid in full</span>}
          {balance > 0 && fin?.balance_due_on && fin.balance_due_on < isoDate() && <span className="pill Urgent" style={{ justifySelf: 'start' }}>Balance overdue</span>}
        </div>
        <h4 style={{ margin: '6px 0 0' }}>Order value</h4>
        {!fin && data.quote && base === null && <div className="muted">Filled from the latest quotation ({data.quote.quotation_number}, v{data.quote.version}). You can change it.</div>}
        {legacy && <div className="muted">This value was entered before GST was added, so it is treated as the final total. Change it below if needed.</div>}
        <label>Order value (₹){m === 'inclusive' ? ', GST included' : ', before GST'}<input type="number" min="0" step="any" value={baseStr} onChange={(e) => setBase(e.target.value)} /></label>
        <div className="bar">
          <button type="button" className={m === 'plus' ? 'primary' : ''} onClick={() => setMode('plus')}>+ GST ({rate}%)</button>
          <button type="button" className={m === 'inclusive' ? 'primary' : ''} onClick={() => setMode('inclusive')}>Inclusive of GST</button></div>
        <label>Freight / courier charges (₹, paid by the buyer, optional)<input type="number" min="0" step="any" value={courierStr} onChange={(e) => setCourier(e.target.value)} /></label>
        <label>Balance due on<DateField value={due ?? fin?.balance_due_on ?? ''} onChange={setDue} ariaLabel="Balance due date" /></label>
        {B > 0 && <div className="warnbox" style={{ display: 'grid', gap: 3 }}>
          <div className="row"><span>Order value{m === 'inclusive' ? ' (GST included)' : ''}</span><span>{inr(B)}</span></div>
          <div className="row"><span>{m === 'plus' ? `GST ${rate}% (added)` : `GST ${rate}% (already inside the value)`}</span><span>{m === 'plus' ? '+ ' : ''}{inr(gst)}</span></div>
          {C > 0 && <div className="row"><span>Courier charges (added)</span><span>+ {inr(C)}</span></div>}
          <div className="row"><b>Total to receive</b><b>{inr(total)}</b></div></div>}
        <button disabled={busy} onClick={saveValue}>Save order value</button>
        <h4 style={{ margin: '6px 0 0' }}>Record a payment</h4>
        <label>Amount received (₹)<input type="number" min="0" step="any" value={amt} onChange={(e) => setAmt(e.target.value)} /></label>
        <label>Date received<DateField value={on} onChange={setOn} ariaLabel="Date received" /></label>
        <input placeholder="Note, e.g. advance / UPI / cheque no. (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="primary" disabled={busy} onClick={addPayment}>Record payment</button>
        {err && <p className="msg">{err}</p>}
        {data.pays.length > 0 && <><h4 style={{ margin: '6px 0 0' }}>Received so far</h4>
          {data.pays.map((p: any) => <div key={p.id} className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 6 }}>
            <div><b>{inr(p.amount)}</b> <span className="muted">· {fmtDate(p.paid_on)}</span><div className="muted">{(Array.isArray(p.employees) ? p.employees[0] : p.employees)?.employee_name ?? ''}{p.note ? ` · ${p.note}` : ''}</div></div>
            {isAdmin && <button className="link" onClick={() => del(p.id)}>Delete</button>}</div>)}</>}
      </>}
    </div></div>
  )
}
