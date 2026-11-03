// Simple line icons (no extra library). One per menu area.
const P: Record<string, string> = {
  dash: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  inq: 'M4 5h16v11h-5l-2 3h-2l-2-3H4zM8 9h8M8 12h5',
  pipe: 'M4 5h16l-6 7v6l-4 2v-8z',
  fu: 'M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4',
  after: 'M14 6a4 4 0 0 0-5 5L4 16l4 4 5-5a4 4 0 0 0 5-5l-3 2-2-2z',
  time: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2',
  inv: 'M3 8l9-4 9 4v9l-9 4-9-4zM3 8l9 4 9-4M12 12v9',
  ins: 'M5 20V11M12 20V4M19 20v-6',
  team: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a2.5 2.5 0 1 0 0-5M17 14c2.5.3 4 2.4 4 5',
  quo: 'M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6',
  svc: 'M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6zM9 12l2 2 4-4',
  set: 'M5 7h9M18 7h1M5 17h1M10 17h9M14 4v6M8 14v6'
}
export default function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[name] || P.dash} /></svg>
}
