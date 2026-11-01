import { supabase } from './supabase'
export const LOST_REASONS = ['Price was too high', 'Chose a competitor', 'No response from customer', 'Project cancelled or postponed', 'Other']
// Moves an inquiry stage; refuses if someone else edited it since it was loaded. Returns an error message or null.
// `extra` lets the same save carry the lost reason, so the stage and reason are written together.
export async function moveStage(r: { id: string; updated_at: string }, next: string, extra: Record<string, any> = {}): Promise<string | null> {
  const { data, error } = await supabase.from('inquiries').update({ sales_stage: next, ...extra }).eq('id', r.id).eq('updated_at', r.updated_at).select('id')
  if (error) return error.message
  if (!data?.length) return 'Someone else changed this inquiry. Latest data loaded — try again.'
  if (next === 'Order Confirmed' || next === 'Lost')
    await supabase.from('followups').update({ status: 'Cancelled' }).eq('inquiry_id', r.id).eq('status', 'Pending')
  return null
}
