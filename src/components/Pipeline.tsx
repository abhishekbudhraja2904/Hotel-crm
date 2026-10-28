import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { moveStage } from '../lib/stage'
const COLS = ['New Inquiry','Qualified','Technical Discussion','Quotation Preparation','Quotation Sent','Negotiation','Order Confirmed','Lost']
export default function Pipeline() {
  const qc = useQueryClient(), [msg, setMsg] = useState('')
  const { data = [], isLoading } = useQuery({ queryKey: ['inquiries', 'pipe'], queryFn: async () => {
    const { data, error } = await supabase.from('inquiries').select('id,inquiry_number,sales_stage,updated_at,customers(customer_name)').is('archived_at', null); if (error) throw error; return data } })
  async function move(r: any, next: string) {
    setMsg((await moveStage(r, next)) ?? '')
    qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['followups'] })
  }
  return (
    <section>
      {msg && <p className="msg">{msg}</p>}{isLoading && <p className="empty">Loading…</p>}
      <div className="kanban">{COLS.map((c) => { const rows = data.filter((r: any) => r.sales_stage === c); return (
        <div className="col" key={c}><h4>{c} <span className="muted">({rows.length})</span></h4>
          {rows.map((r: any) => <div className="card" key={r.id}><b>{r.customers?.customer_name}</b><span className="muted">{r.inquiry_number}</span>
            <select value={r.sales_stage} onChange={(e) => move(r, e.target.value)}>{[...COLS, 'On Hold'].map((s) => <option key={s}>{s}</option>)}</select></div>)}
        </div>)})}</div>
    </section>
  )
}
