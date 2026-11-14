// Hot / Warm / Cold from the date the customer needs the order.
export type Temp = 'Hot' | 'Warm' | 'Cold' | 'None'
export function tempOf(needed: string | null | undefined, hotDays: number, warmDays: number): Temp {
  if (!needed) return 'None'
  const d = Math.ceil((new Date(needed + 'T00:00:00').getTime() - new Date().setHours(0, 0, 0, 0)) / 864e5)
  return d <= hotDays ? 'Hot' : d <= warmDays ? 'Warm' : 'Cold'
}
export const TEMP_LOOK: Record<string, { icon: string; bg: string; fg: string }> = {
  Hot: { icon: '🔥', bg: '#f6d9d3', fg: '#8a2c1f' }, Warm: { icon: '🌤', bg: '#f6e8c8', fg: '#7a5a12' }, Cold: { icon: '❄️', bg: '#dbe8ef', fg: '#2c5468' } }
