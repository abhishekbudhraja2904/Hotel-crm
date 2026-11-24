import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAcks } from './AckBar'
// Top of the owner's dashboard: "Who is not doing the work".
// 1. Work given to a service employee that they have not acknowledged yet.
// 2. Repair boxes they acknowledged but never opened (no pieces listed), which means no work was done on them.
const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const ago = (t?: string | null) => { if (!t) return ''; const h = (Date.now() - +new Date(t)) / 36e5; return h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days` }
type Row = { emp: string; kind: string; label: string; problem: 'ack' | 'box'; since: string; tab: string; filter: string }
export default function NotDoingWork({ go }: { go?: (tab: string, filter?: string) => void }) {
  const acks = useAcks()
  const open = useQuery({ queryKey: ['aftersales', 'open-work'], refetchInterval: 60000, queryFn: async () => {
    const [pk, ins, tix, box] = await Promise.all([
      supabase.from('inquiries').select('id,packing_no,customers(customer_name)').not('packer_id', 'is', null).is('packed_at', null).is('dispatched_at', null).is('archived_at', null).eq('sales_stage', 'Order Confirmed'),
      supabase.from('installations').select('id,site_name,what').neq('status', 'Completed'),
      supabase.from('service_tickets').select('id,seq,title').neq('status', 'Fixed'),
      supabase.from('repair_boxes').select('id,box_no,customer_name,repair_items(id)').neq('status', 'Done'),
    ])
    for (const r of [pk, ins, tix, box]) if (r.error) throw r.error
    return { pk: pk.data as any[], ins: ins.data as any[], tix: tix.data as any[], box: box.data as any[] } } })
  if (!acks.data || !open.data) return null
  const A = acks.data, rows: Row[] = []
  const add = (kind: string, id: string, label: string, tab: string, filter: string, boxEmpty = false) => {
    const a = A[`${kind}:${id}`]; if (!a) return
    if (!a.ack_at) rows.push({ emp: a.emp_name ?? '?', kind, label, problem: 'ack', since: a.assigned_at, tab, filter })
    else if (boxEmpty) rows.push({ emp: a.emp_name ?? '?', kind, label, problem: 'box', since: a.ack_at, tab, filter })
  }
  for (const r of open.data.pk) add('packing', r.id, `Packing no. ${r.packing_no ?? '?'} · ${one(r.customers)?.customer_name ?? ''}`, 'inv', 'pack')
  for (const r of open.data.ins) add('installation', r.id, `Installation · ${r.site_name}${r.what ? ' · ' + r.what : ''}`, 'after', 'inst')
  for (const r of open.data.tix) add('ticket', r.id, `Ticket S-${String(r.seq).padStart(3, '0')} · ${r.title}`, 'after', 'tix')
  for (const r of open.data.box) add('repair', r.id, `Repair box no. ${r.box_no} · ${r.customer_name}`, 'after', 'rep', !(r.repair_items ?? []).length)
  const byEmp = new Map<string, Row[]>(); for (const r of rows) byEmp.set(r.emp, [...(byEmp.get(r.emp) ?? []), r])
  const people = [...byEmp.entries()].sort((a, b) => b[1].length - a[1].length)
  if (!people.length) return <div className="card" style={{ borderLeftColor: '#2F6B3A' }}><b>✅ Everyone is on their work</b><div className="muted">All work is acknowledged and every repair box has been opened.</div></div>
  return <div className="card" style={{ borderLeftColor: '#b3261e', background: 'rgba(179,38,30,0.07)' }}>
    <div className="row"><b style={{ fontSize: 18 }}>⚠️ Who is not doing the work</b><span className="pill Urgent">{rows.length}</span></div>
    {people.map(([emp, list]) => <div key={emp} style={{ borderTop: '1px solid var(--line)', paddingTop: 8, display: 'grid', gap: 4 }}>
      <div className="row"><b style={{ fontSize: 16 }}>{emp}</b><span className="muted">{`${list.filter((r) => r.problem === 'ack').length} not acknowledged · ${list.filter((r) => r.problem === 'box').length} box not opened`}</span></div>
      {list.sort((a, b) => +new Date(a.since) - +new Date(b.since)).map((r, i) => <div key={i} className="tap" style={{ cursor: go ? 'pointer' : undefined }} onClick={() => go?.(r.tab, r.filter)}>
        <span style={{ color: '#9b3b30', fontWeight: 600 }}>{r.problem === 'ack' ? `⏳ Not acknowledged · given ${ago(r.since)} ago` : `📦 Box not opened · acknowledged ${ago(r.since)} ago, no pieces listed`}</span>
        <div className="muted">{r.label}</div></div>)}
    </div>)}
  </div>
}
