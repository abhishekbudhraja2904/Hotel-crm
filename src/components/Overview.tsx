import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDateTime } from '../lib/dates'

type Go = (tab: string, filter?: string) => void
const RED = { background: '#fde2e2', color: '#b42318' }, AMBER = { background: '#fff4d6', color: '#8a5a00' }
const ROLE: Record<string, string> = { sales: 'Sales', service: 'Service', service_admin: 'Service desk' }

function Tile({ n, label, tone, onClick }: { n: number | null | undefined; label: string; tone?: 'red' | 'amber'; onClick?: () => void }) {
  if (n === null || n === undefined) return null
  const hot = tone && n > 0, st: any = hot ? (tone === 'red' ? RED : AMBER) : {}
  return <div className="stat" onClick={onClick} style={{ ...st, cursor: onClick ? 'pointer' : 'default' }}><b style={hot ? { color: st.color } : {}}>{n}</b><span className="muted" style={hot ? { color: st.color } : {}}>{label}</span></div>
}
const Sec = ({ t }: { t: string }) => <div className="muted" style={{ fontWeight: 600, margin: '14px 0 6px' }}>{t}</div>

// Whole-company overview for the admin; the sales person sees the same for their own clients. Counts only, no money.
export default function Overview({ me, go }: { me: any; go: Go }) {
  const isAdmin = me?.role === 'admin'
  const { data, error } = useQuery({ queryKey: ['overview'], refetchInterval: 60000, queryFn: async () => { const { data, error } = await supabase.rpc('dashboard_overview'); if (error) throw error; return data as any } })
  if (error) return <p className="msg">{(error as any).message}</p>
  if (!data?.attention) return null
  const A = data.attention, S = data.sales, O = data.ops, F = data.after, team: any[] = data.team ?? [], act: any[] = data.activity ?? []
  const stages = Object.entries(S.stages ?? {}) as [string, number][]
  const tot = (S.hot ?? 0) + (S.warm ?? 0) + (S.cold ?? 0) + (S.nodate ?? 0) || 1
  const toPay = () => document.getElementById('pay-pending')?.scrollIntoView({ behavior: 'smooth' })
  return <div style={{ display: 'grid', gap: 2, marginBottom: 14 }}>
    <Sec t="Needs attention now" />
    <div className="stats">
      <Tile n={A.not_attended} label="Inquiries not attended" tone="red" onClick={() => go('inq', 'notatt')} />
      <Tile n={A.fu_overdue} label="Follow-ups overdue" tone="red" onClick={() => go('inq', 'late')} />
      <Tile n={A.not_ack} label="Work not acknowledged" tone="red" onClick={() => go('after', 'inst')} />
      <Tile n={A.packing_late} label="Packing late" tone="red" onClick={isAdmin ? () => go('inv', 'pack') : undefined} />
      <Tile n={A.pay_pending} label="Payment pending, dispatched" tone="amber" onClick={isAdmin ? toPay : undefined} />
      <Tile n={A.tix_old} label="Tickets open over 3 days" tone="amber" onClick={() => go('after', 'tix')} />
      <Tile n={A.short_parts} label="Orders short of parts" tone="amber" onClick={() => go('inv')} />
      <Tile n={A.low_stock} label="Low stock items" tone="amber" onClick={() => go('inv')} />
    </div>

    <Sec t="Sales" />
    <div className="card">
      <div className="row"><b>Inquiries in process</b><b>{S.in_process}</b></div>
      <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', background: '#e6e3d8' }}>
        <div style={{ width: `${(S.hot / tot) * 100}%`, background: '#E24B4A' }} /><div style={{ width: `${(S.warm / tot) * 100}%`, background: '#EF9F27' }} /><div style={{ width: `${(S.cold / tot) * 100}%`, background: '#85B7EB' }} /></div>
      <div className="muted"><a onClick={() => go('inq', 'temp:Hot')}>🔥 Hot {S.hot}</a> · <a onClick={() => go('inq', 'temp:Warm')}>🌤 Warm {S.warm}</a> · <a onClick={() => go('inq', 'temp:Cold')}>❄️ Cold {S.cold}</a> · <a onClick={() => go('inq', 'temp:None')}>No date {S.nodate}</a></div>
      <div className="row tapx" onClick={() => go('inq')}><span>New today</span><b>{S.new_today}</b></div>
      <div className="row tapx" onClick={() => go('inq', 'stage:Quotation Sent')}><span>Quotations sent, waiting</span><b>{S.quote_wait}</b></div>
      <div className="row tapx" onClick={() => go('inq', 'today')}><span>Follow-ups due today</span><b>{S.fu_today}</b></div>
      {stages.length > 0 && <div className="muted" style={{ marginTop: 4 }}>By stage: {stages.map(([k, v], i) => <span key={k}>{i > 0 && ' · '}<a onClick={() => go('inq', 'stage:' + k)}>{k} {v}</a></span>)}</div>}
    </div>

    <Sec t="Orders and operations" />
    <div className="stats">
      <Tile n={O.to_pack} label="To pack" onClick={isAdmin ? () => go('inv', 'pack') : undefined} />
      <Tile n={O.ready} label="Ready to dispatch" onClick={isAdmin ? () => go('inv', 'pack') : undefined} />
      <Tile n={O.dispatched_week} label="Dispatched this week" onClick={() => go('inq', 'old')} />
      <Tile n={O.install_sched} label="Installations scheduled" onClick={() => go('after', 'inst')} />
    </div>

    {F && <><Sec t="After-sales" />
      <div className="stats">
        <Tile n={F.open} label="Open tickets" onClick={() => go('after', 'tix')} />
        <Tile n={F.software} label="Software" onClick={() => go('after', 'tix:Software')} />
        <Tile n={F.technical} label="Technical" onClick={() => go('after', 'tix:Technical')} />
        <Tile n={F.repairs} label="Repair boxes open" onClick={() => go('after', 'rep')} />
        <Tile n={F.fixed_week} label="Fixed this week" onClick={() => go('after', 'tix')} />
      </div></>}

    {team.length > 0 && <><Sec t="Team: who is doing what" />
      <div className="card">
        <div className="row muted" style={{ fontWeight: 600 }}><span style={{ flex: 2 }}>Name</span><span style={{ flex: 1 }}>In</span><span style={{ flex: 1 }}>Jobs</span><span style={{ flex: 1 }}>Late</span><span style={{ flex: 1 }}>Not ack</span></div>
        {team.map((e) => <div className="row tapx" key={e.id} onClick={() => e.role === 'sales' || e.role === 'admin' ? go('inq', 'emp:' + e.id) : go('after', 'inst')}>
          <span style={{ flex: 2, minWidth: 0 }}>{e.name} <span className="muted">· {ROLE[e.role] ?? e.role}</span></span>
          <span style={{ flex: 1 }} className={e.clock_in ? '' : 'muted'}>{e.clock_in ?? 'Not in'}</span>
          <b style={{ flex: 1 }}>{e.open_jobs}</b>
          <b style={{ flex: 1, color: e.overdue > 0 ? '#b42318' : undefined }}>{e.overdue}</b>
          <b style={{ flex: 1, color: e.not_ack > 0 ? '#b42318' : undefined }}>{e.not_ack}</b></div>)}
        <div className="muted" style={{ fontSize: 12 }}>Jobs = work in hand. Late = overdue follow-ups (sales) or late packing, old tickets and missed installation dates (service).</div>
      </div></>}

    {act.length > 0 && <><Sec t="Live activity" />
      <div className="card">{act.map((a, i) => <div className={a.inq ? 'row tapx' : 'row'} key={i} onClick={a.inq ? () => go('inq', 'q:' + a.inq) : undefined}><span>{a.who ? `${a.who}: ` : ''}{a.text}{a.inq ? ` · ${a.inq}` : ''}{a.customer ? ` · ${a.customer}` : ''}</span><span className="muted">{fmtDateTime(a.at)}</span></div>)}</div></>}
  </div>
}
