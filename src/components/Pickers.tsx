import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
export function useCustomers() { return useQuery({ queryKey: ['assignable-customers'], queryFn: async () => ((await supabase.rpc('assignable_customers')).data as any[]) ?? [] }) }
export function useBuyers() { return useQuery({ queryKey: ['ticket-customers'], queryFn: async () => ((await supabase.rpc('ticket_customers')).data as any[]) ?? [] }) }
// Pick the customer (name + city) the work is for: type to search the list, or type a new site by hand.
// buyersOnly: only customers who have a completed (dispatched) order.
export function CustomerPick({ site, city, onChange, buyersOnly }: { site: string; city: string; onChange: (site: string, city: string) => void; buyersOnly?: boolean }) {
  const all = useCustomers(), buyers = useBuyers(), cs = buyersOnly ? buyers : all, [other, setOther] = useState(false), [q, setQ] = useState(''), [openList, setOpenList] = useState(false)
  const list = (() => { const seen = new Set<string>(); return (cs.data ?? []).filter((c: any) => { const k = `${String(c.name).toLowerCase()}|${String(c.city ?? '').toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true }) })()
  const chosen = !other && list.find((c: any) => c.name === site && (c.city ?? '') === city)
  const shown = openList ? q : chosen ? `${chosen.name}${chosen.city ? ` · ${chosen.city}` : ''}` : ''
  const s = q.trim().toLowerCase(), hits = list.filter((c: any) => !s || `${c.name} ${c.city ?? ''}`.toLowerCase().includes(s)).slice(0, 30)
  return <>
    <label>Customer<input placeholder={buyersOnly ? 'Type to search customers with a completed order…' : 'Type to search customers…'} value={shown} onFocus={() => { setQ(''); setOpenList(true) }} onChange={(e) => { setQ(e.target.value); setOpenList(true) }} onBlur={() => setTimeout(() => setOpenList(false), 150)} />
      {openList && <div style={{ border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card, #fffdf8)', maxHeight: 220, overflowY: 'auto' }}>
        {hits.map((c: any) => <button type="button" key={c.id} className="link" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px' }} onMouseDown={(e) => e.preventDefault()} onClick={() => { setOther(false); setOpenList(false); onChange(c.name ?? '', c.city ?? '') }}>{c.name}{c.city ? ` · ${c.city}` : ''}</button>)}
        {!hits.length && <div className="muted" style={{ padding: '8px 10px' }}>No customer matches.</div>}
        <button type="button" className="link" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', fontWeight: 600 }} onMouseDown={(e) => e.preventDefault()} onClick={() => { setOther(true); setOpenList(false); onChange(q.trim(), '') }}>Someone else (type below)</button>
      </div>}</label>
    {(other || (site && !chosen)) && <label>Customer / site name<input required value={site} onChange={(e) => onChange(e.target.value, city)} /></label>}
    <label>City<input value={city} onChange={(e) => onChange(site, e.target.value)} placeholder="City of the customer" /></label>
  </>
}
export function useDesk() { return useQuery({ queryKey: ['service-desk'], queryFn: async () => ((await supabase.rpc('service_desk_info')).data ?? null) as null | { id: string; name: string; me: boolean } }) }
// Service employees plus the service desk person (a sales employee who keeps software tickets).
export function useEmpsAndDesk() { const e = useEmps(), d = useDesk(); const list = [...(e.data ?? [])] as any[]; if (d.data && !list.some((x) => x.id === d.data!.id)) list.push({ id: d.data.id, employee_name: `${d.data.name} (service desk)` }); return { data: list } }
export function useEmps() { return useQuery({ queryKey: ['employees', 'active'], queryFn: async () => (await supabase.from('employees').select('id,employee_name').eq('active', true).eq('role', 'service').order('employee_name')).data ?? [] }) }
