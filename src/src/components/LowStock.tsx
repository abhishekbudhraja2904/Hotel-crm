import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
// "N products low on stock". Everyone sees the product names; people who may see stock (admin, stock keeper) also see the numbers.
export default function LowStock({ detail }: { detail?: boolean }) {
  const [open, setOpen] = useState(false)
  const low = useQuery({ queryKey: ['lowstock'], queryFn: async () => { const { data, error } = await supabase.rpc('low_stock_names'); if (error) throw error; return data as any[] } })
  const nums = useQuery({ queryKey: ['inventory', 'overview'], enabled: !!detail, queryFn: async () => { const { data } = await supabase.rpc('stock_overview'); return (data ?? []) as any[] } })
  if (!low.data?.length) return null
  const n = low.data.length
  return <div className="warnbox" style={{ margin: '0 0 12px' }}>
    <div className="row"><b>⚠ {n} product{n > 1 ? 's' : ''} low on stock</b><button className="link" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'}</button></div>
    {open && <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>{low.data.map((p) => { const s = nums.data?.find((x) => x.product_id === p.product_id)
      return <div key={p.product_id}>{p.product_name}{p.out_of_stock && <> <span className="ptag lost">out of stock</span></>}{detail && s ? <span className="muted"> · {Number(s.in_store)} in store, alert at {Number(s.low_stock_level)}</span> : null}</div> })}</div>}
  </div>
}
