export const PALETTE = ['#5a7d63', '#8A6F52', '#D9C9A5', '#c08a4a', '#a8573f', '#7a8f9c', '#6B8F72']
export const FIXED: Record<string, string> = { 'New Inquiry': '#6B8F72', 'Order Confirmed': '#3f6b4a', Lost: '#9b3b30', 'On Hold': '#8b8f86' }
export const stageColour = (s: string, all: string[]) => FIXED[s] ?? PALETTE[Math.max(0, all.indexOf(s)) % PALETTE.length]
// The steps shown in the progress bar: every stage except Lost and On Hold.
export const barSteps = (stages: string[]) => stages.filter((s) => s !== 'Lost' && s !== 'On Hold')
