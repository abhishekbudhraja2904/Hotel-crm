import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { moveStage } from '../lib/stage'
import LostReason from './LostReason'
import ConfirmOrder from './ConfirmOrder'
import QuoteForm from './QuoteForm'
import { useSettings } from '../lib/settings'
import { stageColour } from '../lib/stageColour'
import InquiryBar, { useMoney } from './Progress'
// Overview tiles show every stage's count at a glance (no sideways scrolling); tap a tile to see just those inquiries.
export default function Pipeline() {
  const qc = useQueryClient(), [msg, setMsg] = useState(''), [sel, setSel] = useState(''), [q, setQ] = useState(''), [lostFor, setLostFor] = useState<any>(null), [confirmFor, setConfirmFor] = useState<any>(null), [quoFormFor, setQuoFormFor] = useState<any>(null)
  const { stages } = useSettings(), money = useMoney()
  const { data = [], isLoading } = useQuery({ queryKey: ['inquiries', 'pipe'], queryFn: async () => {
    const { data, error } = await supabase.from('inquiries').select('id,inquiry_number,sales_stage,priority,updated_at,dispatched_at,packing_no,customers(customer_name,phone_number)').is('archived_at', null).order('updated_at', { ascending: false }); if (error) throw error; return data } })
  const all = [...stages, ...[...new Set(data.map((r: any) => r.sales_stage))].filter((s: any) => !stages.includes(s))] as string[] // keeps inquiries visible even if their stage was removed elsewhere
  const colour = (s: string) => stageColour(s, all)
  async function move(r: any, next: string) {
    if (next === 'Lost' && r.sales_stage !== 'Lost') return setLostFor(r) // ask why first
    if (next === 'Order Confirmed' && r.sales_stage !== 'Order Confirmed') return setConfirmFor(r) // link products so stock can be locked
    if (next === 'Quotation Sent' && r.sales_stage !== 'Quotation Sent') return setQuoFormFor(r) // record what is being quoted
    setMsg((await moveStage(r, next)) ?? '')
    qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['followups'] })
  }
  const rows = data.filter((r: any) => (!sel || r.sales_stage === sel) && JSON.stringify(r).toLowerCase().includes(q.toLowerCase()))
  return (
    <section>
      {msg && <p className="msg">{msg}</p>}
      {quoFormFor && <QuoteForm inquiry={quoFormFor} onClose={() => setQuoFormFor(null)} onSaved={async () => { const e = await moveStage(quoFormFor, 'Quotation Sent'); qc.invalidateQueries({ queryKey: ['inquiries'] }); return e }} onSkip={async () => { const e = await moveStage(quoFormFor, 'Quotation Sent'); qc.invalidateQueries({ queryKey: ['inquiries'] }); return e }} />}
      {confirmFor && <ConfirmOrder inquiry={confirmFor} onClose={() => setConfirmFor(null)} onConfirm={async () => { const e = await moveStage(confirmFor, 'Order Confirmed'); qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['followups'] }); qc.invalidateQueries({ queryKey: ['inventory'] }); return e }} />}
      {lostFor && <LostReason inquiry={lostFor} onClose={() => setLostFor(null)} onSave={async (reason, note) => { const e = await moveStage(lostFor, 'Lost', { lost_reason: reason, lost_note: note || null }); qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['followups'] }); return e }} />}
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
          <div className="muted">{r.inquiry_number}{r.customers?.phone_number ? <> · <a href={`tel:${r.customers.phone_number}`}>📞 {r.customers.phone_number}</a></> : null}{r.packing_no ? ` · packing no. ${r.packing_no}` : ''}</div>
          <InquiryBar r={r} stages={stages} money={money.data} />
          <select value={r.sales_stage} onChange={(e) => move(r, e.target.value)}>{all.map((s) => <option key={s}>{s}</option>)}</select>
        </div>))}
    </section>
  )
}
