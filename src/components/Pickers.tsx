import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
export function useCustomers() { return useQuery({ queryKey: ['assignable-customers'], queryFn: async () => ((await supabase.rpc('assignable_customers')).data as any[]) ?? [] }) }
// Pick the customer (name + city) the work is for, or type a new site by hand.
export function CustomerPick({ site, city, onChange }: { site: string; city: string; onChange: (site: string, city: string) => void }) {
  const cs = useCustomers(), [other, setOther] = useState(false)
  const val = other ? '__other' : cs.data?.find((c: any) => c.name === site && (c.city ?? '') === city)?.id ?? ''
  return <>
    <label>Customer<select value={val} onChange={(e) => { if (e.target.value === '__other') { setOther(true); onChange('', '') } else { setOther(false); const c = cs.data?.find((x: any) => x.id === e.target.value); onChange(c?.name ?? '', c?.city ?? '') } }}>
      <option value="">Choose customer…</option>{cs.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.city ? ` · ${c.city}` : ''}</option>)}<option value="__other">Someone else (type below)</option></select></label>
    {(other || (site && !val)) && <label>Customer / site name<input required value={site} onChange={(e) => onChange(e.target.value, city)} /></label>}
    <label>City<input value={city} onChange={(e) => onChange(site, e.target.value)} placeholder="City of the customer" /></label>
  </>
}
export function useEmps() { return useQuery({ queryKey: ['employees', 'active'], queryFn: async () => (await supabase.from('employees').select('id,employee_name').eq('active', true).eq('role', 'service').order('employee_name')).data ?? [] }) }
