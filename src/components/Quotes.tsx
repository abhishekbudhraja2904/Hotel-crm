import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { inr } from '../lib/money'
import { QSTATUS, qclass, one } from '../lib/quotes'
import QuoteForm from './QuoteForm'
const fmt = (d?: string | null) => (d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString() : '')
// Quotations recorded for one inquiry, with a button to record a new or revised one.
export default function Quotes({ me, inquiry, onClose }: { me: any; inquiry: any; onClose: () => void }) {
  const qc = useQueryClient(), canWrite = me.role === 'admin' || me.role === 'sales', isAdmin = me.role === 'admin'
  const [adding, setAdding] = useState(false), [msg, setMsg] = useState('')
  const list = useQuery({ queryKey: ['quotes', inquiry.id], queryFn: async () => {
    const { data, error } = await supabase.from('quotations').select('id,quotation_number,version,quotation_date,total_amount,status,created_at,creator:created_by(employee_name),quotation_lines(id,product_name,quantity,unit,unit_price,line_total)').eq('inquiry_id', inquiry.id).order('created_at', { ascending: false })
    if (error) throw error; return data as any[] } })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['quotes'] }); qc.invalidateQueries({ queryKey: ['quote-library'] }) }
  async function setSt(q: any, s: string) { const { error } = await supabase.from('quotations').update({ status: s }).eq('id', q.id); setMsg(error ? error.message : ''); refresh() }
  async function remove(q: any) {
    if (!confirm(`Delete quotation ${q.quotation_number} (v${q.version}) permanently?`)) return
    const { error } = await supabase.from('quotations').delete().eq('id', q.id); if (error) return setMsg(error.message); refresh()
  }
  return (
    <div className="modal"><div className="card" style={{ maxWidth: 560 }}>
      <div className="row"><h3 style={{ margin: 0 }}>Quotations</h3><button className="link" onClick={onClose}>Close</button></div>
      <div className="muted">{inquiry.customers?.customer_name ?? ''} · {inquiry.inquiry_number}</div>
      {msg && <p className="msg">{msg}</p>}
      {canWrite && <button className="primary" onClick={() => setAdding(true)}>{list.data?.length ? '+ Record a revised quotation' : '+ Record a quotation'}</button>}
      {list.isLoading && <p className="empty">Loading…</p>}
      {list.data && !list.data.length && <p className="empty">Nothing quoted for this inquiry yet.</p>}
      {list.data?.map((q) => <div className="card" key={q.id} style={{ margin: 0 }}>
        <div className="row"><b>{q.quotation_number} <span className="muted">v{q.version}</span></b><span className={`pill ${qclass(q.status)}`}>{q.status}</span></div>
        <div className="muted">{fmt(q.quotation_date)} · by {one(q.creator)?.employee_name ?? '—'}</div>
        {(q.quotation_lines ?? []).map((l: any) => <div className="row" key={l.id}><span>{Number(l.quantity)}{l.unit ? ` ${l.unit}` : ''} × {l.product_name}</span><span className="muted">{inr(l.unit_price)} each · <b>{inr(l.line_total)}</b></span></div>)}
        <div className="row"><b>Total</b><b>{inr(q.total_amount)}</b></div>
        {canWrite && <div className="bar">{QSTATUS.filter((s) => s !== q.status && s !== 'Revised').map((s) => <button key={s} onClick={() => setSt(q, s)}>Mark {s}</button>)}{isAdmin && <button className="link" onClick={() => remove(q)}>Delete</button>}</div>}
      </div>)}
      {adding && <QuoteForm inquiry={inquiry} onClose={() => setAdding(false)} />}
    </div></div>
  )
}
