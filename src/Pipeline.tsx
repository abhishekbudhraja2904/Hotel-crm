import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { moveStage } from '../lib/stage'
const STAGES: [string, string][] = [['New Inquiry','#6B8F72'],['Qualified','#5a7d63'],['Technical Discussion','#8A6F52'],['Quotation Preparation','#D9C9A5'],['Quotation Sent','#c08a4a'],['Negotiation','#a8573f'],['Order Confirmed','#3f6b4a'],['Lost','#9b3b30'],['On Hold','#8b8f86']]
const colour = (s: string) => STAGES.find((x) => x[0] === s)?.[1] ?? '#6B8F72'
// Overview tiles show every stage's count at a glance (no sideways scrolling); tap a tile to see just those inquiries.
export default function Pipeline() {
  const qc = useQueryClient(), [msg, setMsg] = useState(''), [sel, setSel] = useState(''), [q, setQ] = useState('')
  const { data = [], isLoading } = useQuery({ queryKey: ['inquiries', 'pipe'], queryFn: async () => {
    const { data, error } = await supabase.from('inquiries').select('id,inquiry_number,sales_stage,priority,updated_at,customers(customer_name)').is('archived_at', null).order('updated_at', { ascending: false }); if (error) throw error; return data } })
  async function move(r: any, next: string) {
    setMsg((await moveStage(r, next)) ?? '')
    qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['followups'] })
  }
  const rows = data.filter((r: any) => (!sel || r.sales_stage === sel) && JSON.stringify(r).toLowerCase().includes(q.toLowerCase()))
  return (
    <section>
      {msg && <p className="msg">{msg}</p>}
      <div className="tiles">
        <button className={`tile${!sel ? ' sel' : ''}`} style={{ borderTopColor: '#0F1F17' }} onClick={() => setSel('')}><b>{data.length}</b><span>All</span></button>
        {STAGES.map(([s, c]) => <button key={s} className={`tile${sel === s ? ' sel' : ''}`} style={{ borderTopColor: c }} onClick={() => setSel(sel === s ? '' : s)}>
          <b>{data.filter((r: any) => r.sales_stage === s).length}</b><span>{s}</span></button>)}
      </div>
      <input className="search" placeholder="Search customer or inquiry number…" value={q} onChange={(e) => setQ(e.target.value)} />
      {isLoading && <p className="empty">Loading…</p>}
      {!isLoading && !rows.length && <p className="empty">No inquiries here.</p>}
      {rows.map((r: any) => (
        <div className="card" key={r.id} style={{ borderLeftColor: colour(r.sales_stage) }}>
          <div className="row"><b>{r.customers?.customer_name}</b><span className="pill">{r.priority}</span></div>
          <div className="muted">{r.inquiry_number}</div>
          <select value={r.sales_stage} onChange={(e) => move(r, e.target.value)}>{STAGES.map(([s]) => <option key={s}>{s}</option>)}</select>
        </div>))}
    </section>
  )
}
