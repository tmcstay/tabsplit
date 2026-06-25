'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SplitStatus } from '@/types/database'

export async function archiveSplit(splitId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('splits')
    .update({ status: 'archived' })
    .eq('id', splitId)
    .eq('organiser_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/')
}

export async function unarchiveSplit(splitId: string): Promise<SplitStatus> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Restore to finalised if a share link exists, otherwise draft
  const { data: link } = await supabase
    .from('share_links')
    .select('id')
    .eq('split_id', splitId)
    .limit(1)
    .maybeSingle()

  const status: SplitStatus = link ? 'finalised' : 'draft'

  const { error } = await supabase
    .from('splits')
    .update({ status })
    .eq('id', splitId)
    .eq('organiser_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return status
}

export async function deleteSplit(splitId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('splits')
    .delete()
    .eq('id', splitId)
    .eq('organiser_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/')
}
