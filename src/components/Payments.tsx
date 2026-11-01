import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { inr } from '../lib/money'
const day = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString([], { dateStyle: 'medium' })
// Order value, due date and the list of payments for one inquiry.
export default function Payments({ me, inquiry, onClose }: { me: any; inquiry: any; onClose: () => void }) {
  const qc = useQueryClient(), isAdmin = me.role === 'admin'
  const key = ['money', inquiry.id]
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: async () => {
    const f = await supabase.from('order_finance').select('order_value,balance_due_on').eq('inquiry_id', inquiry.id).maybeSingle(); if (f.error) throw f.error
    const p = await supabase.from('payments').select('id,amount,paid_on,note,created_at,employees:created_by(employee_name)').eq('inquiry_id', inquiry.id).order('paid_on', { ascending: false }).order('created_at', { ascending: false }); if (p.error) throw p.error
    return { fin: f.data, pays: p.data as any[] } } })
  const [val, setVal] = useState<string | null>(null), [due, setDue] = useState<string | null>(null)
  const [amt, setAmt] = useState(''), [on, setOn] = useState(new Date().toLocaleDateString('en-CA')), [note, setNote] = useState('')
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const refresh = () => { qc.invalidateQueries({ queryKey: ['money'] }); qc.invalidateQueries({ queryKey: ['inventory'] }) }
  const value = Number(data?.fin?.order_value ?? 0), paid = (data?.pays ?? []).reduce((n, p) => n + Number(p.amount), 0), balance = Math.max(0, value - paid)
  const pct = value > 0 ? Math.min(100, Math.round((paid / value) * 100)) : 0
  async function saveValue() {
    const v = Number(val ?? data?.fin?.order_value); if (!(v >= 0) || isNaN(v)) return setErr('Enter the order value as a number.')
    setErr(''); setBusy(true)
    const { error } = await supabase.from('order_finance').upsert({ inquiry_id: inquiry.id, order_value: v, balance_due_on: (due ?? data?.fin?.balance_due_on) || null, updated_by: me.id }, { onConflict: 'inquiry_id' })
    setBusy(false); if (error) return setErr(error.message); setVal(null); setDue(null); refresh()
  }
  async function addPayment() {
    const a = Number(amt); if (!(a > 0)) return setErr('Enter the amount received.')
    if (!data?.fin) return setErr('Save the order value first.')
    if (a > balance + 0.001) return setErr(`That is more than the balance (${inr(balance)}). Check the amount.`)
    setErr(''); setBusy(true)
    const { error } = await supabase.from('payments').insert({ inquiry_id: inquiry.id, amount: a, paid_on: on, note: note || null, created_by: me.id })
    setBusy(false); if (error) return setErr(error.message); setAmt(''); setNote(''); refresh()
  }
  async function del(id: string) { if (!confirm('Delete this payment entry?')) return; const { error } = await supabase.from('payments').delete().eq('id', id); if (error) setErr(error.message); refresh() }
  return (
    <div className="modal"><div className="card">
      <div className="row"><h3 style={{ margin: 0 }}>Payments</h3><button className="link" onClick={onClose}>Close</button></div>
      <div className="muted">{inquiry.customers?.customer_name} · {inquiry.inquiry_number}</div>
      {isLoading && <p className="muted">Loading…</p>}
      {data && <>
        <div style={{ display: 'grid', gap: 6 }}>
          <div className="row"><span className="muted">Order value</span><b>{data.fin ? inr(value) : 'Not entered'}</b></div>
          <div className="row"><span className="muted">Received</span><b>{inr(paid)}</b></div>
          <div style={{ height: 10, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: 10, background: 'var(--sage)' }} /></div>
          <div className="row"><span className="muted">Balance{data.fin?.balance_due_on ? ` · due ${day(data.fin.balance_due_on)}` : ''}</span><b>{inr(balance)}</b></div>
          {data.fin && balance === 0 && value > 0 && <span className="pill" style={{ justifySelf: 'start' }}>Paid in full: ready to dispatch</span>}
          {balance > 0 && data.fin?.balance_due_on && data.fin.balance_due_on < new Date().toLocaleDateString('en-CA') && <span className="pill Urgent" style={{ justifySelf: 'start' }}>Balance overdue</span>}
        </div>
        <h4 style={{ margin: '6px 0 0' }}>Order value</h4>
        <div className="bar"><input type="number" min="0" placeholder="Order value (₹)" value={val ?? (data.fin ? String(value) : '')} onChange={(e) => setVal(e.target.value)} />
          <input type="date" aria-label="Balance due date" value={due ?? data.fin?.balance_due_on ?? ''} onChange={(e) => setDue(e.target.value)} /></div>
        <div className="muted">The first box is the total value. The date is when the balance is due. You can change the value if the order changes.</div>
        <button disabled={busy} onClick={saveValue}>Save value and due date</button>
        <h4 style={{ margin: '6px 0 0' }}>Record a payment</h4>
        <div className="bar"><input type="number" min="0" placeholder="Amount received (₹)" value={amt} onChange={(e) => setAmt(e.target.value)} />
          <input type="date" aria-label="Date received" value={on} onChange={(e) => setOn(e.target.value)} /></div>
        <input placeholder="Note, e.g. advance / UPI / cheque no. (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="primary" disabled={busy} onClick={addPayment}>Record payment</button>
        {err && <p className="msg">{err}</p>}
        {data.pays.length > 0 && <><h4 style={{ margin: '6px 0 0' }}>Received so far</h4>
          {data.pays.map((p: any) => <div key={p.id} className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 6 }}>
            <div><b>{inr(p.amount)}</b> <span className="muted">· {day(p.paid_on)}</span><div className="muted">{(Array.isArray(p.employees) ? p.employees[0] : p.employees)?.employee_name ?? ''}{p.note ? ` · ${p.note}` : ''}</div></div>
            {isAdmin && <button className="link" onClick={() => del(p.id)}>Delete</button>}</div>)}</>}
      </>}
    </div></div>
  )
}
