import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
// "Alam · 5 jobs (3 packing, 2 tickets)": what each service employee is working on right now.
export function useWorkload() {
  const q = useQuery({ queryKey: ['workload'], refetchInterval: 60000, queryFn: async () => ((await supabase.rpc('service_workload')).data ?? []) as any[] })
  const m = new Map<string, any>((q.data ?? []).map((w: any) => [w.id, w]))
  return (id: string, name: string) => {
    const w = m.get(id); if (!w) return name
    const parts = [[w.packing, 'packing'], [w.installs, 'installation'], [w.tickets, 'ticket'], [w.repairs, 'repair']].filter((x) => Number(x[0]) > 0).map((x) => `${x[0]} ${x[1]}${Number(x[0]) > 1 && x[1] !== 'packing' ? 's' : ''}`)
    const total = Number(w.packing) + Number(w.installs) + Number(w.tickets) + Number(w.repairs)
    return total ? `${name} · ${total} job${total > 1 ? 's' : ''} (${parts.join(', ')})` : `${name} · free`
  }
}
