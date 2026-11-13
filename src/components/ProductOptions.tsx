// Product choices grouped by category (inside a <select>), keeping the catalogue's own order.
export function productOptions(list: any[], idKey = 'id', nameKey = 'product_name') {
  const groups: Record<string, any[]> = {}, order: string[] = []
  for (const p of list) { const c = p.product_category || 'Other'; if (!groups[c]) { groups[c] = []; order.push(c) } groups[c].push(p) }
  return order.map((c) => <optgroup key={c} label={c}>{groups[c].map((p) => <option key={p[idKey]} value={p[idKey]}>{p[nameKey]}{p.product_code ? ` (${p.product_code})` : ''}</option>)}</optgroup>)
}
