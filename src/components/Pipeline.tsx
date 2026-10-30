import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { moveStage } from '../lib/stage'
import { useSettings } from '../lib/settings'
const PALETTE = ['#5a7d63', '#8A6F52', '#D9C9A5', '#c08a4a', '#a8573f', '#7a8f9c', '#6B8F72']
const FIXED: Record<string, string> = { 'New Inquiry': '#6B8F72', 'Order Confirmed': '#3f6b4a', Lost: '#9b3b30', 'On Hold': '#8b8f86' }
// Overview tiles show every stage's count at a glance (no sideways scrolling); tap a tile to see just those inquiries.
export default function Pipeline() {
  const qc = useQueryClient(), [msg, setMsg] = useState(''), [sel, setSel] = useState(''), [q, setQ] = useState('')
  const { stages } = useSettings()
  const { data = [], isLoading } = useQuery({ queryKey: ['inquiries', 'pipe'], queryFn: async () => {
    const { data, error } = await supabase.from('inquiries').select('id,inquiry_number,sales_stage,priority,updated_at,customers(customer_name)').is('archived_at', null).order('updated_at', { ascending: false }); if (error) throw error; return data } })
  const all = [...stages, ...[...new Set(data.map((r: any) => r.sales_stage))].filter((s: any) => !stages.includes(s))] as string[] // keeps inquiries visible even if their stage was removed elsewhere
  const colour = (s: string) => FIXED[s] ?? PALETTE[Math.max(0, all.indexOf(s)) % PALETTE.length]
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
        {all.map((s) => <button key={s} className={`tile${sel === s ? ' sel' : ''}`} style={{ borderTopColor: colour(s) }} onClick={() => setSel(sel === s ? '' : s)}>
          <b>{data.filter((r: any) => r.sales_stage === s).length}</b><span>{s}</span></button>)}
      </div>
      <input className="search" placeholder="Search customer or inquiry number…" value={q} onChange={(e) => setQ(e.target.value)} />
      {isLoading && <p className="empty">Loading…</p>}
      {!isLoading && !rows.length && <p className="empty">No inquiries here.</p>}
      {rows.map((r: any) => (
        <div className="card" key={r.id} style={{ borderLeftColor: colour(r.sales_stage) }}>
          <div className="row"><b>{r.customers?.customer_name}</b><span className="pill">{r.priority}</span></div>
          <div className="muted">{r.inquiry_number}</div>
          <select value={r.sales_stage} onChange={(e) => move(r, e.target.value)}>{all.map((s) => <option key={s}>{s}</option>)}</select>
        </div>))}
    </section>
  )
}
