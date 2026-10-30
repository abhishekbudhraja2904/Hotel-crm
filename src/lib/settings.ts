import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
export const DEFAULT_CATEGORIES = ['RFID Hotel Locks','Electronic Door Locks','RFID Cards','Access Control','Sensor-Based Entry','Automatic Sliding Doors','Hotel Lock Software','Accessories','Other']
export const DEFAULT_SOURCES = ['WhatsApp','Phone Call','Email','Website','Referral','Walk-in','Manual','Other']
// These four stages drive built-in behaviour (new inquiries, won/lost counts, dispatch, stopping follow-ups), so they stay fixed.
export const FIRST = 'New Inquiry'
export const LAST = ['Order Confirmed', 'Lost', 'On Hold']
export const DEFAULT_MID = ['Qualified','Technical Discussion','Quotation Preparation','Quotation Sent','Negotiation']
const list = (a: any, d: string[]) => (Array.isArray(a) && a.length ? a.map(String) : d)
export function normStages(a: any): string[] {
  const mid = [...new Set(list(a, [FIRST, ...DEFAULT_MID, ...LAST]).map((s) => s.trim()).filter((s) => s && s !== FIRST && !LAST.includes(s)))]
  return [FIRST, ...mid, ...LAST]
}
// Falls back to the built-in lists if nothing has been saved yet (or the settings table isn't installed).
export function useSettings() {
  const { data } = useQuery({ queryKey: ['settings'], retry: false, staleTime: 30000, queryFn: async () => {
    const { data, error } = await supabase.from('org_settings').select('key,value'); if (error) throw error
    return Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value])) as Record<string, any> } })
  const s = data ?? {}
  return { categories: list(s.categories, DEFAULT_CATEGORIES), sources: list(s.sources, DEFAULT_SOURCES), stages: normStages(s.stages) }
}
export async function saveSetting(key: string, value: any, by: string): Promise<string | null> {
  const { data: ex, error: e1 } = await supabase.from('org_settings').select('id').eq('key', key).maybeSingle()
  if (e1) return e1.message
  const { error } = ex ? await supabase.from('org_settings').update({ value, updated_by: by }).eq('id', ex.id) : await supabase.from('org_settings').insert({ key, value, updated_by: by })
  return error ? error.message : null
}
