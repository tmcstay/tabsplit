'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
