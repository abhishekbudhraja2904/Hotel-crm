import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
// One channel; any change refetches the matching query (RLS filters events per user).
export function useRealtime() {
  const qc = useQueryClient()
  const [state, setState] = useState<'connecting' | 'live' | 'reconnecting' | 'offline'>('connecting')
  useEffect(() => {
    const ch = supabase.channel('crm-changes')
    for (const t of ['inquiries', 'followups', 'customers', 'inquiry_items', 'activity_log', 'attendance', 'inventory', 'stock_movements', 'org_settings'])
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => qc.invalidateQueries({ queryKey: [t] }))
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_parts' }, () => { qc.invalidateQueries({ queryKey: ['dispatch'] }); qc.invalidateQueries({ queryKey: ['inventory'] }) })
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => qc.invalidateQueries({ queryKey: ['lowstock'] }))
    ch.subscribe((s) => setState(s === 'SUBSCRIBED' ? 'live' : s === 'CLOSED' ? 'offline' : 'reconnecting'))
    return () => { supabase.removeChannel(ch) }
  }, [qc])
  return state
}
