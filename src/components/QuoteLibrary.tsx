import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { inr } from '../lib/money'
import { QSTATUS, qclass, one } from '../lib/quotes'
const fmt = (d?: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString() : '')
// What was quoted to whom. Admin sees every quotation; sales sees only quotations on their own inquiries (the database enforces this).
export default function QuoteLibrary() {
  const [q, setQ] = useState(''), [st, setSt] = useState(''), [who, setWho] = useState('')
  const { data, isLoading, error } = useQuery({ queryKey: ['quote-library'], queryFn: async () => {
    const { data, error } = await supabase.from('quotations').select('id,quotation_number,version,quotation_date,total_amount,status,creator:created_by(employee_name),inquiries(inquiry_number,customers(customer_name)),quotation_lines(id,product_name,quantity,unit,unit_price,line_total)').order('created_at', { ascending: false }).limit(500)
    if (error) throw error; return data as any[] } })
  const names = [...new Set((data ?? []).map((r) => one(r.creator)?.employee_name).filter(Boolean))] as string[]
  const t = q.trim().toLowerCase()
  const rows = (data ?? []).filter((r) => (!st || r.status === st) && (!who || one(r.creator)?.employee_name === who) && (!t || JSON.stringify([r.quotation_number, one(r.inquiries)?.inquiry_number, one(one(r.inquiries)?.customers)?.customer_name, (r.quotation_lines ?? []).map((l: any) => l.product_name)]).toLowerCase().includes(t)))
  const latest = rows.filter((r) => r.status !== 'Revised')
  const quoted = latest.reduce((s, r) => s + Number(r.total_amount ?? 0), 0)
  return (
    <section>
      <h3>Quotations</h3>
      <input className="search" placeholder="Search by customer, product, quote or inquiry number" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="bar">
        <select value={st} onChange={(e) => setSt(e.target.value)}><option value="">All statuses</option>{QSTATUS.map((s) => <option key={s}>{s}</option>)}</select>
        {names.length > 1 && <select value={who} onChange={(e) => setWho(e.target.value)}><option value="">Everyone</option>{names.map((n) => <option key={n}>{n}</option>)}</select>}
      </div>
      {isLoading && <p className="empty">Loading…</p>}
      {error && <p className="msg">{(error as any).message}</p>}
      {data && <div className="muted">{latest.length} current quotations · {inr(quoted)} quoted in total</div>}
      {data && !rows.length && <p className="empty">Nothing quoted yet. Quotations appear here when an inquiry is moved to Quotation Sent.</p>}
      {rows.map((r) => <div className="card" key={r.id} style={{ opacity: r.status === 'Revised' ? 0.65 : 1 }}>
        <div className="row"><b>{one(one(r.inquiries)?.customers)?.customer_name}</b><span className={`pill ${qclass(r.status)}`}>{r.status}</span></div>
        <div className="muted">{r.quotation_number} v{r.version} · {one(r.inquiries)?.inquiry_number} · {fmt(r.quotation_date)} · by {one(r.creator)?.employee_name ?? '—'}</div>
        {(r.quotation_lines ?? []).map((l: any) => <div className="row" key={l.id}><span>{Number(l.quantity)}{l.unit ? ` ${l.unit}` : ''} × {l.product_name}</span><span className="muted">{inr(l.unit_price)} each · {inr(l.line_total)}</span></div>)}
        <div className="row"><b>Total</b><b>{inr(r.total_amount)}</b></div>
      </div>)}
    </section>
  )
}
