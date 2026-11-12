import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
export const DEFAULT_CATEGORIES = ['RFID Hotel Locks','Electronic Door Locks','RFID Cards','Access Control','Sensor-Based Entry','Automatic Sliding Doors','Hotel Lock Software','Accessories','Other']
export const DEFAULT_LOST_REASONS = ['Price was too high','Chose a competitor','No response from customer','Project cancelled or postponed','Other']
export const DEFAULT_SOURCES = ['WhatsApp','Phone Call','Email','Website','Referral','Walk-in','Manual','Other']
// These four stages drive built-in behaviour (new inquiries, won/lost counts, dispatch, stopping follow-ups), so they stay fixed.
export const FIRST = 'New Inquiry'
export const LAST = ['Order Confirmed', 'Lost', 'On Hold']
export const DEFAULT_MID = ['Qualified','Technical Discussion','Quotation Preparation','Quotation Sent','Negotiation']
// Dashboard number tiles. Built-in kinds count things the app already knows; 'stage' tiles count inquiries in the chosen stages.
export type Tile = { id: string; label: string; kind: 'total' | 'today' | 'active' | 'due_today' | 'overdue' | 'stage'; stages?: string[]; period?: 'all' | 'month' | 'today'; hidden?: boolean }
export const DEFAULT_TILES: Tile[] = [
  { id: 'total', label: 'Total inquiries', kind: 'total' }, { id: 'today', label: 'New today', kind: 'today' }, { id: 'active', label: 'Active', kind: 'active' },
  { id: 'due', label: 'Follow-ups due today', kind: 'due_today' }, { id: 'overdue', label: 'Overdue follow-ups', kind: 'overdue' },
  { id: 'quotes', label: 'Quotations pending', kind: 'stage', stages: ['Quotation Sent'], period: 'all' },
  { id: 'confirmed', label: 'Orders confirmed', kind: 'stage', stages: ['Order Confirmed'], period: 'all' },
  { id: 'won', label: 'Won this month', kind: 'stage', stages: ['Order Confirmed'], period: 'month' },
  { id: 'lost', label: 'Lost this month', kind: 'stage', stages: ['Lost'], period: 'month' }]
const normTiles = (a: any): Tile[] => (Array.isArray(a) && a.length ? a.filter((t) => t && typeof t.id === 'string' && typeof t.label === 'string') : DEFAULT_TILES)
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
  const aco = s.autoClockOut ?? {}
  return { appUrl: typeof s.customerAppUrl === 'string' ? s.customerAppUrl : '', appBackupPhone: typeof s.appBackupPhone === 'string' && s.appBackupPhone ? s.appBackupPhone : '9312435438', appName: 'OFORTT', gstRate: typeof s.gstRate === 'number' && s.gstRate >= 0 ? s.gstRate : 18, requireFullPayment: s.requireFullPayment === true, autoClockOut: { time: typeof aco.time === 'string' ? aco.time : '21:00', idleMinutes: Number(aco.idleMinutes) > 0 ? Number(aco.idleMinutes) : 60 }, categories: list(s.categories, DEFAULT_CATEGORIES), kitCategories: Array.isArray(s.kitCategories) ? s.kitCategories.map(String) : [] as string[], soldTogether: (Array.isArray(s.soldTogether) ? s.soldTogether.filter((x: any) => Array.isArray(x) && x.length === 2).map((x: any) => [String(x[0]), String(x[1])]) : []) as string[][], mortis: { category: typeof s.mortisCategory === 'string' ? s.mortisCategory : '', standardId: typeof s.standardMortisId === 'string' ? s.standardMortisId : '', optionIds: Array.isArray(s.mortisOptionIds) ? s.mortisOptionIds.map(String) : [] as string[] }, sources: list(s.sources, DEFAULT_SOURCES), lostReasons: list(s.lostReasons, DEFAULT_LOST_REASONS), stages: normStages(s.stages), tiles: normTiles(s.tiles) }
}
export async function saveSetting(key: string, value: any, by: string): Promise<string | null> {
  const { data: ex, error: e1 } = await supabase.from('org_settings').select('id').eq('key', key).maybeSingle()
  if (e1) return e1.message
  const { error } = ex ? await supabase.from('org_settings').update({ value, updated_by: by }).eq('id', ex.id) : await supabase.from('org_settings').insert({ key, value, updated_by: by })
  return error ? error.message : null
}
