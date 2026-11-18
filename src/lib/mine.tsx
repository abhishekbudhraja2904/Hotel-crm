// "Your work" highlight: a card for work given to the person signed in gets a thick blue frame and a "YOUR WORK" tag,
// so a service employee can tell their own jobs apart from everyone else's at a glance. Mine comes first in each list.
export const isMine = (me: any, assignedId?: string | null) => !!me?.id && !!assignedId && assignedId === me.id
export const mineCls = (mine: boolean) => (mine ? ' mine' : '')
export function MineTag({ mine }: { mine: boolean }) {
  if (!mine) return null
  return <span className="minetag">⭐ YOUR WORK</span>
}
// Stable sort: my unfinished work first, then everything else in the order it came.
export function mineFirst<T>(list: T[] | undefined, mine: (x: T) => boolean, finished: (x: T) => boolean = () => false): T[] {
  const a = list ?? []
  const rank = (x: T) => (mine(x) && !finished(x) ? 0 : 1)
  return a.map((x, i) => [x, i] as const).sort((p, q) => rank(p[0]) - rank(q[0]) || p[1] - q[1]).map((p) => p[0])
}
